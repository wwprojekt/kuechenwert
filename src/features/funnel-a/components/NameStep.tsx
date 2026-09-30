import type { FormEvent } from "react";
import { NAME_MAX, type ContactErrors, type FunnelAContact } from "../validation";
import { SalutationField, TextField } from "./ContactFields";

export const NAME_FORM_ID = "funnel-a-name";

interface NameStepProps {
  contact: FunnelAContact;
  onChange: (patch: Partial<FunnelAContact>) => void;
  /** Fehler erst nach einem Weiter-Versuch zeigen. */
  errors: ContactErrors;
  onSubmit: () => void;
}

/** Anrede und Name als eigener kurzer Schritt vor E-Mail und Telefon. */
export function NameStep({ contact, onChange, errors, onSubmit }: NameStepProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form id={NAME_FORM_ID} onSubmit={handleSubmit} noValidate className="mx-auto max-w-xl space-y-4 short:space-y-3">
      <SalutationField value={contact.salutation} onChange={(salutation) => onChange({ salutation })} />
      <div className="grid gap-4 sm:grid-cols-2 short:gap-3">
        <TextField
          id="kontakt-first_name"
          label="Vorname"
          required
          autoComplete="given-name"
          enterKeyHint="next"
          maxLength={NAME_MAX}
          value={contact.first_name}
          onChange={(e) => onChange({ first_name: e.target.value })}
          error={errors.first_name}
        />
        <TextField
          id="kontakt-last_name"
          label="Nachname"
          required
          autoComplete="family-name"
          enterKeyHint="next"
          maxLength={NAME_MAX}
          value={contact.last_name}
          onChange={(e) => onChange({ last_name: e.target.value })}
          error={errors.last_name}
        />
      </div>
    </form>
  );
}
