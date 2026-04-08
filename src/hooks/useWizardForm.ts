import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { handleValidationError, handleAndLogError } from "@/lib/errorLogService";
import { translateError } from "@/lib/germanErrors";
import { trackWizardCompleted, trackUserRegistered, setEnhancedConversionFromForm, generateTransactionId } from "@/lib/gadsConversionService";
import { getTrackingData } from "@/lib/clickIdService";
import { ensureValidSession, isSessionOrRLSError, isNetworkError, withNetworkRetry } from "@/lib/sessionGuard";
import type { Database } from "@/integrations/supabase/types";

const STORAGE_KEY = "verkaufen_wizard_draft";

export interface WizardFormData {
  // Step 1: Vehicle Type
  vehicleType: string; // "Wohnmobil" | "Wohnwagen"
  bodyType: string;

  // Step 2: Vehicle Info
  manufacturer: string;
  model: string;
  year: number | null;
  mileage: number | null;
  condition: string;
  description: string;

  // Step 2: Technical Details
  baseVehicle?: string;
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

  // Step 2: Capacity (merged from old DimensionsStep)
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  total_weight_kg?: number | null;
  payload_kg?: number | null;
  number_of_axles: number;
  seats_with_seatbelts?: number | null;
  sleeping_places: number | null;
  beds_description?: string;

  // Step 2: Defects (merged from old DefectsStep)
  known_defects?: string;
  no_known_defects: boolean;

  // Step 4: Interior Features (merged into Equipment)
  has_kitchen: boolean;
  heating_type?: string;
  air_conditioning: string;
  has_bathroom: boolean;
  has_toilet: boolean;
  has_shower: boolean;
  fresh_water_capacity_liters?: number | null;
  grey_water_capacity_liters?: number | null;

  // Step 4: Equipment & Features
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
  has_awning_tent: boolean;
  has_roof_ac: boolean;
  has_stand_ac: boolean;
  has_bike_rack: boolean;
  has_garage: boolean;
  has_tv_sat: boolean;

  // Step 6: Photos
  photos: File[];

  // Step 7: Sale Channel & Contact
  saleChannel: string;
  instantPrice: number | null;
  reservePrice: number | null;
  additional_equipment?: string;
  vehicle_identification_number?: string;
  license_plate?: string;
  country?: string;
  street?: string;
  houseNumber?: string;
  zipCode?: string;
  city?: string;

  // Step 7: Contact Data
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;

  // Legacy: Appointment (for station - handled post-submission)
  stationId?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  appointmentNotes?: string;
}

const initialFormData: WizardFormData = {
  vehicleType: "Wohnmobil",
  bodyType: "",
  manufacturer: "",
  model: "",
  year: null,
  mileage: null,
  condition: "",
  description: "",
  
  baseVehicle: undefined,
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

  known_defects: undefined,
  no_known_defects: true,
  
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
  has_awning_tent: false,
  has_roof_ac: false,
  has_stand_ac: false,
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
  street: undefined,
  houseNumber: undefined,
  zipCode: undefined,
  city: undefined,
  
  stationId: undefined,
  appointmentDate: undefined,
  appointmentTime: undefined,
  customerName: undefined,
  customerPhone: undefined,
  customerEmail: undefined,
  appointmentNotes: undefined,
};

// =============================================
// Validation Schemas for the 8-step wizard
// =============================================
// Step 1: Vehicle Type (bodyType als Tile-Selection)
// Step 2: Vehicle Info (manufacturer, model, year, mileage, condition)
// Step 3: Technical Details (fuel_type, transmission, seats, sleeping_places, defects)
// Step 4: Equipment (optional)
// Step 5: Quick Contact (name + email - Lead-Sicherung)
// Step 6: Photos (optional)
// Step 7: Final Contact & Sale Channel (saleChannel, phone, description, account)
// Step 8: Location & Account (address, password)

// Step 1: Vehicle Type (Aufbauart als Tile-Selection)
const step1Schema = z.object({
  bodyType: z.string().min(1, "Bitte wählen Sie eine Aufbauart"),
});

