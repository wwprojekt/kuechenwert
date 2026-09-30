import { Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const MESSAGES = [
  "Wir analysieren Raum, Perspektive und Licht …",
  "Schränke, Fronten und Arbeitsplatte werden eingesetzt …",
  "Geräte und Details werden platziert …",
  "Letzter Feinschliff an Licht und Materialien …",
];

/**
 * Lade-Bildschirm direkt nach „Küche visualisieren“: Die KI arbeitet, der
 * Kunde sieht Fortschritt statt eines leeren Bildes. Das eigene Raumfoto
 * (falls vorhanden) liegt unscharf im Hintergrund, die Küche selbst gibt es
 * erst nach der Kontakterfassung.
 */
export function VisualizingStep({ percent, photoUrl, error }: { percent: number; photoUrl: string | null; error: string | null }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setIndex((i) => Math.min(i + 1, MESSAGES.length - 1)), 2600);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="mx-auto max-w-xl">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-muted to-accent/15 short:aspect-[16/10] xshort:aspect-[2/1]">
        {photoUrl && <img src={photoUrl} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-md" />}
        <div className="absolute inset-0 bg-background/40" />
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1/3 animate-scan bg-gradient-to-b from-transparent via-primary/25 to-transparent motion-reduce:hidden"
        />
        <div className="relative flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="relative grid h-16 w-16 place-items-center xshort:h-12 xshort:w-12">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary/25 motion-reduce:animate-none" />
            <span className="relative grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg xshort:h-12 xshort:w-12">
              <Wand2 className="h-7 w-7 xshort:h-5 xshort:w-5" aria-hidden="true" />
            </span>
          </span>
          <p className="text-base font-semibold text-foreground" aria-live="polite">
            {error ?? MESSAGES[index]}
          </p>
        </div>
      </div>

      <div className="mt-4 short:mt-3">
        <div className="h-2 overflow-hidden rounded-full bg-border" aria-hidden="true">
          <div
            className={cn("h-full rounded-full bg-primary transition-[width] duration-700 ease-out", error && "bg-muted-foreground")}
            style={{ width: `${error ? 100 : percent}%` }}
          />
        </div>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {error ? "Ihre Preisschätzung und Angebote bekommen Sie trotzdem." : "Das dauert meist 20–40 Sekunden – gleich geht es weiter."}
        </p>
      </div>
    </div>
  );
}
