import { useState } from "react";
import { CookieSettingsModal } from "@/components/CookieSettingsModal";
import { FOCUS_RING } from "@/components/funnel/funnel-header";
import { cn } from "@/lib/utils";

const LEGAL_LINKS = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/agb", label: "AGB" },
  { href: "/barrierefreiheit", label: "Barrierefreiheit" },
] as const;

const ITEM = cn(
  "inline-flex min-h-8 items-center rounded px-1 text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline",
  FOCUS_RING,
);

/**
 * Fußzeile im Fokusmodus: nur die Pflichtangaben. Die Links öffnen einen neuen
 * Tab, damit der Funnel offen bleibt; die Cookie-Einstellungen bleiben
 * erreichbar, wie der Cookie-Banner es zusagt.
 */
export function FunnelFooter({ className }: { className?: string }) {
  const [cookieSettingsOpen, setCookieSettingsOpen] = useState(false);

  return (
    <footer className={cn("px-4 py-5 text-xs", className)}>
      <nav aria-label="Rechtliches">
        <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {LEGAL_LINKS.map(({ href, label }) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noopener" className={ITEM}>
                {label}
                <span className="sr-only"> (öffnet in neuem Tab)</span>
              </a>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setCookieSettingsOpen(true)} className={ITEM}>
              Cookie-Einstellungen
            </button>
          </li>
        </ul>
      </nav>
      <CookieSettingsModal open={cookieSettingsOpen} onOpenChange={setCookieSettingsOpen} />
    </footer>
  );
}
