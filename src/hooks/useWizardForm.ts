import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { handleValidationError, handleAndLogError } from "@/lib/errorLogService";
import type { Database } from "@/integrations/supabase/types";

const STORAGE_KEY = "verkaufen_wizard_draft";

export interface WizardFormData {
  // Step 1: Vehicle Details
  manufacturer: string;
  model: string;
  year: number | null;
  mileage: number | null;
  condition: string;
  bodyType: string;
  description: string;

  // Step 2: Technical Details
  fuel_type?: string;
  power_kw?: number | null;
  power_ps?: number | null;
  transmission?: string;
  emission_class?: string;
  first_registration?: string;
  tuv_valid_until?: string;
  previous_owners?: number | null;
  accident_free: boolean;
  non_smoker: boolean;
  service_history_available: boolean;
  engine_displacement_ccm?: number | null;
  main_tires?: string;
  second_tires?: string;

  // Step 3: Dimensions & Capacity
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  total_weight_kg?: number | null;
  payload_kg?: number | null;
  number_of_axles: number;
  seats_with_seatbelts?: number | null;
  sleeping_places: number | null;
  beds_description?: string;

  // Step 4: Interior Features
  has_kitchen: boolean;
  heating_type?: string;
  air_conditioning: string;
  has_bathroom: boolean;
  has_toilet: boolean;
  has_shower: boolean;
  fresh_water_capacity_liters?: number | null;
  grey_water_capacity_liters?: number | null;

  // Step 5: Equipment & Features
  has_airbag: boolean;
  has_alarm: boolean;
  has_swivel_seats: boolean;
  has_esp: boolean;
  has_cruise_control: boolean;
  has_parking_sensors: boolean;
  has_reversing_camera: boolean;
  has_central_locking: boolean;
  has_solar: boolean;
  solar_power_watts?: number | null;
  battery_capacity_ah?: number | null;
  has_inverter: boolean;
  has_awning: boolean;
  awning_length_cm?: number | null;
  has_bike_rack: boolean;
  has_garage: boolean;
  has_tv_sat: boolean;

  // Step 6: Photos
  photos: File[];

  // Step 7: Sale Channel & Additional
  saleChannel: string;
  instantPrice: number | null;
  reservePrice: number | null;
  additional_equipment?: string;
  vehicle_identification_number?: string;
  license_plate?: string;
  country?: string;
  
  // Known Defects
  known_defects?: string;
  no_known_defects: boolean;
  
  // Step 8: Appointment (for station)
  stationId?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  appointmentNotes?: string;
}

const initialFormData: WizardFormData = {
  manufacturer: "",
  model: "",
  year: null,
  mileage: null,
  condition: "",
  bodyType: "",
  description: "",
  
  fuel_type: undefined,
  power_kw: null,
  power_ps: null,
  transmission: undefined,
  emission_class: undefined,
  first_registration: undefined,
  tuv_valid_until: undefined,
  previous_owners: null,
  accident_free: true,
  non_smoker: true,
  service_history_available: false,
  engine_displacement_ccm: null,
  main_tires: undefined,
  second_tires: undefined,
  
  length_cm: null,
  width_cm: null,
  height_cm: null,
  total_weight_kg: null,
  payload_kg: null,
  number_of_axles: 2,
  seats_with_seatbelts: null,
  sleeping_places: null,
  beds_description: undefined,
  
  has_kitchen: true,
  heating_type: undefined,
  air_conditioning: "Keine",
  has_bathroom: false,
  has_toilet: false,
  has_shower: false,
  fresh_water_capacity_liters: null,
  grey_water_capacity_liters: null,
  
  has_airbag: false,
  has_alarm: false,
  has_swivel_seats: false,
  has_esp: false,
  has_cruise_control: false,
  has_parking_sensors: false,
  has_reversing_camera: false,
  has_central_locking: false,
  has_solar: false,
  solar_power_watts: null,
  battery_capacity_ah: null,
  has_inverter: false,
  has_awning: false,
  awning_length_cm: null,
  has_bike_rack: false,
  has_garage: false,
  has_tv_sat: false,
  
  photos: [],
  saleChannel: "",
  instantPrice: null,
  reservePrice: null,
  additional_equipment: undefined,
  vehicle_identification_number: undefined,
  license_plate: undefined,
  country: "DE",
  
  known_defects: undefined,
  no_known_defects: false,
  
  stationId: undefined,
  appointmentDate: undefined,
  appointmentTime: undefined,
  customerName: undefined,
  customerPhone: undefined,
  customerEmail: undefined,
  appointmentNotes: undefined,
};

