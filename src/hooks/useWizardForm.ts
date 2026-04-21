import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { handleValidationError, handleAndLogError } from "@/lib/errorLogService";
import { translateError } from "@/lib/germanErrors";
import { trackWizardCompleted, setEnhancedConversionFromForm, generateTransactionId } from "@/lib/gadsConversionService";
import { getTrackingData, getStoredClickIds } from "@/lib/clickIdService";
import { trackEvent } from "@/lib/analyticsService";
import { ensureValidSession, ensureValidRLSSession, isSessionOrRLSError, isNetworkError, withNetworkRetry } from "@/lib/sessionGuard";
import { optimizeImage, OPTIMIZATION_PRESETS } from "@/lib/imageOptimization";
import { MARKETING_CONFIG } from "@/lib/marketing-config";

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
  // Pflicht-Consent für die Marketingphase (Auktion / Festpreis).
  // Phase 1 des Marketing-Phase-Rollouts – juristisch verankert in AGB §6.
  // Wird im SaleChannelStep abgefragt, sobald saleChannel ∈ {auction, instant_price}.
  marketingConsent: boolean;
  // Verkäufer-Wunsch für automatische Preissenkung pro Runde.
  // null = noch nicht entschieden → Channel-Default greift
  // (true bei Auktion, false bei Festpreis, siehe MARKETING_CONFIG).
  dynamicPricing: boolean | null;
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
  marketingConsent: false,
  dynamicPricing: null,
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
// Step 7: Sale Channel + Phone (light) – saleChannel, Preis, Telefon, optional Beschreibung
// Step 8: Location & Account – Standort, Passwort, Marketingphasen-Consent (Pflicht
//         für auction + instant_price, AGB §6 / § 305c BGB) und Submit. Bei
//         sale_channel = 'station' wird die Consent-Checkbox ausgeblendet.

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

// Step 3: Technical Details – ALL OPTIONAL (smart defaults pre-filled in DetailsStep)
// Competitor analysis (Caravanmarkt24): they don't ask ANY tech details for initial offer.
// Making this step zero-friction while still collecting valuable data via defaults.
const step4Schema = z.object({});

// Step 4: Equipment (all optional - no validation needed)
const step5Schema = z.object({});

// Step 5: Quick Contact (name + email - Lead-Sicherung)
const step3Schema = z.object({
  customerName: z.string().min(1, "Name ist erforderlich"),
  customerEmail: z.string().email("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
});

// Step 6: Photos (optional - no validation needed, user can skip)
const step6Schema = z.object({});

// A reasonable-but-permissive phone check: min 6 usable digits, allows +, spaces, -, /, ().
// We deliberately stay permissive (international formats) but reject e.g. "12" or "abc".
const phoneRegex = /^[+()\d\s\-/.]{6,}$/;
const phoneSchema = z
  .string()
  .min(5, "Bitte geben Sie eine gültige Telefonnummer ein")
  .regex(phoneRegex, "Bitte geben Sie eine gültige Telefonnummer ein")
  .refine(
    (v) => (v.match(/\d/g) || []).length >= 6,
    "Telefonnummer benötigt mindestens 6 Ziffern"
  );

// Step 7: Sale Channel + Phone (light)
//
// Pflicht: saleChannel, customerPhone und der Channel-spezifische Preis
// (instantPrice für instant_price, reservePrice für auction).
//
// Name + E-Mail sind hier NICHT mehr Pflicht – sie wurden bereits in Step 5
// (QuickContactStep) erfasst und werden in Step 7 nur noch zur Bestätigung
// angezeigt. Der Marketing-Consent (AGB §6) sitzt jetzt direkt am Ende von
// Step 8 als kompakte Pflicht-Checkbox, damit Step 7 entlastet ist und der
// User bei Abbruch in Step 8 trotzdem schon Telefonnummer + Standort hat.
const step7Schema = z.object({
  saleChannel: z.string().min(1, "Bitte wählen Sie einen Verkaufsweg"),
  reservePrice: z.number().nullable().optional(),
  customerPhone: phoneSchema,
  instantPrice: z.number().nullable().optional(),
}).superRefine((data, ctx) => {
  if (data.saleChannel === 'instant_price' && !(data.instantPrice != null && data.instantPrice > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['instantPrice'],
      message: "Bitte geben Sie Ihren Wunschpreis ein",
    });
  }
  if (data.saleChannel === 'auction' && !(data.reservePrice != null && data.reservePrice > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reservePrice'],
      message: "Bitte geben Sie Ihren Wunsch-Mindestpreis ein",
    });
  }
});

