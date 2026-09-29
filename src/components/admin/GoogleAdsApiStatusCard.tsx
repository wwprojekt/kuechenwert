/**
 * Admin → Einstellungen → Tracking: Live-Diagnose der Google Ads API über die
 * Edge Function kw-google-ads (action "status").
 */
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ServerCog, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { invokeWithAuth } from "@/lib/sessionGuard";
import LiveStatusItem from "./LiveStatusItem";

interface GoogleAdsConversionAction {
  id: string;
  name: string;
  status: string;
  type: string;
  category: string;
  primaryForGoal: boolean;
  sendTo: string | null;
}

interface GoogleAdsStatus {
  ok: boolean;
  error?: string;
  apiVersion: string;
  managerId: string;
  loginCustomerId?: string;
  credentials: Record<string, "env" | "vault" | "missing">;
  account?: {
    id: string;
    name: string;
    status: string;
    autoTagging: boolean;
    finalUrlSuffixOk: boolean;
    acceptedCustomerDataTerms: boolean;
  };
  managerLinks?: Array<{ managerId: string; status: string }>;
  conversionActions?: GoogleAdsConversionAction[];
  tracking?: { enabled: boolean; configured: string | null; expected: string | null; matches: boolean };
  valueUploads?: { uploaded: number; open: number; failed: number } | null;
}

const formatCustomerId = (id?: string) => (id ?? "").replace(/^(\d{3})(\d{3})(\d{4})$/, "$1-$2-$3");

function trackingDetail(t: NonNullable<GoogleAdsStatus["tracking"]>): string {
  if (!t.expected) return "fehlt in Google Ads";
  if (!t.matches) return `eingetragen: ${t.configured ?? "—"}, richtig: ${t.expected}`;
  return t.enabled ? t.expected : "passt, Google Ads ist aber ausgeschaltet";
}

interface GoogleAdsApiStatusCardProps {
  /** Übernimmt send_to der Conversion „Küchenanfrage“ ins Formular; gespeichert wird wie gewohnt. */
  onApplyTracking: (conversionId: string, label: string) => void;
}

export default function GoogleAdsApiStatusCard({ onApplyTracking }: GoogleAdsApiStatusCardProps) {
  const [status, setStatus] = useState<GoogleAdsStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await invokeWithAuth("kw-google-ads", { body: { action: "status" } });
      if (fnError) throw fnError;
      setStatus(data as GoogleAdsStatus);
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const failure = error ?? (status && !status.ok ? status.error ?? "Unbekannter Fehler" : null);
  const account = status?.ok ? status.account : undefined;
  const tracking = status?.tracking;
  const managerLinked = !!status?.managerLinks?.some((l) => l.managerId === status.managerId && l.status === "ACTIVE");
  const [expectedId, expectedLabel] = tracking?.expected?.split("/") ?? [];
  const credentialSources = [...new Set(Object.values(status?.credentials ?? {}))].join(", ");

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ServerCog className="w-5 h-5 text-primary" />
              Google Ads API – Live-Diagnose
            </CardTitle>
            <CardDescription>
              Prüft über die Edge Function <code>kw-google-ads</code> die Zugangsdaten (Supabase Vault), das Konto, die
              Verknüpfung mit dem Verwaltungskonto und die Conversion-Aktionen – und ob die gespeicherte Conversion für
              Küchenanfragen dazu passt.
            </CardDescription>
          </div>
          <Button onClick={runCheck} disabled={loading} size="sm">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            {loading ? "Prüfe…" : "Live-Check ausführen"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!status && !error && !loading && (
          <p className="text-sm text-muted-foreground">
            Klicken Sie auf <strong>Live-Check ausführen</strong>, um die Google-Ads-Anbindung zu prüfen.
          </p>
        )}

        {failure && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <div className="flex gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Diagnose fehlgeschlagen.</strong>
                <pre className="mt-1 text-xs whitespace-pre-wrap break-all">{failure}</pre>
              </div>
            </div>
          </div>
        )}

        {account && tracking && (
          <>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <LiveStatusItem
                label="Konto"
                ok={account.status === "ENABLED"}
                detail={`${account.name} (${formatCustomerId(account.id)})`}
              />
              <LiveStatusItem
                label="Verwaltungskonto"
                ok={managerLinked}
                detail={managerLinked ? formatCustomerId(status?.managerId) : "nicht verknüpft"}
              />
              <LiveStatusItem
                label="Conversion Küchenanfrage"
                ok={tracking.matches && tracking.enabled}
                detail={trackingDetail(tracking)}
              />
              <LiveStatusItem
                label="Kundendaten-Bedingungen"
                ok={account.acceptedCustomerDataTerms}
                detail={
                  account.acceptedCustomerDataTerms
                    ? "akzeptiert (Enhanced Conversions)"
                    : "in Google Ads unter Ziele → Einstellungen akzeptieren"
                }
              />
            </div>

            {!tracking.matches && expectedId && expectedLabel && (
              <div className="flex flex-wrap items-center gap-3 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                <span className="flex-1">
                  Die Conversion-ID oder das Label für Küchenanfragen passt nicht zu Google Ads. Übernehmen und danach
                  speichern.
                </span>
                <Button size="sm" variant="outline" onClick={() => onApplyTracking(expectedId, expectedLabel)}>
                  Werte übernehmen
                </Button>
              </div>
            )}

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">ID</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Typ</th>
                    <th className="px-3 py-2 font-medium">Kategorie</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-center">Primär</th>
                    <th className="px-3 py-2 font-medium">send_to</th>
                  </tr>
                </thead>
                <tbody>
                  {(status?.conversionActions ?? []).map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{a.id}</td>
                      <td className="px-3 py-2">{a.name}</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="text-[10px]">{a.type}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{a.category}</td>
                      <td className="px-3 py-2">
                        <Badge variant={a.status === "ENABLED" ? "default" : "secondary"} className="text-[10px]">
                          {a.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {a.primaryForGoal ? (
                          <CheckCircle2 className="w-4 h-4 text-success inline" aria-label="primär" />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs break-all">{a.sendTo ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              API {status?.apiVersion} · Login {formatCustomerId(status?.loginCustomerId)} · Zugangsdaten aus{" "}
              {credentialSources} · Auto-Tagging {account.autoTagging ? "an" : "aus"} · URL-Suffix{" "}
              {account.finalUrlSuffixOk ? "gesetzt" : "fehlt oder weicht ab"}
              {status?.valueUploads &&
                ` · Umsatzmeldungen: ${status.valueUploads.uploaded} gemeldet, ${status.valueUploads.open} offen, ${status.valueUploads.failed} gescheitert`}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
