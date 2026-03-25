/**
 * Dialog to convert a completed wizard session into a motorhome listing.
 * Admin can review/edit all wizard data, choose sale channel, and create the motorhome.
 * Automatically creates a user account for the customer if needed.
 */

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  Car,
  User,
  Gavel,
  Zap,
  MapPin,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { logger } from "@/lib/logger";

// ============================================================================
// Types
// ============================================================================

interface WizardSessionData {
  id: string;
  user_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  form_data: Record<string, unknown>;
  status: string;
}

interface ConvertToMotorhomeDialogProps {
  session: WizardSessionData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============================================================================
// Constants
// ============================================================================

const BODY_TYPES = [
  { value: "Teilintegriert", label: "Teilintegriert" },
  { value: "Alkoven", label: "Alkoven" },
  { value: "Vollintegriert", label: "Vollintegriert" },
  { value: "Kastenwagen", label: "Kastenwagen" },
  { value: "Campingbus", label: "Campingbus" },
];

const CONDITIONS = [
  { value: "Neuwertig", label: "Neuwertig" },
  { value: "Sehr gut", label: "Sehr gut" },
  { value: "Gut", label: "Gut" },
  { value: "Befriedigend", label: "Befriedigend" },
  { value: "Reparaturbedürftig", label: "Reparaturbedürftig" },
];

const SALE_CHANNELS = [
  { value: "auction", label: "Händler-Auktion", icon: Gavel, color: "text-blue-600" },
  { value: "instant_price", label: "Sofortpreis", icon: Zap, color: "text-yellow-600" },
  { value: "station", label: "Ankaufstation", icon: MapPin, color: "text-green-600" },
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

// ============================================================================
// Helper: Map wizard form_data fields to motorhome DB fields
// ============================================================================

function mapWizardToMotorhome(formData: Record<string, unknown>) {
  return {
    // Core vehicle
    manufacturer: String(formData.manufacturer || ""),
    model: String(formData.model || ""),
    year: Number(formData.year) || new Date().getFullYear(),
    mileage: Number(formData.mileage) || 0,
    body_type: String(formData.bodyType || "Kastenwagen"),
    condition: String(formData.condition || "Gut"),
    description: String(formData.description || ""),
    // Sale
    sale_channel: String(formData.saleChannel || "auction"),
    reserve_price: formData.reservePrice ? Number(formData.reservePrice) : null,
    instant_price: formData.desiredPrice ? Number(formData.desiredPrice) : null,
    // Technical
    fuel_type: formData.fuelType ? String(formData.fuelType) : null,
    transmission: formData.transmission ? String(formData.transmission) : null,
    engine_power_hp: formData.enginePower ? Number(formData.enginePower) : null,
    engine_displacement_ccm: formData.engine_displacement_ccm ? Number(formData.engine_displacement_ccm) : null,
    emission_class: formData.emissionClass ? String(formData.emissionClass) : null,
    // Dimensions
    length_m: formData.length_m ? Number(formData.length_m) : null,
    width_m: formData.width_m ? Number(formData.width_m) : null,
    height_m: formData.height_m ? Number(formData.height_m) : null,
    weight_kg: formData.weight_kg ? Number(formData.weight_kg) : null,
    payload_kg: formData.payload_kg ? Number(formData.payload_kg) : null,
    seats: formData.number_of_seats ? Number(formData.number_of_seats) : null,
    sleeping_places: formData.number_of_sleeping_places ? Number(formData.number_of_sleeping_places) : null,
    number_of_axles: formData.number_of_axles ? Number(formData.number_of_axles) : null,
    // Equipment booleans
    has_bathroom: Boolean(formData.has_bathroom),
    has_kitchen: Boolean(formData.has_kitchen),
    has_shower: Boolean(formData.has_shower),
    has_toilet: Boolean(formData.has_toilet),
    has_heating: Boolean(formData.has_heating),
    has_air_conditioning: Boolean(formData.has_air_conditioning),
    has_solar: Boolean(formData.has_solar_panel),
    has_awning: Boolean(formData.has_awning),
    has_bike_rack: Boolean(formData.has_bike_rack),
    has_navigation: Boolean(formData.has_navigation),
    has_backup_camera: Boolean(formData.has_backup_camera),
    has_cruise_control: Boolean(formData.has_cruise_control),
    has_garage: Boolean(formData.has_garage),
    has_alarm: Boolean(formData.has_alarm_system || formData.has_alarm),
    has_esp: Boolean(formData.has_esp),
    has_swivel_seats: Boolean(formData.has_swivel_seats),
    has_satellite: Boolean(formData.has_satellite_system),
    has_tv: Boolean(formData.has_satellite_system),
    // Condition details
    accident_free: formData.accident_free != null ? Boolean(formData.accident_free) : null,
    first_registration: formData.first_registration ? String(formData.first_registration) : null,
    tuev_valid_until: formData.tuev_valid_until ? String(formData.tuev_valid_until) : null,
    previous_owners: formData.previous_owners ? Number(formData.previous_owners) : null,
    // Water/Gas
    water_tank_liters: formData.water_tank_liters ? Number(formData.water_tank_liters) : null,
    grey_water_capacity_liters: formData.waste_water_tank_liters ? Number(formData.waste_water_tank_liters) : null,
    gas_system: formData.gas_system ? String(formData.gas_system) : null,
    refrigerator_type: formData.refrigerator_type ? String(formData.refrigerator_type) : null,
    // Tires
    main_tires: formData.main_tires ? String(formData.main_tires) : null,
    second_tires: formData.second_tires ? String(formData.second_tires) : null,
  };
}

// ============================================================================
// Component
// ============================================================================

export function ConvertToMotorhomeDialog({
  session,
  open,
  onOpenChange,
}: ConvertToMotorhomeDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Initialize form from wizard session data
  useEffect(() => {
    if (session) {
      const mapped = mapWizardToMotorhome(session.form_data || {});
      setFormData(mapped);
      setCustomerName(session.customer_name || String(session.form_data?.customerName || ""));
      setCustomerEmail(session.customer_email || String(session.form_data?.customerEmail || ""));
      setCustomerPhone(session.customer_phone || String(session.form_data?.customerPhone || ""));
    }
  }, [session]);

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ---- Main Mutation: Create account + motorhome ----
  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("Keine Session ausgewählt");

      // Validate required fields
      const manufacturer = String(formData.manufacturer || "").trim();
      const model = String(formData.model || "").trim();
      const year = Number(formData.year);
      const mileage = Number(formData.mileage);
      const bodyType = String(formData.body_type || "");
      const condition = String(formData.condition || "");

      if (!manufacturer) throw new Error("Hersteller ist erforderlich");
      if (!model) throw new Error("Modell ist erforderlich");
      if (!year || year < 1950 || year > 2030) throw new Error("Ungültiges Baujahr");
      if (mileage < 0) throw new Error("Ungültiger Kilometerstand");
      if (!bodyType) throw new Error("Aufbauart ist erforderlich");
      if (!condition) throw new Error("Zustand ist erforderlich");
      if (!customerEmail.trim()) throw new Error("E-Mail des Kunden ist erforderlich");

      let sellerId = session.user_id;

      // If no user exists, create one via admin API (Supabase Edge Function)
      if (!sellerId) {
        const nameParts = customerName.trim().split(" ");
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        // Use Supabase admin function to create user
        const { data: createUserData, error: createUserError } = await supabase.functions.invoke(
          "admin-create-user",
          {
            body: {
              email: customerEmail.trim(),
              firstName,
              lastName,
              phone: customerPhone.trim() || undefined,
              role: "private",
            },
          }
        );

        if (createUserError) {
          // Fallback: Try to find existing user by email
          logger.warn("admin-create-user failed, trying to find existing user:", createUserError.message);
          const { data: existingUsers, error: findError } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", customerEmail.trim())
            .limit(1);

          if (findError || !existingUsers?.length) {
            throw new Error(
              `Kunden-Account konnte nicht erstellt werden: ${createUserError.message}. ` +
              `Bitte stellen Sie sicher, dass die Edge Function "admin-create-user" deployed ist, ` +
              `oder erstellen Sie den Kunden-Account manuell unter Benutzer.`
            );
          }
          sellerId = existingUsers[0].id;
        } else {
          sellerId = createUserData?.userId || createUserData?.user_id;
          if (!sellerId) {
            throw new Error("Kein User-ID in der Antwort der Edge Function");
          }
        }
      }

      // Build motorhome insert payload
      const motorhomePayload: Record<string, unknown> = {
        seller_id: sellerId,
        manufacturer,
        model,
        year,
        mileage,
        body_type: bodyType,
        condition,
        description: formData.description || null,
        sale_channel: formData.sale_channel || "auction",
        reserve_price: formData.reserve_price || null,
        instant_price: formData.instant_price || null,
        fuel_type: formData.fuel_type || null,
        transmission: formData.transmission || null,
        engine_power_hp: formData.engine_power_hp || null,
        engine_displacement_ccm: formData.engine_displacement_ccm || null,
        emission_class: formData.emission_class || null,
        length_m: formData.length_m || null,
        width_m: formData.width_m || null,
        height_m: formData.height_m || null,
        weight_kg: formData.weight_kg || null,
        payload_kg: formData.payload_kg || null,
        seats: formData.seats || null,
        sleeping_places: formData.sleeping_places || null,
        number_of_axles: formData.number_of_axles || null,
        has_bathroom: formData.has_bathroom || false,
        has_kitchen: formData.has_kitchen || false,
        has_shower: formData.has_shower || false,
        has_toilet: formData.has_toilet || false,
        has_heating: formData.has_heating || false,
        has_air_conditioning: formData.has_air_conditioning || false,
        has_solar: formData.has_solar || false,
        has_awning: formData.has_awning || false,
        has_bike_rack: formData.has_bike_rack || false,
        has_navigation: formData.has_navigation || false,
        has_backup_camera: formData.has_backup_camera || false,
        has_cruise_control: formData.has_cruise_control || false,
        has_garage: formData.has_garage || false,
        has_alarm: formData.has_alarm || false,
        has_esp: formData.has_esp || false,
        has_swivel_seats: formData.has_swivel_seats || false,
        has_satellite: formData.has_satellite || false,
        has_tv: formData.has_tv || false,
        accident_free: formData.accident_free || null,
        first_registration: formData.first_registration || null,
        tuev_valid_until: formData.tuev_valid_until || null,
        previous_owners: formData.previous_owners || null,
        water_tank_liters: formData.water_tank_liters || null,
        grey_water_capacity_liters: formData.grey_water_capacity_liters || null,
        gas_system: formData.gas_system || null,
        main_tires: formData.main_tires || null,
        second_tires: formData.second_tires || null,
        status: "active",
      };

      // Insert motorhome
      const { data: motorhome, error: insertError } = await supabase
        .from("motorhomes")
        .insert(motorhomePayload as any)
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Mark wizard session as converted
      await supabase
        .from("wizard_sessions")
        .update({
          status: "converted",
          admin_notes: `${session.admin_notes ? session.admin_notes + "\n" : ""}[${new Date().toLocaleDateString("de-DE")}] Als Wohnmobil angelegt (ID: ${motorhome.id})`,
        } as any)
        .eq("id", session.id);

      return { motorhomeId: motorhome.id, saleChannel: formData.sale_channel };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["adminWizardSessions"] });
      queryClient.invalidateQueries({ queryKey: ["adminMotorhomes"] });

