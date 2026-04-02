/**
 * Dialog to edit motorhome details in the admin panel
 * Comprehensive edit form with all database fields organized in tabs
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
  // Basis
  manufacturer: string;
  model: string;
  year: number;
  first_registration: string | null;
  mileage: number;
  condition: string;
  body_type: string;
  previous_owners: number | null;
  status: string;
  listing_number: string | null;
  // Preise & Verkauf
  price: number | null;
  instant_price: number | null;
  reserve_price: number | null;
  sale_channel: string;
  sale_type: string | null;
  available_from: string | null;
  // Technik
  fuel_type: string | null;
  power_kw: number | null;
  engine_power_hp: number | null;
  engine_displacement_ccm: number | null;
  transmission: string | null;
  emission_class: string | null;
  vehicle_identification_number: string | null;
  license_plate: string | null;
  has_tuev: boolean | null;
  tuev_valid_until: string | null;
  last_tuev_date: string | null;
  number_of_axles: number | null;
  fuel_tank_capacity_liters: number | null;
  main_tires: string | null;
  second_tires: string | null;
  // Zustand
  accident_free: boolean | null;
  non_smoker: boolean | null;
  service_history_available: boolean | null;
  has_damage: boolean | null;
  damage_summary: string | null;
  // Maße & Gewicht
  length_m: number | null;
  width_m: number | null;
  height_m: number | null;
  weight_kg: number | null;
  payload_kg: number | null;
  sleeping_places: number | null;
  seats: number | null;
  // Wohnbereich
  water_tank_liters: number | null;
  grey_water_capacity_liters: number | null;
  battery_capacity_ah: number | null;
  solar_power_watts: number | null;
  heating_type: string | null;
  has_heating: boolean | null;
  refrigerator_type: string | null;
  air_conditioning_type: string | null;
  gas_system: string | null;
  beds_description: string | null;
  awning_length_m: number | null;
  // Ausstattung
  has_kitchen: boolean | null;
  has_bathroom: boolean | null;
  has_toilet: boolean | null;
  has_shower: boolean | null;
  has_solar: boolean | null;
  has_awning: boolean | null;
  has_awning_tent: boolean | null;
  has_roof_ac: boolean | null;
  has_stand_ac: boolean | null;
  has_tv: boolean | null;
  has_backup_camera: boolean | null;
  has_air_conditioning: boolean | null;
  has_airbag: boolean | null;
  has_alarm: boolean | null;
  has_bike_rack: boolean | null;
  has_central_locking: boolean | null;
  has_cruise_control: boolean | null;
  has_esp: boolean | null;
  has_garage: boolean | null;
  has_inverter: boolean | null;
  has_markise: boolean | null;
  has_navigation: boolean | null;
  has_parking_sensors: boolean | null;
  has_satellite: boolean | null;
  has_swivel_seats: boolean | null;
  additional_equipment: string | null;
  // Standort
  postal_code: string | null;
  city: string | null;
  country: string | null;
  location: string | null;
  // Beschreibung
  description: string | null;
}

interface MotorhomeEditDialogProps {
  motorhome: MotorhomeData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONDITIONS = [
  { value: "Neuwertig", label: "Neuwertig" },
  { value: "Sehr gut", label: "Sehr gut" },
  { value: "Gut", label: "Gut" },
  { value: "Befriedigend", label: "Befriedigend" },
  { value: "Reparaturbedürftig", label: "Reparaturbedürftig" },
];

const BODY_TYPES = [
  { value: "Teilintegriert", label: "Teilintegriert" },
  { value: "Alkoven", label: "Alkoven" },
  { value: "Vollintegriert", label: "Vollintegriert" },
  { value: "Kastenwagen", label: "Kastenwagen" },
  { value: "Campingbus", label: "Campingbus" },
  { value: "Wohnwagen", label: "Wohnwagen" },
  { value: "Faltcaravan", label: "Faltcaravan" },
  { value: "Mobilheim", label: "Mobilheim" },
];

const SALE_CHANNELS = [
  { value: "instant_price", label: "Sofortpreis" },
  { value: "auction", label: "Händler-Auktion" },
  { value: "station", label: "Ankaufstation" },
];

const FUEL_TYPES = [
  { value: "Diesel", label: "Diesel" },
  { value: "Benzin", label: "Benzin" },
  { value: "Elektro", label: "Elektro" },
  { value: "Hybrid", label: "Hybrid" },
];

const TRANSMISSIONS = [
  { value: "Schaltgetriebe", label: "Schaltgetriebe" },
  { value: "Automatik", label: "Automatik" },
];

const EMISSION_CLASSES = [
  { value: "Euro 3", label: "Euro 3" },
  { value: "Euro 4", label: "Euro 4" },
  { value: "Euro 5", label: "Euro 5" },
  { value: "Euro 6", label: "Euro 6" },
  { value: "Euro 6c", label: "Euro 6c" },
  { value: "Euro 6d-TEMP", label: "Euro 6d-TEMP" },
  { value: "Euro 6d", label: "Euro 6d" },
];

const HEATING_TYPES = [
  { value: "Gas", label: "Gas" },
  { value: "Diesel", label: "Diesel" },
  { value: "Elektrisch", label: "Elektrisch" },
  { value: "Kombiniert", label: "Kombiniert" },
];

const REFRIGERATOR_TYPES = [
  { value: "Kompressor", label: "Kompressor" },
  { value: "Absorber", label: "Absorber" },
  { value: "Thermoelektrisch", label: "Thermoelektrisch" },
];

const AC_TYPES = [
  { value: "Keine", label: "Keine" },
  { value: "Fahrerhaus", label: "Fahrerhaus" },
  { value: "Wohnraum", label: "Wohnraum" },
  { value: "Beides", label: "Beides" },
];

const STATUSES = [
  { value: "draft", label: "Entwurf" },
  { value: "pending_review", label: "Prüfung ausstehend" },
  { value: "available", label: "Verfügbar" },
  { value: "reserved", label: "Reserviert" },
  { value: "sold", label: "Verkauft" },
  { value: "archived", label: "Archiviert" },
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
          // Basis
          manufacturer: data.manufacturer,
          model: data.model,
          year: data.year,
          first_registration: data.first_registration,
          mileage: data.mileage,
          condition: data.condition,
          body_type: data.body_type,
          previous_owners: data.previous_owners,
          status: data.status,
          // Preise & Verkauf
          price: data.price,
          instant_price: data.instant_price,
          reserve_price: data.reserve_price,
          sale_channel: data.sale_channel,
          sale_type: data.sale_type,
          available_from: data.available_from,
          // Technik
          fuel_type: data.fuel_type,
          power_kw: data.power_kw,
          engine_power_hp: data.engine_power_hp,
          engine_displacement_ccm: data.engine_displacement_ccm,
          transmission: data.transmission,
          emission_class: data.emission_class,
          vehicle_identification_number: data.vehicle_identification_number,
          license_plate: data.license_plate,
          has_tuev: data.has_tuev,
          tuev_valid_until: data.tuev_valid_until,
          last_tuev_date: data.last_tuev_date,
          number_of_axles: data.number_of_axles,
          fuel_tank_capacity_liters: data.fuel_tank_capacity_liters,
          main_tires: data.main_tires,
          second_tires: data.second_tires,
          // Zustand
          accident_free: data.accident_free,
          non_smoker: data.non_smoker,
          service_history_available: data.service_history_available,
          has_damage: data.has_damage,
          damage_summary: data.damage_summary,
          // Maße & Gewicht
          length_m: data.length_m,
          width_m: data.width_m,
          height_m: data.height_m,
          weight_kg: data.weight_kg,
          payload_kg: data.payload_kg,
          sleeping_places: data.sleeping_places,
          seats: data.seats,
          // Wohnbereich
          water_tank_liters: data.water_tank_liters,
          grey_water_capacity_liters: data.grey_water_capacity_liters,
          battery_capacity_ah: data.battery_capacity_ah,
          solar_power_watts: data.solar_power_watts,
          heating_type: data.heating_type,
          has_heating: data.has_heating,
          refrigerator_type: data.refrigerator_type,
          air_conditioning_type: data.air_conditioning_type,
          gas_system: data.gas_system,
          beds_description: data.beds_description,
          awning_length_m: data.awning_length_m,
          // Ausstattung
          has_kitchen: data.has_kitchen,
          has_bathroom: data.has_bathroom,
          has_toilet: data.has_toilet,
          has_shower: data.has_shower,
          has_solar: data.has_solar,
          has_awning: data.has_awning,
          has_awning_tent: data.has_awning_tent,
          has_roof_ac: data.has_roof_ac,
          has_stand_ac: data.has_stand_ac,
          has_tv: data.has_tv,
          has_backup_camera: data.has_backup_camera,
          has_air_conditioning: data.has_air_conditioning,
          has_airbag: data.has_airbag,
          has_alarm: data.has_alarm,
          has_bike_rack: data.has_bike_rack,
          has_central_locking: data.has_central_locking,
          has_cruise_control: data.has_cruise_control,
          has_esp: data.has_esp,
          has_garage: data.has_garage,
          has_inverter: data.has_inverter,
          has_markise: data.has_markise,
          has_navigation: data.has_navigation,
          has_parking_sensors: data.has_parking_sensors,
          has_satellite: data.has_satellite,
          has_swivel_seats: data.has_swivel_seats,
          additional_equipment: data.additional_equipment,
          // Standort
          postal_code: data.postal_code,
          city: data.city,
          country: data.country,
          location: data.location,
          // Beschreibung
          description: data.description,
        })
        .eq("id", motorhome.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminMotorhomes"] });
      queryClient.invalidateQueries({ queryKey: ["adminMotorhome"] });
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

  // Helper for select fields with optional "clear" option
  const renderSelect = (
    field: keyof MotorhomeData,
    label: string,
    options: { value: string; label: string }[],
    placeholder: string
  ) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={(formData[field] as string) || ""}
        onValueChange={(value) => updateField(field, value === "__clear__" ? null : value as any)}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__clear__">
            <span className="text-muted-foreground">— Keine Auswahl —</span>
          </SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // Helper for number input fields
  const renderNumberInput = (
    field: keyof MotorhomeData,
    label: string,
    placeholder?: string,
    step?: string
  ) => (
    <div className="space-y-2">
      <Label htmlFor={field}>{label}</Label>
      <Input
        id={field}
        type="number"
        step={step}
        value={(formData[field] as number) ?? ""}
        onChange={(e) => {
          const val = e.target.value;
          updateField(field, val === "" ? null : (step ? parseFloat(val) : parseInt(val)) as any);
        }}
        placeholder={placeholder}
      />
    </div>
  );

  // Helper for text input fields
  const renderTextInput = (
    field: keyof MotorhomeData,
    label: string,
    placeholder?: string,
    maxLength?: number
  ) => (
    <div className="space-y-2">
      <Label htmlFor={field}>{label}</Label>
      <Input
        id={field}
        value={(formData[field] as string) || ""}
        onChange={(e) => updateField(field, e.target.value as any)}
        placeholder={placeholder}
        maxLength={maxLength}
      />
    </div>
  );

  // Helper for date input fields
  const renderDateInput = (
    field: keyof MotorhomeData,
    label: string
  ) => (
    <div className="space-y-2">
      <Label htmlFor={field}>{label}</Label>
      <Input
        id={field}
        type="date"
        value={(formData[field] as string) || ""}
        onChange={(e) => updateField(field, e.target.value || null as any)}
      />
    </div>
  );

  // Helper for switch fields
  const renderSwitch = (
    field: keyof MotorhomeData,
    label: string
  ) => (
    <div className="flex items-center justify-between">
      <Label htmlFor={field}>{label}</Label>
      <Switch
        id={field}
        checked={(formData[field] as boolean) || false}
        onCheckedChange={(checked) => updateField(field, checked as any)}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Wohnmobil bearbeiten</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[65vh] pr-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7 h-auto">
              <TabsTrigger value="basic" className="text-xs">Basis</TabsTrigger>
              <TabsTrigger value="prices" className="text-xs">Preise</TabsTrigger>
              <TabsTrigger value="technical" className="text-xs">Technik</TabsTrigger>
              <TabsTrigger value="dimensions" className="text-xs">Maße</TabsTrigger>
              <TabsTrigger value="living" className="text-xs">Wohnbereich</TabsTrigger>
              <TabsTrigger value="equipment" className="text-xs">Ausstattung</TabsTrigger>
              <TabsTrigger value="other" className="text-xs">Sonstiges</TabsTrigger>
            </TabsList>

            {/* ===== BASIS TAB ===== */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                {renderTextInput("manufacturer", "Hersteller")}
                {renderTextInput("model", "Modell")}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {renderNumberInput("year", "Baujahr")}
                {renderDateInput("first_registration", "Erstzulassung")}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {renderNumberInput("mileage", "Kilometerstand")}
                {renderNumberInput("previous_owners", "Vorbesitzer")}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {renderSelect("condition", "Zustand", CONDITIONS, "Zustand wählen")}
                {renderSelect("body_type", "Aufbauart", BODY_TYPES, "Aufbauart wählen")}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {renderSelect("status", "Status", STATUSES, "Status wählen")}
                {renderTextInput("listing_number", "Inseratsnummer")}
              </div>

              {/* Standort */}
              <h4 className="font-medium text-sm text-muted-foreground pt-2">Standort</h4>
              <div className="grid grid-cols-2 gap-4">
                {renderTextInput("postal_code", "PLZ", "z.B. 80331", 5)}
                {renderTextInput("city", "Stadt", "z.B. München")}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {renderTextInput("country", "Land", "z.B. Deutschland")}
                {renderTextInput("location", "Standort (Detail)", "z.B. Halle 3")}
              </div>
            </TabsContent>

            {/* ===== PREISE & VERKAUF TAB ===== */}
            <TabsContent value="prices" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                {renderNumberInput("price", "Verkaufspreis (€)")}
                {renderNumberInput("instant_price", "Sofortpreis (€)")}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {renderNumberInput("reserve_price", "Mindestpreis (€)")}
                {renderSelect("sale_channel", "Verkaufsweg", SALE_CHANNELS, "Verkaufsweg wählen")}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {renderTextInput("sale_type", "Verkaufsart")}
                {renderDateInput("available_from", "Verfügbar ab")}
              </div>
            </TabsContent>

            {/* ===== TECHNIK TAB ===== */}
            <TabsContent value="technical" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                {renderSelect("fuel_type", "Kraftstoff", FUEL_TYPES, "Kraftstoff wählen")}
                {renderSelect("transmission", "Getriebe", TRANSMISSIONS, "Getriebe wählen")}
              </div>

              <div className="grid grid-cols-3 gap-4">
                {renderNumberInput("engine_power_hp", "Leistung (PS)")}
                {renderNumberInput("power_kw", "Leistung (kW)")}
                {renderNumberInput("engine_displacement_ccm", "Hubraum (ccm)")}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {renderSelect("emission_class", "Schadstoffklasse", EMISSION_CLASSES, "Klasse wählen")}
                {renderNumberInput("fuel_tank_capacity_liters", "Tankinhalt (Liter)")}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {renderNumberInput("number_of_axles", "Achsen")}
              </div>

              <h4 className="font-medium text-sm text-muted-foreground pt-2">Reifen</h4>
              <div className="grid grid-cols-2 gap-4">
                {renderTextInput("main_tires", "Hauptreifen", "z.B. 225/75 R16")}
                {renderTextInput("second_tires", "Zweitreifen", "z.B. 225/75 R16")}
              </div>

              <h4 className="font-medium text-sm text-muted-foreground pt-2">Fahrzeugdaten</h4>
              <div className="grid grid-cols-2 gap-4">
                {renderTextInput("vehicle_identification_number", "Fahrgestellnummer (VIN)")}
                {renderTextInput("license_plate", "Kennzeichen")}
              </div>

              <h4 className="font-medium text-sm text-muted-foreground pt-2">TÜV</h4>
              <div className="space-y-4">
                {renderSwitch("has_tuev", "TÜV vorhanden")}
                <div className="grid grid-cols-2 gap-4">
                  {renderDateInput("tuev_valid_until", "TÜV gültig bis")}
                  {renderDateInput("last_tuev_date", "Letzter TÜV")}
                </div>
              </div>

              <h4 className="font-medium text-sm text-muted-foreground pt-2">Fahrzeugzustand</h4>
              <div className="space-y-4">
                {renderSwitch("accident_free", "Unfallfrei")}
                {renderSwitch("non_smoker", "Nichtraucherfahrzeug")}
                {renderSwitch("service_history_available", "Scheckheft gepflegt")}
                {renderSwitch("has_damage", "Schäden vorhanden")}
              </div>
              {formData.has_damage && (
                <div className="space-y-2">
                  <Label htmlFor="damage_summary">Schadensbeschreibung</Label>
                  <Textarea
                    id="damage_summary"
                    rows={3}
                    value={formData.damage_summary || ""}
                    onChange={(e) => updateField("damage_summary", e.target.value)}
                    placeholder="Beschreiben Sie die Schäden..."
                  />
                </div>
              )}
            </TabsContent>

            {/* ===== MASSE & GEWICHT TAB ===== */}
            <TabsContent value="dimensions" className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4">
                {renderNumberInput("length_m", "Länge (cm)")}
                {renderNumberInput("width_m", "Breite (cm)")}
                {renderNumberInput("height_m", "Höhe (cm)")}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {renderNumberInput("weight_kg", "Gesamtgewicht (kg)")}
                {renderNumberInput("payload_kg", "Zuladung (kg)")}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {renderNumberInput("sleeping_places", "Schlafplätze")}
                {renderNumberInput("seats", "Sitzplätze mit Gurt")}
              </div>
            </TabsContent>

            {/* ===== WOHNBEREICH TAB ===== */}
            <TabsContent value="living" className="space-y-4 mt-4">
              <h4 className="font-medium text-sm text-muted-foreground">Wasser & Tanks</h4>
              <div className="grid grid-cols-2 gap-4">
                {renderNumberInput("water_tank_liters", "Frischwassertank (Liter)")}
                {renderNumberInput("grey_water_capacity_liters", "Grauwassertank (Liter)")}
              </div>

              <h4 className="font-medium text-sm text-muted-foreground pt-2">Energie</h4>
              <div className="grid grid-cols-2 gap-4">
                {renderNumberInput("battery_capacity_ah", "Batteriekapazität (Ah)")}
                {renderNumberInput("solar_power_watts", "Solarleistung (Watt)")}
              </div>

              <h4 className="font-medium text-sm text-muted-foreground pt-2">Heizung & Klima</h4>
              <div className="grid grid-cols-2 gap-4">
                {renderSelect("heating_type", "Heizungsart", HEATING_TYPES, "Heizungsart wählen")}
                {renderSelect("air_conditioning_type", "Klimaanlage", AC_TYPES, "Klimaanlage wählen")}
              </div>
              <div className="space-y-4">
                {renderSwitch("has_heating", "Heizung vorhanden")}
              </div>

              <h4 className="font-medium text-sm text-muted-foreground pt-2">Küche & Kühlung</h4>
              <div className="grid grid-cols-2 gap-4">
                {renderSelect("refrigerator_type", "Kühlschrankart", REFRIGERATOR_TYPES, "Kühlschrankart wählen")}
                {renderTextInput("gas_system", "Gasanlage", "z.B. 2x 11kg Flaschen")}
              </div>

              <h4 className="font-medium text-sm text-muted-foreground pt-2">Schlafen & Markise</h4>
              <div className="grid grid-cols-2 gap-4">
                {renderNumberInput("awning_length_m", "Markisenlänge (m)", undefined, "0.1")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="beds_description">Bettenbeschreibung</Label>
                <Textarea
                  id="beds_description"
                  rows={2}
                  value={formData.beds_description || ""}
                  onChange={(e) => updateField("beds_description", e.target.value)}
                  placeholder="z.B. Hubbett 140x200, Heckbett 150x200..."
                />
              </div>
            </TabsContent>

            {/* ===== AUSSTATTUNG TAB ===== */}
            <TabsContent value="equipment" className="space-y-4 mt-4">
              <h4 className="font-medium text-sm text-muted-foreground">Wohnraum</h4>
              <div className="space-y-3">
                {renderSwitch("has_kitchen", "Küche")}
                {renderSwitch("has_bathroom", "Badezimmer")}
                {renderSwitch("has_toilet", "Toilette")}
                {renderSwitch("has_shower", "Dusche")}
                {renderSwitch("has_garage", "Heckgarage")}
              </div>

              <h4 className="font-medium text-sm text-muted-foreground pt-2">Außen</h4>
              <div className="space-y-3">
                {renderSwitch("has_solar", "Solaranlage")}
                {renderSwitch("has_awning", "Markise")}
                {renderSwitch("has_awning_tent", "Vorzelt")}
                {renderSwitch("has_bike_rack", "Fahrradträger")}
              </div>

              <h4 className="font-medium text-sm text-muted-foreground pt-2">Komfort & Technik</h4>
              <div className="space-y-3">
                {renderSwitch("has_roof_ac", "Dachklima")}
                {renderSwitch("has_stand_ac", "Standklima")}
                {renderSwitch("has_air_conditioning", "Klimaanlage (Fahrerhaus)")}
                {renderSwitch("has_tv", "TV")}
                {renderSwitch("has_satellite", "SAT-Anlage")}
                {renderSwitch("has_inverter", "Wechselrichter")}
                {renderSwitch("has_swivel_seats", "Drehsitze")}
              </div>

              <h4 className="font-medium text-sm text-muted-foreground pt-2">Sicherheit & Fahrzeug</h4>
              <div className="space-y-3">
                {renderSwitch("has_backup_camera", "Rückfahrkamera")}
                {renderSwitch("has_navigation", "Navigation")}
                {renderSwitch("has_parking_sensors", "Einparkhilfe")}
                {renderSwitch("has_cruise_control", "Tempomat")}
                {renderSwitch("has_esp", "ESP")}
                {renderSwitch("has_airbag", "Airbag")}
                {renderSwitch("has_alarm", "Alarmanlage")}
                {renderSwitch("has_central_locking", "Zentralverriegelung")}
              </div>

              <h4 className="font-medium text-sm text-muted-foreground pt-2">Zusatzausstattung</h4>
              <div className="space-y-2">
                <Textarea
                  id="additional_equipment"
                  rows={3}
                  value={formData.additional_equipment || ""}
                  onChange={(e) => updateField("additional_equipment", e.target.value)}
                  placeholder="Weitere Ausstattungsmerkmale..."
                />
              </div>
            </TabsContent>

            {/* ===== SONSTIGES TAB ===== */}
            <TabsContent value="other" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  rows={6}
                  value={formData.description || ""}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Allgemeine Beschreibung des Fahrzeugs..."
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