// Step 8: Location & Account (Standort + Passwort + Marketingphasen-Consent)
//
// bodyType, manufacturer, saleChannel und der Channel-spezifische Preis
// werden hier mitgeprüft als zusätzliche Sicherheitsebene gegen URL-Hacks
// (z.B. ?step=8 ohne Step 7 zu durchlaufen).
//
// Der Marketingphasen-Consent ist hier (nicht mehr in einem eigenen Step 9)
// als kompakte Inline-Pflicht-Checkbox integriert – juristisch erforderlich
// nach § 305c BGB für die „überraschenden" Klauseln Bindungsphase und
// automatische Preisanpassung. Für sale_channel = 'station' entfällt der
// Consent komplett (keine Marketingphase, kein § 305c-Risiko).
const step8Schema = z.object({
  bodyType: z.string().min(1, "Aufbauart fehlt \u2013 bitte gehen Sie zur\u00fcck zu Schritt 1"),
  manufacturer: z.string().min(1, "Hersteller fehlt \u2013 bitte gehen Sie zur\u00fcck zu Schritt 2"),
  saleChannel: z.enum(['instant_price', 'auction', 'station'], {
    errorMap: () => ({ message: "Bitte w\u00e4hlen Sie einen Verkaufsweg \u2013 gehen Sie zur\u00fcck zu Schritt 7" }),
  }),
  instantPrice: z.number().nullable().optional(),
  reservePrice: z.number().nullable().optional(),
  customerName: z.string().min(1, "Name fehlt \u2013 bitte gehen Sie zur\u00fcck zu Schritt 5"),
  customerEmail: z.string().email("E-Mail-Adresse fehlt oder ung\u00fcltig \u2013 bitte gehen Sie zur\u00fcck zu Schritt 5"),
  customerPhone: phoneSchema,
  street: z.string().min(1, "Stra\u00dfe ist erforderlich"),
  houseNumber: z.string().min(1, "Hausnummer ist erforderlich"),
  zipCode: z.string().min(3, "Bitte geben Sie eine g\u00fcltige PLZ ein").max(10, "PLZ ist zu lang"),
  city: z.string().min(1, "Ort ist erforderlich"),
  country: z.string().min(2, "Bitte w\u00e4hlen Sie ein Land"),
  marketingConsent: z.boolean().optional(),
}).superRefine((data, ctx) => {
  if (data.saleChannel === 'instant_price' && !(data.instantPrice != null && data.instantPrice > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['instantPrice'],
      message: "Sofortkauf ben\u00f6tigt einen Wunschpreis gr\u00f6\u00dfer 0 \u2013 gehen Sie zur\u00fcck zu Schritt 7",
    });
  }
  if (data.saleChannel === 'auction' && !(data.reservePrice != null && data.reservePrice > 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reservePrice'],
      message: "Auktion ben\u00f6tigt einen Mindestpreis gr\u00f6\u00dfer 0 \u2013 gehen Sie zur\u00fcck zu Schritt 7",
    });
  }
  // Marketingphasen-Consent ist NUR für auction + instant_price erforderlich.
  // Für station gibt es keine Marketingphase – Checkbox wird im UI ausgeblendet.
  if (
    (data.saleChannel === 'auction' || data.saleChannel === 'instant_price') &&
    data.marketingConsent !== true
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['marketingConsent'],
      message: "Bitte bestätigen Sie die Marketingphase gem\u00e4\u00df AGB \u00a76, um Ihr Inserat zu ver\u00f6ffentlichen",
    });
  }
});

