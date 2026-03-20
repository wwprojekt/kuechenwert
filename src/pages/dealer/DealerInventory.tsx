import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useAuth } from "@/contexts/AuthContext";
import { Package, Search, Calendar, Euro, Eye } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface InventoryItem {
  id: string;
  manufacturer: string;
  model: string;
  year: number;
  mileage: number;
  status: string;
  purchased_at: string;
  purchase_price: number;
  photos: Array<{ photo_url: string }>;
}

const DealerInventory = () => {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchInventory = useCallback(async () => {
    try {
      // Get motorhomes that the dealer has won/purchased
      const { data, error } = await supabase
        .from('motorhomes')
        .select('*, motorhome_photos(*)')
        .eq('sold_to', user?.id)
        .order('sold_at', { ascending: false });

      if (error) throw error;

      const formattedData = data?.map(item => ({
        id: item.id,
        manufacturer: item.manufacturer,
        model: item.model,
        year: item.year,
        mileage: item.mileage,
        status: item.status,
        purchased_at: item.sold_at,
        purchase_price: item.instant_price || 0,
        photos: item.motorhome_photos || [],
      })) || [];

      setInventory(formattedData);
    } catch (error) {
      logger.error('Error fetching inventory:', error);
      toast.error('Fehler beim Laden des Inventars');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      fetchInventory();
    }
  }, [user, fetchInventory]);

  const filteredInventory = inventory.filter(item =>
    `${item.manufacturer} ${item.model}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Inventar</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihre erworbenen Wohnmobile
          </p>
        </div>
        <Badge variant="secondary" className="text-lg px-4 py-2">
          {inventory.length} Fahrzeuge
        </Badge>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Suchen Sie nach Hersteller oder Modell..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Inventory Grid */}
      {filteredInventory.length === 0 ? (
        <Card className="p-12">
          <div className="text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {searchTerm ? 'Keine Ergebnisse gefunden' : 'Kein Inventar vorhanden'}
            </h3>
            <p className="text-muted-foreground mb-6">
              {searchTerm 
                ? 'Versuchen Sie einen anderen Suchbegriff' 
                : 'Gewinnen Sie Auktionen, um Fahrzeuge zu Ihrem Inventar hinzuzufügen'}
            </p>
            {!searchTerm && (
              <Button asChild>
                <Link to="/kaufen">Auktionen durchsuchen</Link>
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredInventory.map((item) => {
            const firstPhoto = item.photos?.sort((a: any, b: any) => 
              a.display_order - b.display_order
            )[0]?.photo_url;

            return (
              <Card key={item.id} className="overflow-hidden hover-lift">
                <div className="aspect-video bg-muted relative overflow-hidden">
                  {firstPhoto ? (
                    <img
                      src={firstPhoto}
                      alt={`${item.manufacturer} ${item.model}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      Kein Bild
                    </div>
                  )}
                  <Badge className="absolute top-3 right-3">
                    {item.status === 'sold' ? 'Verkauft' : 'Verfügbar'}
                  </Badge>
                </div>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {item.manufacturer} {item.model}
                  </CardTitle>
                  <CardDescription>
                    {item.year} • {item.mileage.toLocaleString('de-DE')} km
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(item.purchased_at).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 font-semibold">
                      <Euro className="h-4 w-4" />
                      {item.purchase_price.toLocaleString('de-DE')}
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to={`/dashboard/listings/${item.id}`}>
                      <Eye className="h-4 w-4 mr-2" />
                      Details ansehen
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DealerInventory;
