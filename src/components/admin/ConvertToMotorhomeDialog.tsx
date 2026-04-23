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
import { MonthYearPicker } from "@/components/ui/month-year-picker";
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
import { invokeWithAuth, SessionExpiredError, ensureValidRLSSession } from "@/lib/sessionGuard";
import {
  Loader2,
  Car,
  User,
  Gavel,
  Zap,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Send,
  Mail,
} from "lucide-react";
import { logger } from "@/lib/logger";
import { handleAndLogError } from "@/lib/errorLogService";

// ============================================================================
// Types
// ============================================================================

interface WizardSessionData {
  id: string;
  user_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  form_data?: Record<string, unknown>;
  status: string;
}

type LeadSourceType = "wizard" | "valuation";

interface ConvertToMotorhomeDialogProps {
  session: WizardSessionData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceType?: LeadSourceType;
}

// ============================================================================
// Constants
// ============================================================================

const BODY_TYPES = [
  // Wohnmobil
  { value: "Teilintegriert", label: "Teilintegriert" },
  { value: "Alkoven", label: "Alkoven" },
  { value: "Vollintegriert", label: "Vollintegriert" },
  { value: "Kastenwagen", label: "Kastenwagen" },
  { value: "Campingbus", label: "Campingbus" },
  // Wohnwagen
  { value: "Wohnwagen", label: "Wohnwagen" },
  { value: "Faltcaravan", label: "Faltcaravan" },
  { value: "Mobilheim", label: "Mobilheim" },
];

const CONDITIONS = [
  { value: "Neuwertig", label: "Neuwertig" },
  { value: "Sehr gepflegt", label: "Sehr gepflegt" },
  { value: "Gepflegt", label: "Gepflegt" },
  { value: "Gebrauchsspuren", label: "Gebrauchsspuren" },
  { value: "Reparaturbedürftig", label: "Reparaturbedürftig" },
];

