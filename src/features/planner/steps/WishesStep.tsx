import { Plus } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const MAX_WISHES = 500;

const SUGGESTIONS = ["Insel mit Sitzplätzen", "Viel Stauraum", "Offene Regale", "Rückenschonend", "Platz für Vorräte"];

/** Freie Wünsche fließen in die Visualisierung und später in die Studio-Anfrage. */
export function WishesStep({ wishes, onWishes }: { wishes: string; onWishes: (value: string) => void }) {
  const append = (text: string) => {
    const current = wishes.trim();
    if (current.toLowerCase().includes(text.toLowerCase())) return;
    onWishes((current ? `${current}, ${text}` : text).slice(0, MAX_WISHES));
  };

  return (
    <div className="space-y-3">
      <label htmlFor="wishes" className="sr-only">
        Ihre Wünsche (optional)
      </label>
      <Textarea
        id="wishes"
        value={wishes}
        onChange={(e) => onWishes(e.target.value.slice(0, MAX_WISHES))}
        placeholder="z. B. Heizkörper unter dem Fenster bleibt, Wasseranschluss an Wand B …"
        rows={3}
        className="min-h-[5.5rem] resize-none rounded-xl text-base xshort:min-h-[4.25rem]"
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Vorschläge">
        {SUGGESTIONS.map((s) => {
          const added = wishes.toLowerCase().includes(s.toLowerCase());
          return (
            <button
              key={s}
              type="button"
              onClick={() => append(s)}
              disabled={added}
              className={cn(
                "inline-flex min-h-10 items-center gap-1 rounded-full border px-3 text-sm font-medium transition-colors xshort:min-h-9",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                added ? "border-primary bg-brand-50 text-brand-900" : "border-border bg-card text-foreground hover:border-brand-300",
              )}
            >
              {!added && <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
}
