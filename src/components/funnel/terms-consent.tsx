import { AlertCircle, Lock } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const LINK =
  "font-medium text-foreground underline underline-offset-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Was mit der Anfrage passiert, direkt über dem AGB-Haken; Text aus supabase/functions/_shared/lead-terms.ts. */
export function TermsNotice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[11px] leading-snug text-muted-foreground sm:text-xs sm:leading-relaxed", className)}>
      <Lock className="mr-1 inline h-3.5 w-3.5 -translate-y-px text-brand-600" aria-hidden="true" />
      {children}
    </p>
  );
}

/** „Es gelten unsere AGB und die Datenschutzerklärung.“ mit Links, für Aktionen ohne eigenen Haken. */
export function TermsLinks() {
  return (
    <>
      Es gelten unsere{" "}
      <a href="/agb" target="_blank" rel="noopener noreferrer" className={LINK}>
        AGB
      </a>{" "}
      und die{" "}
      <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className={LINK}>
        Datenschutzerklärung
      </a>
      .
    </>
  );
}

/** Pflicht-Haken am Ende jedes Funnels; der sichtbare Text entspricht TERMS_LABEL. */
export function TermsConsent({
  id,
  checked,
  onChange,
  error,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
}) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          name="accept_terms"
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className="mt-0.5 h-5 w-5 flex-none cursor-pointer rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <label htmlFor={id} className="cursor-pointer text-sm leading-snug text-foreground">
          Ich akzeptiere die{" "}
          <a href="/agb" target="_blank" rel="noopener noreferrer" className={LINK}>
            AGB
          </a>{" "}
          und habe die{" "}
          <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className={LINK}>
            Datenschutzerklärung
          </a>{" "}
          gelesen.
        </label>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
