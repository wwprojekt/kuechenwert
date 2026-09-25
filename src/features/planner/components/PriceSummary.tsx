import { ChevronDown, Info } from "lucide-react";
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

export function PriceSummary({
  estimate,
  compact = false,
  defaultOpen = false,
}: {
  estimate: KitchenEstimate;
  compact?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
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
      <div className={cn("p-4", !compact && "sm:p-5")}>
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Geschätzter Marktpreis</p>
        <p className={cn("mt-1 font-extrabold text-foreground", compact ? "text-xl" : "text-2xl sm:text-[1.7rem]")}>
          <PriceRange estimate={estimate} />
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Mittelwert ca. <span className="font-semibold text-foreground">{euro(estimate.mid)}</span> · inkl. MwSt.
        </p>
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
                      {l.detail && <span className="text-muted-foreground/80"> · {l.detail}</span>}
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