      const channelLabel = SALE_CHANNELS.find((c) => c.value === result.saleChannel)?.label || result.saleChannel;

      toast({
        title: "Wohnmobil erfolgreich angelegt!",
        description: `${formData.manufacturer} ${formData.model} wurde als "${channelLabel}" erstellt. Sie können das Inserat jetzt unter Wohnmobile verwalten.`,
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      logger.error("Convert to motorhome failed:", error);
      toast({
        title: "Fehler beim Anlegen",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (!session) return null;

  const isValid =
    String(formData.manufacturer || "").trim() !== "" &&
    String(formData.model || "").trim() !== "" &&
    Number(formData.year) > 1950 &&
    String(formData.body_type || "").trim() !== "" &&
    String(formData.condition || "").trim() !== "" &&
    customerEmail.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Car className="w-5 h-5 text-primary" />
            Wizard-Anfrage als Wohnmobil anlegen
          </DialogTitle>
          <DialogDescription>
            Prüfen und bearbeiten Sie die Daten aus der Wizard-Session. Nach dem Anlegen
            erscheint das Fahrzeug in der Wohnmobil-Verwaltung.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[62vh] pr-4">
          <div className="space-y-6">
            {/* Customer Info Card */}
            <Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Kundendaten
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="conv-name" className="text-xs">Name</Label>
                  <Input
                    id="conv-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Vor- und Nachname"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="conv-email" className="text-xs">
                    E-Mail <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="conv-email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="kunde@email.de"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="conv-phone" className="text-xs">Telefon</Label>
                  <Input
                    id="conv-phone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+49 123 456789"
                  />
                </div>
              </div>
              {session.user_id && (
                <Badge variant="outline" className="mt-2 text-xs text-green-600">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Kunden-Account vorhanden
                </Badge>
              )}
              {!session.user_id && (
                <Badge variant="outline" className="mt-2 text-xs text-orange-600">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Kunden-Account wird automatisch erstellt
                </Badge>
              )}
            </Card>

            {/* Sale Channel Selection */}
            <div className="space-y-3">
              <Label className="font-semibold">Verkaufsweg</Label>
              <div className="grid grid-cols-3 gap-3">
                {SALE_CHANNELS.map((channel) => {
                  const Icon = channel.icon;
                  const isSelected = formData.sale_channel === channel.value;
                  return (
                    <Card
                      key={channel.value}
                      className={`p-3 cursor-pointer transition-all text-center ${
                        isSelected
                          ? "border-2 border-primary bg-primary/5 shadow-md"
                          : "border hover:border-primary/30 hover:shadow-sm"
                      }`}
                      onClick={() => updateField("sale_channel", channel.value)}
                    >
                      <Icon className={`w-6 h-6 mx-auto mb-1 ${isSelected ? "text-primary" : channel.color}`} />
                      <p className={`text-sm font-medium ${isSelected ? "text-primary" : ""}`}>
                        {channel.label}
                      </p>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Price fields based on sale channel */}
            {formData.sale_channel === "instant_price" && (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor="conv-instant-price">Sofortpreis (€) <span className="text-red-500">*</span></Label>
                <Input
                  id="conv-instant-price"
                  type="number"
                  value={String(formData.instant_price || "")}
                  onChange={(e) => updateField("instant_price", e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="z.B. 45000"
                />
              </div>
            )}
            {formData.sale_channel === "auction" && (
              <div className="grid grid-cols-2 gap-4 animate-fade-in">
                <div className="space-y-2">
                  <Label htmlFor="conv-reserve-price">Mindestpreis (€)</Label>
                  <Input
                    id="conv-reserve-price"
                    type="number"
                    value={String(formData.reserve_price || "")}
                    onChange={(e) => updateField("reserve_price", e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="conv-instant-price-auction">Sofortkauf-Preis (€)</Label>
                  <Input
                    id="conv-instant-price-auction"
                    type="number"
                    value={String(formData.instant_price || "")}
                    onChange={(e) => updateField("instant_price", e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="optional"
                  />
                </div>
              </div>
            )}

            {/* Tabbed Vehicle Details */}
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Fahrzeug</TabsTrigger>
                <TabsTrigger value="technical">Technik</TabsTrigger>
                <TabsTrigger value="dimensions">Maße</TabsTrigger>
                <TabsTrigger value="equipment">Ausstattung</TabsTrigger>
              </TabsList>

              {/* Basic Tab */}
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="conv-manufacturer">
                      Hersteller <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="conv-manufacturer"
                      value={String(formData.manufacturer || "")}
                      onChange={(e) => updateField("manufacturer", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conv-model">
                      Modell <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="conv-model"
                      value={String(formData.model || "")}
                      onChange={(e) => updateField("model", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="conv-year">
                      Baujahr <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="conv-year"
                      type="number"
                      value={String(formData.year || "")}
                      onChange={(e) => updateField("year", parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conv-mileage">
                      Kilometerstand <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="conv-mileage"
                      type="number"
                      value={String(formData.mileage || "")}
                      onChange={(e) => updateField("mileage", parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      Aufbauart <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={String(formData.body_type || "")}
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
                  <div className="space-y-2">
                    <Label>
                      Zustand <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={String(formData.condition || "")}
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conv-description">Beschreibung</Label>
                  <Textarea
                    id="conv-description"
                    rows={3}
                    value={String(formData.description || "")}
                    onChange={(e) => updateField("description", e.target.value)}
                    placeholder="Fahrzeugbeschreibung, Besonderheiten..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="conv-first-reg">Erstzulassung</Label>
                    <Input
                      id="conv-first-reg"
                      type="date"
                      value={String(formData.first_registration || "")}
                      onChange={(e) => updateField("first_registration", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conv-tuev">TÜV gültig bis</Label>
                    <Input
                      id="conv-tuev"
                      type="date"
                      value={String(formData.tuev_valid_until || "")}
                      onChange={(e) => updateField("tuev_valid_until", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="conv-prev-owners">Vorbesitzer</Label>
                    <Input
                      id="conv-prev-owners"
                      type="number"
                      value={String(formData.previous_owners || "")}
                      onChange={(e) => updateField("previous_owners", parseInt(e.target.value) || null)}
                    />
                  </div>
                  <div className="flex items-center justify-between pt-6">
                    <Label htmlFor="conv-accident-free">Unfallfrei</Label>
                    <Switch
                      id="conv-accident-free"
                      checked={Boolean(formData.accident_free)}
                      onCheckedChange={(checked) => updateField("accident_free", checked)}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Technical Tab */}
              <TabsContent value="technical" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kraftstoff</Label>
                    <Select
                      value={String(formData.fuel_type || "")}
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
                    <Label>Getriebe</Label>
                    <Select
                      value={String(formData.transmission || "")}
                      onValueChange={(value) => updateField("transmission", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Getriebe wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {TRANSMISSIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="conv-power">Leistung (PS)</Label>
                    <Input
                      id="conv-power"
                      type="number"
                      value={String(formData.engine_power_hp || "")}
                      onChange={(e) => updateField("engine_power_hp", parseInt(e.target.value) || null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conv-displacement">Hubraum (ccm)</Label>
                    <Input
                      id="conv-displacement"
                      type="number"
                      value={String(formData.engine_displacement_ccm || "")}
                      onChange={(e) => updateField("engine_displacement_ccm", parseInt(e.target.value) || null)}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Dimensions Tab */}
              <TabsContent value="dimensions" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="conv-length">Länge (cm)</Label>
                    <Input
                      id="conv-length"
                      type="number"
                      value={String(formData.length_m || "")}
                      onChange={(e) => updateField("length_m", parseInt(e.target.value) || null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conv-width">Breite (cm)</Label>
                    <Input
                      id="conv-width"
                      type="number"
                      value={String(formData.width_m || "")}
                      onChange={(e) => updateField("width_m", parseInt(e.target.value) || null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conv-height">Höhe (cm)</Label>
                    <Input
                      id="conv-height"
                      type="number"
                      value={String(formData.height_m || "")}
                      onChange={(e) => updateField("height_m", parseInt(e.target.value) || null)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="conv-weight">Gesamtgewicht (kg)</Label>
                    <Input
                      id="conv-weight"
                      type="number"
                      value={String(formData.weight_kg || "")}
                      onChange={(e) => updateField("weight_kg", parseInt(e.target.value) || null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conv-payload">Zuladung (kg)</Label>
                    <Input
                      id="conv-payload"
                      type="number"
                      value={String(formData.payload_kg || "")}
                      onChange={(e) => updateField("payload_kg", parseInt(e.target.value) || null)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="conv-seats">Sitzplätze</Label>
                    <Input
                      id="conv-seats"
                      type="number"
                      value={String(formData.seats || "")}
                      onChange={(e) => updateField("seats", parseInt(e.target.value) || null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conv-sleeping">Schlafplätze</Label>
                    <Input
                      id="conv-sleeping"
                      type="number"
                      value={String(formData.sleeping_places || "")}
                      onChange={(e) => updateField("sleeping_places", parseInt(e.target.value) || null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conv-axles">Achsen</Label>
                    <Input
                      id="conv-axles"
                      type="number"
                      value={String(formData.number_of_axles || "")}
                      onChange={(e) => updateField("number_of_axles", parseInt(e.target.value) || null)}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Equipment Tab */}
              <TabsContent value="equipment" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                  {[
                    { key: "has_bathroom", label: "Badezimmer" },
                    { key: "has_kitchen", label: "Küche" },
                    { key: "has_shower", label: "Dusche" },
                    { key: "has_toilet", label: "Toilette" },
                    { key: "has_heating", label: "Heizung" },
                    { key: "has_air_conditioning", label: "Klimaanlage" },
                    { key: "has_solar", label: "Solaranlage" },
                    { key: "has_awning", label: "Markise" },
                    { key: "has_bike_rack", label: "Fahrradträger" },
                    { key: "has_navigation", label: "Navigation" },
                    { key: "has_backup_camera", label: "Rückfahrkamera" },
                    { key: "has_cruise_control", label: "Tempomat" },
                    { key: "has_garage", label: "Heckgarage" },
                    { key: "has_alarm", label: "Alarmanlage" },
                    { key: "has_esp", label: "ESP" },
                    { key: "has_swivel_seats", label: "Drehsitze" },
                    { key: "has_satellite", label: "SAT-Anlage" },
                    { key: "has_tv", label: "TV" },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between">
                      <Label htmlFor={`conv-${item.key}`} className="text-sm">
                        {item.label}
                      </Label>
                      <Switch
                        id={`conv-${item.key}`}
                        checked={Boolean(formData[item.key])}
                        onCheckedChange={(checked) => updateField(item.key, checked)}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={() => convertMutation.mutate()}
            disabled={convertMutation.isPending || !isValid}
            className="gradient-hero hover:gradient-hero-hover"
          >
            {convertMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Wird angelegt...
              </>
            ) : (
              <>
                <Car className="w-4 h-4 mr-2" />
                Als Wohnmobil anlegen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