// Alle Zod-Schemas verwenden jetzt die globale germanZodErrorMap aus main.tsx
// Zusätzlich sind hier explizite deutsche Meldungen für benutzerdefinierte Regeln

const step1Schema = z.object({
  manufacturer: z.string().min(1, "Hersteller ist erforderlich"),
  model: z.string().min(1, "Modell ist erforderlich"),
  year: z.number({ required_error: "Baujahr ist ein Pflichtfeld", invalid_type_error: "Bitte geben Sie ein gültiges Baujahr ein" })
    .min(1980, "Baujahr muss nach 1980 sein")
    .max(new Date().getFullYear() + 1, `Baujahr darf nicht nach ${new Date().getFullYear() + 1} liegen`),
  mileage: z.number({ required_error: "Kilometerstand ist ein Pflichtfeld", invalid_type_error: "Bitte geben Sie einen gültigen Kilometerstand ein" })
    .min(0, "Kilometerstand darf nicht negativ sein"),
  condition: z.string().min(1, "Zustand ist erforderlich"),
  bodyType: z.string().min(1, "Aufbauart ist erforderlich"),
  description: z.string().min(20, "Beschreibung muss mindestens 20 Zeichen lang sein"),
});

const step2Schema = z.object({});

const step3Schema = z.object({
  seats_with_seatbelts: z.number({ required_error: "Sitzplätze mit Gurt ist ein Pflichtfeld", invalid_type_error: "Bitte geben Sie die Anzahl der Sitzplätze ein" })
    .min(1, "Mindestens 1 Sitzplatz erforderlich")
    .max(9, "Maximal 9 Sitzplätze möglich"),
  sleeping_places: z.number({ required_error: "Schlafplätze ist ein Pflichtfeld", invalid_type_error: "Bitte geben Sie die Anzahl der Schlafplätze ein" })
    .min(1, "Mindestens 1 Schlafplatz erforderlich")
    .max(9, "Maximal 9 Schlafplätze möglich"),
  length_cm: z.number({ invalid_type_error: "Bitte geben Sie eine gültige Länge in cm ein" }).min(200, "Länge muss mindestens 200 cm sein").nullable().optional(),
  width_cm: z.number({ invalid_type_error: "Bitte geben Sie eine gültige Breite in cm ein" }).min(150, "Breite muss mindestens 150 cm sein").nullable().optional(),
  height_cm: z.number({ invalid_type_error: "Bitte geben Sie eine gültige Höhe in cm ein" }).min(150, "Höhe muss mindestens 150 cm sein").nullable().optional(),
  total_weight_kg: z.number({ invalid_type_error: "Bitte geben Sie ein gültiges Gewicht in kg ein" }).min(500, "Gewicht muss mindestens 500 kg sein").nullable().optional(),
  payload_kg: z.number({ invalid_type_error: "Bitte geben Sie eine gültige Zuladung in kg ein" }).min(0, "Zuladung darf nicht negativ sein").nullable().optional(),
});

const step4Schema = z.object({});

const step5Schema = z.object({});

const step6Schema = z.object({
  photos: z.array(z.any()).min(4, "Bitte laden Sie mindestens 4 Fotos hoch").max(30, "Maximal 30 Fotos erlaubt"),
});

const step7Schema = z.object({
  no_known_defects: z.boolean(),
  known_defects: z.string().optional(),
}).refine(
  (data) => data.no_known_defects || (data.known_defects && data.known_defects.trim().length > 0),
  { message: "Bitte geben Sie an, ob Mängel bekannt sind, oder beschreiben Sie die vorhandenen Mängel" }
);

const step8Schema = z.object({
  saleChannel: z.string().min(1, "Bitte wählen Sie einen Verkaufsweg aus"),
});

