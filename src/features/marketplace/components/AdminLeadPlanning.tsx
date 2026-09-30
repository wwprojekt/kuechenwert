import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";
import { errorMessage } from "../api-client";
import { fetchAdminTender, fetchLeadPlanner } from "../admin-api";
import type { ProjectSummary } from "../dealer-api";
import { plannerSummaryFromLead } from "../planner-preview";
import { PlannerSummaryCards } from "./PlannerSummaryCards";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

const euro = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;

function originalWishes(lead: Lead): string | null {
  const answers = lead.funnel_answers as { config?: { wishes?: unknown } } | null;
  const wishes = answers?.config?.wishes;
  return typeof wishes === "string" && wishes.trim() ? wishes.trim() : null;
}

/**
 * Funnel C im Admin-Dialog: gewählte Visualisierung, Preisschätzung und die
 * Planung so, wie Studios sie in der Ausschreibung sehen (oder ohne
 * Ausschreibung sähen).
 */
export function AdminLeadPlanning({ lead }: { lead: Lead }) {
  const planner = useQuery({ queryKey: ["admin-lead-planner", lead.id], queryFn: () => fetchLeadPlanner(lead.id), staleTime: 30 * 60_000 });
  const tender = useQuery({ queryKey: ["admin-lead-tender", lead.id], queryFn: () => fetchAdminTender(lead.id) });
  const tenderSummary = tender.data?.public_summary as ProjectSummary | null | undefined;
  const published = tenderSummary?.source === "c" ? tenderSummary : null;
  const photoCount = planner.data?.photoCount ?? 0;
  const summary = published ?? plannerSummaryFromLead(lead, photoCount);
  const wishes = originalWishes(lead);
  const wishesFiltered = !!wishes && !!summary?.labels && summary.wishes !== wishes;

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Planung aus dem Traumküchen-Planer</h3>
        {planner.data && (
          <Link
            to={`/admin/planner-sessions?q=${planner.data.sessionId}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Alle Visualisierungen ({planner.data.renderCount}) <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </Link>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {published
          ? "So sehen Studios die Planung: ohne Namen und Kontaktdaten."
          : "Vorschau: So sähen Studios die Planung in einer Ausschreibung (ohne Namen und Kontaktdaten)."}
      </p>

      {planner.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : planner.isError ? (
        <p className="text-sm text-destructive">{errorMessage(planner.error)}</p>
      ) : planner.data?.renderUrl ? (
        <img src={planner.data.renderUrl} alt="Gewählte Visualisierung" className="aspect-[3/2] w-full rounded-lg border object-cover" />
      ) : (
        <p className="text-sm text-muted-foreground">Keine fertige Visualisierung.</p>
      )}

      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex gap-3">
          <dt className="w-28 flex-none text-muted-foreground">KI-Schätzung</dt>
          <dd className="font-medium">{summary?.estimate ? `${euro(summary.estimate.min)} – ${euro(summary.estimate.max)}` : "–"}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-28 flex-none text-muted-foreground">Raumfotos</dt>
          <dd className="font-medium">{photoCount > 0 ? photoCount : "keine (Visualisierung aus der Beschreibung)"}</dd>
        </div>
      </dl>

      {wishesFiltered && (
        <p className="text-xs text-muted-foreground">
          Im Wunschtext der Kund:in stehen Kontaktangaben; Studios sehen die gefilterte Fassung. Das Original steht unten in den
          Funnel-Antworten.
        </p>
      )}

      {summary ? (
        <PlannerSummaryCards summary={summary} />
      ) : (
        <p className="text-sm text-muted-foreground">Zu diesem Lead ist keine Planung gespeichert.</p>
      )}
    </section>
  );
}