// Step 2: Vehicle Info – Wohnmobil (Hersteller, Modell, Baujahr, KM, Zustand)
const step2SchemaWohnmobil = z.object({
  manufacturer: z.string().min(1, "Hersteller ist erforderlich"),
  model: z.string().min(1, "Modell ist erforderlich"),
  year: z.number({ required_error: "Baujahr ist ein Pflichtfeld", invalid_type_error: "Bitte wählen Sie ein Baujahr" })
    .min(1980, "Baujahr muss nach 1980 sein")
    .max(new Date().getFullYear() + 1, `Baujahr darf nicht nach ${new Date().getFullYear() + 1} liegen`),
  mileage: z.number({ required_error: "Kilometerstand ist ein Pflichtfeld", invalid_type_error: "Bitte geben Sie den Kilometerstand ein" })
    .min(0, "Kilometerstand darf nicht negativ sein"),
  condition: z.string().min(1, "Zustand ist erforderlich"),
});

// Step 2: Vehicle Info – Wohnwagen (kein Kilometerstand, da kein Motor/Tacho)
const step2SchemaWohnwagen = z.object({
  manufacturer: z.string().min(1, "Hersteller ist erforderlich"),
  model: z.string().min(1, "Modell ist erforderlich"),
  year: z.number({ required_error: "Baujahr ist ein Pflichtfeld", invalid_type_error: "Bitte wählen Sie ein Baujahr" })
    .min(1980, "Baujahr muss nach 1980 sein")
    .max(new Date().getFullYear() + 1, `Baujahr darf nicht nach ${new Date().getFullYear() + 1} liegen`),
  condition: z.string().min(1, "Zustand ist erforderlich"),
});

// Step 3: Technical Details – Wohnmobil (fuel_type, transmission, sleeping_places required; seats optional; defects validated)
const step4SchemaWohnmobil = z.object({
  fuel_type: z.string().min(1, "Kraftstoffart ist erforderlich"),
  transmission: z.string().min(1, "Getriebe ist erforderlich"),
  sleeping_places: z.number({ required_error: "Schlafplätze ist ein Pflichtfeld", invalid_type_error: "Bitte wählen Sie die Anzahl der Schlafplätze" })
    .min(1, "Mindestens 1 Schlafplatz erforderlich")
    .max(9, "Maximal 9 Schlafplätze möglich"),
  no_known_defects: z.boolean(),
  known_defects: z.string().optional(),
}).refine(
  (data) => data.no_known_defects || (data.known_defects && data.known_defects.trim().length > 0),
  { message: "Bitte geben Sie an, ob Mängel bekannt sind, oder beschreiben Sie die vorhandenen Mängel" }
);

// Step 3: Technical Details – Wohnwagen (kein Motor, kein Getriebe, keine Sitzplätze)
const step4SchemaWohnwagen = z.object({
  sleeping_places: z.number({ required_error: "Schlafplätze ist ein Pflichtfeld", invalid_type_error: "Bitte wählen Sie die Anzahl der Schlafplätze" })
    .min(1, "Mindestens 1 Schlafplatz erforderlich")
    .max(9, "Maximal 9 Schlafplätze möglich"),
  no_known_defects: z.boolean(),
  known_defects: z.string().optional(),
}).refine(
  (data) => data.no_known_defects || (data.known_defects && data.known_defects.trim().length > 0),
  { message: "Bitte geben Sie an, ob Mängel bekannt sind, oder beschreiben Sie die vorhandenen Mängel" }
);

// Step 4: Equipment (all optional - no validation needed)
const step5Schema = z.object({});

