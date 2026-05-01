import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Sparkles,
  MessageSquarePlus,
  TrendingDown,
  Wand2,
  ArrowRight,
  Clock,
  CheckCircle2,
  Hash,
  ImageIcon,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * "Meine Küchen-Journey" – Customer-Dashboard Einstieg fuer den neuen
 * Lead-zentrierten Flow.
 *
 * Zeigt:
 *  1. Alle Leads des eingeloggten Users (Funnel A = Angebote einholen,
 *     Funnel B = Studio-Preis unterbieten, Funnel C = Traumkueche-KI)
 *  2. Alle Traumkueche-KI-Visualisierungen aus planner_sessions
 *  3. Wenn beides leer ist: Einen 3-Funnel-CTA-Block, damit der User
 *     startet.
 *
 * Wichtig: `leads.user_id` wird nur gesetzt, wenn der Funnel waehrend
 * einer eingeloggten Session abgesendet wurde. Aeltere Guest-Leads sind
 * daher nicht sichtbar -- das ist gewollt.
 */

type LeadRow = {
  id: string;
  funnel_type: "a" | "b" | "traumkueche";
  funnel_variant: string | null;
  status: string;
  kitchen_form: string | null;
  kitchen_style: string | null;
  budget_midpoint: number | null;
  existing_offer_price_cents: number | null;
  existing_offer_studio: string | null;
  timeframe_months: number | null;
  created_at: string;
};

type PlannerSessionRow = {
  id: string;
  session_token: string;
  spec: Record<string, unknown> | null;
  image_url: string | null;
  status: string;
  lead_id: string | null;
  created_at: string;
};

const FUNNEL_META: Record<
  LeadRow["funnel_type"],
  {
    title: string;
    href: string;
    icon: typeof Sparkles;
    color: string;
    description: string;
  }
> = {
  a: {
    title: "Angebote einholen",
    href: "/funnel/a",
    icon: MessageSquarePlus,
    color: "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800",
    description: "Bis zu 3 geprüfte Studios geben Ihnen ein unverbindliches Angebot.",
  },
  b: {
    title: "Studio-Preis unterbieten",
    href: "/funnel/b",
    icon: TrendingDown,
    color:
      "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800",
    description: "Bestehendes Küchen-Angebot von verifizierten Händlern unterbieten lassen.",
  },
  traumkueche: {
    title: "Traumküche-KI",
    href: "/funnel/c",
    icon: Wand2,
    color:
      "text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-800",
    description: "Ihre Vorstellungen als KI-Visualisierung – qualifiziert Ihre Anfrage.",
  },
};

function formatStatus(status: string): { label: string; tone: "default" | "success" | "warning" | "muted" } {
  switch (status) {
    case "new":
      return { label: "Neu eingegangen", tone: "warning" };
    case "qualified":
      return { label: "Qualifiziert", tone: "default" };
    case "matched":
      return { label: "Studios zugeordnet", tone: "default" };
    case "in_auction":
      return { label: "Studios bieten", tone: "default" };
    case "offer_sent":
      return { label: "Angebot erhalten", tone: "success" };
    case "appointment_set":
      return { label: "Termin vereinbart", tone: "success" };
    case "closed_won":
      return { label: "Abgeschlossen", tone: "success" };
    case "closed_lost":
      return { label: "Nicht gewonnen", tone: "muted" };
    case "disqualified":
      return { label: "Nicht passend", tone: "muted" };
    default:
      return { label: status, tone: "muted" };
  }
}

function StatusBadge({ status }: { status: string }) {
  const { label, tone } = formatStatus(status);
  const toneClass =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300"
        : tone === "muted"
          ? "bg-muted text-muted-foreground border-border"
          : "bg-primary/5 text-primary border-primary/20";
  return <Badge className={`font-normal ${toneClass}`} variant="outline">{label}</Badge>;
}

function formatBudget(cents?: number | null, euros?: number | null): string | null {
  if (cents && cents > 0) {
    return `${Math.round(cents / 100).toLocaleString("de-DE")} €`;
  }
  if (euros && euros > 0) {
    return `${euros.toLocaleString("de-DE")} €`;
  }
  return null;
}

