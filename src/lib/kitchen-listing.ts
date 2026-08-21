import { z } from "zod";

/** Marketplace + listing form values. Stored in `kitchens.body_type`. */
export const KITCHEN_FORMS = [
  "L-Form",
  "U-Form",
  "Kochinsel",
  "Einzelzeile",
  "Zweizeilig",
  "G-Form",
] as const;
export type KitchenForm = (typeof KITCHEN_FORMS)[number];

/** Matches `kitchen_condition` enum. */
export const KITCHEN_CONDITIONS = [
  "Neuwertig",
  "Sehr gepflegt",
  "Gepflegt",
  "Sehr gut",
  "Gut",
  "Gebrauchsspuren",
  "Befriedigend",
  "Reparaturbedürftig",
] as const;
export type KitchenCondition = (typeof KITCHEN_CONDITIONS)[number];

export const DEFAULT_KITCHEN_BRANDS = [
  "Nobilia",
  "Häcker",
  "Nolte",
  "SieMatic",
  "Bulthaup",
  "Poggenpohl",
  "Leicht",
  "Schüller",
  "Rotpunkt",
  "Ballerina",
  "Ewe",
  "Bauformat",
] as const;

const BRAND_DISPLAY: Record<string, string> = {
  Hacker: "Häcker",
  Schuller: "Schüller",
  Stoermer: "Störmer",
  Allmilmoe: "Allmilmö",
  Sachsenkuechen: "Sachsenküchen",
  "Express Kuechen": "Express Küchen",
  Hoeffner: "Höffner",
};

export function displayKitchenBrand(name: string): string {
  return BRAND_DISPLAY[name] ?? name;
}

const currentYear = new Date().getFullYear();

export const dealerKitchenCreateSchema = z.object({
  manufacturer: z.string().trim().min(1, "Marke wählen").max(80),
  model: z.string().trim().min(1, "Modell angeben").max(80),
  bodyType: z.enum(KITCHEN_FORMS, { required_error: "Küchenform wählen" }),
  year: z
    .number({ required_error: "Produktionsjahr wählen" })
    .int()
    .min(1990, "Jahr ungültig")
    .max(currentYear + 1, "Jahr ungültig"),
  condition: z.enum(KITCHEN_CONDITIONS, { required_error: "Zustand wählen" }),
  reservePrice: z.number().positive("Mindestpreis ist Pflicht"),
  mwstAusweisbar: z.boolean(),
});

export type DealerKitchenCreateInput = z.infer<typeof dealerKitchenCreateSchema>;