// Passwort-Validierung f\u00fcr Gast-Submit (Step 8 ohne bestehendes Login).
// Verlangt 8+ Zeichen, 1 Gro\u00df-, 1 Kleinbuchstabe und 1 Ziffer.
// Sonderzeichen sind empfohlen, aber nicht hart verlangt (Score-UI zeigt an).
const passwordSchema = z.object({
  registerPassword: z
    .string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
    .regex(/[A-Z]/, "Passwort muss mindestens einen Gro\u00dfbuchstaben enthalten")
    .regex(/[a-z]/, "Passwort muss mindestens einen Kleinbuchstaben enthalten")
    .regex(/[0-9]/, "Passwort muss mindestens eine Ziffer enthalten"),
  confirmPassword: z.string().min(1, "Bitte Passwort best\u00e4tigen"),
}).refine((d) => d.registerPassword === d.confirmPassword, {
  message: "Passw\u00f6rter stimmen nicht \u00fcberein",
  path: ['confirmPassword'],
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
          // Step 3 is fully optional (smart defaults pre-filled)
          step4Schema.parse({});
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
            reservePrice: formData.reservePrice,
            customerPhone: formData.customerPhone,
            instantPrice: formData.instantPrice,
          });
          break;
        case 8:
          step8Schema.parse({
            bodyType: formData.bodyType,
            manufacturer: formData.manufacturer,
            saleChannel: formData.saleChannel,
            instantPrice: formData.instantPrice,
            reservePrice: formData.reservePrice,
            customerName: formData.customerName,
            customerEmail: formData.customerEmail,
            customerPhone: formData.customerPhone,
            street: formData.street,
            houseNumber: formData.houseNumber,
            zipCode: formData.zipCode,
            city: formData.city,
            country: formData.country || 'DE',
            marketingConsent: formData.marketingConsent,
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

  const submitForm = async (
    registerPassword?: string,
    botProtection?: { turnstileToken?: string | null; honeypot?: string },
    context?: { existingSessionId?: string | null; anonymousId?: string | null }
  ): Promise<boolean> => {
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
      const user = sessionResult.user;

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

        const savedClickIds = getStoredClickIds();

        // Prefer UPDATEing the existing wizard_session created by useWizardSession
        // on mount — otherwise we end up with two "completed" rows for a single
        // lead. Fall back to a fresh INSERT only when no session is available
        // (e.g. initial RPC create failed earlier).
        let savedSessionId: string | null = null;
        const existingSessionId = context?.existingSessionId || null;
        const existingAnonId = context?.anonymousId || null;

        if (existingSessionId && existingAnonId) {
          try {
            const { error: updateError } = await withNetworkRetry(
              () => supabase.rpc('update_wizard_session_by_anonymous_id', {
                p_anonymous_id: existingAnonId,
                p_session_id: existingSessionId,
                p_updates: {
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
                  gclid: savedClickIds.gclid || null,
                  gbraid: savedClickIds.gbraid || null,
                  wbraid: savedClickIds.wbraid || null,
                },
              }),
              2,
              'wizard-session-update'
            );
            if (updateError) throw updateError;
            savedSessionId = existingSessionId;
            logger.info('Wizard session updated for guest submit, id:', savedSessionId);
          } catch (wizardUpdateErr) {
            logger.warn('Guest submit: session UPDATE failed, falling back to INSERT', wizardUpdateErr);
          }
        }

        if (!savedSessionId) {
          const generatedSessionId = crypto.randomUUID();
          try {
            const { error: sessionError } = await withNetworkRetry(
              () => supabase.from('wizard_sessions').insert({
                id: generatedSessionId,
                user_id: null,
                anonymous_id: existingAnonId || `wizard_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
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
                gclid: savedClickIds.gclid || null,
                gbraid: savedClickIds.gbraid || null,
                wbraid: savedClickIds.wbraid || null,
              }),
              2,
              'wizard-session-insert'
            );

            if (sessionError) throw sessionError;
            savedSessionId = generatedSessionId;
            logger.info('Wizard session saved for signup-without-session user, id:', generatedSessionId);
          } catch (wizardSessionError) {
            // C3: FAIL LOUD — previously this error was swallowed and the user
            // was told everything succeeded while their data was lost. Now we
            // surface the error and abort the submit so they can retry.
            logger.error('Failed to save wizard session:', wizardSessionError);
            toast({
              title: "Fehler beim Speichern",
              description:
                "Ihre Anfrage konnte nicht gespeichert werden. Bitte pr\u00fcfen Sie Ihre Internetverbindung und versuchen Sie es erneut.",
              variant: "destructive",
            });
            setIsSubmitting(false);
            return false;
          }
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
        setEnhancedConversionFromForm({ customerEmail: formData.customerEmail, customerName: formData.customerName, customerPhone: formData.customerPhone, postalCode: formData.zipCode, country: formData.country }).catch((err) => {
          console.error('[useWizardForm] setEnhancedConversionFromForm failed (non-blocking):', err);
        });
        trackWizardCompleted(`${formData.manufacturer || 'Unbekannt'} ${formData.model || ''} (${formData.year || ''}) - ${formData.bodyType || ''}`, txId1);
        trackEvent('wizard_completed', { category: 'business', properties: { manufacturer: formData.manufacturer, model: formData.model, bodyType: formData.bodyType, saleChannel: formData.saleChannel, path: 'guest' } });

        clearDraft();

        toast({
          title: "Fahrzeug erfolgreich eingereicht!",
          description: "Sie erhalten in Kürze eine E-Mail zur Kontoaktivierung. Prüfen Sie Ihr Postfach.",
        });
        // Alle Daten über window-Objekt an die Danke-Seite übergeben.
        // WARUM? navigate() bricht laufende fetch()-Requests ab (OPTIONS geht durch,
        // aber der eigentliche POST wird abgebrochen). Deshalb müssen ALLE
        // Edge-Function-Aufrufe auf der Danke-Seite starten, nicht hier.
        if (savedSessionId) {
          const trackingData = getTrackingData();
          (window as any).__pendingWizardConvert = {
            sessionId: savedSessionId,
            anonymousId: context?.anonymousId || null,
            password: registerPassword,
            leadNotification: {
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
          };
        }
        if (formData.photos.length > 0 && savedSessionId) {
          (window as any).__pendingWizardPhotos = {
            photos: formData.photos,
            sessionId: savedSessionId,
            anonymousId: context?.anonymousId || null,
          };
        }
        navigate("/verkaufen/danke");

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
          let uploadFile: File;
          let fileExt: string;
          try {
            const optimized = await optimizeImage(file, OPTIMIZATION_PRESETS.STANDARD);
            uploadFile = optimized.file;
            fileExt = optimized.format;
          } catch {
            uploadFile = file;
            fileExt = file.name.split('.').pop() || 'jpg';
          }
          const fileName = `${user.id}/${Date.now()}_${i}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('motorhome-photos')
            .upload(fileName, uploadFile, {
              contentType: uploadFile.type || `image/${fileExt}`,
              cacheControl: "31536000, immutable",
            });

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

      // Insert photos + create auction. If either fails we roll back the
      // motorhome row so we don't leave half-created listings behind.
      const rollbackMotorhome = async (reason: string) => {
        logger.error(`Wizard submit: rolling back motorhome ${motorhome.id} (${reason})`);
        try {
          await supabase.from('motorhome_photos').delete().eq('motorhome_id', motorhome.id);
          await supabase.from('auctions').delete().eq('motorhome_id', motorhome.id);
          await supabase.from('motorhomes').delete().eq('id', motorhome.id);
        } catch (rollbackErr) {
          logger.error('Rollback after failed wizard submit failed:', rollbackErr);
        }
      };

      if (photoUrls.length > 0) {
        const photoRecords = photoUrls.map((url, index) => ({
          motorhome_id: motorhome.id,
          url: url,
          display_order: index,
        }));

        const { error: photosError } = await supabase
          .from('motorhome_photos')
          .insert(photoRecords);

        if (photosError) {
          await rollbackMotorhome('photos insert failed');
          throw photosError;
        }
      }

      // Create auction listing (for both 'auction' and 'instant_price' channels)
      // instant_price vehicles use the auction as a listing container but disable bidding.
      //
      // Marketing-Phase Felder (Phase 1 / Phase 2 Rollout):
      //   * seller_initial_reserve / seller_initial_instant_price: Anker für die
      //     Reduktionslogik (-6 % Floor Auktion, -10 % Floor Festpreis). Bleibt
      //     unsichtbar für Käufer/Händler.
      //   * dynamic_pricing: Verkäufer-Opt-in für automatische Preissenkung pro
      //     Runde. Default richtet sich nach dem Channel (Auktion: an, Festpreis: aus).
      //   * agb_version_at_start: Snapshot der akzeptierten AGB-Version zum
      //     Aktivierungs-Zeitpunkt (juristische Absicherung pro Inserat).
      //   * marketing_phase_started_at / max_until werden ERST bei der Admin-
      //     Aktivierung gesetzt (Phase 3/4), nicht beim Draft-Insert.
      //   * starting_bid wird über compute_random_starting_bid auf 40-60 % vom
      //     Reserve-Preis gesetzt, damit Händler den Reserve nicht reverse-engineeren
      //     können. Festpreis-Inserate bleiben bei starting_bid=0.
      if (formData.saleChannel === 'auction' || formData.saleChannel === 'instant_price') {
        const isInstantOnly = formData.saleChannel === 'instant_price';
        const reserveForAuction = isInstantOnly ? formData.instantPrice : formData.reservePrice;

        // Channel-Default für dynamic_pricing nutzen, wenn der User nichts geändert hat.
        const dynamicPricingForInsert =
          formData.dynamicPricing != null
            ? formData.dynamicPricing
            : isInstantOnly
              ? MARKETING_CONFIG.INSTANT_PRICE_DYNAMIC_PRICING_DEFAULT
              : MARKETING_CONFIG.AUCTION_DYNAMIC_PRICING_DEFAULT;

        // Aktuelle AGB-Version snapshotten – non-fatal falls RPC nicht verfügbar
        // ist (z. B. älteres DB-Schema), dann bleibt agb_version_at_start NULL.
        // RPC ist ans DB Schema 20260414180100_update_agb_kaufchance_auto_relist.sql
        // gebunden; types.ts kennt sie aber via generierter rpc-Map.
        let agbVersion: string | null = null;
        try {
          const { data: agbData, error: agbErr } = await supabase.rpc('get_current_agb_version');
          if (!agbErr && typeof agbData === 'string' && agbData.length > 0) {
            agbVersion = agbData;
          }
        } catch (agbRpcErr) {
          logger.warn('get_current_agb_version RPC failed (non-critical):', agbRpcErr);
        }

        // Random Startgebot 40-60 % vom Reserve (nur Auktion). Festpreis: 0.
        // Verhindert Reverse-Engineering des Reserve-Preises durch Händler,
        // siehe migration 20260420212000_random_starting_bid_rpc.sql.
        // RPC noch nicht in types.ts → cast über supabase.rpc.
        let startingBid = 0;
        if (!isInstantOnly && reserveForAuction && reserveForAuction > 0) {
          try {
            const { data: bidData, error: bidErr } = await (
              supabase as unknown as {
                rpc: (
                  fn: 'compute_random_starting_bid',
                  args: { p_reserve_price: number },
                ) => Promise<{ data: number | null; error: unknown }>;
              }
            ).rpc('compute_random_starting_bid', { p_reserve_price: reserveForAuction });
            if (!bidErr && typeof bidData === 'number' && bidData > 0) {
              startingBid = bidData;
            } else {
              startingBid = 50;
            }
          } catch (bidRpcErr) {
            logger.warn('compute_random_starting_bid RPC failed, falling back to 50:', bidRpcErr);
            startingBid = 50;
          }
        }

        // Cast über `Record<string, unknown>` weil seller_initial_*, dynamic_pricing,
        // agb_version_at_start in den lokalen supabase-types.ts noch nicht regeneriert
        // sind (Migration 20260420210000 ist deployt, aber types.ts wird noch nicht
        // gepflegt um die ~1900 Strict-Generic-Errors über die ganze Codebase zu vermeiden).
        const auctionInsertPayload: Record<string, unknown> = {
          motorhome_id: motorhome.id,
          starting_bid: startingBid,
          reserve_price: reserveForAuction,
          status: 'draft',
          seller_initial_reserve: reserveForAuction,
          seller_initial_instant_price: isInstantOnly ? formData.instantPrice : null,
          dynamic_pricing: dynamicPricingForInsert,
          agb_version_at_start: agbVersion,
        };
        const { error: auctionError } = await supabase
          .from('auctions')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(auctionInsertPayload as any);

        if (auctionError) {
          await rollbackMotorhome('auction insert failed');
          throw auctionError;
        }
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
          const sessionValid = await ensureValidRLSSession();
          if (!sessionValid) return;

          await supabase
            .from('profiles')
            .update(profileUpdate)
            .eq('id', user.id);
        }
      } catch (profileError) {
        logger.warn('Wizard: Profil-Update mit Adresse fehlgeschlagen (nicht kritisch)', profileError);
      }

      clearDraft();

      try { await supabase.rpc('record_agb_acceptance', { p_user_id: user.id, p_context: 'wizard' }); } catch {}

      const txId3 = (window as any).__lastTransactionId || generateTransactionId('wizard');
      await setEnhancedConversionFromForm({ customerEmail: formData.customerEmail, customerName: formData.customerName, customerPhone: formData.customerPhone, postalCode: formData.zipCode, country: formData.country });
      trackWizardCompleted(`${formData.manufacturer || 'Unbekannt'} ${formData.model || ''} (${formData.year || ''}) - ${formData.bodyType || ''}`, txId3);
      trackEvent('wizard_completed', { category: 'business', properties: { manufacturer: formData.manufacturer, model: formData.model, bodyType: formData.bodyType, saleChannel: formData.saleChannel, path: 'authenticated' } });

      toast({
        title: "Erfolgreich eingestellt!",
        description: "Ihr Wohnmobil wurde erfolgreich auf CaravanWert eingestellt.",
      });

      navigate("/dashboard/listings");
      return true;
    } catch (error: unknown) {
      logger.error("Submission error:", error);

      // Bei Netzwerkfehlern: spezifischere Meldung und Hinweis auf erneuten Versuch.
      // handleAndLogError() is called for its side-effect (Sentry/analytics log);
      // the translated return value is discarded here because the toast below
      // uses a fixed, friendlier wording for network hiccups.
      if (isNetworkError(error)) {
        handleAndLogError(error, {
          componentName: 'VerkaufenWizard',
          category: 'api',
          severity: 'medium',
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

  /**
   * Validates the password fields for the guest registration flow (Step 8).
   * Returns true if the password is strong enough and both fields match.
   * Also writes the resulting errors into `fieldErrors` so the form can
   * highlight the offending inputs.
   */
  const validatePassword = useCallback(
    (registerPassword: string, confirmPassword: string): boolean => {
      try {
        passwordSchema.parse({ registerPassword, confirmPassword });
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.registerPassword;
          delete next.confirmPassword;
          return next;
        });
        return true;
      } catch (error) {
        if (error instanceof z.ZodError) {
          const errors: Record<string, string> = {};
          error.errors.forEach((e) => {
            const fieldPath = e.path?.join('.') || 'registerPassword';
            if (!errors[fieldPath]) {
              errors[fieldPath] = e.message;
            }
          });
          setFieldErrors((prev) => ({ ...prev, ...errors }));
          toast({
            title: "Bitte überprüfen Sie Ihr Passwort",
            description: Object.values(errors)[0] || "Das Passwort erfüllt die Anforderungen nicht",
            variant: "destructive",
          });
        }
        return false;
      }
    },
    [toast]
  );

  return {
    formData,
    updateFormData,
    validateStep,
    validatePassword,
    submitForm,
    isSubmitting,
    clearDraft,
    fieldErrors,
    clearFieldErrors,
  };
};
