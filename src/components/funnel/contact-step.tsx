import { clsx } from "clsx";

export interface ContactData {
  salutation: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  consentCall: boolean;
  consentMarketing: boolean;
}

interface ContactStepProps {
  data: ContactData;
  onChange: (patch: Partial<ContactData>) => void;
  /** Additional fields rendered below the standard form */
  children?: React.ReactNode;
  /**
   * "full" zeigt Telefon + Consents (Standard / Legacy-Funnel).
   * "without-phone" lässt Telefon + Consents weg – für Funnels mit
   * separatem Telefon-Verifizierungs-Step (Funnel A).
   */
  variant?: "full" | "without-phone";
}

export function ContactStep({
  data,
  onChange,
  children,
  variant = "full",
}: ContactStepProps) {
  const showPhoneAndConsents = variant === "full";
  return (
    <div className="space-y-5">
      {/* Salutation */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-zinc-700">
          Anrede
        </label>
        <div className="flex gap-3">
          {(["Herr", "Frau", "Divers"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ salutation: s })}
              className={clsx(
                "rounded-lg border-2 px-5 py-2.5 text-sm font-medium transition",
                data.salutation === s
                  ? "border-brand-600 bg-brand-50 text-brand-800"
                  : "border-zinc-200 text-zinc-600 hover:border-brand-300",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Name fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label
            htmlFor="contact-firstname"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            Vorname *
          </label>
          <input
            id="contact-firstname"
            type="text"
            autoComplete="given-name"
            value={data.firstName}
            onChange={(e) => onChange({ firstName: e.target.value })}
            className="input-field"
            required
          />
        </div>
        <div>
          <label
            htmlFor="contact-lastname"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            Nachname *
          </label>
          <input
            id="contact-lastname"
            type="text"
            autoComplete="family-name"
            value={data.lastName}
            onChange={(e) => onChange({ lastName: e.target.value })}
            className="input-field"
            required
          />
        </div>
      </div>

      {/* Email */}
      <div>
        <label
          htmlFor="contact-email"
          className="mb-1.5 block text-sm font-medium text-zinc-700"
        >
          E-Mail-Adresse *
        </label>
        <input
          id="contact-email"
          type="email"
          autoComplete="email"
          value={data.email}
          onChange={(e) => onChange({ email: e.target.value })}
          className="input-field"
          required
        />
      </div>

      {/* Phone – nur im Full-Mode (Funnels ohne separaten Phone-Step) */}
      {showPhoneAndConsents && (
        <div>
          <label
            htmlFor="contact-phone"
            className="mb-1.5 block text-sm font-medium text-zinc-700"
          >
            Telefonnummer *
          </label>
          <input
            id="contact-phone"
            type="tel"
            autoComplete="tel"
            value={data.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            className="input-field"
            placeholder="Für die telefonische Qualifizierung"
            required
          />
        </div>
      )}

      {/* Additional fields (e.g. upload, textarea) */}
      {children}

      {/* Consent checkboxes – nur im Full-Mode */}
      {showPhoneAndConsents && (
        <div className="space-y-3 rounded-lg bg-zinc-50 p-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={data.consentCall}
              onChange={(e) => onChange({ consentCall: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
              required
            />
            <span className="text-zinc-700">
              Ich stimme zu, dass KüchenWert mich telefonisch kontaktiert, um
              meine Anfrage zu qualifizieren und passende Angebote zu vermitteln. *
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={data.consentMarketing}
              onChange={(e) => onChange({ consentMarketing: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-zinc-500">
              Ich möchte Tipps und Angebote rund um den Küchenkauf per E-Mail
              erhalten (jederzeit abbestellbar).
            </span>
          </label>
        </div>
      )}

      {/* Privacy notice */}
      <p className="text-xs leading-relaxed text-zinc-400">
        Ihre Daten werden ausschließlich zur Bearbeitung Ihrer Anfrage
        verwendet und gemäß unserer{" "}
        <a
          href="/datenschutz"
          target="_blank"
          className="underline hover:text-zinc-600"
        >
          Datenschutzerklärung
        </a>{" "}
        verarbeitet. Felder mit * sind Pflichtfelder.
      </p>
    </div>
  );
}

/**
 * Validates that all required contact fields are filled.
 * Mit `variant: "without-phone"` werden Telefon/Consent nicht geprüft
 * (werden im separaten Phone-Step validiert).
 */
export function isContactComplete(
  data: ContactData,
  variant: "full" | "without-phone" = "full",
): boolean {
  const baseOk =
    !!data.firstName.trim() &&
    !!data.lastName.trim() &&
    !!data.email.trim() &&
    data.email.includes("@");
  if (variant === "without-phone") return baseOk;
  return baseOk && !!data.phone.trim() && !!data.consentCall;
}
