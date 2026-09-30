import { ArrowRight, MessagesSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { KitchenFormPlan } from "@/components/kitchen/KitchenFormPlan";
import { FORM_OPTIONS, UNSURE, type ChoiceOption } from "@/features/funnel-a/catalog";
import { cn } from "@/lib/utils";
import { funnelEntryUrl } from "./entry";

const TILE =
  "group flex h-full overflow-hidden rounded-2xl border-2 border-border bg-card text-left shadow-sm transition-all duration-200 " +
  "hover:-translate-y-0.5 hover:border-primary hover:shadow-md " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

interface TileProps {
  option: ChoiceOption;
  to: string;
  onPick?: () => void;
}

function FormTile({ option, to, onPick }: TileProps) {
  return (
    <Link to={to} onClick={onPick} className={cn(TILE, "flex-col")}>
      <span className="relative block aspect-[4/3] bg-muted/60 transition-colors group-hover:bg-primary/5 short:aspect-[16/10] xshort:aspect-[2/1] sm:aspect-[16/10] sm:short:aspect-[2/1]">
        <span className="absolute inset-1.5 flex items-center justify-center sm:inset-3">
          <KitchenFormPlan form={option.id} className="transition-transform duration-500 motion-safe:group-hover:scale-105" />
        </span>
      </span>
      <span className="flex flex-1 flex-col justify-center px-1.5 py-1.5 text-center sm:p-3 sm:text-left">
        <span className="text-[13px] font-semibold leading-tight text-foreground sm:text-base">{option.label}</span>
        {option.hint && <span className="mt-1 hidden text-xs leading-snug text-muted-foreground sm:block sm:short:hidden">{option.hint}</span>}
      </span>
    </Link>
  );
}

function UnsureTile({ option, to, onPick }: TileProps) {
  return (
    <Link to={to} onClick={onPick} className={cn(TILE, "min-h-[3.25rem] items-center gap-3 px-3.5 py-2 sm:gap-4 sm:p-4")}>
      <span
        aria-hidden="true"
        className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground sm:h-12 sm:w-12"
      >
        <MessagesSquare className="h-5 w-5 sm:h-6 sm:w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-tight text-foreground sm:text-base">{option.label}</span>
        {option.hint && <span className="mt-0.5 block text-xs text-muted-foreground sm:text-sm">{option.hint}</span>}
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
 * Funnel A bei Schritt 2. Auch auf dem Handy dreispaltig, damit die Frage
 * samt Antworten ohne Scrollen sichtbar ist.
 */
export function FormPicker({ search, labelledBy, onPick }: { search: string; labelledBy: string; onPick?: () => void }) {
  return (
    <>
      <ul aria-labelledby={labelledBy} className="grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-4">
        {FORM_OPTIONS.map((option) =>
          option.id === UNSURE ? (
            <li key={option.id} className="col-span-3 lg:col-span-2">
              <UnsureTile option={option} to={funnelEntryUrl(search, option.id)} onPick={onPick} />
            </li>
          ) : (
            <li key={option.id}>
              <FormTile option={option} to={funnelEntryUrl(search, option.id)} onPick={onPick} />
            </li>
          ),
        )}
      </ul>
      <p className="mt-3 text-center text-sm text-muted-foreground sm:mt-5">
        <Link
          to={funnelEntryUrl(search)}
          className="inline-flex min-h-8 items-center rounded-sm font-medium underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Ohne Auswahl starten
        </Link>
      </p>
    </>
  );
}
