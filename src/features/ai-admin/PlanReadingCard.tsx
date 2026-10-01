import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { errorMessage } from "@/features/marketplace/api-client";
import { PLAN_READING_MODELS, planReadingModel } from "@/features/marketplace/plan-reading";
import { fetchPlanReadingCounts, fetchPlanReadingSetup } from "@/features/marketplace/plan-reading-api";
import { fetchAiSettings, savePlanReadingSettings } from "./api";

const SETUP_STEPS = [
  "Konto bei Mistral AI anlegen (console.mistral.ai) und einen Bezahl-Tarif mit Zahlungsart wählen.",
  "Den Auftragsverarbeitungsvertrag (Data Processing Agreement) im Mistral Legal Center abschließen.",
  "In der Mistral-Konsole unter Admin → Privacy „Anonymous improvement data“ ausschalten; auf Wunsch Zero Data Retention beantragen.",
  "API-Schlüssel erzeugen und in Supabase unter Project Settings → Vault als Secret „mistral_api_key“ speichern.",
];

/**
 * Steuerung der KI-Auslesung hochgeladener Planungen (kw-plan-read): Schalter,
 * Modell, ob Mistral eingerichtet ist, und die Ergebnisse der letzten 30 Tage.
 */
export function PlanReadingCard() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ["admin-ai-settings"], queryFn: fetchAiSettings });
  const setup = useQuery({ queryKey: ["admin-plan-reading-setup"], queryFn: fetchPlanReadingSetup });
  const counts = useQuery({ queryKey: ["admin-plan-reading-counts"], queryFn: fetchPlanReadingCounts });
  const enabled = settings.data?.plan_reading_enabled !== false;
  const model = planReadingModel(settings.data?.plan_reading_model);

  const save = useMutation({
    mutationFn: savePlanReadingSettings,
    onSuccess: () => {
      toast.success("Gespeichert.");
      for (const key of ["admin-ai-settings", "admin-ai-settings-history", "admin-plan-reading-setup"]) {
        void qc.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Planungen automatisch auslesen (Funnel B)</CardTitle>
        <CardDescription>
          Lädt eine Kund:in die Planung oder das Angebot ihres Küchenstudios hoch, liest Mistral AI (Paris, Verarbeitung in der EU)
          Küchenform, Hersteller, Maße, Geräte und Leistungen aus. Das Team sieht den Vorschlag im Experten-Check und übernimmt ihn ins
          Briefing; Studios sehen nur das gespeicherte Briefing. Namen und Kontaktdaten von den Unterlagen werden nicht gespeichert, nur ob
          welche darauf stehen (Hinweis zum Schwärzen).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 p-3">
          <div>
            <Label htmlFor="plan-reading-enabled">Neue Unterlagen auslesen</Label>
            <p className="text-xs text-muted-foreground">
              {enabled
                ? "An: Planungen und Angebote werden etwa eine Minute nach dem Upload ausgelesen."
                : "Aus: Es entstehen keine neuen Auslesungen; das Team füllt das Briefing selbst aus."}
            </p>
          </div>
          <Switch
            id="plan-reading-enabled"
            checked={enabled}
            disabled={save.isPending || !settings.data}
            onCheckedChange={(next) => save.mutate({ plan_reading_enabled: next, plan_reading_model: model })}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="plan-reading-model">Modell</Label>
            <select
              id="plan-reading-model"
              value={model}
              disabled={save.isPending || !settings.data}
              onChange={(e) => save.mutate({ plan_reading_enabled: enabled, plan_reading_model: e.target.value })}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              {PLAN_READING_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-medium">Mistral AI</p>
            {setup.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : setup.isError ? (
              <p className="text-destructive">{errorMessage(setup.error)}</p>
            ) : setup.data?.configured ? (
              <p className="flex items-center gap-1.5 text-success">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Eingerichtet (EU-Endpunkt)
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-warning">
                <CircleAlert className="h-4 w-4" aria-hidden="true" /> Noch nicht eingerichtet – Unterlagen warten
              </p>
            )}
          </div>
        </div>

        {setup.data && !setup.data.configured && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">
            <p className="font-medium">So richten Sie Mistral AI ein (einmalig, etwa 10 Minuten):</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              {SETUP_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">
              Danach liest das System neue Unterlagen automatisch; wartende holt es innerhalb von 6 Stunden nach, sofort per „Jetzt auslesen“
              in der Anfrage.
            </p>
          </div>
        )}

        {counts.data && (
          <p className="text-xs text-muted-foreground">
            Letzte 30 Tage: {counts.data.done} ausgelesen, {counts.data.waiting} wartend, {counts.data.failed} fehlgeschlagen.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
