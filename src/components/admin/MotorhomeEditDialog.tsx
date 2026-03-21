/**
 * Dialog to edit motorhome details in the admin panel
 */

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save } from "lucide-react";
import { logger } from "@/lib/logger";

interface MotorhomeData {
  id: string;
  manufacturer: string;
  model: string;
  year: number;
  mileage: number;
  condition: string;
  body_type: string;
  description: string | null;
  sale_channel: string;
  instant_price: number | null;
  reserve_price: number | null;
  fuel_type: string | null;
  power_kw: number | null;
  engine_power_hp: number | null;
  transmission: string | null;
  accident_free: boolean | null;
  non_smoker: boolean | null;
  service_history_available: boolean | null;
  length_m: number | null;
  width_m: number | null;
  height_m: number | null;
  weight_kg: number | null;
  sleeping_places: number | null;
  seats: number | null;
  has_kitchen: boolean | null;
  has_bathroom: boolean;
  has_toilet: boolean | null;
  has_shower: boolean | null;
  has_solar: boolean;
  has_awning: boolean;
  has_tv: boolean | null;
  has_backup_camera: boolean | null;
  additional_equipment: string | null;
}

interface MotorhomeEditDialogProps {
  motorhome: MotorhomeData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONDITIONS = [
  { value: "new", label: "Neu" },
  { value: "like_new", label: "Wie neu" },
  { value: "excellent", label: "Ausgezeichnet" },
  { value: "good", label: "Gut" },
  { value: "fair", label: "Befriedigend" },
  { value: "poor", label: "Renovierungsbedürftig" },
];

const BODY_TYPES = [
  { value: "integrated", label: "Integriert" },
  { value: "semi_integrated", label: "Teilintegriert" },
  { value: "alcove", label: "Alkoven" },
  { value: "camper_van", label: "Kastenwagen" },
  { value: "low_profile", label: "Flachboden" },
  { value: "caravan", label: "Wohnwagen" },
];

const SALE_CHANNELS = [
  { value: "auction", label: "Auktion" },
  { value: "instant_sale", label: "Sofortverkauf" },
  { value: "both", label: "Beides" },
  { value: "station", label: "Ankaufstation" },
];

const FUEL_TYPES = [
  { value: "diesel", label: "Diesel" },
  { value: "petrol", label: "Benzin" },
  { value: "electric", label: "Elektro" },
  { value: "hybrid", label: "Hybrid" },
  { value: "lpg", label: "LPG" },
];

export function MotorhomeEditDialog({
  motorhome,
  open,
  onOpenChange,
}: MotorhomeEditDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<MotorhomeData>>({});

  useEffect(() => {
    if (motorhome) {
      setFormData(motorhome);
    }
  }, [motorhome]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<MotorhomeData>) => {
      if (!motorhome?.id) throw new Error("No motorhome ID");

      const { error } = await supabase
        .from("motorhomes")
        .update({
          manufacturer: data.manufacturer,
          model: data.model,
          year: data.year,
          mileage: data.mileage,
          condition: data.condition,
          body_type: data.body_type,
          description: data.description,
          sale_channel: data.sale_channel,
          instant_price: data.instant_price,
          reserve_price: data.reserve_price,
          fuel_type: data.fuel_type,
          power_kw: data.power_kw,
          engine_power_hp: data.engine_power_hp,
          transmission: data.transmission,
          accident_free: data.accident_free,
          non_smoker: data.non_smoker,
          service_history_available: data.service_history_available,
          length_m: data.length_m,
          width_m: data.width_m,
          height_m: data.height_m,
          weight_kg: data.weight_kg,
          sleeping_places: data.sleeping_places,
          seats: data.seats,
          has_kitchen: data.has_kitchen,
          has_bathroom: data.has_bathroom,
          has_toilet: data.has_toilet,
          has_shower: data.has_shower,
          has_solar: data.has_solar,
          has_awning: data.has_awning,
          has_tv: data.has_tv,
          has_backup_camera: data.has_backup_camera,
          additional_equipment: data.additional_equipment,
        })
        .eq("id", motorhome.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminMotorhomes"] });
      toast({
        title: "Gespeichert",
        description: "Wohnmobil wurde erfolgreich aktualisiert.",
      });
      onOpenChange(false);
    },
    onError: (error) => {
      logger.error("Update error:", error);
      toast({
        title: "Fehler",
        description: "Wohnmobil konnte nicht aktualisiert werden.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(formData);
  };

  const updateField = <K extends keyof MotorhomeData>(
    field: K,
    value: MotorhomeData[K]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (!motorhome) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Wohnmobil bearbeiten</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basis</TabsTrigger>
              <TabsTrigger value="technical">Technik</TabsTrigger>
              <TabsTrigger value="dimensions">Maße</TabsTrigger>
              <TabsTrigger value="equipment">Ausstattung</TabsTrigger>
            </TabsList>

            {/* Basic Tab */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Hersteller</Label>
                  <Input
                    id="manufacturer"
                    value={formData.manufacturer || ""}
                    onChange={(e) => updateField("manufacturer", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Modell</Label>
                  <Input
                    id="model"
                    value={formData.model || ""}
                    onChange={(e) => updateField("model", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="year">Baujahr</Label>
                  <Input
                    id="year"
                    type="number"
                    value={formData.year || ""}
                    onChange={(e) => updateField("year", parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mileage">Kilometerstand</Label>
                  <Input
                    id="mileage"
                    type="number"
                    value={formData.mileage || ""}
                    onChange={(e) => updateField("mileage", parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Zustand</Label>
                  <Select
                    value={formData.condition || ""}
                    onValueChange={(value) => updateField("condition", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Zustand wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Aufbauart</Label>
                  <Select
                    value={formData.body_type || ""}
                    onValueChange={(value) => updateField("body_type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Aufbauart wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {BODY_TYPES.map((b) => (
                        <SelectItem key={b.value} value={b.value}>
                          {b.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Verkaufsweg</Label>
                <Select
                  value={formData.sale_channel || ""}
                  onValueChange={(value) => updateField("sale_channel", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Verkaufsweg wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {SALE_CHANNELS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="instant_price">Sofortpreis (€)</Label>
                  <Input
                    id="instant_price"
                    type="number"
                    value={formData.instant_price || ""}
                    onChange={(e) => updateField("instant_price", parseInt(e.target.value) || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reserve_price">Mindestpreis (€)</Label>
                  <Input
                    id="reserve_price"
                    type="number"
                    value={formData.reserve_price || ""}
                    onChange={(e) => updateField("reserve_price", parseInt(e.target.value) || null)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  rows={4}
                  value={formData.description || ""}
                  onChange={(e) => updateField("description", e.target.value)}
                />
              </div>
            </TabsContent>

            {/* Technical Tab */}
            <TabsContent value="technical" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kraftstoff</Label>
                  <Select
                    value={formData.fuel_type || ""}
                    onValueChange={(value) => updateField("fuel_type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Kraftstoff wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {FUEL_TYPES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="engine_power_hp">Leistung (PS)</Label>
                  <Input
                    id="engine_power_hp"
                    type="number"
                    value={formData.engine_power_hp || ""}
                    onChange={(e) => updateField("engine_power_hp", parseInt(e.target.value) || null)}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="accident_free">Unfallfrei</Label>
                  <Switch
                    id="accident_free"
                    checked={formData.accident_free || false}
                    onCheckedChange={(checked) => updateField("accident_free", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="non_smoker">Nichtraucherfahrzeug</Label>
                  <Switch
                    id="non_smoker"
                    checked={formData.non_smoker || false}
                    onCheckedChange={(checked) => updateField("non_smoker", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="service_history">Scheckheft gepflegt</Label>
                  <Switch
                    id="service_history"
                    checked={formData.service_history_available || false}
                    onCheckedChange={(checked) => updateField("service_history_available", checked)}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Dimensions Tab */}
            <TabsContent value="dimensions" className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="length_m">Länge (cm)</Label>
                  <Input
                    id="length_m"
                    type="number"
                    value={formData.length_m || ""}
                    onChange={(e) => updateField("length_m", parseInt(e.target.value) || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="width_m">Breite (cm)</Label>
                  <Input
                    id="width_m"
                    type="number"
                    value={formData.width_m || ""}
                    onChange={(e) => updateField("width_m", parseInt(e.target.value) || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height_m">Höhe (cm)</Label>
                  <Input
                    id="height_m"
                    type="number"
                    value={formData.height_m || ""}
                    onChange={(e) => updateField("height_m", parseInt(e.target.value) || null)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight_kg">Gesamtgewicht (kg)</Label>
                  <Input
                    id="weight_kg"
                    type="number"
                    value={formData.weight_kg || ""}
                    onChange={(e) => updateField("weight_kg", parseInt(e.target.value) || null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sleeping_places">Schlafplätze</Label>
                  <Input
                    id="sleeping_places"
                    type="number"
                    value={formData.sleeping_places || ""}
                    onChange={(e) => updateField("sleeping_places", parseInt(e.target.value) || null)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="seats">Sitzplätze mit Gurt</Label>
                <Input
                  id="seats"
                  type="number"
                  value={formData.seats || ""}
                  onChange={(e) => updateField("seats", parseInt(e.target.value) || null)}
                />
              </div>
            </TabsContent>

            {/* Equipment Tab */}
            <TabsContent value="equipment" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="has_kitchen">Küche</Label>
                  <Switch
                    id="has_kitchen"
                    checked={formData.has_kitchen || false}
                    onCheckedChange={(checked) => updateField("has_kitchen", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="has_bathroom">Badezimmer</Label>
                  <Switch
                    id="has_bathroom"
                    checked={formData.has_bathroom || false}
                    onCheckedChange={(checked) => updateField("has_bathroom", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="has_toilet">Toilette</Label>
                  <Switch
                    id="has_toilet"
                    checked={formData.has_toilet || false}
                    onCheckedChange={(checked) => updateField("has_toilet", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="has_shower">Dusche</Label>
                  <Switch
                    id="has_shower"
                    checked={formData.has_shower || false}
                    onCheckedChange={(checked) => updateField("has_shower", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="has_solar">Solaranlage</Label>
                  <Switch
                    id="has_solar"
                    checked={formData.has_solar || false}
                    onCheckedChange={(checked) => updateField("has_solar", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="has_awning">Markise</Label>
                  <Switch
                    id="has_awning"
                    checked={formData.has_awning || false}
                    onCheckedChange={(checked) => updateField("has_awning", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="has_tv">TV/SAT</Label>
                  <Switch
                    id="has_tv"
                    checked={formData.has_tv || false}
                    onCheckedChange={(checked) => updateField("has_tv", checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="has_backup_camera">Rückfahrkamera</Label>
                  <Switch
                    id="has_backup_camera"
                    checked={formData.has_backup_camera || false}
                    onCheckedChange={(checked) => updateField("has_backup_camera", checked)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="additional_equipment">Zusatzausstattung</Label>
                <Textarea
                  id="additional_equipment"
                  rows={3}
                  value={formData.additional_equipment || ""}
                  onChange={(e) => updateField("additional_equipment", e.target.value)}
                  placeholder="Weitere Ausstattungsmerkmale..."
                />
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
