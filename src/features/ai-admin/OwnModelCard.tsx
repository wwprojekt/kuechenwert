import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { fetchAiStats } from "./api";

/** Ab so vielen echten Räumen trägt ein fester Testsatz für Modell- und Prompt-Vergleiche. */
const TEST_SET_GOAL = 50;

const STEPS = [
  "Kund:innen stellen freiwillig ihre Raumfotos ohne Kontaktdaten bereit; Bewertungen und Gründe zeigen, welche Visualisierungen überzeugen.",
  "Ab etwa 50 Fotos entsteht ein fester Testsatz: Neue Modelle und Prompts laufen zuerst gegen dieselben echten Räume, bevor Kund:innen sie sehen.",
  "Der beste Kandidat tritt oben im A/B-Vergleich gegen das Hauptmodell an – gemessen an Bewertungen der Erstbilder, Ausweichquote, Dauer und Kosten.",
  "Ein eigenes LoRA auf einem offenen Modell lohnt erst mit Vorher-nachher-Paaren (Raumfoto und Foto der fertig montierten Küche) und wird nur Hauptmodell, wenn es den Vergleich gewinnt.",
];

export function OwnModelCard() {
  const stats = useQuery({ queryKey: ["admin-ai-stats", 30], queryFn: () => fetchAiStats(30) });
  const samples = stats.data?.training.samples ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Eigenes KI-Modell</CardTitle>
        <CardDescription>
          Trainiert wird nur mit echten Kundenfotos, nie mit Bildern anderer KI-Anbieter: Google und OpenAI untersagen, mit ihren
          Ergebnissen konkurrierende Modelle zu entwickeln – und nur echte Räume bringen dem Modell die Wirklichkeit bei.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span>Raumfotos mit Einwilligung (Testsatz)</span>
            <span className="tabular-nums">
              {samples} / {TEST_SET_GOAL}
            </span>
          </div>
          <Progress value={Math.min(100, (samples / TEST_SET_GOAL) * 100)} />
          <p className="text-xs text-muted-foreground">
            Aus {stats.data?.training.sessions ?? 0} Planungen; in den letzten 30 Tagen {stats.data?.funnel.ai_training_consents ?? 0} neue
            Einwilligungen. Gespeichert höchstens 36 Monate, Widerruf löscht sofort.
          </p>
        </div>
        <ol className="space-y-2 text-sm">
          {STEPS.map((text, i) => (
            <li key={text} className="flex gap-3">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <span className="text-muted-foreground">{text}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
