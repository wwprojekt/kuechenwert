import { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useAuth } from "@/contexts/AuthContext";
import { useLiveData } from "@/hooks/useLiveData";
import { Package, Search, Calendar, Euro, ArrowUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  photos: Array<{ url: string }>;
}

const DealerInventory = () => {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'name'>('newest');

  const fetchInventory = useCallback(async () => {
    try {
      // Get kitchens that the dealer has won/purchased
      const { data, error } = await supabase
        .from('kitchens')
        .select('*, kitchen_photos(*)')
        .eq('sold_to', user?.id)
        .order('sold_at', { ascending: false });

      if (error) throw error;

      // Also fetch the auction data to get the actual purchase price (current_bid)
      const kitchenIds = data?.map(item => item.id) || [];
      let auctionPriceMap: Record<string, number> = {};
      
      if (kitchenIds.length > 0) {
        const { data: auctionsData } = await supabase
          .from('auctions')
          .select('kitchen_id, current_bid')
          .in('kitchen_id', kitchenIds)
          .in('status', ['sold', 'ended']);
        
        auctionPriceMap = (auctionsData || []).reduce((acc, a) => {
          // Use the highest bid as purchase price
          if (!acc[a.kitchen_id] || Number(a.current_bid) > acc[a.kitchen_id]) {
            acc[a.kitchen_id] = Number(a.current_bid) || 0;
          }
          return acc;
        }, {} as Record<string, number>);
      }

      const formattedData = data?.map(item => ({
        id: item.id,
        manufacturer: item.manufacturer,
        model: item.model,
        year: item.year,
        mileage: item.mileage,
        status: item.status,
        purchased_at: item.sold_at,
        // Bug 2.3 fix: Use auction current_bid as purchase price, fallback to instant_price
        purchase_price: auctionPriceMap[item.id] || item.instant_price || 0,
        photos: item.kitchen_photos || [],
      })) || [];

      setInventory(formattedData);
    } catch (error) {
      logger.error('Error fetching inventory:', error);
      toast.error('Fehler beim Laden des Inventars');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useLiveData(fetchInventory, { enabled: !!user, pollingInterval: 0 });

  const filteredInventory = inventory.filter(item =>
    `${item.manufacturer} ${item.model}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedInventory = useMemo(() => {
    const sorted = [...filteredInventory];
    switch (sortBy) {
      case 'newest': return sorted.sort((a, b) => new Date(b.purchased_at).getTime() - new Date(a.purchased_at).getTime());
      case 'oldest': return sorted.sort((a, b) => new Date(a.purchased_at).getTime() - new Date(b.purchased_at).getTime());
      case 'price_asc': return sorted.sort((a, b) => a.purchase_price - b.purchase_price);
      case 'price_desc': return sorted.sort((a, b) => b.purchase_price - a.purchase_price);
      case 'name': return sorted.sort((a, b) => `${a.manufacturer} ${a.model}`.localeCompare(`${b.manufacturer} ${b.model}`));
      default: return sorted;
    }
  }, [filteredInventory, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold mb-0.5">Inventar</h1>
          <p className="text-sm text-muted-foreground">
            Verwalten Sie Ihre erworbenen Küchen
          </p>
        </div>
        <Badge variant="secondary" className="text-sm px-3 py-1">
          {inventory.length} Fahrzeuge
        </Badge>
      </div>

      {/* Search & Sort */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Suchen Sie nach Hersteller oder Modell..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Sortieren" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Neueste zuerst</SelectItem>
                <SelectItem value="oldest">Älteste zuerst</SelectItem>
                <SelectItem value="price_desc">Preis absteigend</SelectItem>
                <SelectItem value="price_asc">Preis aufsteigend</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Grid */}
      {filteredInventory.length === 0 ? (
        <Card className="p-8">
          <div className="text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-lg font-semibold mb-1">
              {searchTerm ? 'Keine Ergebnisse gefunden' : 'Kein Inventar vorhanden'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchTerm 
                ? 'Versuchen Sie einen anderen Suchbegriff' 
                : 'Gewinnen Sie Auktionen, um Fahrzeuge zu Ihrem Inventar hinzuzufügen'}
            </p>
            {!searchTerm && (
              <Button size="sm" asChild>
                <Link to="/kaufen">Auktionen durchsuchen</Link>
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {sortedInventory.map((item) => {
            const itemPhotos = Array.isArray(item.photos) ? item.photos : item.photos ? [item.photos] : [];
            const firstPhotoObj = itemPhotos.sort((a: any, b: any) =>
              a.display_order - b.display_order
            )[0];
            const firstPhoto = firstPhotoObj?.card_url || firstPhotoObj?.url;

            return (
              <Link
                key={item.id}
                to={`/dashboard/inventory/${item.id}`}
                className="block group"
              >
                <Card className="overflow-hidden border hover:border-primary/40 transition-all duration-200 hover:shadow-md cursor-pointer h-full bg-card">
                  <div className="flex flex-row h-full">
                    {/* Thumbnail */}
                    <div className="relative w-28 sm:w-32 flex-shrink-0">
                      {firstPhoto ? (
                        <img
                          src={firstPhoto}
                          alt={`${item.manufacturer} ${item.model}`}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted">
                          <Package className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <Badge className="absolute top-1.5 right-1.5 text-[10px] px-1.5 py-0.5">
                        {item.status === 'sold' ? 'Verkauft' : 'Verfügbar'}
                      </Badge>
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                      <div>
                        <h3 className="font-semibold text-sm leading-tight line-clamp-1 text-foreground group-hover:text-primary transition-colors">
                          {item.manufacturer} {item.model}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.year} · {item.mileage.toLocaleString('de-DE')} km
                        </p>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/40">
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(item.purchased_at).toLocaleDateString('de-DE')}
                        </span>
                        <span className="text-xs font-semibold flex items-center gap-0.5">
                          <Euro className="w-3 h-3" />
                          {item.purchase_price.toLocaleString('de-DE')}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DealerInventory;
