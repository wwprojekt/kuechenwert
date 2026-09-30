import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUxAlerts, runUxAlertCheck, setUxAlertStatus, type UxAlert, type UxAlertSeverity, type UxAlertStatus } from "@/features/ux-alerts/api";
import { SEVERITY_LABELS } from "@/features/ux-alerts/labels";
import { UxAlertCard } from "@/features/ux-alerts/UxAlertCard";

const SEVERITIES: UxAlertSeverity[] = ["high", "medium", "low"];

function AlertList({ alerts, busyId, onStatus }: { alerts: UxAlert[]; busyId: string | null; onStatus: (alert: UxAlert, status: UxAlertStatus) => void }) {
  return (
    <div className="space-y-4">
      {alerts.map((alert) => (
        <UxAlertCard
          key={alert.id}
          alert={alert}
          busy={busyId === alert.id}
          onResolve={(a) => onStatus(a, "resolved")}
          onReopen={(a) => onStatus(a, "open")}
        />
      ))}
    </div>
  );
}

/** UX-Alerts der Funnels: was kaputt ist, wo Nutzer abbrechen, wo sie hängen. */
export default function AdminUxAlerts() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [tab, setTab] = useState<UxAlertStatus>("open");
  const [lastCheck, setLastCheck] = useState<string | null>(null);

  const open = useQuery({ queryKey: ["uxAlerts", "open"], queryFn: () => fetchUxAlerts("open"), refetchInterval: 5 * 60_000 });
  const resolved = useQuery({ queryKey: ["uxAlerts", "resolved"], queryFn: () => fetchUxAlerts("resolved"), enabled: tab === "resolved" });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["uxAlerts"] });
    void queryClient.invalidateQueries({ queryKey: ["adminNotificationCounts"] });
  };

  const check = useMutation({
    mutationFn: runUxAlertCheck,
    onSuccess: (result) => {
      setLastCheck(result.checked_at);
      toast.success(result.open === 1 ? "Geprüft: 1 offener Alert" : `Geprüft: ${result.open} offene Alerts`);
      refresh();
    },
    onError: (error: Error) => toast.error(`Prüfung fehlgeschlagen: ${error.message}`),
  });

  const status = useMutation({
    mutationFn: ({ alert, next }: { alert: UxAlert; next: UxAlertStatus }) => setUxAlertStatus(alert.id, next, user?.id ?? null),
    onSuccess: (_data, { next }) => {
      toast.success(next === "resolved" ? "Als erledigt markiert" : "Wieder geöffnet");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openAlerts = open.data ?? [];
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, openAlerts.filter((a) => a.severity === s).length])) as Record<UxAlertSeverity, number>;
  const busyId = status.isPending ? status.variables?.alert.id ?? null : null;
  const onStatus = (alert: UxAlert, next: UxAlertStatus) => status.mutate({ alert, next });

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">UX-Alerts</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Stündlich geprüft: was in den Funnels kaputt ist, wo Besucher abbrechen und wo sie hängen. Grundlage sind die Funnel-Telemetrie (nur
            Besucher mit Statistik-Einwilligung), das Fehlerprotokoll und der Planer. „Erledigt“ blendet einen Alert aus; er kommt nur wieder,
            wenn das Problem nach dem Fix erneut auftritt.
          </p>
        </div>
        <Button onClick={() => check.mutate()} disabled={check.isPending}>
          {check.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Jetzt prüfen
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {SEVERITIES.map((s) => (
          <Badge key={s} className={SEVERITY_LABELS[s].className}>
            {SEVERITY_LABELS[s].label}: {counts[s]}
          </Badge>
        ))}
        {lastCheck && (
          <span className="text-xs text-muted-foreground">Zuletzt geprüft {format(new Date(lastCheck), "dd.MM. HH:mm", { locale: de })} Uhr</span>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as UxAlertStatus)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="open">Offen ({openAlerts.length})</TabsTrigger>
          <TabsTrigger value="resolved">Erledigt</TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          {open.isLoading ? (
            <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-muted-foreground" />
          ) : open.error ? (
            <p className="text-sm text-destructive">Alerts konnten nicht geladen werden: {(open.error as Error).message}</p>
          ) : openAlerts.length === 0 ? (
            <Card>
              <CardContent className="flex items-start gap-3 p-6 text-sm">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-success" aria-hidden="true" />
                <p className="text-muted-foreground">
                  Keine offenen UX-Alerts. Quoten zählen erst ab 3 Fällen, und Planungen gelten erst nach 2 Stunden als „ohne Anfrage“ – bei
                  wenig Verkehr dauert es etwas, bis Alerts erscheinen.
                </p>
              </CardContent>
            </Card>
          ) : (
            <AlertList alerts={openAlerts} busyId={busyId} onStatus={onStatus} />
          )}
        </TabsContent>

        <TabsContent value="resolved">
          {resolved.isLoading ? (
            <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-muted-foreground" />
          ) : (resolved.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine erledigten Alerts.</p>
          ) : (
            <AlertList alerts={resolved.data ?? []} busyId={busyId} onStatus={onStatus} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
