import { z } from "zod";

export const SALUTATIONS = ["Herr", "Frau", "Divers"] as const;
export type Salutation = (typeof SALUTATIONS)[number];

export const PHONE_PATTERN = /^[+0][\d\s\-/()]{6,}$/;
/** Wie isEmail in kw-http.ts: Was der Server annimmt, lehnt das Formular nicht ab. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const NAME_MAX = 80;
export const EMAIL_MAX = 254;
export const PHONE_MAX = 40;

/** Formularzustand des Kontaktschritts inkl. freiwilliger Einwilligungen. */
export interface FunnelAContact {
  salutation: Salutation | "";
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  contact_by_phone: boolean;
  marketing: boolean;
}

export type ContactField = "salutation" | "first_name" | "last_name" | "email" | "phone";
export type ContactErrors = Partial<Record<ContactField, string>>;

/** Reihenfolge im Formular – der erste Fehler bekommt den Fokus. */
export const CONTACT_FIELD_ORDER: readonly ContactField[] = ["salutation", "first_name", "last_name", "email", "phone"];

export interface ValidContact {
  salutation: Salutation | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  contact_by_phone: boolean;
  marketing: boolean;
}

export function emptyContact(): FunnelAContact {
  return {
    salutation: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    contact_by_phone: false,
    marketing: false,
  };
}

function isSalutation(value: unknown): value is Salutation {
  return typeof value === "string" && (SALUTATIONS as readonly string[]).includes(value);
}

/** Liest einen (untrusted) gespeicherten Kontaktstand ein. */
export function sanitizeContact(input: unknown): FunnelAContact {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
  return {
    salutation: isSalutation(raw.salutation) ? raw.salutation : "",
    first_name: text(raw.first_name, NAME_MAX),
    last_name: text(raw.last_name, NAME_MAX),
    email: text(raw.email, EMAIL_MAX),
    phone: text(raw.phone, PHONE_MAX),
    contact_by_phone: raw.contact_by_phone === true,
    marketing: raw.marketing === true,
  };
}

function countDigits(value: string): number {
  return value.replace(/\D/g, "").length;
}

const contactSchema = z.object({
  salutation: z.union([z.enum(SALUTATIONS), z.literal("")]),
  first_name: z
    .string()
    .trim()
    .min(1, "Bitte geben Sie Ihren Vornamen an.")
    .max(NAME_MAX, `Der Vorname darf höchstens ${NAME_MAX} Zeichen lang sein.`),
  last_name: z
    .string()
    .trim()
    .min(1, "Bitte geben Sie Ihren Nachnamen an.")
    .max(NAME_MAX, `Der Nachname darf höchstens ${NAME_MAX} Zeichen lang sein.`),
  email: z
    .string()
    .trim()
    .min(1, "Bitte geben Sie Ihre E-Mail-Adresse an.")
    .max(EMAIL_MAX, "Diese E-Mail-Adresse ist zu lang.")
    .regex(EMAIL_PATTERN, "Bitte geben Sie eine gültige E-Mail-Adresse an, z. B. name@beispiel.de."),
  phone: z
    .string()
    .trim()
    .max(PHONE_MAX, "Diese Telefonnummer ist zu lang.")
    .refine(
      (value) => value === "" || (PHONE_PATTERN.test(value) && countDigits(value) >= 6 && countDigits(value) <= 16),
      "Bitte geben Sie eine gültige Telefonnummer mit Vorwahl an, z. B. 0511 123456 – oder lassen Sie das Feld leer.",
    ),
  contact_by_phone: z.boolean(),
  marketing: z.boolean(),
});

export type ContactValidation = { ok: true; value: ValidContact } | { ok: false; errors: ContactErrors };

export function validateContact(contact: FunnelAContact): ContactValidation {
  const result = contactSchema.safeParse(contact);
  if (!result.success) {
    const errors: ContactErrors = {};
    for (const issue of result.error.issues) {
      const field = CONTACT_FIELD_ORDER.find((f) => f === issue.path[0]);
      if (field && !errors[field]) errors[field] = issue.message;
    }
    return { ok: false, errors };
  }
  const v = result.data;
  const phone = v.phone === "" ? null : v.phone;
  return {
    ok: true,
    value: {
      salutation: v.salutation === "" ? null : v.salutation,
      first_name: v.first_name,
      last_name: v.last_name,
      email: v.email,
      phone,
      contact_by_phone: phone !== null && v.contact_by_phone,
      marketing: v.marketing,
    },
  };
}

/** Fehler eines einzelnen Felds, z. B. für die Live-Prüfung nach Verlassen des Felds. */
export function contactFieldError(contact: FunnelAContact, field: ContactField): string | undefined {
  const result = validateContact(contact);
  return result.ok ? undefined : result.errors[field];
}