export function MyKuechenJourney() {
  const { user } = useAuth();

  const { data: leads, isLoading: leadsLoading } = useQuery({
    queryKey: ["myLeads", user?.id],
    queryFn: async () => {
      if (!user) return [] as LeadRow[];
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id,funnel_type,funnel_variant,status,kitchen_form,kitchen_style,budget_midpoint,existing_offer_price_cents,existing_offer_studio,timeframe_months,created_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as LeadRow[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["myPlannerSessions", user?.id],
    queryFn: async () => {
      if (!user) return [] as PlannerSessionRow[];
      // Planner-Sessions ohne `user_id`-Spalte -> ueber lead_id joinen:
      // Alle Sessions auflisten, deren lead_id zu einem User-Lead gehoert.
      const { data: leadIds } = await supabase
        .from("leads")
        .select("id")
        .eq("user_id", user.id)
        .eq("funnel_type", "traumkueche");
      const ids = (leadIds ?? []).map((l) => l.id);
      if (ids.length === 0) return [] as PlannerSessionRow[];
      const { data, error } = await supabase
        .from("planner_sessions")
        .select("id,session_token,spec,image_url,status,lead_id,created_at")
        .in("lead_id", ids)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as PlannerSessionRow[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const isLoading = leadsLoading || sessionsLoading;
  const hasLeads = (leads?.length ?? 0) > 0;
  const hasSessions = (sessions?.length ?? 0) > 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-primary" />
            Meine Küchen-Journey
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Empty state: keine Anfragen -> 3-Funnel-CTA
  if (!hasLeads && !hasSessions) {
    return (
      <Card className="border-2 border-dashed border-primary/30">
        <CardContent className="p-6 sm:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-2xl bg-primary/10 mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold mb-2">
              Starten Sie Ihre Küchen-Planung
            </h3>
            <p className="text-muted-foreground max-w-xl mx-auto text-sm sm:text-base">
              Drei Wege zur Traumküche – suchen Sie sich den passenden aus. Sie
              sehen Ihre Anfragen und eingehende Studio-Angebote anschließend
              hier im Dashboard.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {(Object.keys(FUNNEL_META) as LeadRow["funnel_type"][]).map((key) => {
              const meta = FUNNEL_META[key];
              const Icon = meta.icon;
              return (
                <Link
                  key={key}
                  to={meta.href}
                  className={`block rounded-xl border-2 p-5 transition hover:scale-[1.02] hover:shadow-lg ${meta.color}`}
                >
                  <Icon className="w-7 h-7 mb-3" />
                  <h4 className="font-semibold text-base mb-1.5 text-foreground">
                    {meta.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    {meta.description}
                  </p>
                  <div className="flex items-center gap-1 text-xs font-medium">
                    Jetzt starten <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {hasLeads && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="w-5 h-5 text-primary" />
                Meine Anfragen
                <Badge variant="secondary" className="ml-1">
                  {leads?.length ?? 0}
                </Badge>
              </CardTitle>
              <Link to="/funnel/a">
                <Button variant="ghost" size="sm" className="gap-1 h-8">
                  Neue Anfrage <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {leads?.map((lead) => {
              const meta = FUNNEL_META[lead.funnel_type];
              const Icon = meta?.icon ?? Sparkles;
              const budget = formatBudget(
                lead.existing_offer_price_cents,
                lead.budget_midpoint,
              );
              return (
                <div
                  key={lead.id}
                  className="flex flex-col sm:flex-row gap-3 sm:items-center p-4 rounded-lg border hover:bg-accent/50 transition"
                >
                  <div
                    className={`inline-flex p-2.5 rounded-lg border ${meta?.color ?? "bg-muted"} flex-shrink-0`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-medium">
                        {meta?.title ?? lead.funnel_type}
                      </span>
                      <StatusBadge status={lead.status} />
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(lead.created_at), "dd.MM.yyyy", {
                          locale: de,
                        })}
                      </span>
                      {lead.kitchen_form && (
                        <span className="capitalize">Form: {lead.kitchen_form}</span>
                      )}
                      {lead.kitchen_style && (
                        <span className="capitalize">Stil: {lead.kitchen_style}</span>
                      )}
                      {budget && (
                        <span>
                          {lead.funnel_type === "b" ? "Vorliegendes Angebot" : "Budget"}:
                          {" "}
                          {budget}
                        </span>
                      )}
                      {lead.existing_offer_studio && (
                        <span>Studio: {lead.existing_offer_studio}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                    <Hash className="w-3 h-3" />
                    <span className="font-mono">{lead.id.slice(0, 8)}</span>
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground pt-2 border-t">
              Sobald Küchenstudios auf Ihre Anfragen reagieren, erscheinen die
              Angebote hier.
            </p>
          </CardContent>
        </Card>
      )}

      {hasSessions && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wand2 className="w-5 h-5 text-primary" />
                Meine Traumküche-Visualisierungen
                <Badge variant="secondary" className="ml-1">
                  {sessions?.length ?? 0}
                </Badge>
              </CardTitle>
              <Link to="/funnel/c">
                <Button variant="ghost" size="sm" className="gap-1 h-8">
                  Neue erzeugen <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sessions?.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border overflow-hidden bg-background"
                >
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    {s.image_url ? (
                      <img
                        src={s.image_url}
                        alt="Traumküche-Render"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                    )}
                  </div>
                  <div className="p-3 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground mb-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(s.created_at), "dd.MM.yyyy HH:mm", {
                        locale: de,
                      })}
                    </div>
                    {s.lead_id && (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="w-3 h-3" />
                        Als Anfrage abgesendet
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
