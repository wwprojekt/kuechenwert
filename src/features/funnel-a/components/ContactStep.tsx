import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import {
  CONTACT_FIELD_ORDER,
  EMAIL_MAX,
  NAME_MAX,
  PHONE_MAX,
  validateContact,
  type ContactField,
  type FunnelAContact,
  type ValidContact,
} from "../validation";
import { ConsentCheckbox, SalutationField, TextField } from "./ContactFields";

const fieldId = (field: ContactField) => `kontakt-${field}`;

const LINK_CLASS =
  "font-medium text-foreground underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface ContactStepProps {
  contact: FunnelAContact;
  onChange: (patch: Partial<FunnelAContact>) => void;
  onSubmit: (contact: ValidContact, website: string) => void;
  submitting: boolean;
  error: string | null;
  turnstileRef: (node: HTMLDivElement | null) => void;
  /** Fehlende Pflichtangabe aus einem früheren Schritt. */
  missing: { label: string; onFix: () => void } | null;
}

export function ContactStep({ contact, onChange, onSubmit, submitting, error, turnstileRef, missing }: ContactStepProps) {
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
      const first = CONTACT_FIELD_ORDER.find((field) => validation.errors[field]);
      if (first) document.getElementById(fieldId(first))?.focus();
      return;
    }
    onSubmit(validation.value, website);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mx-auto max-w-xl space-y-5">
      <SalutationField value={contact.salutation} onChange={(salutation) => onChange({ salutation })} />

      <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
        <TextField
          id={fieldId("first_name")}
          label="Vorname"
          required
          autoComplete="given-name"
          maxLength={NAME_MAX}
          value={contact.first_name}
          onChange={(e) => onChange({ first_name: e.target.value })}
          onBlur={(e) => touch("first_name", e.target.value)}
          error={errorFor("first_name")}
        />
        <TextField
          id={fieldId("last_name")}
          label="Nachname"
          required
          autoComplete="family-name"
          maxLength={NAME_MAX}
          value={contact.last_name}
          onChange={(e) => onChange({ last_name: e.target.value })}
          onBlur={(e) => touch("last_name", e.target.value)}
          error={errorFor("last_name")}
        />
      </div>

      <TextField
        id={fieldId("email")}
        label="E-Mail"
        type="email"
        required
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={EMAIL_MAX}
        value={contact.email}
        onChange={(e) => onChange({ email: e.target.value })}
        onBlur={(e) => touch("email", e.target.value)}
        error={errorFor("email")}
      />

      <div className="space-y-3">
        <TextField
          id={fieldId("phone")}
          label="Telefon"
          type="tel"
          autoComplete="tel"
          maxLength={PHONE_MAX}
          hint="Optional – für schnellere Rückfragen der Studios"
          value={contact.phone}
          onChange={(e) => {
            const phone = e.target.value;
            onChange(phone.trim() ? { phone } : { phone, contact_by_phone: false });
          }}
          onBlur={(e) => touch("phone", e.target.value)}
          error={errorFor("phone")}
        />
        {hasPhone && (
          <ConsentCheckbox
            id="kontakt-anruf"
            checked={contact.contact_by_phone}
            onChange={(contact_by_phone) => onChange({ contact_by_phone })}
          >
            Küchenstudios dürfen mich zu meiner Anfrage anrufen.
          </ConsentCheckbox>
        )}
      </div>

      <ConsentCheckbox id="kontakt-marketing" checked={contact.marketing} onChange={(marketing) => onChange({ marketing })}>
        Tipps und Angebote rund um den Küchenkauf per E-Mail, jederzeit abbestellbar
      </ConsentCheckbox>

      <div className="sr-only" aria-hidden="true">
        <label htmlFor="kontakt-website">Website</label>
        <input
          id="kontakt-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
      <div ref={turnstileRef} />

      <p className="text-xs text-ink-muted">
        <span aria-hidden="true" className="text-destructive">
          *
        </span>{" "}
        Pflichtangabe
      </p>

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

      <div className="space-y-3 border-t border-border pt-5">
        <p className="text-xs leading-relaxed text-ink-muted">
          Mit Klick auf „Kostenlos Angebote erhalten“ senden wir Ihre Anfrage anonymisiert an geprüfte Küchenstudios in
          Ihrer Region. Ihre Kontaktdaten erhalten höchstens drei Studios für Rückfragen sowie das Studio, dessen Angebot
          Sie annehmen. Es gelten unsere{" "}
          <a href="/agb" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            AGB
          </a>
          ; Hinweise zum Datenschutz in der{" "}
          <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
            Datenschutzerklärung
          </a>
          .
        </p>
        <button type="submit" disabled={submitting} className="btn-primary-lg w-full gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              Wird gesendet …
            </>
          ) : (
            <>
              Kostenlos Angebote erhalten
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </>
          )}
        </button>
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
