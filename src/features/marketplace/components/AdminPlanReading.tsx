import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ClipboardPaste, Loader2, ScanText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errorMessage } from "../api-client";
import type { ExpertBriefing } from "../lead-details";
import { briefingFromPlanReading, describePlanReading, planReadingWarnings } from "../plan-reading";
import { fetchPlanReading, readPlanNow, type PlanReadingRow } from "../plan-reading-api";

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "");

/** Warum (noch) kein Ergebnis da ist, in einem Satz. */
function statusText(row: PlanReadingRow | null): string {
  if (!row) return "Noch nicht ausgelesen. Lädt die Kund:in eine Planung oder ein Angebot hoch, liest die KI sie automatisch aus.";
  if (row.status === "running") return "Wird gerade ausgelesen …";
  if (row.status === "pending") {
    if (row.error_code === "not_configured") return "Wartet auf die Einrichtung von Mistral AI (Schlüssel „mistral_api_key“ im Supabase Vault).";
    if (row.error_code) return `Neuer Versuch ab ${time(row.next_attempt_at)} (${row.error_message ?? row.error_code}).`;
    return "Steht in der Warteschlange und ist in etwa einer Minute fertig.";
  }
  if (row.status === "failed") return `Konnte nicht ausgelesen werden: ${row.error_message ?? "unbekannter Fehler"}. Bitte das Briefing selbst ausfüllen.`;
  if (row.status === "skipped") return row.error_message ?? "Nicht ausgelesen.";
  return "";
}

interface AdminPlanReadingProps {
  leadId: string;
  /** Preis, den die Kund:in genannt hat, zum Abgleich mit einem hochgeladenen Angebot. */
  statedPriceEur?: number | null;
  onApply: (suggestion: ExpertBriefing) => void;
}

/**
 * Vorschlag der KI aus der hochgeladenen Planung (Funnel B): Hinweise fürs
 * Schwärzen, Abgleich mit dem genannten Preis und „Ins Briefing übernehmen“.
 * Studios sehen davon nichts, nur das gespeicherte Briefing.
 */
export function AdminPlanReading({ leadId, statedPriceEur, onApply }: AdminPlanReadingProps) {
  const qc = useQueryClient();
  const queryKey = ["admin-plan-reading", leadId];
  const reading = useQuery({
    queryKey,
    queryFn: () => fetchPlanReading(leadId),
    refetchInterval: (query) => (query.state.data?.status === "pending" || query.state.data?.status === "running" ? 5000 : false),
  });
  const read = useMutation({
    mutationFn: () => readPlanNow(leadId),
    onSuccess: (row) => {
      qc.setQueryData(queryKey, row);
      if (row?.status === "done") toast.success("Planung ausgelesen – Vorschlag unten prüfen.");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const row = reading.data ?? null;
  const result = row?.status === "done" ? row.result : null;
  const busy = read.isPending || row?.status === "running";
  const warnings = result ? planReadingWarnings(result, statedPriceEur) : [];
  const rows = result ? describePlanReading(result) : [];

  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold">
          <ScanText className="h-4 w-4 text-primary" aria-hidden="true" />
          KI-Auslesung der Planung
        </p>
        <Button size="sm" variant="outline" onClick={() => read.mutate()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanText className="mr-2 h-4 w-4" />}
          {row ? "Neu auslesen" : "Jetzt auslesen"}
        </Button>
      </div>

      {reading.isLoading ? (
        <Loader2 className="mt-2 h-4 w-4 animate-spin text-muted-foreground" />
      ) : reading.isError ? (
        <p className="mt-2 text-destructive">{errorMessage(reading.error)}</p>
      ) : !result ? (
        <p className="mt-2 text-muted-foreground">{statusText(row)}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {warnings.map((w) => (
            <p key={w} className="flex gap-2 rounded-md bg-amber-50 p-2 text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
              {w}
            </p>
          ))}
          {rows.length > 0 ? (
            <dl className="space-y-1">
              {rows.map((r) => (
                <div key={r.label} className="flex gap-3">
                  <dt className="w-36 flex-none text-muted-foreground">{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-muted-foreground">Die KI hat in den Unterlagen keine verwertbaren Angaben gefunden.</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => onApply(briefingFromPlanReading(result))} disabled={rows.length === 0}>
              <ClipboardPaste className="mr-2 h-4 w-4" />
              Ins Briefing übernehmen
            </Button>
            <span className="text-xs text-muted-foreground">
              Vorschlag von Mistral AI (EU), ausgelesen am {time(row?.finished_at ?? null)}. Füllt nur leere Felder; vor dem Speichern prüfen.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