const SALE_CHANNELS = [
  { value: "auction", label: "Händler-Auktion", icon: Gavel, color: "text-blue-600" },
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
  const isWohnwagen = formData.vehicleType === "Wohnwagen";

  return {
    // Core vehicle info
    manufacturer: String(formData.manufacturer || ""),
    model: String(formData.model || ""),
    year: Number(formData.year) || new Date().getFullYear(),
    mileage: isWohnwagen ? 0 : (Number(formData.mileage) || 0),
    body_type: String(formData.bodyType || "Kastenwagen"),
    condition: String(formData.condition || "Gut"),
    description: String(formData.description || `${formData.manufacturer || ''} ${formData.model || ''} (${formData.year || ''})`),

    // Sale info
    sale_channel: String(formData.saleChannel || "auction"),
    reserve_price: formData.reservePrice ? Number(formData.reservePrice) : null,
    instant_price: formData.instantPrice ? Number(formData.instantPrice) : null,

    // Technical details (wizard uses fuel_type, power_ps, emission_class directly)
    fuel_type: isWohnwagen ? null : ((formData.fuel_type || formData.fuelType || null) as string | null),
    transmission: isWohnwagen ? null : ((formData.transmission || null) as string | null),
    engine_power_hp: isWohnwagen ? null : (formData.power_ps ? Number(formData.power_ps) : (formData.enginePower ? Number(formData.enginePower) : null)),
    engine_displacement_ccm: isWohnwagen ? null : (formData.engine_displacement_ccm ? Number(formData.engine_displacement_ccm) : null),
    emission_class: isWohnwagen ? null : ((formData.emission_class || formData.emissionClass || null) as string | null),
    first_registration: formData.first_registration ? `${String(formData.first_registration).substring(0, 7)}-01` : null,
    tuev_valid_until: (formData.tuv_valid_until || formData.tuev_valid_until) ? `${String(formData.tuv_valid_until || formData.tuev_valid_until).substring(0, 7)}-01` : null,
    previous_owners: formData.previous_owners != null ? Number(formData.previous_owners) : null,
    accident_free: formData.accident_free != null ? Boolean(formData.accident_free) : null,
    non_smoker: formData.non_smoker != null ? Boolean(formData.non_smoker) : null,
    service_history_available: formData.service_history_available != null ? Boolean(formData.service_history_available) : null,
    main_tires: formData.main_tires ? String(formData.main_tires) : null,
    second_tires: formData.second_tires ? String(formData.second_tires) : null,

    // Dimensions (wizard stores in cm, DB expects meters for length/width/height)
    length_m: formData.length_cm ? Number(formData.length_cm) / 100 : (formData.length_m ? Number(formData.length_m) : null),
    width_m: formData.width_cm ? Number(formData.width_cm) / 100 : (formData.width_m ? Number(formData.width_m) : null),
    height_m: formData.height_cm ? Number(formData.height_cm) / 100 : (formData.height_m ? Number(formData.height_m) : null),
    weight_kg: formData.total_weight_kg ? Number(formData.total_weight_kg) : (formData.weight_kg ? Number(formData.weight_kg) : null),
    payload_kg: formData.payload_kg ? Number(formData.payload_kg) : null,
    number_of_axles: formData.number_of_axles ? Number(formData.number_of_axles) : null,
    seats: isWohnwagen ? null : (formData.seats_with_seatbelts ? Number(formData.seats_with_seatbelts) : (formData.number_of_seats ? Number(formData.number_of_seats) : null)),
    sleeping_places: formData.sleeping_places ? Number(formData.sleeping_places) : (formData.number_of_sleeping_places ? Number(formData.number_of_sleeping_places) : null),
    beds_description: formData.beds_description ? String(formData.beds_description) : null,

    // Interior
    has_kitchen: Boolean(formData.has_kitchen),
    heating_type: formData.heating_type ? String(formData.heating_type) : null,
    air_conditioning_type: formData.air_conditioning ? String(formData.air_conditioning) : null,
    has_bathroom: Boolean(formData.has_toilet || formData.has_shower || formData.has_bathroom),
    has_shower: Boolean(formData.has_shower),
    has_toilet: Boolean(formData.has_toilet),
    water_tank_liters: formData.fresh_water_capacity_liters ? Number(formData.fresh_water_capacity_liters) : (formData.water_tank_liters ? Number(formData.water_tank_liters) : null),
    grey_water_capacity_liters: formData.grey_water_capacity_liters ? Number(formData.grey_water_capacity_liters) : (formData.waste_water_tank_liters ? Number(formData.waste_water_tank_liters) : null),

    // Equipment & Features
    has_airbag: isWohnwagen ? false : Boolean(formData.has_airbag),
    has_alarm: Boolean(formData.has_alarm || formData.has_alarm_system),
    has_swivel_seats: isWohnwagen ? false : Boolean(formData.has_swivel_seats),
    has_esp: isWohnwagen ? false : Boolean(formData.has_esp),
    has_cruise_control: isWohnwagen ? false : Boolean(formData.has_cruise_control),
    has_parking_sensors: isWohnwagen ? false : Boolean(formData.has_parking_sensors),
    has_backup_camera: Boolean(formData.has_reversing_camera || formData.has_backup_camera),
    has_central_locking: Boolean(formData.has_central_locking),
    has_solar: Boolean(formData.has_solar || formData.has_solar_panel),
    solar_power_watts: formData.solar_power_watts ? Number(formData.solar_power_watts) : null,
    battery_capacity_ah: formData.battery_capacity_ah ? Number(formData.battery_capacity_ah) : null,
    has_inverter: Boolean(formData.has_inverter),
    has_awning: Boolean(formData.has_awning),
    awning_length_m: formData.awning_length_cm ? Number(formData.awning_length_cm) / 100 : null,
    has_bike_rack: Boolean(formData.has_bike_rack),
    has_garage: Boolean(formData.has_garage),
    has_tv: Boolean(formData.has_tv_sat || formData.has_tv),
    has_satellite: Boolean(formData.has_tv_sat || formData.has_satellite_system),
    has_awning_tent: Boolean(formData.has_awning_tent),
    has_roof_ac: Boolean(formData.has_roof_ac),
    has_stand_ac: Boolean(formData.has_stand_ac),

    // Defects
    has_damage: formData.no_known_defects != null ? !formData.no_known_defects : null,
    damage_summary: formData.known_defects ? String(formData.known_defects) : null,

    // Location
    postal_code: formData.zipCode ? String(formData.zipCode) : null,
    city: formData.city ? String(formData.city) : null,
    country: formData.country ? String(formData.country) : "DE",

    // Additional
    additional_equipment: formData.additional_equipment ? String(formData.additional_equipment) : null,
    vehicle_identification_number: formData.vehicle_identification_number ? String(formData.vehicle_identification_number) : null,
    license_plate: formData.license_plate ? String(formData.license_plate) : null,
  };
}

