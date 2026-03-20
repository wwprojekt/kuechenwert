import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Building2, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Station {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  phone: string;
  email: string;
  manager_name: string | null;
  accepts_cash_payment: boolean;
  accepts_sepa_instant: boolean;
  opening_hours: any;
  is_active: boolean;
}

const AdminStations = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    address: "",
    city: "",
    postal_code: "",
    phone: "",
    email: "",
    manager_name: "",
    accepts_cash_payment: true,
    accepts_sepa_instant: true,
    opening_hours: "Mo-Fr: 9:00-18:00 Uhr",
    is_active: true,
  });

  useEffect(() => {
    fetchStations();
  }, []);

  const fetchStations = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_stations')
        .select('*')
        .order('city');

      if (error) throw error;
      setStations(data || []);
    } catch (error) {
      logger.error('Error fetching stations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStation) {
        const { error } = await supabase
          .from('purchase_stations')
          .update(formData)
          .eq('id', editingStation.id);

        if (error) throw error;
        toast({ title: "Station aktualisiert" });
      } else {
        const { error } = await supabase
          .from('purchase_stations')
          .insert([formData]);

        if (error) throw error;
        toast({ title: "Station erstellt" });
      }

      setIsDialogOpen(false);
      setEditingStation(null);
      resetForm();
      fetchStations();
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (station: Station) => {
    setEditingStation(station);
    setFormData({
      name: station.name,
      address: station.address,
      city: station.city,
      postal_code: station.postal_code,
      phone: station.phone,
      email: station.email,
      manager_name: station.manager_name || "",
      accepts_cash_payment: station.accepts_cash_payment,
      accepts_sepa_instant: station.accepts_sepa_instant,
      opening_hours: station.opening_hours || "",
      is_active: station.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Möchten Sie diese Station wirklich löschen?")) return;

    try {
      const { error } = await supabase
        .from('purchase_stations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Station gelöscht" });
      fetchStations();
    } catch (error: any) {
      toast({
        title: "Fehler",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      city: "",
      postal_code: "",
      phone: "",
      email: "",
      manager_name: "",
      accepts_cash_payment: true,
      accepts_sepa_instant: true,
      opening_hours: "Mo-Fr: 9:00-18:00 Uhr",
      is_active: true,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="w-8 h-8" />
            Ankaufstationen
          </h1>
          <p className="text-muted-foreground mt-1">
            Verwaltung der Ankaufstationen
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setEditingStation(null); }}>
              <Plus className="w-4 h-4 mr-2" />
              Neue Station
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingStation ? "Station bearbeiten" : "Neue Station erstellen"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">Stadt *</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adresse *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="postal_code">PLZ *</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manager_name">Ansprechpartner</Label>
                  <Input
                    id="manager_name"
                    value={formData.manager_name}
                    onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="opening_hours">Öffnungszeiten</Label>
                <Textarea
                  id="opening_hours"
                  value={formData.opening_hours}
                  onChange={(e) => setFormData({ ...formData, opening_hours: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cash">Barzahlung akzeptieren</Label>
                  <Switch
                    id="cash"
                    checked={formData.accepts_cash_payment}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, accepts_cash_payment: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="sepa">SEPA Instant akzeptieren</Label>
                  <Switch
                    id="sepa"
                    checked={formData.accepts_sepa_instant}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, accepts_sepa_instant: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="active">Station aktiv</Label>
                  <Switch
                    id="active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, is_active: checked })
                    }
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  {editingStation ? "Aktualisieren" : "Erstellen"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Abbrechen
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Lade Stationen...</p>
          </Card>
        ) : stations.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Noch keine Stationen vorhanden</p>
          </Card>
        ) : (
          stations.map((station) => (
            <Card key={station.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {station.name}
                      {!station.is_active && (
                        <span className="text-xs px-2 py-1 bg-muted rounded">Inaktiv</span>
                      )}
                    </CardTitle>
                    <CardDescription>{station.city}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(station)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={() => handleDelete(station.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium mb-1">Adresse:</p>
                    <p className="text-muted-foreground">
                      {station.address}<br />
                      {station.postal_code} {station.city}
                    </p>
                  </div>
                  <div>
                    <p className="font-medium mb-1">Kontakt:</p>
                    <p className="text-muted-foreground">
                      Tel: {station.phone}<br />
                      E-Mail: {station.email}
                    </p>
                  </div>
                  {station.manager_name && (
                    <div>
                      <p className="font-medium mb-1">Ansprechpartner:</p>
                      <p className="text-muted-foreground">{station.manager_name}</p>
                    </div>
                  )}
                  <div>
                    <p className="font-medium mb-1">Zahlungsmethoden:</p>
                    <p className="text-muted-foreground">
                      {station.accepts_cash_payment && "Barzahlung"}
                      {station.accepts_cash_payment && station.accepts_sepa_instant && ", "}
                      {station.accepts_sepa_instant && "SEPA Instant"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminStations;