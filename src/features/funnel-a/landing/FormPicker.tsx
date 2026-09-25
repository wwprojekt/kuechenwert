import { ArrowRight, MessagesSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { KitchenFormPlan } from "@/components/kitchen/KitchenFormPlan";
import { FORM_OPTIONS, UNSURE, type ChoiceOption } from "@/features/funnel-a/catalog";
import { cn } from "@/lib/utils";
import { funnelEntryUrl } from "./entry";

const TILE =
  "group flex h-full overflow-hidden rounded-xl border-2 border-border bg-card text-left transition-all duration-200 " +
  "hover:-translate-y-0.5 hover:border-primary hover:shadow-md " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

function FormTile({ option, to }: { option: ChoiceOption; to: string }) {
  return (
    <Link to={to} className={cn(TILE, "flex-col")}>
      <span className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted/60 p-3 transition-colors group-hover:bg-primary/5">
        <KitchenFormPlan
          form={option.id}
          className="transition-transform duration-500 motion-safe:group-hover:scale-105"
        />
      </span>
      <span className="flex flex-1 flex-col p-3 sm:p-3.5">
        <span className="font-semibold leading-tight text-foreground">{option.label}</span>
        {option.hint && <span className="mt-1 text-xs leading-snug text-muted-foreground">{option.hint}</span>}
      </span>
    </Link>
  );
}

function UnsureTile({ option, to }: { option: ChoiceOption; to: string }) {
  return (
    <Link to={to} className={cn(TILE, "items-center gap-4 p-4")}>
      <span
        aria-hidden="true"
        className="grid h-14 w-14 flex-none place-items-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
      >
        <MessagesSquare className="h-7 w-7" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-tight text-foreground">{option.label}</span>
        {option.hint && <span className="mt-1 block text-sm text-muted-foreground">{option.hint}</span>}
      </span>
      <ArrowRight
        aria-hidden="true"
        className="h-5 w-5 flex-none text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
      />
    </Link>
  );
}

/**
 * Erste Funnel-Frage direkt auf der Landing: Ein Klick auf eine Form startet
 * Funnel A bei Schritt 2. Die „Steht noch nicht fest“-Kachel füllt die letzte
 * Zeile, damit das Raster bei 2, 3 und 4 Spalten ohne Lücke aufgeht.
 */
export function FormPicker({ search, labelledBy }: { search: string; labelledBy: string }) {
  return (
    <>
      <ul aria-labelledby={labelledBy} className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {FORM_OPTIONS.map((option) =>
          option.id === UNSURE ? (
            <li key={option.id} className="col-span-2 sm:col-span-3 lg:col-span-2">
              <UnsureTile option={option} to={funnelEntryUrl(search, option.id)} />
            </li>
          ) : (
            <li key={option.id}>
              <FormTile option={option} to={funnelEntryUrl(search, option.id)} />
            </li>
          ),
        )}
      </ul>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        <Link
          to={funnelEntryUrl(search)}
          className="rounded-sm font-medium underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Ohne Auswahl starten
        </Link>
      </p>
    </>
  );
}
