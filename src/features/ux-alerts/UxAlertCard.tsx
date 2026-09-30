import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { CheckCircle2, ExternalLink, Lightbulb, Loader2, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { UxAlert } from "./api";
import { CATEGORY_LABELS, FUNNEL_LABELS, SEVERITY_LABELS } from "./labels";
import { uxAlertLinks } from "./links";

const when = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true, locale: de });
const at = (iso: string) => format(new Date(iso), "dd.MM. HH:mm", { locale: de });

interface UxAlertCardProps {
  alert: UxAlert;
  busy: boolean;
  onResolve: (alert: UxAlert) => void;
  onReopen: (alert: UxAlert) => void;
}

export function UxAlertCard({ alert, busy, onResolve, onReopen }: UxAlertCardProps) {
  const severity = SEVERITY_LABELS[alert.severity];
  const place = [alert.funnel ? FUNNEL_LABELS[alert.funnel] : null, alert.step_label ?? alert.step].filter(Boolean).join(" · ");
  const open = alert.status === "open";

  return (
    <Card className={cn(open && alert.severity === "high" && "border-destructive/40")}>
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge className={severity.className}>{severity.label}</Badge>
          <Badge variant="outline">{CATEGORY_LABELS[alert.category]}</Badge>
          {place && <span className="text-muted-foreground">{place}</span>}
          {alert.field && <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{alert.field}</code>}
        </div>

        <div>
          <h3 className="font-semibold leading-snug text-foreground">{alert.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{alert.detail}</p>
        </div>

        <div className="flex gap-2 rounded-xl bg-muted/60 p-3 text-sm">
          <Lightbulb className="mt-0.5 h-4 w-4 flex-none text-primary" aria-hidden="true" />
          <p>
            <span className="font-medium text-foreground">Was tun? </span>
            <span className="text-muted-foreground">{alert.hint}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            {open ? (
              <>
                Erkannt {when(alert.first_seen_at)} · zuletzt {when(alert.last_seen_at)}
                {alert.reopened_count > 0 && ` · ${alert.reopened_count}× wieder aufgetreten`}
              </>
            ) : (
              <>
                {alert.auto_resolved ? "Von selbst geschlossen" : "Erledigt"} am {alert.resolved_at ? at(alert.resolved_at) : "–"}
                {alert.resolved_note && ` · ${alert.resolved_note}`}
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {uxAlertLinks(alert).map((link) =>
              link.external ? (
                <Button key={link.label} asChild size="sm" variant="ghost">
                  <a href={link.to} target="_blank" rel="noopener">
                    {link.label}
                    <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </Button>
              ) : (
                <Button key={link.label} asChild size="sm" variant="ghost">
                  <Link to={link.to}>{link.label}</Link>
                </Button>
              ),
            )}
            {open ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onResolve(alert)}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                Erledigt
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onReopen(alert)}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-4 w-4" />}
                Wieder öffnen
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
