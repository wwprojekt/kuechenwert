import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { errorMessage } from "../api-client";
import { setProjectAiConsent, type ProjectView } from "../project-api";

/** Einwilligung zur KI-Verbesserung – Widerruf so einfach wie die Erteilung (Art. 7 Abs. 3 DSGVO). */
export function ProjectAiConsentCard({ token, granted }: { token: string; granted: boolean }) {
  const qc = useQueryClient();
  const change = useMutation({
    mutationFn: (next: boolean) => setProjectAiConsent(token, next),
    onSuccess: (view, next) => {
      qc.setQueryData<ProjectView>(["kw-project", token], view);
      toast.success(next ? "Danke! Ihre Raumfotos helfen, die Visualisierung zu verbessern." : "Widerrufen – die Kopien Ihrer Fotos sind gelöscht.");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="rounded-2xl border bg-card p-5 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <label htmlFor="ai-training" className="flex items-center gap-2 font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" /> KI-Visualisierung verbessern
          </label>
          <p className="mt-1 text-muted-foreground">
            Ihre Raumfotos und Bewertungen dürfen ohne Namen und Kontaktdaten gespeichert werden, um die Visualisierung zu verbessern – auch
            für das Training eigener Modelle. Höchstens 36 Monate; ausschalten löscht die Kopien sofort.
          </p>
        </div>
        <Switch
          id="ai-training"
          checked={change.isPending ? !!change.variables : granted}
          disabled={change.isPending}
          onCheckedChange={(next) => change.mutate(next)}
          className="mt-0.5 flex-none"
        />
      </div>
    </div>
  );
}
