import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { errorMessage } from "../api-client";
import { setProjectCalls, type ProjectView } from "../project-api";

/**
 * Anrufe von Studios mit freigeschaltetem Kontakt: Mit dem AGB-Haken erlaubt,
 * hier mit einem Klick abzuschalten (Widerspruch so einfach wie die Anfrage).
 */
export function ProjectCallsCard({ token, allowed }: { token: string; allowed: boolean }) {
  const qc = useQueryClient();
  const change = useMutation({
    mutationFn: (next: boolean) => setProjectCalls(token, next),
    onSuccess: (view, next) => {
      qc.setQueryData<ProjectView>(["kw-project", token], view);
      toast.success(next ? "Studios dürfen Sie zu Ihrem Angebot anrufen." : "Keine Anrufe mehr – Studios erreichen Sie per E-Mail.");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <div className="rounded-2xl border bg-card p-5 text-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <label htmlFor="studio-calls" className="flex items-center gap-2 font-semibold text-foreground">
            <Phone className="h-4 w-4 text-primary" aria-hidden="true" /> Anrufe von Studios
          </label>
          <p className="mt-1 text-muted-foreground">
            Studios, die Ihren Kontakt freischalten (höchstens drei), dürfen Sie für Rückfragen zu Ihrem Angebot anrufen. Ausgeschaltet
            erreichen sie Sie per E-Mail.
          </p>
        </div>
        <Switch
          id="studio-calls"
          checked={change.isPending ? !!change.variables : allowed}
          disabled={change.isPending}
          onCheckedChange={(next) => change.mutate(next)}
          className="mt-0.5 flex-none"
        />
      </div>
    </div>
  );
}
