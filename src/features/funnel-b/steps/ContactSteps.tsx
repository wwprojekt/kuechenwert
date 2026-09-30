import { CardStep } from "@/components/funnel/card-step";
import { PlzStep } from "@/components/funnel/plz-step";
import { TermsConsent, TermsNotice } from "@/components/funnel/terms-consent";
import { FUNNEL_TERMS } from "../../../../supabase/functions/_shared/lead-terms.ts";
import { Field } from "../Field";
import type { FunnelBData } from "../state";
import type { FunnelBStepProps } from "./OfferSteps";

type Props = Omit<FunnelBStepProps, "onAdvance">;

export function PlzCityStep({ data, update, onAdvance }: FunnelBStepProps) {
  return (
    <div className="space-y-3">
      <PlzStep value={data.postalCode} onChange={(postalCode) => update({ postalCode })} onSubmit={onAdvance} />
      <div className="mx-auto max-w-sm">
        <Field label="Ort (optional)">
          <input name="city" type="text" autoComplete="address-level2" className="input-field" value={data.city} onChange={(e) => update({ city: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

export function NameStep({ data, update }: Props) {
  return (
    <div className="space-y-4 short:space-y-3">
      <div>
        <p id="funnel-b-salutation" className="label-field mb-1">
          Anrede <span className="font-normal text-ink-muted">(optional)</span>
        </p>
        <CardStep
          labelledBy="funnel-b-salutation"
          mobileColumns={3}
          columns={3}
          selected={data.salutation}
          onSelect={(v) => update({ salutation: v as FunnelBData["salutation"] })}
          options={[
            { id: "frau", label: "Frau" },
            { id: "herr", label: "Herr" },
            { id: "divers", label: "Divers" },
          ]}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 short:gap-3">
        <Field label="Vorname *">
          <input
            id="funnel-b-first-name"
            name="first_name"
            type="text"
            autoComplete="given-name"
            className="input-field"
            value={data.firstName}
            onChange={(e) => update({ firstName: e.target.value })}
          />
        </Field>
        <Field label="Nachname *">
          <input
            id="funnel-b-last-name"
            name="last_name"
            type="text"
            autoComplete="family-name"
            className="input-field"
            value={data.lastName}
            onChange={(e) => update({ lastName: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

/** Letzter Schritt: E-Mail, Telefon für den Experten-Check und der AGB-Haken; „Weiter“ sendet ab. */
export function ContactStep({
  data,
  update,
  honeypot,
  onHoneypot,
  turnstileRef,
}: Props & { honeypot: string; onHoneypot: (value: string) => void; turnstileRef: (node: HTMLDivElement | null) => void }) {
  return (
    <div className="space-y-4 short:space-y-3 xshort:space-y-2">
      <div className="grid gap-4 sm:grid-cols-2 short:gap-3 xshort:gap-2">
        <Field label="E-Mail *">
          <input
            id="funnel-b-email"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            className="input-field"
            value={data.email}
            onChange={(e) => update({ email: e.target.value })}
          />
        </Field>
        <Field label="Telefon *" hint="Für den kurzen Experten-Check.">
          <input
            id="funnel-b-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className="input-field"
            value={data.phone}
            onChange={(e) => update({ phone: e.target.value })}
          />
        </Field>
      </div>
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="funnel-b-website">Website</label>
        <input id="funnel-b-website" type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => onHoneypot(e.target.value)} />
      </div>
      <TermsNotice>{FUNNEL_TERMS.b.notice}</TermsNotice>
      <TermsConsent id="funnel-b-accept-terms" checked={data.acceptTerms} onChange={(acceptTerms) => update({ acceptTerms })} />
      {/* Hinter dem Haken: Braucht Turnstile doch eine Eingabe, bleiben Hinweis und Haken über der mobilen Leiste. */}
      <div ref={turnstileRef} />
    </div>
  );
}
