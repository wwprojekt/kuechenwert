/**
 * Zod-Schemas fuer den Wertrechner.
 * Im Frontend zur Step-Validierung, in der ai-valuation Edge Function zur
 * server-seitigen Validierung (Deno kompatibel).
 */
import { z } from "zod";

const currentYear = new Date().getFullYear();

export const vehicleTypeSchema = z.enum(["Wohnmobil", "Wohnwagen"]);

export const wertrechnerLeadSchema = z.object({
  name: z.string().trim().min(2, "Bitte geben Sie Ihren Namen ein"),
  email: z.string().trim().email("Ungültige E-Mail-Adresse"),
  phone: z.string().trim().min(5, "Bitte geben Sie Ihre Telefonnummer ein"),
});

/**
 * Akzeptiert Form-Strings (year, mileage, lengthM) und coerced sie auf number.
 * Leere Strings werden zu undefined (statt NaN) ueber preprocess.
 */
const emptyToUndef = (v: unknown) => (v === "" || v === null ? undefined : v);

export const wertrechnerVehicleSchema = z.object({
  vehicleType: vehicleTypeSchema,
  bodyType: z.string().min(1, "Fahrzeugtyp auswählen"),
  manufacturer: z.preprocess(emptyToUndef, z.string().trim().optional()),
  model: z.preprocess(emptyToUndef, z.string().trim().optional()),
  year: z.preprocess(
    (v) => (typeof v === "string" ? parseInt(v, 10) : v),
    z.number().int()
      .gte(1950, "Baujahr muss >= 1950 sein")
      .lte(currentYear, "Baujahr darf nicht in der Zukunft liegen"),
  ),
  mileage: z.preprocess(
    (v) => {
      if (v === "" || v === null || v === undefined) return undefined;
      if (typeof v === "string") {
        const parsed = parseInt(v, 10);
        return isNaN(parsed) ? undefined : parsed;
      }
      return v;
    },
    z.number().int().gte(0).lte(999_999).optional(),
  ),
  condition: z.enum(["new", "excellent", "good", "fair", "poor"]),
  lengthM: z.preprocess(
    (v) => {
      if (v === "" || v === null || v === undefined) return undefined;
      if (typeof v === "string") {
        const parsed = parseFloat(v.replace(",", "."));
        return isNaN(parsed) ? undefined : parsed;
      }
      return v;
    },
    z.number().positive().lte(15).optional(),
  ),
})
  .superRefine((data, ctx) => {
    // Wohnmobile brauchen Kilometerstand, Wohnwagen nicht.
    if (data.vehicleType === "Wohnmobil" && data.mileage === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mileage"],
        message: "Kilometerstand ist bei Wohnmobilen erforderlich.",
      });
    }
  });

export const wertrechnerFullSchema = z.intersection(wertrechnerVehicleSchema, wertrechnerLeadSchema);

export type WertrechnerLead = z.infer<typeof wertrechnerLeadSchema>;
export type WertrechnerVehicle = z.infer<typeof wertrechnerVehicleSchema>;
export type WertrechnerFull = z.infer<typeof wertrechnerFullSchema>;

export const aiValuationRequestSchema = z.object({
  manufacturer: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  bodyType: z.string().min(1),
  year: z.number().int().gte(1900).lte(currentYear + 1),
  mileage: z.number().int().gte(0).lte(999_999),
  condition: z.string().min(1),
  algorithmMin: z.number().nonnegative(),
  algorithmMax: z.number().nonnegative(),
  vehicleType: z.enum(["Wohnmobil", "Wohnwagen"]).optional(),
  lengthM: z.number().positive().lte(15).optional(),
  leadId: z.string().uuid().optional(),
  turnstileToken: z.string().optional(),
});

export type AiValuationRequest = z.infer<typeof aiValuationRequestSchema>;
