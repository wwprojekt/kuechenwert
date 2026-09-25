import { AlertCircle } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SALUTATIONS, type Salutation } from "../validation";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({ id, label, hint, error, required, ...inputProps }: TextFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required && (
          <span aria-hidden="true" className="text-destructive">
            {" "}
            *
          </span>
        )}
      </label>
      <input
        id={id}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn("input-field", error && "border-destructive focus-visible:ring-destructive")}
        {...inputProps}
      />
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}

export function SalutationField({ value, onChange }: { value: Salutation | ""; onChange: (value: Salutation) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-foreground">
        Anrede <span className="font-normal text-ink-muted">(optional)</span>
      </legend>
      <div className="flex flex-wrap gap-2">
        {SALUTATIONS.map((option) => (
          <label key={option} className="cursor-pointer">
            <input
              type="radio"
              name="salutation"
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="peer sr-only"
            />
            <span
              className={cn(
                "inline-flex min-h-11 min-w-[4.5rem] items-center justify-center rounded-lg border-2 border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:border-brand-300",
                "peer-checked:border-primary peer-checked:bg-brand-50 peer-checked:text-brand-900",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
              )}
            >
              {option}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ConsentCheckbox({
  id,
  checked,
  onChange,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 flex-none cursor-pointer rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-snug text-foreground">
        {children}
      </label>
    </div>
  );
}