export const useWizardForm = () => {
  const [formData, setFormData] = useState<WizardFormData>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          delete parsed.photos;
          return { ...initialFormData, ...parsed };
        } catch {
          // Ignore parse errors
        }
      }
    }
    return initialFormData;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const dataToSave = { ...formData };
      delete (dataToSave as Partial<WizardFormData>).photos;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [formData]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const updateFormData = (updates: Partial<WizardFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const validateStep = async (step: number): Promise<boolean> => {
    try {
      switch (step) {
        case 1:
          step1Schema.parse({
            manufacturer: formData.manufacturer,
            model: formData.model,
            year: formData.year,
            mileage: formData.mileage,
            condition: formData.condition,
            bodyType: formData.bodyType,
            description: formData.description,
          });
          break;
        case 2:
          step2Schema.parse({});
          break;
        case 3:
          step3Schema.parse({
            seats_with_seatbelts: formData.seats_with_seatbelts,
            sleeping_places: formData.sleeping_places,
            length_cm: formData.length_cm,
            width_cm: formData.width_cm,
            height_cm: formData.height_cm,
            total_weight_kg: formData.total_weight_kg,
            payload_kg: formData.payload_kg,
          });
          break;
        case 4:
          step4Schema.parse({});
          break;
        case 5:
          step5Schema.parse({});
          break;
        case 6:
          step6Schema.parse({
            photos: formData.photos,
          });
          break;
        case 7:
          step7Schema.parse({
            no_known_defects: formData.no_known_defects,
            known_defects: formData.known_defects,
          });
          break;
        case 8:
          step8Schema.parse({
            saleChannel: formData.saleChannel,
          });
          break;
        case 9:
          // Only validate appointment if station (Ankaufstation)
          if (formData.saleChannel === 'station') {
            if (!formData.stationId) {
              throw new z.ZodError([{
                code: 'custom',
                path: ['stationId'],
                message: 'Bitte wählen Sie eine Ankaufstation aus'
              }]);
            }
            if (!formData.appointmentDate || !formData.appointmentTime) {
              throw new z.ZodError([{
                code: 'custom',
                path: ['appointmentDate'],
                message: 'Bitte wählen Sie ein Datum und eine Uhrzeit für Ihren Termin'
              }]);
            }
            if (!formData.customerName || !formData.customerPhone || !formData.customerEmail) {
              throw new z.ZodError([{
                code: 'custom',
                path: ['customerName'],
                message: 'Bitte füllen Sie alle Kontaktfelder aus (Name, Telefon, E-Mail)'
              }]);
            }
          }
          break;
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Deutsche Fehlermeldung über den zentralen Service
        const germanMessage = handleValidationError(error, 'VerkaufenWizard');
        toast({
          title: "Bitte überprüfen Sie Ihre Eingaben",
          description: germanMessage,
          variant: "destructive",
        });
      }
      return false;
    }
  };

  const submitForm = async () => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Nicht angemeldet",
          description: "Bitte melden Sie sich an, um Ihr Wohnmobil einzustellen.",
          variant: "destructive",
        });
        navigate("/login?redirect=/verkaufen/wizard");
        return;
      }

      // Upload photos first
      const photoUrls: string[] = [];
      for (let i = 0; i < formData.photos.length; i++) {
        const file = formData.photos[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}_${i}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('motorhome-photos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('motorhome-photos')
          .getPublicUrl(fileName);

        photoUrls.push(publicUrl);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const motorhomeInsert: Record<string, any> = {
        seller_id: user.id,
        manufacturer: formData.manufacturer,
        model: formData.model,
        year: formData.year!,
        mileage: formData.mileage!,
        condition: formData.condition,
        body_type: formData.bodyType,
        description: formData.description,
        
        fuel_type: formData.fuel_type || null,
        engine_power_hp: formData.power_ps || null,
        transmission: formData.transmission || null,
        emission_class: formData.emission_class || null,
        tuev_valid_until: formData.tuv_valid_until || null,
        first_registration: formData.first_registration || null,
        previous_owners: formData.previous_owners ?? null,
        accident_free: formData.accident_free,
        non_smoker: formData.non_smoker,
        service_history_available: formData.service_history_available,
        engine_displacement_ccm: formData.engine_displacement_ccm || null,
        main_tires: formData.main_tires || null,
        second_tires: formData.second_tires || null,
        
        length_m: formData.length_cm ? formData.length_cm / 100 : null,
        width_m: formData.width_cm ? formData.width_cm / 100 : null,
        height_m: formData.height_cm ? formData.height_cm / 100 : null,
        weight_kg: formData.total_weight_kg || null,
        payload_kg: formData.payload_kg || null,
        seats: formData.seats_with_seatbelts || null,
        sleeping_places: formData.sleeping_places || null,
        number_of_axles: formData.number_of_axles || null,
        beds_description: formData.beds_description || null,
        
        has_kitchen: formData.has_kitchen,
        heating_type: formData.heating_type || null,
        air_conditioning_type: formData.air_conditioning || null,
        has_bathroom: formData.has_toilet || formData.has_shower,
        has_toilet: formData.has_toilet,
        has_shower: formData.has_shower,
        water_tank_liters: formData.fresh_water_capacity_liters || null,
        grey_water_capacity_liters: formData.grey_water_capacity_liters || null,
        
        // Equipment - Basisfahrzeug
        has_airbag: formData.has_airbag,
        has_alarm: formData.has_alarm,
        has_swivel_seats: formData.has_swivel_seats,
        has_esp: formData.has_esp,
        has_cruise_control: formData.has_cruise_control,
        has_parking_sensors: formData.has_parking_sensors,
        has_backup_camera: formData.has_reversing_camera,
        has_central_locking: formData.has_central_locking,
        // Equipment - Wohnbereich
        has_solar: formData.has_solar,
        solar_power_watts: formData.solar_power_watts || null,
        battery_capacity_ah: formData.battery_capacity_ah || null,
        has_inverter: formData.has_inverter,
        has_awning: formData.has_awning,
        awning_length_m: formData.awning_length_cm ? formData.awning_length_cm / 100 : null,
        has_bike_rack: formData.has_bike_rack,
        has_garage: formData.has_garage,
        has_tv: formData.has_tv_sat,
        has_satellite: formData.has_tv_sat,
        
        has_damage: !formData.no_known_defects,
        damage_summary: formData.known_defects || null,
        
        // Sale & Additional
        sale_channel: formData.saleChannel,
        instant_price: formData.instantPrice,
        reserve_price: formData.reservePrice,
        additional_equipment: formData.additional_equipment || null,
        vehicle_identification_number: formData.vehicle_identification_number || null,
        license_plate: formData.license_plate || null,
        country: formData.country || 'DE',
      };

      const { data: motorhome, error: motorhomeError } = await supabase
        .from('motorhomes')
        .insert([motorhomeInsert])
        .select()
        .single();

      if (motorhomeError) throw motorhomeError;

      const photoRecords = photoUrls.map((url, index) => ({
        motorhome_id: motorhome.id,
        url: url,
        display_order: index,
      }));

      const { error: photosError } = await supabase
        .from('motorhome_photos')
        .insert(photoRecords);

      if (photosError) throw photosError;

      // If auction, create auction entry
      if (formData.saleChannel === 'auction') {
        const { error: auctionError } = await supabase
          .from('auctions')
          .insert({
            motorhome_id: motorhome.id,
            starting_bid: 50,
            reserve_price: formData.reservePrice,
            status: 'draft',
          });

        if (auctionError) throw auctionError;
      }

      // If instant sale with appointment, create appointment
      if (formData.saleChannel === 'station' && formData.stationId) {
        const appointmentDateTime = new Date(formData.appointmentDate!);
        const [hours, minutes] = formData.appointmentTime!.split(':');
        appointmentDateTime.setHours(parseInt(hours), parseInt(minutes));

        const { error: appointmentError } = await supabase
          .from('appointments')
          .insert({
            station_id: formData.stationId,
            seller_id: user.id,
            motorhome_id: motorhome.id,
            appointment_date: appointmentDateTime.toISOString(),
            notes: formData.appointmentNotes || null,
            status: 'scheduled',
          });

        if (appointmentError) throw appointmentError;
      }

      clearDraft();

      toast({
        title: "Erfolgreich eingestellt!",
        description: "Ihr Wohnmobil wurde erfolgreich auf CaravanWert eingestellt.",
      });

      navigate("/dashboard/listings");
    } catch (error: unknown) {
      logger.error("Submission error:", error);
      // Zentrales Error-Handling mit deutscher Übersetzung und Logging
      const germanMessage = handleAndLogError(error, {
        componentName: 'VerkaufenWizard',
        category: 'api',
        severity: 'high',
      });
      toast({
        title: "Fehler beim Einstellen",
        description: germanMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    updateFormData,
    validateStep,
    submitForm,
    isSubmitting,
    clearDraft,
  };
};