// Step 5: Quick Contact (name + email - Lead-Sicherung)
const step3Schema = z.object({
  customerName: z.string().min(1, "Name ist erforderlich"),
  customerEmail: z.string().email("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
});

// Step 6: Photos (optional - no validation needed, user can skip)
const step6Schema = z.object({});

// Step 7: Sale Channel & Contact (saleChannel + phone required, name+email already captured)
const step7Schema = z.object({
  saleChannel: z.string().min(1, "Bitte wählen Sie einen Verkaufsweg"),
  customerName: z.string().min(1, "Name ist erforderlich"),
  customerEmail: z.string().email("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
  customerPhone: z.string().min(5, "Bitte geben Sie eine gültige Telefonnummer ein"),
});

// Step 8: Location & Account (Standort + Passwort - letzter Schritt)
// bodyType, manufacturer und saleChannel werden hier nochmals geprüft als letzte Sicherheitsebene vor dem Submit.
// saleChannel MUSS hier geprüft werden, weil handleSubmit nur validateStep(8) aufruft, nicht validateStep(7).
// Ohne diese Prüfung kann ein leerer saleChannel an die DB gesendet werden → PostgreSQL-Enum-Fehler.
const step8Schema = z.object({
  bodyType: z.string().min(1, "Aufbauart fehlt \u2013 bitte gehen Sie zur\u00fcck zu Schritt 1"),
  manufacturer: z.string().min(1, "Hersteller fehlt \u2013 bitte gehen Sie zur\u00fcck zu Schritt 2"),
  saleChannel: z.enum(['instant_price', 'auction', 'station'], {
    errorMap: () => ({ message: "Bitte w\u00e4hlen Sie einen Verkaufsweg \u2013 gehen Sie zur\u00fcck zu Schritt 7" }),
  }),
  customerName: z.string().min(1, "Name fehlt \u2013 bitte gehen Sie zur\u00fcck zu Schritt 5"),
  customerEmail: z.string().email("E-Mail-Adresse fehlt oder ung\u00fcltig \u2013 bitte gehen Sie zur\u00fcck zu Schritt 5"),
  customerPhone: z.string().min(5, "Telefonnummer fehlt \u2013 bitte gehen Sie zur\u00fcck zu Schritt 7"),
  street: z.string().min(1, "Stra\u00dfe ist erforderlich"),
  houseNumber: z.string().min(1, "Hausnummer ist erforderlich"),
  zipCode: z.string().min(3, "Bitte geben Sie eine g\u00fcltige PLZ ein").max(10, "PLZ ist zu lang"),
  city: z.string().min(1, "Ort ist erforderlich"),
  country: z.string().min(2, "Bitte w\u00e4hlen Sie ein Land"),
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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

  const updateFormData = useCallback((updates: Partial<WizardFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    // Fehler für geänderte Felder sofort entfernen
    const updatedFields = Object.keys(updates);
    if (updatedFields.length > 0) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        updatedFields.forEach((field) => delete next[field]);
        // Spezialfall: no_known_defects löscht auch den refine-Fehler
        if ('no_known_defects' in updates || 'known_defects' in updates) {
          delete next['_refine'];
        }
        return next;
      });
    }
  }, []);

  const validateStep = async (step: number): Promise<boolean> => {
    try {
      switch (step) {
        case 1:
          step1Schema.parse({
            bodyType: formData.bodyType,
          });
          break;
        case 2:
          if (formData.vehicleType === "Wohnwagen") {
            step2SchemaWohnwagen.parse({
              manufacturer: formData.manufacturer,
              model: formData.model,
              year: formData.year,
              condition: formData.condition,
            });
          } else {
            step2SchemaWohnmobil.parse({
              manufacturer: formData.manufacturer,
              model: formData.model,
              year: formData.year,
              mileage: formData.mileage,
              condition: formData.condition,
            });
          }
          break;
        case 3:
          if (formData.vehicleType === "Wohnwagen") {
            step4SchemaWohnwagen.parse({
              sleeping_places: formData.sleeping_places,
              no_known_defects: formData.no_known_defects,
              known_defects: formData.known_defects,
            });
          } else {
            step4SchemaWohnmobil.parse({
              fuel_type: formData.fuel_type,
              transmission: formData.transmission,
              sleeping_places: formData.sleeping_places,
              no_known_defects: formData.no_known_defects,
              known_defects: formData.known_defects,
            });
          }
          break;
        case 4:
          step5Schema.parse({});
          break;
        case 5:
          step3Schema.parse({
            customerName: formData.customerName,
            customerEmail: formData.customerEmail,
          });
          break;
        case 6:
          step6Schema.parse({});
          break;
        case 7:
          step7Schema.parse({
            saleChannel: formData.saleChannel,
            customerName: formData.customerName,
            customerEmail: formData.customerEmail,
            customerPhone: formData.customerPhone,
          });
          break;
        case 8:
          step8Schema.parse({
            bodyType: formData.bodyType,
            manufacturer: formData.manufacturer,
            saleChannel: formData.saleChannel,
            customerName: formData.customerName,
            customerEmail: formData.customerEmail,
            customerPhone: formData.customerPhone,
            street: formData.street,
            houseNumber: formData.houseNumber,
            zipCode: formData.zipCode,
            city: formData.city,
            country: formData.country || 'DE',
          });
          break;
      }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Feld-spezifische Fehler extrahieren für Inline-Anzeige
        const errors: Record<string, string> = {};
        error.errors.forEach((e) => {
          const fieldPath = e.path?.join('.') || '_refine';
          if (!errors[fieldPath]) {
            const translated = translateError(e.message);
            errors[fieldPath] = translated.message;
          }
        });
        setFieldErrors(errors);

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

  const submitForm = async (registerPassword?: string, botProtection?: { turnstileToken?: string | null; honeypot?: string }): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      // Bot-Check: Honeypot ausgefüllt → still abbrechen (Bot merkt nichts)
      if (botProtection?.honeypot && botProtection.honeypot.length > 0) {
        logger.info('Bot detected via honeypot, silently aborting');
        setIsSubmitting(false);
        return true; // Fake-Erfolg
      }

      // Check if user is already authenticated (with session validation)
      const sessionResult = await ensureValidSession();
      let user = sessionResult.user;

      if (sessionResult.wasRefreshed) {
        logger.info('Wizard submit: Session was proactively refreshed');
      }

      // Require password if not authenticated
      if (!user && !registerPassword) {
        toast({
          title: "Passwort fehlt",
          description: "Bitte legen Sie ein Passwort für Ihr Konto fest.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return false;
      }

      // User-Erstellung wurde in die Edge Function auto-convert-wizard verlagert.
      // WARUM: supabase.auth.signUp() sendet IMMER eine Standard-Bestätigungs-E-Mail
      // wenn "Confirm email" in Supabase Auth Settings aktiviert ist.
      // Das führte zu DOPPELTEN E-Mails (Supabase-Standard + unsere Custom-E-Mail).
      // Jetzt erstellt auto-convert-wizard den User per admin.createUser() mit
      // email_confirm: true, was KEINE automatische E-Mail sendet.
      // Das Passwort wird sicher über den Edge Function Request-Body übergeben.

      // If no active session (because email confirmation is pending), save wizard data
      // so it can be converted by the edge function automatically.
      if (!user) {
        // Build form_data JSON (exclude File objects which can't be serialized)
        const formDataForStorage = { ...formData };
        delete (formDataForStorage as Partial<WizardFormData>).photos;

        // User wird jetzt in auto-convert-wizard per admin.createUser() erstellt.
        // Daher gibt es hier keine user_id - sie wird von der Edge Function nachträglich gesetzt.
        const capturedUserId = null;

        // Save to wizard_sessions so admin can convert and data is not lost
        // Generate UUID client-side to avoid needing .select('id') after INSERT.
        // The SELECT RLS policy requires auth.uid() which is null for unconfirmed users,
        // so .select('id').single() would fail silently and return null.
        const generatedSessionId = crypto.randomUUID();
        let savedSessionId: string | null = null;
        try {
          const { error: sessionError } = await withNetworkRetry(
            () => supabase.from('wizard_sessions').insert({
              id: generatedSessionId,
              user_id: capturedUserId, // Use the signUp user ID if available
              anonymous_id: `wizard_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
              customer_name: formData.customerName || null,
              customer_email: formData.customerEmail || null,
              customer_phone: formData.customerPhone || null,
              current_step: 8,
              max_step_reached: 8,
              total_steps: 8,
              step_name: 'completed',
              form_data: formDataForStorage,
              status: 'completed',
              vehicle_summary: `${formData.manufacturer || ''} ${formData.model || ''} (${formData.year || ''}) - ${formData.bodyType || ''}`.trim(),
              completed_at: new Date().toISOString(),
            }),
            2,
            'wizard-session-insert'
          );
          
          if (sessionError) throw sessionError;
          savedSessionId = generatedSessionId;
          logger.info('Wizard session saved for signup-without-session user, id:', generatedSessionId);
        } catch (wizardSessionError) {
          logger.error('Failed to save wizard session:', wizardSessionError);
        }

        // ===== SOFORTIGE WEITERLEITUNG =====
        // Alle nachfolgenden Operationen (Photo-Upload, Edge Functions) laufen
        // fire-and-forget im Hintergrund. Die wizard_session ist bereits in der DB
        // gespeichert, daher gehen keine Daten verloren.
        //
        // ROOT CAUSE der 2-3 Min Wartezeit: Der Photo-Upload (await fetch()) blockierte
        // die Navigation. iPhone-Fotos sind 3-8 MB pro Stück, bei 5-10 Fotos = 25-80 MB
        // Upload über mobiles Netz = 2-3 Minuten. Jetzt fire-and-forget.

        // Google Ads: Enhanced Conversions + Wizard abgeschlossen (Guest-Pfad)
        // Tracking wird VOR der Navigation ausgeführt (schnell, client-seitig)
        const txId1 = generateTransactionId('wizard');
        (window as any).__lastTransactionId = txId1;
        setEnhancedConversionFromForm({ customerEmail: formData.customerEmail, customerName: formData.customerName, customerPhone: formData.customerPhone }).catch(() => {});
        trackWizardCompleted(`${formData.manufacturer || 'Unbekannt'} ${formData.model || ''} (${formData.year || ''}) - ${formData.bodyType || ''}`, txId1);

        clearDraft();

        toast({
          title: "Fahrzeug erfolgreich eingereicht!",
          description: "Sie erhalten in Kürze eine E-Mail zur Kontoaktivierung. Prüfen Sie Ihr Postfach.",
        });
        // Fotos und sessionId über window-Objekt an die Danke-Seite übergeben.
        // WARUM? File-Objekte sind nicht über history.state serialisierbar.
        // WARUM NICHT fire-and-forget? navigate() bricht laufende fetch()-Requests ab.
        // Die Danke-Seite liest diese Daten und startet den Upload dort.
        if (formData.photos.length > 0 && savedSessionId) {
          (window as any).__pendingWizardPhotos = {
            photos: formData.photos,
            sessionId: savedSessionId,
          };
        }
        navigate("/verkaufen/danke");

        // --- Background tasks (fire-and-forget, nicht blockierend) ---
        if (savedSessionId) {
          // 1. auto-convert-wizard: Erstellt Profil, Motorhome, sendet Aktivierungs-E-Mail
          supabase.functions.invoke("auto-convert-wizard", {
            body: {
              sessionId: savedSessionId,
              userId: null,  // User wird in auto-convert-wizard erstellt
              password: registerPassword,
              // Signal: User hat bereits ein Passwort im Wizard gesetzt
              hasPassword: true,
            },
          }).then(() => {
            logger.info("Auto-convert successful (background)");
          }).catch((convertErr) => {
            logger.error("Auto-convert failed (background):", convertErr);
          });

          // 2. send-lead-notification: Admin-Benachrichtigung + Conversion-Tracking
          const trackingData = getTrackingData();
          supabase.functions.invoke("send-lead-notification", {
            body: {
              type: "wizard",
              name: formData.customerName || "Unbekannt",
              email: formData.customerEmail || "",
              phone: formData.customerPhone || undefined,
              manufacturer: formData.manufacturer || undefined,
              model: formData.model || undefined,
              country: formData.country || "DE",
              gclid: trackingData.gclid,
              gbraid: trackingData.gbraid,
              wbraid: trackingData.wbraid,
              ga4ClientId: trackingData.ga4ClientId,
              transactionId: txId1,
              skipUserEmail: true,
              turnstileToken: botProtection?.turnstileToken || undefined,
              honeypot: botProtection?.honeypot || undefined,
            },
          }).catch((emailError) => {
            logger.error("Failed to send wizard lead notification (background):", emailError);
          });
        }

        return true;
      }

      // Ensure profile exists before motorhome insert (handles race condition
      // where handle_new_user trigger may have failed silently)
      try {
        const nameParts = (formData.customerName || "").split(" ");
        await supabase.rpc('ensure_profile_exists', {
          p_user_id: user.id,
          p_email: formData.customerEmail || user.email || '',
          p_first_name: nameParts[0] || null,
          p_last_name: nameParts.slice(1).join(' ') || null,
          p_phone: formData.customerPhone || null,
        });
      } catch (profileError) {
        logger.warn('ensure_profile_exists RPC failed, proceeding anyway:', profileError);
      }

      // Upload photos (parallel statt sequentiell für bessere Performance)
      const photoUrls: string[] = [];
      if (formData.photos.length > 0) {
        const uploadPromises = formData.photos.map(async (file, i) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}_${i}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('motorhome-photos')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('motorhome-photos')
            .getPublicUrl(fileName);

          return publicUrl;
        });

        const results = await Promise.all(uploadPromises);
        photoUrls.push(...results);
      }

      // Defensive Validierung: Pflichtfelder prüfen bevor DB-Insert versucht wird
      // Verhindert kryptische DB-Enum-Fehler (z.B. "invalid input value for enum motorhome_body_type: ''")
      const VALID_BODY_TYPES = ['Teilintegriert', 'Alkoven', 'Vollintegriert', 'Kastenwagen', 'Campingbus', 'Wohnwagen', 'Faltcaravan', 'Mobilheim'];
      if (!formData.bodyType || !VALID_BODY_TYPES.includes(formData.bodyType)) {
        throw new Error('Bitte wählen Sie eine gültige Aufbauart aus. Gehen Sie zurück zu Schritt 1.');
      }
      if (!formData.manufacturer || !formData.model || !formData.year || !formData.condition) {
        throw new Error('Fahrzeugdaten sind unvollständig. Bitte prüfen Sie Hersteller, Modell, Baujahr und Zustand.');
      }

      // Defensive Validierung: sale_channel muss ein gültiger Enum-Wert sein
      // Verhindert PostgreSQL-Fehler "invalid input value for enum sale_channel: ''"
      // Tritt auf wenn der User per URL-Parameter (?step=8) direkt zum letzten Step springt
      // und Step 7 (Verkaufsweg) nie besucht hat → saleChannel bleibt "" (initialFormData)
      const VALID_SALE_CHANNELS = ['instant_price', 'auction', 'station'] as const;
      if (!formData.saleChannel || !VALID_SALE_CHANNELS.includes(formData.saleChannel as typeof VALID_SALE_CHANNELS[number])) {
        throw new Error('Bitte wählen Sie einen Verkaufsweg aus. Gehen Sie zurück zu Schritt 7.');
      }

      // Defensive Validierung: Kontaktdaten müssen vorhanden sein
      if (!formData.customerName || !formData.customerEmail) {
        throw new Error('Kontaktdaten sind unvollständig. Bitte prüfen Sie Name und E-Mail-Adresse.');
      }

      // Wohnwagen haben keinen Motor – Motor-Felder auf null setzen
      const isWohnwagen = formData.vehicleType === "Wohnwagen";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const motorhomeInsert: Record<string, any> = {
        seller_id: user.id,
        manufacturer: formData.manufacturer,
        model: formData.model,
        year: formData.year!,
        mileage: isWohnwagen ? 0 : formData.mileage!,
        condition: formData.condition,
        body_type: formData.bodyType,
        description: formData.description || `${formData.manufacturer} ${formData.model} (${formData.year})`,
        
        fuel_type: isWohnwagen ? null : (formData.fuel_type || null),
        engine_power_hp: isWohnwagen ? null : (formData.power_ps || null),
        transmission: isWohnwagen ? null : (formData.transmission || null),
        emission_class: isWohnwagen ? null : (formData.emission_class || null),
        tuev_valid_until: formData.tuv_valid_until || null,
        first_registration: formData.first_registration || null,
        previous_owners: formData.previous_owners ?? null,
        accident_free: formData.accident_free,
        non_smoker: formData.non_smoker,
        service_history_available: formData.service_history_available,
        engine_displacement_ccm: isWohnwagen ? null : (formData.engine_displacement_ccm || null),
        main_tires: formData.main_tires || null,
        second_tires: formData.second_tires || null,
        
        length_m: formData.length_cm ? formData.length_cm / 100 : null,
        width_m: formData.width_cm ? formData.width_cm / 100 : null,
        height_m: formData.height_cm ? formData.height_cm / 100 : null,
        weight_kg: formData.total_weight_kg || null,
        payload_kg: formData.payload_kg || null,
        seats: isWohnwagen ? null : (formData.seats_with_seatbelts || null),
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
        
        has_airbag: isWohnwagen ? false : formData.has_airbag,
        has_alarm: formData.has_alarm,
        has_swivel_seats: isWohnwagen ? false : formData.has_swivel_seats,
        has_esp: isWohnwagen ? false : formData.has_esp,
        has_cruise_control: isWohnwagen ? false : formData.has_cruise_control,
        has_parking_sensors: isWohnwagen ? false : formData.has_parking_sensors,
        has_backup_camera: formData.has_reversing_camera,
        has_central_locking: formData.has_central_locking,
        has_solar: formData.has_solar,
        solar_power_watts: formData.solar_power_watts || null,
        battery_capacity_ah: formData.battery_capacity_ah || null,
        has_inverter: formData.has_inverter,
        has_awning: formData.has_awning,
        awning_length_m: formData.awning_length_cm ? formData.awning_length_cm / 100 : null,
        has_awning_tent: formData.has_awning_tent,
        has_roof_ac: formData.has_roof_ac,
        has_stand_ac: formData.has_stand_ac,
        has_bike_rack: formData.has_bike_rack,
        has_garage: formData.has_garage,
        has_tv: formData.has_tv_sat,
        has_satellite: formData.has_tv_sat,
        
        has_damage: !formData.no_known_defects,
        damage_summary: formData.known_defects || null,
        
        sale_channel: formData.saleChannel,
        instant_price: formData.instantPrice,
        reserve_price: formData.reservePrice,
        additional_equipment: formData.additional_equipment || null,
        vehicle_identification_number: formData.vehicle_identification_number || null,
        license_plate: formData.license_plate || null,
        country: formData.country || 'DE',
        postal_code: formData.zipCode || null,
        city: formData.city || null,
      };

      const { data: motorhome, error: motorhomeError } = await withNetworkRetry(
        () => supabase
          .from('motorhomes')
          .insert([motorhomeInsert])
          .select()
          .single(),
        2,
        'motorhomes-insert'
      );

      if (motorhomeError) {
        // If RLS error, the session might have expired between validation and insert.
        // Fall back to lead-only submission so the user's data is not lost.
        if (isSessionOrRLSError(motorhomeError)) {
          logger.warn('Wizard submit: RLS error on motorhomes insert, falling back to lead-only submission', {
            error: motorhomeError.message,
            userId: user.id,
          });

          // Try to save as lead instead
          try {
            const trackingData = getTrackingData();
            const transactionId = generateTransactionId('wizard');
            await supabase.functions.invoke("send-lead-notification", {
              body: {
                type: "wizard",
                name: formData.customerName || user.email || "Unbekannt",
                email: formData.customerEmail || user.email || "",
                phone: formData.customerPhone || undefined,
                manufacturer: formData.manufacturer || undefined,
                model: formData.model || undefined,
                country: formData.country || "DE",
                gclid: trackingData.gclid,
                gbraid: trackingData.gbraid,
                wbraid: trackingData.wbraid,
                ga4ClientId: trackingData.ga4ClientId,
                transactionId,
                skipUserEmail: true, // Admin-only – User bekommt bereits die Aktivierungs-E-Mail
                turnstileToken: botProtection?.turnstileToken || undefined,
                honeypot: botProtection?.honeypot || undefined,
              },
            });
          } catch (emailError) {
            logger.error("Failed to send fallback lead notification:", emailError);
          }

          clearDraft();
          toast({
            title: "Anfrage erfolgreich gesendet!",
            description: "Ihre Sitzung war abgelaufen, aber wir haben Ihre Daten sicher erhalten. Wir melden uns innerhalb von 24 Stunden bei Ihnen.",
          });
          navigate("/verkaufen/danke");
          return true;
        }
        throw motorhomeError;
      }

      // Insert photos
      if (photoUrls.length > 0) {
        const photoRecords = photoUrls.map((url, index) => ({
          motorhome_id: motorhome.id,
          url: url,
          display_order: index,
        }));

        const { error: photosError } = await supabase
          .from('motorhome_photos')
          .insert(photoRecords);

        if (photosError) throw photosError;
      }

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

      // Send notification to admin about new listing (fire-and-forget)
      const trackingData = getTrackingData();
      const transactionId = generateTransactionId('wizard');
      (window as any).__lastTransactionId = transactionId;
      supabase.functions.invoke("send-lead-notification", {
        body: {
          type: "wizard",
          name: formData.customerName || user.email || "Registrierter Nutzer",
          email: formData.customerEmail || user.email || "",
          phone: formData.customerPhone || undefined,
          manufacturer: formData.manufacturer || undefined,
          model: formData.model || undefined,
          country: formData.country || "DE",
          gclid: trackingData.gclid,
          gbraid: trackingData.gbraid,
          wbraid: trackingData.wbraid,
          ga4ClientId: trackingData.ga4ClientId,
          transactionId,
          skipUserEmail: true, // Admin-only – eingeloggter User braucht keine Bestätigungs-E-Mail
          turnstileToken: botProtection?.turnstileToken || undefined,
          honeypot: botProtection?.honeypot || undefined,
        },
      }).catch((emailError) => {
        logger.error("Failed to send wizard lead notification (background):", emailError);
      });

      // Adresse aus dem Wizard ins Profil übernehmen
      try {
        const profileUpdate: Record<string, string | null> = {};
        if (formData.street || formData.houseNumber) {
          profileUpdate.address_street = [formData.street, formData.houseNumber].filter(Boolean).join(' ') || null;
        }
        if (formData.zipCode) profileUpdate.address_zip = formData.zipCode;
        if (formData.city) profileUpdate.address_city = formData.city;
        if (formData.country) profileUpdate.address_country = formData.country;
        if (formData.customerName) {
          const nameParts = formData.customerName.trim().split(/\s+/);
          if (nameParts.length >= 2) {
            profileUpdate.first_name = nameParts[0];
            profileUpdate.last_name = nameParts.slice(1).join(' ');
          } else if (nameParts.length === 1) {
            profileUpdate.last_name = nameParts[0];
          }
        }
        if (formData.customerPhone) profileUpdate.phone = formData.customerPhone;

        if (Object.keys(profileUpdate).length > 0) {
          await supabase
            .from('profiles')
            .update(profileUpdate)
            .eq('id', user.id);
        }
      } catch (profileError) {
        logger.warn('Wizard: Profil-Update mit Adresse fehlgeschlagen (nicht kritisch)', profileError);
      }

      clearDraft();

      // Google Ads: Enhanced Conversions + Wizard abgeschlossen (authentifizierter Pfad)
      const txId3 = (window as any).__lastTransactionId || generateTransactionId('wizard');
      await setEnhancedConversionFromForm({ customerEmail: formData.customerEmail, customerName: formData.customerName, customerPhone: formData.customerPhone });
      trackWizardCompleted(`${formData.manufacturer || 'Unbekannt'} ${formData.model || ''} (${formData.year || ''}) - ${formData.bodyType || ''}`, txId3);

      toast({
        title: "Erfolgreich eingestellt!",
        description: "Ihr Wohnmobil wurde erfolgreich auf CaravanWert eingestellt.",
      });

      navigate("/dashboard/listings");
      return true;
    } catch (error: unknown) {
      logger.error("Submission error:", error);

      // Bei Netzwerkfehlern: spezifischere Meldung und Hinweis auf erneuten Versuch
      if (isNetworkError(error)) {
        const germanMessage = handleAndLogError(error, {
          componentName: 'VerkaufenWizard',
          category: 'api',
          severity: 'medium', // Netzwerkfehler sind weniger kritisch als echte API-Fehler
          metadata: { retryHint: true, networkError: true },
        });
        toast({
          title: "Verbindungsproblem",
          description: "Die Verbindung zum Server wurde unterbrochen. Ihre Daten sind gespeichert \u2013 bitte versuchen Sie es erneut.",
          variant: "destructive",
        });
        return false;
      }

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
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearFieldErrors = useCallback(() => {
    setFieldErrors({});
  }, []);

  return {
    formData,
    updateFormData,
    validateStep,
    submitForm,
    isSubmitting,
    clearDraft,
    fieldErrors,
    clearFieldErrors,
  };
};
