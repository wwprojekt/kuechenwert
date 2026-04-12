import { z } from "zod";

/**
 * Strong password validation schema
 * Requires: 8+ characters, uppercase, lowercase, number, special character
 */
export const passwordSchema = z
  .string()
  .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
  .regex(/[A-Z]/, "Mindestens ein Großbuchstabe erforderlich")
  .regex(/[a-z]/, "Mindestens ein Kleinbuchstabe erforderlich")
  .regex(/[0-9]/, "Mindestens eine Zahl erforderlich")
  .regex(/[^A-Za-z0-9]/, "Mindestens ein Sonderzeichen erforderlich (!@#$%^&* etc.)");

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .email("Ungültige E-Mail-Adresse")
  .max(255, "E-Mail-Adresse zu lang");

// Motorhome basic details validation
export const motorhomeBasicSchema = z.object({
  manufacturer: z.string().trim().min(1, "Hersteller ist erforderlich").max(100),
  model: z.string().trim().min(1, "Modell ist erforderlich").max(100),
  year: z.coerce
    .number()
    .min(1950, "Baujahr muss nach 1950 sein")
    .max(new Date().getFullYear() + 1, "Baujahr kann nicht in der Zukunft liegen"),
  mileage: z.coerce.number().min(0, "Kilometerstand muss positiv sein").max(9999999),
  body_type: z.enum(["Teilintegriert", "Alkoven", "Vollintegriert", "Kastenwagen", "Campingbus"]),
  condition: z.enum(["Neuwertig", "Sehr gut", "Gut", "Befriedigend", "Reparaturbedürftig"]),
});

// Technical specifications validation
export const motorhomeTechnicalSchema = z.object({
  fuel_type: z.enum(["Diesel", "Benzin", "Elektro", "Hybrid"]).optional(),
  power_kw: z.coerce.number().min(0).max(1000).optional().or(z.literal("")),
  engine_power_hp: z.coerce.number().min(0).max(1500).optional().or(z.literal("")),
  transmission: z.enum(["Schaltgetriebe", "Automatik"]).optional(),
  emission_class: z.enum(["Euro 3", "Euro 4", "Euro 5", "Euro 6", "Euro 6c", "Euro 6d-TEMP", "Euro 6d"]).optional(),
  first_registration: z.string().optional(),
  last_tuev_date: z.string().optional(),
  tuev_valid_until: z.string().optional(),
  previous_owners: z.coerce.number().min(0).max(99).optional().or(z.literal("")),
  accident_free: z.boolean().default(true),
  non_smoker: z.boolean().default(true),
  service_history_available: z.boolean().default(false),
});

// Dimensions and capacity validation
export const motorhomeDimensionsSchema = z.object({
  length_cm: z.coerce.number().min(200).max(2000).optional().or(z.literal("")),
  width_cm: z.coerce.number().min(150).max(300).optional().or(z.literal("")),
  height_cm: z.coerce.number().min(150).max(500).optional().or(z.literal("")),
  weight_kg: z.coerce.number().min(500).max(20000).optional().or(z.literal("")),
  payload_kg: z.coerce.number().min(0).max(5000).optional().or(z.literal("")),
  number_of_axles: z.coerce.number().min(1).max(4).default(2),
  seats: z.coerce.number().min(1).max(9).optional().or(z.literal("")),
  sleeping_places: z.coerce.number().min(1).max(9),
  beds_description: z.string().max(500).optional(),
});

// Interior features validation
export const motorhomeInteriorSchema = z.object({
  has_kitchen: z.boolean().default(true),
  refrigerator_type: z.enum(["Kompressor", "Absorber", "Thermoelektrisch"]).optional(),
  heating_type: z.enum(["Gas", "Diesel", "Elektrisch", "Kombiniert"]).optional(),
  air_conditioning_type: z.enum(["Keine", "Fahrerhaus", "Wohnraum", "Beides"]).default("Keine"),
  has_bathroom: z.boolean().default(false),
  has_toilet: z.boolean().default(false),
  has_shower: z.boolean().default(false),
  water_tank_liters: z.coerce.number().min(0).max(1000).optional().or(z.literal("")),
  grey_water_capacity_liters: z.coerce.number().min(0).max(1000).optional().or(z.literal("")),
  fuel_tank_capacity_liters: z.coerce.number().min(0).max(500).optional().or(z.literal("")),
});

// Equipment and features validation
export const motorhomeEquipmentSchema = z.object({
  has_solar: z.boolean().default(false),
  solar_power_watts: z.coerce.number().min(0).max(5000).optional().or(z.literal("")),
  battery_capacity_ah: z.coerce.number().min(0).max(1000).optional().or(z.literal("")),
  has_inverter: z.boolean().default(false),
  has_awning: z.boolean().default(false),
  awning_length_m: z.coerce.number().min(0).max(1000).optional().or(z.literal("")),
  has_bike_rack: z.boolean().default(false),
  has_garage: z.boolean().default(false),
  has_tv: z.boolean().default(false),
  has_backup_camera: z.boolean().default(false),
  has_parking_sensors: z.boolean().default(false),
  has_cruise_control: z.boolean().default(false),
  has_central_locking: z.boolean().default(false),
});

// Additional information validation
export const motorhomeAdditionalSchema = z.object({
  description: z.string().max(5000).optional(),
  additional_equipment: z.string().max(2000).optional(),
  vehicle_identification_number: z.string().max(17).optional(),
  license_plate: z.string().max(15).optional(),
  instant_price: z.coerce.number().min(0).max(10000000).optional().or(z.literal("")),
  reserve_price: z.coerce.number().min(0).max(10000000).optional().or(z.literal("")),
});

// Combined schema for complete motorhome
export const motorhomeCompleteSchema = motorhomeBasicSchema
  .merge(motorhomeTechnicalSchema)
  .merge(motorhomeDimensionsSchema)
  .merge(motorhomeInteriorSchema)
  .merge(motorhomeEquipmentSchema)
  .merge(motorhomeAdditionalSchema);

export type MotorhomeFormData = z.infer<typeof motorhomeCompleteSchema>;
