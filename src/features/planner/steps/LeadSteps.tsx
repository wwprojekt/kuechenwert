import { Eye, Lock, Store } from "lucide-react";
import type { FormEvent } from "react";
import { CardStep } from "@/components/funnel/card-step";
import { FUNNEL_HEADING_ID } from "@/components/funnel/funnel-frame";
import { ConsentCheckbox, TextField } from "@/features/funnel-a/components/ContactFields";
import { PLANNER_TIMEFRAMES } from "../core";
import type { OffersChoice } from "../state";

export const PLANNER_NAME_FORM = "planner-name";
export const PLANNER_CONTACT_FORM = "planner-contact";

/** Einwilligungstext zu „Ja, Angebote“ (Version kw-projekt-2026-09-30 in kw-planner). */
export const OFFERS_CONSENT_TEXT =
  "Mit „Ja“ willige ich ein, dass KüchenWert meine Planung ohne Kontaktdaten freigeschalteten Küchenstudios in meiner Region zur Angebotserstellung zeigt und meine Kontaktdaten an das von mir gewählte Studio sowie an bis zu drei Studios zur persönlichen Beratung weitergibt. Widerruf jederzeit möglich.";

export const TIMEFRAMES = PLANNER_TIMEFRAMES.map((t) => ({ id: String(t.months), label: t.label }));

export function OffersStep({ value, onChange, onAdvance }: { value: OffersChoice | null; onChange: (v: OffersChoice) => void; onAdvance: () => void }) {
  return (
    <div className="space-y-3">
      <CardStep
        labelledBy={FUNNEL_HEADING_ID}
        columns={2}
        mobileColumns={1}
        selected={value ?? ""}
        onSelect={(id) => onChange(id as OffersChoice)}
        onAutoAdvance={onAdvance}
        options={[
          {
            id: "ja",
            label: "Ja, Angebote erhalten",
            description: "Kostenlos & unverbindlich von geprüften Studios",
            icon: <Store />,
          },
          {
            id: "nein",
            label: "Nein, nur Küche & Preis",
            description: "Angebote später jederzeit möglich",
            icon: <Eye />,
          },
        ]}
      />
      <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">{OFFERS_CONSENT_TEXT}</p>
    </div>
  );
}

export function TimeframeStep({ value, onChange, onAdvance }: { value: string; onChange: (v: string) => void; onAdvance: () => void }) {
  return (
    <CardStep
      labelledBy={FUNNEL_HEADING_ID}
      columns={3}
      selected={value}
      onSelect={onChange}
      onAutoAdvance={onAdvance}
      options={TIMEFRAMES.map((t, i) => ({ ...t, wide: i === TIMEFRAMES.length - 1 }))}
    />
  );
}

export interface LeadContact {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  contact_by_phone: boolean;
}

export type LeadErrors = Partial<Record<"first_name" | "last_name" | "email" | "phone", string>>;

const PHONE_OK = /^[+0][\d\s\-/()]{6,}$/;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateLead(contact: LeadContact): LeadErrors {
  const errors: LeadErrors = {};
  if (!contact.first_name.trim()) errors.first_name = "Bitte geben Sie Ihren Vornamen an.";
  if (!contact.last_name.trim()) errors.last_name = "Bitte geben Sie Ihren Nachnamen an.";
  if (!EMAIL_OK.test(contact.email.trim())) errors.email = "Bitte geben Sie eine gültige E-Mail-Adresse an, z. B. name@beispiel.de.";
  const digits = contact.phone.replace(/\D/g, "").length;
  if (!PHONE_OK.test(contact.phone.trim()) || digits < 6 || digits > 16) {
    errors.phone = "Bitte geben Sie eine Telefonnummer mit Vorwahl an, z. B. 0511 123456.";
  }
  return errors;
}

function submitHandler(onSubmit: () => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };
}

export function LeadNameStep({
  contact,
  errors,
  onChange,
  onSubmit,
}: {
  contact: LeadContact;
  errors: LeadErrors;
  onChange: (patch: Partial<LeadContact>) => void;
  onSubmit: () => void;
}) {
  return (
    <form id={PLANNER_NAME_FORM} onSubmit={submitHandler(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2 short:gap-3">
      <TextField
        id="first_name"
        label="Vorname"
        required
        autoComplete="given-name"
        enterKeyHint="next"
        maxLength={80}
        value={contact.first_name}
        onChange={(e) => onChange({ first_name: e.target.value })}
        error={errors.first_name}
      />
      <TextField
        id="last_name"
        label="Nachname"
        required
        autoComplete="family-name"
        enterKeyHint="next"
        maxLength={80}
        value={contact.last_name}
        onChange={(e) => onChange({ last_name: e.target.value })}
        error={errors.last_name}
      />
    </form>
  );
}

export function LeadContactStep({
  contact,
  errors,
  wantsOffers,
  onChange,
  onSubmit,
  onChangeChoice,
  honeypot,
  onHoneypot,
  turnstileRef,
}: {
  contact: LeadContact;
  errors: LeadErrors;
  wantsOffers: boolean;
  onChange: (patch: Partial<LeadContact>) => void;
  onSubmit: () => void;
  onChangeChoice: () => void;
  honeypot: string;
  onHoneypot: (value: string) => void;
  turnstileRef: (node: HTMLDivElement | null) => void;
}) {
  return (
    <form id={PLANNER_CONTACT_FORM} onSubmit={submitHandler(onSubmit)} noValidate className="space-y-4 short:space-y-3">
      <div className="grid gap-4 sm:grid-cols-2 short:gap-3">
        <TextField
          id="email"
          label="E-Mail"
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="next"
          maxLength={254}
          value={contact.email}
          onChange={(e) => onChange({ email: e.target.value })}
          error={errors.email}
        />
        <TextField
          id="phone"
          label="Telefon"
          type="tel"
          required
          autoComplete="tel"
          enterKeyHint="send"
          maxLength={40}
          value={contact.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          error={errors.phone}
        />
      </div>
      <ConsentCheckbox id="contact_by_phone" checked={contact.contact_by_phone} onChange={(contact_by_phone) => onChange({ contact_by_phone })}>
        {wantsOffers
          ? "Studios und KüchenWert dürfen mich zu meinem Projekt auch anrufen."
          : "KüchenWert darf mich für eine kostenlose Beratung zu meiner Planung anrufen."}
      </ConsentCheckbox>

      <div className="sr-only" aria-hidden="true">
        <label htmlFor="planner-website">Website</label>
        <input id="planner-website" type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => onHoneypot(e.target.value)} />
      </div>
      <div ref={turnstileRef} />

      <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs sm:leading-relaxed">
        <Lock className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-brand-600" aria-hidden="true" />
        Kostenlos, zusätzlich per E-Mail.{" "}
        <button type="button" onClick={onChangeChoice} className="font-medium text-foreground underline underline-offset-2">
          {wantsOffers ? "Doch keine Angebote?" : "Doch Angebote erhalten?"}
        </button>{" "}
        Es gelten unsere{" "}
        <a href="/agb" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-2">
          AGB
        </a>{" "}
        und die{" "}
        <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="font-medium text-foreground underline underline-offset-2">
          Datenschutzhinweise
        </a>
        .
      </p>
    </form>
  );
}
