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

/** In der mobilen Weiter-Leiste: eine Zeile, Klickfläche trotzdem ≥ 24 px (WCAG 2.5.8). */
const COMPACT_ITEM = cn(
  "inline-flex min-h-6 items-center rounded px-0.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline",
  FOCUS_RING,
);

/**
 * Fußzeile im Fokusmodus: nur die Pflichtangaben. Die Links öffnen einen neuen
 * Tab, damit der Funnel offen bleibt; die Cookie-Einstellungen bleiben
 * erreichbar, wie der Cookie-Banner es zusagt. `compact` ist die einzeilige
 * Fassung für die mobile Leiste, damit kein Schritt fürs Rechtliche scrollt.
 */
export function FunnelFooter({ className, compact = false }: { className?: string; compact?: boolean }) {
  const [cookieSettingsOpen, setCookieSettingsOpen] = useState(false);
  const item = compact ? COMPACT_ITEM : ITEM;

  return (
    <footer className={cn(compact ? "text-[11px] leading-none" : "px-4 py-5 text-xs", className)}>
      <nav aria-label="Rechtliches">
        <ul className={cn("flex flex-wrap items-center justify-center", compact ? "gap-x-2" : "gap-x-3 gap-y-1")}>
          {LEGAL_LINKS.map(({ href, label }) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noopener" className={item}>
                {label}
                <span className="sr-only"> (öffnet in neuem Tab)</span>
              </a>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setCookieSettingsOpen(true)} className={item}>
              {compact ? "Cookies" : "Cookie-Einstellungen"}
            </button>
          </li>
        </ul>
      </nav>
      <CookieSettingsModal open={cookieSettingsOpen} onOpenChange={setCookieSettingsOpen} />
    </footer>
  );
}
