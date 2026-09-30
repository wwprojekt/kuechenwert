import { Lock } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import {
  CONTACT_FIELD_ORDER,
  EMAIL_MAX,
  PHONE_MAX,
  validateContact,
  type ContactField,
  type FunnelAContact,
  type ValidContact,
} from "../validation";
import { ConsentCheckbox, TextField } from "./ContactFields";

export const CONTACT_FORM_ID = "funnel-a-contact";

const fieldId = (field: ContactField) => `kontakt-${field}`;

const LINK_CLASS =
  "font-medium text-foreground underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface ContactStepProps {
  contact: FunnelAContact;
  onChange: (patch: Partial<FunnelAContact>) => void;
  onSubmit: (contact: ValidContact, website: string) => void;
  /** Absenden mit Fehlern: Feldschlüssel für die Funnel-Telemetrie. */
  onInvalid?: (fields: ContactField[]) => void;
  /** Name fehlt (z. B. direkt aufgerufen): zurück zum Namensschritt. */
  onMissingName: () => void;
  submitting: boolean;
  turnstileRef: (node: HTMLDivElement | null) => void;
  /** Fehlende Pflichtangabe aus einem früheren Schritt. */
  missing: { label: string; onFix: () => void } | null;
}

const NAME_FIELDS: ReadonlySet<ContactField> = new Set(["salutation", "first_name", "last_name"]);

/**
 * E-Mail, Telefon und freiwillige Einwilligungen; der Absende-Button steht in
 * der Weiter-Position des Funnel-Rahmens (form={CONTACT_FORM_ID}).
 */
export function ContactStep({ contact, onChange, onSubmit, onInvalid, onMissingName, submitting, turnstileRef, missing }: ContactStepProps) {
  const [website, setWebsite] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<ContactField, boolean>>>({});
  const validation = useMemo(() => validateContact(contact), [contact]);
  const hasPhone = contact.phone.trim() !== "";

  const errorFor = (field: ContactField) =>
    !validation.ok && (attempted || touched[field]) ? validation.errors[field] : undefined;

  // Leere Felder erst beim Absenden bemängeln, nicht schon beim Durchtabben.
  const touch = (field: ContactField, value: string) => {
    if (value.trim()) setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setAttempted(true);
    if (!validation.ok) {
      const failed = CONTACT_FIELD_ORDER.filter((field) => validation.errors[field]);
      onInvalid?.(failed);
      if (failed.some((field) => NAME_FIELDS.has(field))) {
        onMissingName();
        return;
      }
      if (failed[0]) document.getElementById(fieldId(failed[0]))?.focus();
      return;
    }
    onSubmit(validation.value, website);
  };

  return (
    <form id={CONTACT_FORM_ID} onSubmit={handleSubmit} noValidate className="mx-auto max-w-xl space-y-4 short:space-y-3">
      <TextField
        id={fieldId("email")}
        label="E-Mail"
        type="email"
        required
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="next"
        maxLength={EMAIL_MAX}
        value={contact.email}
        onChange={(e) => onChange({ email: e.target.value })}
        onBlur={(e) => touch("email", e.target.value)}
        error={errorFor("email")}
      />

      <div className="space-y-2.5">
        <TextField
          id={fieldId("phone")}
          label="Telefon (optional)"
          type="tel"
          autoComplete="tel"
          enterKeyHint="send"
          maxLength={PHONE_MAX}
          hint={hasPhone ? undefined : "Für schnellere Rückfragen der Studios"}
          hintClassName="xshort:hidden"
          value={contact.phone}
          onChange={(e) => {
            const phone = e.target.value;
            onChange(phone.trim() ? { phone } : { phone, contact_by_phone: false });
          }}
          onBlur={(e) => touch("phone", e.target.value)}
          error={errorFor("phone")}
        />
        {hasPhone && (
          <ConsentCheckbox id="kontakt-anruf" checked={contact.contact_by_phone} onChange={(contact_by_phone) => onChange({ contact_by_phone })}>
            Küchenstudios dürfen mich zu meiner Anfrage anrufen.
          </ConsentCheckbox>
        )}
      </div>

      <ConsentCheckbox id="kontakt-marketing" checked={contact.marketing} onChange={(marketing) => onChange({ marketing })}>
        Tipps und Angebote rund um den Küchenkauf per E-Mail, jederzeit abbestellbar
      </ConsentCheckbox>

      <div className="sr-only" aria-hidden="true">
        <label htmlFor="kontakt-website">Website</label>
        <input id="kontakt-website" type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>
      <div ref={turnstileRef} />

      {missing && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm">
          <span>
            Eine Angabe fehlt noch: <strong className="font-semibold">{missing.label}</strong>
          </span>
          <button
            type="button"
            onClick={missing.onFix}
            className="font-semibold text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Jetzt ergänzen
          </button>
        </div>
      )}

      <p className="text-[11px] leading-snug text-ink-muted sm:text-xs sm:leading-relaxed">
        <Lock className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-brand-600" aria-hidden="true" />
        Mit Klick auf „Kostenlos Angebote erhalten“ senden wir Ihre Anfrage ohne Namen und Kontaktdaten an freigeschaltete
        Küchenstudios in Ihrer Region. Ihre Kontaktdaten erhalten höchstens drei Studios für Rückfragen sowie das Studio,
        dessen Angebot Sie annehmen. Es gelten unsere{" "}
        <a href="/agb" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          AGB
        </a>
        ; mehr in der{" "}
        <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
          Datenschutzerklärung
        </a>
        .
      </p>
    </form>
  );
}
