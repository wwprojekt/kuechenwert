import { ShieldCheck, Phone as PhoneIcon, Lock } from "lucide-react";

export interface PhoneStepData {
  phone: string;
  consentCall: boolean;
  consentMarketing: boolean;
}

interface PhoneStepProps {
  data: PhoneStepData;
  onChange: (patch: Partial<PhoneStepData>) => void;
}

export function PhoneStep({ data, onChange }: PhoneStepProps) {
  return (
    <div className="space-y-5">
      {/* Trust-Framing */}
      <div className="flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand-700" />
        <p className="text-sm leading-relaxed text-ink">
          Wir nutzen Ihre Telefonnummer nur, um Ihre Anfrage kurz zu bestätigen
          und eventuelle Rückfragen zu Ihrer Wunschküche zu klären. Kein Spam,
          keine Weitergabe ohne Ihre Zustimmung.
        </p>
      </div>

      {/* Phone-Input */}
      <div>
        <label
          htmlFor="phone-input"
          className="mb-1.5 block text-sm font-medium text-zinc-700"
        >
          Telefonnummer *
        </label>
        <div className="relative">
          <PhoneIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted" />
          <input
            id="phone-input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="z. B. +49 170 1234567"
            value={data.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
            className="input-field !pl-11 !text-base"
            autoFocus
            required
          />
        </div>
        <p className="mt-1.5 text-xs text-ink-subtle">
          Gerne auch mit Länder­vorwahl (+49 …) oder als 0170 … — beides wird
          akzeptiert.
        </p>
      </div>

      {/* Consents */}
      <div className="space-y-3 rounded-xl bg-zinc-50 p-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={data.consentCall}
            onChange={(e) => onChange({ consentCall: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
            required
          />
          <span className="leading-snug text-zinc-700">
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
          <span className="leading-snug text-zinc-500">
            Ich möchte Tipps und Angebote rund um den Küchenkauf per E-Mail
            erhalten (jederzeit abbestellbar).
          </span>
        </label>
      </div>

      {/* Security-Row */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-ink-subtle">
        <span className="inline-flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 text-success-600" />
          SSL-verschlüsselt
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-success-600" />
          DSGVO-konform
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-success-600" />
          Kostenlos & unverbindlich
        </span>
      </div>

      <p className="text-center text-xs leading-relaxed text-ink-subtle">
        Ihre Daten werden ausschließlich zur Bearbeitung Ihrer Anfrage
        verwendet und gemäß unserer{" "}
        <a
          href="/datenschutz"
          target="_blank"
          className="underline underline-offset-2 hover:text-ink"
        >
          Datenschutzerklärung
        </a>{" "}
        verarbeitet.
      </p>
    </div>
  );
}

const PHONE_REGEX = /^[+0][\d\s\-/()]{6,}$/;

export function isPhoneStepComplete(data: PhoneStepData): boolean {
  return !!(data.consentCall && PHONE_REGEX.test(data.phone.trim()));
}
