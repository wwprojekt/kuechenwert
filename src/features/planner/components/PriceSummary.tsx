import { Calculator, ChevronDown, Info, Target } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { EstimateGroup, KitchenEstimate } from "../core";

const GROUP_LABEL: Record<EstimateGroup, string> = {
  moebel: "Küchenmöbel",
  arbeitsplatte: "Arbeitsplatte",
  geraete: "Elektrogeräte",
  spuele: "Spüle & Armatur",
  extras: "Extras",
  service: "Lieferung & Service",
};

export const euro = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;

export function PriceRange({ estimate, className }: { estimate: Pick<KitchenEstimate, "min" | "max">; className?: string }) {
  return (
    <span className={cn("tabular-nums", className)}>
      {euro(estimate.min)}
      <span className="mx-1.5 font-normal text-muted-foreground">–</span>
      {euro(estimate.max)}
    </span>
  );
}

function PendingEstimate({ compact }: { compact: boolean }) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-sm", !compact && "sm:p-5")}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Calculator className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Ihre Preisschätzung</p>
          <p className="mt-1 font-bold text-foreground">Folgt nach diesem Schritt</p>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Wir berechnen sie aus Küchenform und Maßen – ungefähre Werte genügen. Danach passt sie sich jeder Auswahl an.
      </p>
    </div>
  );
}

export function PriceSummary({
  estimate,
  note,
  compact = false,
  defaultOpen = false,
}: {
  /** null: Form und Maße stehen noch nicht fest, es gibt noch keine Schätzung. */
  estimate: KitchenEstimate | null;
  note?: string | null;
  compact?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!estimate) return <PendingEstimate compact={compact} />;

  const groups = (Object.keys(GROUP_LABEL) as EstimateGroup[])
    .map((g) => {
      const lines = estimate.lines.filter((l) => l.group === g);
      return {
        group: g,
        lines,
        min: lines.reduce((s, l) => s + l.min, 0),
        max: lines.reduce((s, l) => s + l.max, 0),
      };
    })
    .filter((g) => g.lines.length > 0);

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className={cn("p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500", !compact && "sm:p-5")}>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Geschätzter Marktpreis</p>
        <p className={cn("mt-1 font-extrabold text-foreground", compact ? "text-xl" : "text-2xl sm:text-[1.7rem]")}>
          <PriceRange estimate={estimate} />
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Mittelwert ca. <span className="font-semibold text-foreground">{euro(estimate.mid)}</span> · inkl. MwSt.
        </p>
        {note && (
          <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
            <Target className="mt-px h-3.5 w-3.5 flex-none text-primary" aria-hidden="true" />
            {note}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between border-t px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted/50 sm:px-5"
      >
        Wie setzt sich der Preis zusammen?
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-4 border-t px-4 py-4 sm:px-5">
          {groups.map((g) => (
            <div key={g.group}>
              <div className="flex items-baseline justify-between gap-3 text-sm font-semibold">
                <span>{GROUP_LABEL[g.group]}</span>
                <span className="tabular-nums text-muted-foreground">
                  {euro(g.min)} – {euro(g.max)}
                </span>
              </div>
              <ul className="mt-1.5 space-y-1">
                {g.lines.map((l) => (
                  <li key={l.id} className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                    <span className="min-w-0">
                      {l.label}
                      {l.detail && <span> · {l.detail}</span>}
                    </span>
                    <span className="flex-none tabular-nums">
                      {euro(l.min)} – {euro(l.max)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex gap-2 rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-none" />
            <span>
              {estimate.assumptions.join(". ")}. Die Schätzung ersetzt kein Aufmaß – verbindliche Preise machen Ihnen die Küchenstudios.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
