import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { errorMessage } from "../api-client";
import { fetchLeadConsents, type LeadConsent } from "../admin-api";

const PURPOSES: Record<string, { label: string; refused: string }> = {
  terms: { label: "AGB akzeptiert, Datenschutzerklärung gelesen", refused: "Ohne AGB-Bestätigung keine Anfrage." },
  share_with_studios: { label: "Weitergabe an Küchenstudios", refused: "Keine Ausschreibung und keine Weitergabe, auch nicht von Hand." },
  contact_by_phone: { label: "Anrufe", refused: "Nicht anrufen, auch wenn eine Telefonnummer angegeben ist." },
  kuechenwert_call: { label: "Rückruf durch KüchenWert", refused: "Nicht anrufen." },
  marketing: { label: "Werbung per E-Mail", refused: "Keine Werbe- oder Nachfass-Mails." },
  ai_training: { label: "KI-Verbesserung mit Raumfotos", refused: "Fotos nicht für das Training verwenden." },
};
const ORDER = Object.keys(PURPOSES);

const dateTime = (iso: string) => new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
const labelOf = (purpose: string) => PURPOSES[purpose]?.label ?? purpose;

function latestByPurpose(rows: LeadConsent[]): LeadConsent[] {
  const latest = new Map<string, LeadConsent>();
  for (const row of rows) latest.set(row.purpose, row);
  const rank = (p: string) => (ORDER.includes(p) ? ORDER.indexOf(p) : ORDER.length);
  return [...latest.values()].sort((a, b) => rank(a.purpose) - rank(b.purpose));
}

/** Einwilligungsprotokoll eines Leads: jüngste Entscheidung je Zweck mit Folge fürs Team, darunter der Verlauf. */
export function AdminLeadConsents({ leadId }: { leadId: string }) {
  const consents = useQuery({ queryKey: ["admin-lead-consents", leadId], queryFn: () => fetchLeadConsents(leadId) });
  const rows = consents.data ?? [];
  const latest = latestByPurpose(rows);

  return (
    <section className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Einwilligungen</h3>
      {consents.isLoading ? (
        <Loader2 className="mt-3 h-5 w-5 animate-spin text-muted-foreground" />
      ) : consents.isError ? (
        <p className="mt-2 text-sm text-destructive">{errorMessage(consents.error)}</p>
      ) : latest.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Keine Einwilligungen protokolliert.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {latest.map((c) => {
            const refused = c.granted ? null : PURPOSES[c.purpose]?.refused;
            return (
              <li key={c.purpose} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <div className="font-medium">{labelOf(c.purpose)}</div>
                  {refused && <div className="text-xs text-muted-foreground">{refused}</div>}
                </div>
                <div className="flex flex-none items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={c.granted ? "default" : "outline"}>{c.granted ? "Ja" : "Nein"}</Badge>
                  <span>
                    {dateTime(c.created_at)} · {c.text_version}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > latest.length && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted-foreground">Verlauf ({rows.length} Einträge)</summary>
          <ol className="mt-2 space-y-1">
            {rows.map((c) => (
              <li key={c.id}>
                {dateTime(c.created_at)} · {labelOf(c.purpose)}: {c.granted ? "Ja" : "Nein"} ({c.text_version})
              </li>
            ))}
          </ol>
        </details>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Protokolliert mit Zeitpunkt, Textversion, IP-Adresse und Browser; die Einträge lassen sich nicht ändern.
      </p>
    </section>
  );
}
