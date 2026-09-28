import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { fetchAiStats } from "./api";

/** Richtwert für ein erstes eigenes LoRA auf einem offenen Bildmodell. */
const TRAINING_GOAL = 300;

const STEPS = [
  "Kund:innen stellen freiwillig ihre Raumfotos ohne Kontaktdaten bereit; Bewertungen zeigen, welche Visualisierungen überzeugen.",
  "Ein offenes Modell (Qwen Image Edit Plus) läuft oben als Vergleichsmodell mit – so sehen wir, wie nah es am Hauptmodell ist.",
  "Mit genug echten Raumfotos, am besten ergänzt um Fotos der fertig montierten Küchen, trainieren wir ein eigenes LoRA (fal LoRA-Training) und tragen es oben ein.",
  "Gewinnt das eigene Modell den A/B-Vergleich bei Zufriedenheit, Anfragequote und Kosten, wird es Hauptmodell.",
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
            <span>Raumfotos mit Einwilligung</span>
            <span className="tabular-nums">
              {samples} / {TRAINING_GOAL}
            </span>
          </div>
          <Progress value={Math.min(100, (samples / TRAINING_GOAL) * 100)} />
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