// ============================================================================
// Component
// ============================================================================

export function ConvertToMotorhomeDialog({
  session,
  open,
  onOpenChange,
  sourceType = "wizard",
}: ConvertToMotorhomeDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerStreet, setCustomerStreet] = useState("");
  const [customerZip, setCustomerZip] = useState("");
  const [customerCity, setCustomerCity] = useState("");

  // Success state for showing invite button after conversion
  const [conversionResult, setConversionResult] = useState<{ motorhomeId: string; saleChannel: unknown } | null>(null);

  // Initialize form from wizard session data
  useEffect(() => {
    if (session) {
      const mapped = mapWizardToMotorhome(session.form_data || {});
      setFormData(mapped);
      setCustomerName(session.customer_name || String(session.form_data?.customerName || ""));
      setCustomerEmail(session.customer_email || String(session.form_data?.customerEmail || ""));
      setCustomerPhone(session.customer_phone || String(session.form_data?.customerPhone || ""));
      setCustomerStreet(`${session.form_data?.street || ''} ${session.form_data?.houseNumber || ''}`.trim());
      setCustomerZip(String(session.form_data?.zipCode || ""));
      setCustomerCity(String(session.form_data?.city || ""));
      setConversionResult(null); // Reset success state when dialog opens with new session
    }
  }, [session]);

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ---- Main Mutation: Create account + motorhome ----
  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("Keine Session ausgewählt");
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) throw new Error("Session abgelaufen");

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
        const { data: createUserData, error: createUserError } = await invokeWithAuth(
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
        // Bei Sofortkauf: reserve_price automatisch auf instant_price setzen
        reserve_price: formData.instant_price ? (formData.reserve_price || formData.instant_price) : (formData.reserve_price || null),
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
        has_awning_tent: formData.has_awning_tent || false,
        has_roof_ac: formData.has_roof_ac || false,
        has_stand_ac: formData.has_stand_ac || false,
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
        first_registration: formData.first_registration ? `${String(formData.first_registration).substring(0, 7)}-01` : null,
        tuev_valid_until: formData.tuev_valid_until ? `${String(formData.tuev_valid_until).substring(0, 7)}-01` : null,
        previous_owners: formData.previous_owners || null,
        water_tank_liters: formData.water_tank_liters || null,
        grey_water_capacity_liters: formData.grey_water_capacity_liters || null,
        gas_system: formData.gas_system || null,
        main_tires: formData.main_tires || null,
        second_tires: formData.second_tires || null,
        postal_code: formData.postal_code ? String(formData.postal_code) : null,
        city: formData.city ? String(formData.city) : null,
        country: formData.country || null,
        status: "available",
        // Fields from mapWizardToMotorhome that were previously missing
        non_smoker: formData.non_smoker ?? null,
        service_history_available: formData.service_history_available ?? null,
        beds_description: formData.beds_description || null,
        heating_type: formData.heating_type || null,
        air_conditioning_type: formData.air_conditioning_type || null,
        has_airbag: formData.has_airbag || false,
        has_parking_sensors: formData.has_parking_sensors || false,
        has_central_locking: formData.has_central_locking || false,
        has_inverter: formData.has_inverter || false,
        solar_power_watts: formData.solar_power_watts || null,
        battery_capacity_ah: formData.battery_capacity_ah || null,
        awning_length_m: formData.awning_length_m || null,
        has_damage: formData.has_damage ?? null,
        damage_summary: formData.damage_summary || null,
        additional_equipment: formData.additional_equipment || null,
        vehicle_identification_number: formData.vehicle_identification_number || null,
        license_plate: formData.license_plate || null,
      };

      // Insert motorhome
      const { data: motorhome, error: insertError } = await supabase
        .from("motorhomes")
        .insert(motorhomePayload as any)
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Auktion als Listing-Container erstellen (für 'auction' und 'instant_price')
      const effectiveChannel = formData.sale_channel || "auction";
      if (effectiveChannel === "auction" || effectiveChannel === "instant_price") {
        const isInstantOnly = effectiveChannel === "instant_price";
        const reservePrice = isInstantOnly
          ? (formData.instant_price || null)
          : formData.instant_price ? (formData.reserve_price || formData.instant_price) : (formData.reserve_price || null);

        // Prüfe ob bereits eine Auktion für dieses Motorhome existiert (UNIQUE Constraint)
        const { data: existingAuction } = await supabase
          .from("auctions")
          .select("id")
          .eq("motorhome_id", motorhome.id)
          .maybeSingle();

        if (existingAuction) {
          // Bestehende Auktion recyceln
          const { error: updateError } = await supabase
            .from("auctions")
            .update({
              starting_bid: isInstantOnly ? 0 : 50,
              reserve_price: reservePrice,
              status: "draft",
              current_bid: null,
              start_time: null,
              end_time: null,
              kaufchance_expires_at: null,
              kaufchance_min_price: null,
            } as any)
            .eq("id", existingAuction.id);

          if (updateError) {
            logger.error("Auktion konnte nicht aktualisiert werden:", updateError);
          }
        } else {
          // Neue Auktion erstellen
          const { error: auctionError } = await supabase
            .from("auctions")
            .insert({
              motorhome_id: motorhome.id,
              starting_bid: isInstantOnly ? 0 : 50,
              reserve_price: reservePrice,
              status: "draft",
            } as any);

          if (auctionError) {
            logger.error("Auktion konnte nicht erstellt werden:", auctionError);
            // Nicht abbrechen - Motorhome wurde bereits erstellt
          }
        }
      }

      // Update profile with address if provided
      if (sellerId && (customerStreet.trim() || customerZip.trim() || customerCity.trim())) {
        const addressUpdate: Record<string, string> = {};
        if (customerStreet.trim()) addressUpdate.address_street = customerStreet.trim();
        if (customerZip.trim()) addressUpdate.address_zip = customerZip.trim();
        if (customerCity.trim()) addressUpdate.address_city = customerCity.trim();

        const { error: profileError } = await supabase
          .from("profiles")
          .update(addressUpdate)
          .eq("id", sellerId);

        if (profileError) {
          logger.warn("Adresse konnte nicht gespeichert werden:", profileError.message);
          // Nicht abbrechen - Motorhome wurde bereits erstellt
        }
      }

      // Mark source lead as converted
      const convertNote = `[${new Date().toLocaleDateString("de-DE")}] Als Wohnmobil angelegt (ID: ${motorhome.id})`;

      if (sourceType === "wizard") {
        await supabase
          .from("wizard_sessions")
          .update({
            status: "converted",
            admin_notes: `${(session as any).admin_notes ? (session as any).admin_notes + "\n" : ""}${convertNote}`,
          } as any)
          .eq("id", session.id);
      } else if (sourceType === "valuation") {
        await supabase
          .from("value_assessment_leads")
          .update({
            status: "converted",
          } as any)
          .eq("id", session.id);
      }

      return { motorhomeId: motorhome.id, saleChannel: formData.sale_channel };
    },
    onSuccess: (result) => {
      // Invalidate admin queries
      queryClient.invalidateQueries({ queryKey: ["adminWizardSessions"] });
      queryClient.invalidateQueries({ queryKey: ["adminValuationLeads"] });
      queryClient.invalidateQueries({ queryKey: ["adminMotorhomes"] });
      // Also invalidate seller-side queries so the customer dashboard updates
      // (covers the case where admin and seller are on the same browser or
      //  the seller has the dashboard open – Realtime handles the rest)
      queryClient.invalidateQueries({ queryKey: ["sellerTimeline"] });
      queryClient.invalidateQueries({ queryKey: ["myListings"] });
      queryClient.invalidateQueries({ queryKey: ["pendingWizardSession"] });
      setConversionResult(result);
    },
    onError: (error: Error) => {
      const germanMessage = handleAndLogError(error, {
        componentName: 'ConvertToMotorhomeDialog',
        category: 'api',
        severity: 'high',
        metadata: {
          sessionId: session?.id,
          customerEmail: customerEmail,
          action: 'convert_to_motorhome',
        },
      });
      toast({
        title: "Fehler beim Anlegen",
        description: germanMessage || error.message,
        variant: "destructive",
      });
    },
  });

  // ---- Invite Mutation: Send registration link ----
  const inviteMutation = useMutation({
    mutationFn: async (motorhomeId: string) => {
      const { data, error } = await invokeWithAuth(
        "send-registration-invite",
        {
          body: {
            email: customerEmail.trim(),
            customerName: customerName.trim() || undefined,
            motorhomeId,
            sessionId: session?.id,
          },
        }
      );

      if (error) throw new Error(error.message || "E-Mail konnte nicht gesendet werden");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Registrierungslink gesendet!",
        description: `Eine E-Mail mit dem Aktivierungslink wurde an ${customerEmail} gesendet.`,
      });
    },
    onError: (error: Error) => {
      const germanMessage = handleAndLogError(error, {
        componentName: 'ConvertToMotorhomeDialog',
        category: 'api',
        severity: 'medium',
        metadata: {
          sessionId: session?.id,
          customerEmail: customerEmail,
          action: 'send_registration_invite',
        },
      });
      toast({
        title: "Fehler beim Senden",
        description: germanMessage || error.message,
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
            {sourceType === "wizard" ? "Wizard-Anfrage" : "Wertrechner-Lead"} als Wohnmobil anlegen
          </DialogTitle>
          <DialogDescription>
            Prüfen und bearbeiten Sie die Daten{sourceType === "wizard" ? " aus der Wizard-Session" : ""}. Nach dem Anlegen
            erscheint das Fahrzeug in der Wohnmobil-Verwaltung.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <div className="space-y-1">
                  <Label htmlFor="conv-street" className="text-xs">Straße & Hausnr.</Label>
                  <Input
                    id="conv-street"
                    value={customerStreet}
                    onChange={(e) => setCustomerStreet(e.target.value)}
                    placeholder="Musterstraße 1"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="conv-zip" className="text-xs">PLZ</Label>
                  <Input
                    id="conv-zip"
                    value={customerZip}
                    onChange={(e) => setCustomerZip(e.target.value)}
                    placeholder="12345"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="conv-city" className="text-xs">Ort</Label>
                  <Input
                    id="conv-city"
                    value={customerCity}
                    onChange={(e) => setCustomerCity(e.target.value)}
                    placeholder="Berlin"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Die Adresse wird im Kundenprofil gespeichert und im Kaufvertrag verwendet.</p>
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

            {/* Price fields for Auktion */}
            {formData.sale_channel === "auction" && (
              <div className="space-y-4 animate-fade-in">
                {/* Sofortkauf-Option */}
                <div className="flex items-center justify-between p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-600" />
                    <Label htmlFor="conv-sofortkauf-toggle" className="cursor-pointer font-medium">
                      Sofortkauf aktivieren
                    </Label>
                  </div>
                  <Switch
                    id="conv-sofortkauf-toggle"
                    checked={!!formData.instant_price}
                    onCheckedChange={(checked) => {
                      if (!checked) {
                        updateField("instant_price", null);
                      } else {
                        updateField("instant_price", formData.reserve_price || "");
                      }
                    }}
                  />
                </div>

                {/* Sofortkauf-Preis (wenn aktiviert) */}
                {formData.instant_price !== null && formData.instant_price !== undefined && (
                  <div className="space-y-2 animate-fade-in">
                    <Label htmlFor="conv-instant-price">Sofortkauf-Preis (€) <span className="text-red-500">*</span></Label>
                    <Input
                      id="conv-instant-price"
                      type="number"
                      value={String(formData.instant_price || "")}
                      onChange={(e) => {
                        const val = e.target.value ? parseInt(e.target.value) : null;
                        updateField("instant_price", val);
                        // Mindestpreis automatisch auf Sofortkauf-Preis setzen
                        if (val) updateField("reserve_price", val);
                      }}
                      placeholder="z.B. 49000"
                    />
                    <p className="text-xs text-muted-foreground">
                      Der Mindestpreis wird automatisch auf den Sofortkauf-Preis gesetzt.
                      Händler können bieten oder direkt zum Sofortkauf-Preis kaufen.
                    </p>
                  </div>
                )}

                {/* Mindestpreis (nur wenn KEIN Sofortkauf) */}
                {!formData.instant_price && (
                  <div className="space-y-2 animate-fade-in">
                    <Label htmlFor="conv-reserve-price">Mindestpreis (€)</Label>
                    <Input
                      id="conv-reserve-price"
                      type="number"
                      value={String(formData.reserve_price || "")}
                      onChange={(e) => updateField("reserve_price", e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="optional"
                    />
                    <p className="text-xs text-muted-foreground">
                      Unter diesem Preis wird nicht verkauft. Lassen Sie das Feld leer für maximale Reichweite.
                    </p>
                  </div>
                )}
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

                {/* Standort */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="conv-postal-code">
                      PLZ (Fahrzeugstandort)
                    </Label>
                    <Input
                      id="conv-postal-code"
                      value={String(formData.postal_code || "")}
                      onChange={(e) => updateField("postal_code", e.target.value)}
                      placeholder="z.B. 80331"
                      maxLength={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conv-city">Stadt</Label>
                    <Input
                      id="conv-city"
                      value={String(formData.city || "")}
                      onChange={(e) => updateField("city", e.target.value)}
                      placeholder="z.B. München"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <MonthYearPicker
                      id="conv-first-reg"
                      label="Erstzulassung"
                      value={String(formData.first_registration || "").substring(0, 7)}
                      onChange={(val) => updateField("first_registration", val)}
                    />
                  </div>
                  <div className="space-y-2">
                    <MonthYearPicker
                      id="conv-tuev"
                      label="TÜV gültig bis"
                      value={String(formData.tuev_valid_until || "").substring(0, 7)}
                      onChange={(val) => updateField("tuev_valid_until", val)}
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
                    { key: "has_awning_tent", label: "Vorzelt" },
                    { key: "has_roof_ac", label: "Dachklima/Standklima" },
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

        {/* Success Screen after conversion */}
        {conversionResult && (
          <Card className="p-6 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-800 dark:text-green-200 mb-1">
                  Wohnmobil erfolgreich angelegt!
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300 mb-4">
                  {formData.manufacturer} {formData.model} wurde erstellt.
                  Senden Sie dem Kunden jetzt einen Registrierungslink, damit er sein Fahrzeug
                  in seinem Dashboard sehen und verwalten kann.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => inviteMutation.mutate(conversionResult.motorhomeId)}
                    disabled={inviteMutation.isPending || inviteMutation.isSuccess}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {inviteMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Wird gesendet...
                      </>
                    ) : inviteMutation.isSuccess ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Link gesendet an {customerEmail}
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Registrierungslink senden
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setConversionResult(null);
                      onOpenChange(false);
                    }}
                  >
                    Schließen
                  </Button>
                </div>
                {inviteMutation.isSuccess && (
                  <p className="text-xs text-green-600 mt-2">
                    Der Kunde erhält eine E-Mail mit einem Aktivierungslink.
                    Nach dem Klick wird er automatisch eingeloggt und sieht sein Fahrzeug im Dashboard.
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!conversionResult && (
            <>
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
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
