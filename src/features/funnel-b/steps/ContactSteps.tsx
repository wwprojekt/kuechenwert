import type { ReactNode } from "react";
import { CardStep } from "@/components/funnel/card-step";
import { PlzStep } from "@/components/funnel/plz-step";
import { BRAND } from "@/lib/brand";
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

export function ContactStep({ data, update }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 short:gap-3">
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
  );
}

function Consent({
  id,
  name,
  checked,
  disabled,
  onChange,
  children,
}: {
  id?: string;
  name: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        id={id}
        name={name}
        type="checkbox"
        className="mt-0.5 h-5 w-5 flex-none accent-brand-700"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-[13px] leading-snug text-ink-muted sm:text-sm xshort:text-xs">{children}</span>
    </label>
  );
}

export function ConsentStep({
  data,
  update,
  honeypot,
  onHoneypot,
  turnstileRef,
}: Props & { honeypot: string; onHoneypot: (value: string) => void; turnstileRef: (node: HTMLDivElement | null) => void }) {
  return (
    <div className="space-y-3 xshort:space-y-2">
      <Consent
        id="funnel-b-consent-share"
        name="consent_share"
        checked={data.consentShare}
        onChange={(checked) => update(checked ? { consentShare: true } : { consentShare: false, consentStudioCall: false })}
      >
        <strong className="text-ink">Pflicht:</strong> KüchenWert darf mein Angebot und meine Unterlagen ohne Namen und Kontaktdaten an
        Küchenstudios in meiner Region weitergeben, damit sie es unterbieten. Meine Kontaktdaten und die vollständigen Unterlagen erhalten
        höchstens drei Studios für Rückfragen sowie das Studio, dessen Angebot ich annehme.
      </Consent>
      <Consent id="funnel-b-consent-call" name="consent_call" checked={data.consentCall} onChange={(consentCall) => update({ consentCall })}>
        <strong className="text-ink">Pflicht:</strong> KüchenWert darf mich zur Klärung meines Angebots anrufen (Experten-Check).
      </Consent>
      <Consent name="consent_studio_call" checked={data.consentStudioCall} disabled={!data.consentShare} onChange={(consentStudioCall) => update({ consentStudioCall })}>
        Optional: Küchenstudios, die meine Kontaktdaten erhalten, dürfen mich auch telefonisch kontaktieren.
      </Consent>
      <Consent name="marketing" checked={data.consentMarketing} onChange={(consentMarketing) => update({ consentMarketing })}>
        Optional: KüchenWert darf mir Tipps und Marktinformationen rund um meinen Küchenkauf per E-Mail schicken.
      </Consent>
      <p className="text-[11px] leading-snug text-ink-muted sm:text-xs">
        Widerruf jederzeit, z. B. per E-Mail an{" "}
        <a href={`mailto:${BRAND.supportEmail}`} className="underline">
          {BRAND.supportEmail}
        </a>
        . Es gelten unsere{" "}
        <a href="/agb" target="_blank" rel="noopener noreferrer" className="underline">
          AGB
        </a>
        ; mehr in der{" "}
        <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="underline">
          Datenschutzerklärung
        </a>
        .
      </p>
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="funnel-b-website">Website</label>
        <input id="funnel-b-website" type="text" name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => onHoneypot(e.target.value)} />
      </div>
      <div ref={turnstileRef} />
    </div>
  );
}
