import type { FormEvent } from "react";
import { BudgetSliderStep } from "@/components/funnel/budget-slider-step";
import { CardStep } from "@/components/funnel/card-step";
import { choiceIcon } from "@/components/funnel/funnel-a-icons";
import { FUNNEL_HEADING_ID } from "@/components/funnel/funnel-frame";
import { TermsConsent, TermsNotice } from "@/components/funnel/terms-consent";
import { FUNNEL_A_BUDGET, HOUSING_OPTIONS, OCCASION_OPTIONS, UNSURE } from "@/features/funnel-a/catalog";
import { TextField } from "@/features/funnel-a/components/ContactFields";
import type { ChoiceField } from "@/features/funnel-a/steps";
import { FUNNEL_TERMS, TERMS_MISSING } from "../../../../supabase/functions/_shared/lead-terms.ts";
import { PLANNER_TIMEFRAMES } from "../core";

export const PLANNER_NAME_FORM = "planner-name";
export const PLANNER_CONTACT_FORM = "planner-contact";

export const TIMEFRAMES = PLANNER_TIMEFRAMES.map((t) => ({ id: String(t.months), label: t.label }));

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

/** Ohne Preisanker: Schätzung und Visualisierung erscheinen im Planer erst nach dem Kontakt. */
export function LeadBudgetStep({
  value,
  confirmed,
  onChange,
}: {
  value: number | null;
  confirmed: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <BudgetSliderStep
      value={value}
      confirmed={confirmed}
      onChange={onChange}
      min={FUNNEL_A_BUDGET.min}
      max={FUNNEL_A_BUDGET.max}
      step={FUNNEL_A_BUDGET.step}
      defaultValue={FUNNEL_A_BUDGET.default}
    />
  );
}

function catalogOptions(field: ChoiceField, options: ReadonlyArray<{ id: string; label: string; hint?: string }>) {
  return options.map((o, i) => {
    const Icon = choiceIcon(field, o.id);
    return {
      id: o.id,
      label: o.label,
      description: o.hint,
      icon: Icon ? <Icon aria-hidden="true" /> : undefined,
      wide: o.id === UNSURE && i === options.length - 1 && options.length % 2 === 1,
    };
  });
}

export function OccasionStep({ value, onChange, onAdvance }: { value: string; onChange: (v: string) => void; onAdvance: () => void }) {
  return (
    <CardStep
      labelledBy={FUNNEL_HEADING_ID}
      columns={2}
      selected={value}
      onSelect={onChange}
      onAutoAdvance={onAdvance}
      options={catalogOptions("purchase_reason", OCCASION_OPTIONS)}
    />
  );
}

export function HousingStep({ value, onChange, onAdvance }: { value: string; onChange: (v: string) => void; onAdvance: () => void }) {
  return (
    <CardStep
      labelledBy={FUNNEL_HEADING_ID}
      columns={2}
      selected={value}
      onSelect={onChange}
      onAutoAdvance={onAdvance}
      options={catalogOptions("housing", HOUSING_OPTIONS)}
    />
  );
}

export interface LeadContact {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  /** AGB akzeptiert, Datenschutzerklärung gelesen (FUNNEL_TERMS.c). */
  accept_terms: boolean;
}

export type LeadErrors = Partial<Record<"first_name" | "last_name" | "email" | "phone" | "accept_terms", string>>;

const PHONE_OK = /^[+0][\d\s\-/()]{6,}$/;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PHONE_ERROR = "Bitte geben Sie eine Telefonnummer mit Vorwahl an, z. B. 0511 123456.";

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "").length;
  return PHONE_OK.test(phone.trim()) && digits >= 6 && digits <= 16;
}

/** Name, E-Mail und Telefon sind Pflicht: Die Studios brauchen die Nummer für Rückfragen zum Angebot. */
export function validateLead(contact: LeadContact): LeadErrors {
  const errors: LeadErrors = {};
  if (!contact.first_name.trim()) errors.first_name = "Bitte geben Sie Ihren Vornamen an.";
  if (!contact.last_name.trim()) errors.last_name = "Bitte geben Sie Ihren Nachnamen an.";
  if (!EMAIL_OK.test(contact.email.trim())) errors.email = "Bitte geben Sie eine gültige E-Mail-Adresse an, z. B. name@beispiel.de.";
  if (!isValidPhone(contact.phone)) errors.phone = PHONE_ERROR;
  if (!contact.accept_terms) errors.accept_terms = TERMS_MISSING;
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
  onChange,
  onSubmit,
  honeypot,
  onHoneypot,
  turnstileRef,
}: {
  contact: LeadContact;
  errors: LeadErrors;
  onChange: (patch: Partial<LeadContact>) => void;
  onSubmit: () => void;
  honeypot: string;
  onHoneypot: (value: string) => void;
  turnstileRef: (node: HTMLDivElement | null) => void;
}) {
  return (
    <form id={PLANNER_CONTACT_FORM} onSubmit={submitHandler(onSubmit)} noValidate className="space-y-4 short:space-y-3 xshort:space-y-2">
      <div className="grid gap-4 sm:grid-cols-2 short:gap-3 xshort:gap-2">
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
          hint={contact.phone.trim() ? undefined : "Für Rückfragen der Studios zu Ihrem Angebot"}
          hintClassName="short:hidden"
          value={contact.phone}
          onChange={(e) => onChange({ phone: e.target.value })}
          error={errors.phone}
        />
      </div>

      <div className="sr-only" aria-hidden="true">
        <label htmlFor="planner-website">Website</label>
        <input id="planner-website" type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => onHoneypot(e.target.value)} />
      </div>

      <TermsNotice>{FUNNEL_TERMS.c.notice}</TermsNotice>
      <TermsConsent id="accept_terms" checked={contact.accept_terms} onChange={(accept_terms) => onChange({ accept_terms })} error={errors.accept_terms} />
      {/* Hinter dem Haken: Braucht Turnstile doch eine Eingabe, bleiben Hinweis und Haken über der mobilen Leiste. */}
      <div ref={turnstileRef} />
    </form>
  );
}
