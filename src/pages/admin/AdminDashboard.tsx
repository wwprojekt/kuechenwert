import type { ElementType } from "react";
import { Link } from "react-router-dom";
import {
  Users, TrendingUp, UserPlus, Mail, AlertCircle, MessageSquare, Building2,
  FileText, CheckCircle2, ArrowRight, Bell, Inbox, RefreshCw, ExternalLink,
  Activity, BarChart3, PhoneCall, Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FunnelCInsightCard } from "@/components/admin/FunnelCInsightCard";
import {
  ActionItemsList,
  CountBadge,
  QuickStatCard,
  RevenueOverview,
  UrgencyBadge,
} from "@/components/admin/dashboard/DashboardWidgets";
import {
  timeAgo,
  useActionItems,
  useActivityTimeline,
  useDashboardCounts,
  useLeadMetrics,
  useRevenueStats,
  useUrgentLeads,
  type TimelineItem,
} from "@/components/admin/dashboard/useAdminDashboardData";

const TIMELINE_DOT: Record<TimelineItem["type"], string> = {
  lead: "bg-emerald-500",
  wizard: "bg-blue-500",
  email: "bg-orange-500",
  dealer: "bg-amber-500",
};

function QuickLink({ to, icon: Icon, iconClass, label, hint, hintClass }: {
  to: string;
  icon: ElementType;
  iconClass: string;
  label: string;
  hint?: string;
  hintClass?: string;
}) {
  return (
    <Link to={to}>
      <div className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/60 transition-colors cursor-pointer">
        <Icon className={`w-4 h-4 ${iconClass}`} />
        <div>
          <p className="text-xs font-medium">{label}</p>
          {hint && <p className={`text-[10px] ${hintClass}`}>{hint}</p>}
        </div>
      </div>
    </Link>
  );
}

export default function AdminDashboard() {
  const { data: counts } = useDashboardCounts();
  const { data: actionItems, isLoading: actionsLoading } = useActionItems();
  const { data: urgentLeads } = useUrgentLeads();
  const { data: revenue } = useRevenueStats();
  const { data: timeline } = useActivityTimeline();
  const { data: metrics } = useLeadMetrics();

  const totalActionItems = actionItems?.length || 0;
  const highPriorityItems = actionItems?.filter((i) => i.priority === "high").length || 0;
  const metricTiles = metrics
    ? [
        { label: "Leads", value: metrics.total, className: "" },
        { label: "Angebote einholen", value: metrics.funnelA, className: "" },
        { label: "Unterbieten", value: metrics.funnelB, className: "" },
        { label: "Traumküchen-KI", value: metrics.funnelC, className: "" },
        { label: "In Ausschreibung", value: metrics.inTender, className: "text-blue-600" },
        { label: "Gewonnen", value: metrics.won, className: "text-green-600" },
      ]
    : [];

  return (
    <div className="space-y-4 sm:space-y-6 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Willkommen zurück. Hier ist dein Überblick.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          <span className="hidden sm:inline">Aktualisiert sich automatisch</span>
          <span className="sm:hidden">Auto-Aktualisierung</span>
        </div>
      </div>

      {highPriorityItems > 0 && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center flex-shrink-0">
              <Bell className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-red-800 dark:text-red-300">
                {highPriorityItems} dringende {highPriorityItems === 1 ? "Aufgabe" : "Aufgaben"} warten auf dich
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                Neue Anfragen, offene Nachrichten oder Studio-Bewerbungen erfordern deine Aufmerksamkeit.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <QuickStatCard
          title="Neue Anfragen"
          value={counts?.totalAnfragen || 0}
          subtitle="unbearbeitet / 24 h"
          icon={FileText}
          color="text-blue-600"
          bgColor="bg-blue-100"
          link="/admin/leads"
          badge={counts?.totalAnfragen}
        />
        <QuickStatCard
          title="Nachrichten"
          value={counts?.totalMessages || 0}
          subtitle={counts?.totalMessages ? "offen" : "alles erledigt"}
          icon={Inbox}
          color="text-orange-600"
          bgColor="bg-orange-100"
          link="/admin/messages"
          badge={counts?.totalMessages}
        />
        <QuickStatCard
          title="Leads"
          value={counts?.totalLeads || 0}
          subtitle="alle Funnel"
          icon={TrendingUp}
          color="text-green-600"
          bgColor="bg-green-100"
          link="/admin/leads"
        />
        <QuickStatCard
          title="Studio-Bewerbungen"
          value={counts?.pendingDealers || 0}
          subtitle="ausstehend"
          icon={Building2}
          color="text-amber-600"
          bgColor="bg-amber-100"
          link="/admin/dealers"
          badge={counts?.pendingDealers}
        />
        <QuickStatCard
          title="Benutzer"
          value={counts?.totalUsers || 0}
          subtitle="registriert"
          icon={Users}
          color="text-slate-600"
          bgColor="bg-slate-100"
          link="/admin/users"
        />
      </div>

      {revenue && (revenue.monthRevenue > 0 || revenue.openInvoices > 0 || revenue.overdueInvoices > 0) && (
        <RevenueOverview revenue={revenue} />
      )}

      <FunnelCInsightCard />

      {metrics && metrics.total > 0 && (
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Leads (30 Tage)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {metricTiles.map((tile) => (
                <div key={tile.label} className="text-center p-2">
                  <p className={`text-xl font-bold ${tile.className}`}>{tile.value}</p>
                  <p className="text-[10px] text-muted-foreground">{tile.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-primary" />
                Offene Aufgaben
                {totalActionItems > 0 && <CountBadge count={totalActionItems} color="bg-primary" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {actionsLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Lade Aufgaben...
                </div>
              ) : !actionItems || actionItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                  <p className="font-medium text-green-700 dark:text-green-400">Alles erledigt!</p>
                  <p className="text-sm text-muted-foreground mt-1">Keine offenen Aufgaben vorhanden.</p>
                </div>
              ) : (
                <ActionItemsList items={actionItems} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {urgentLeads && urgentLeads.length > 0 && (
            <Card className="border-2 border-orange-200 dark:border-orange-900">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <PhoneCall className="w-4 h-4 text-orange-600" />
                    Dringende Anfragen
                  </CardTitle>
                  <Button asChild variant="ghost" size="sm" className="text-xs h-7">
                    <Link to="/admin/leads">
                      Alle <ArrowRight className="w-3 h-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {urgentLeads.slice(0, 5).map((lead) => (
                    <Link key={lead.id} to="/admin/leads" className="block">
                      <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg hover:bg-muted/60 transition-colors">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{lead.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{lead.summary}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {lead.contacted && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">Kontaktiert</Badge>}
                          <UrgencyBadge days={lead.ageDays} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {timeline && timeline.length > 0 && (
            <Card className="border-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-slate-500" />
                  Aktivitäts-Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {timeline.slice(0, 8).map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${TIMELINE_DOT[item.type]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.title}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{item.subtitle}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(item.time)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500" />
                Bereiche mit Handlungsbedarf
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                <QuickLink
                  to="/admin/leads"
                  icon={UserPlus}
                  iconClass="text-cyan-500"
                  label="Leads"
                  hint={counts?.totalAnfragen ? `${counts.totalAnfragen} neu` : undefined}
                  hintClass="text-cyan-600"
                />
                <QuickLink
                  to="/admin/messages"
                  icon={MessageSquare}
                  iconClass="text-orange-500"
                  label="Nachrichten"
                  hint={counts?.totalMessages ? `${counts.totalMessages} offen` : undefined}
                  hintClass="text-orange-600"
                />
                <QuickLink to="/admin/email" icon={Mail} iconClass="text-purple-500" label="E-Mail-Center" />
                <QuickLink
                  to="/admin/dealers"
                  icon={Building2}
                  iconClass="text-amber-500"
                  label="Küchenstudios"
                  hint={counts?.pendingDealers ? `${counts.pendingDealers} ausstehend` : undefined}
                  hintClass="text-amber-600"
                />
                <QuickLink to="/admin/planner-sessions" icon={Sparkles} iconClass="text-violet-500" label="Traumküchen-KI" />
                <QuickLink to="/admin/analytics" icon={TrendingUp} iconClass="text-rose-500" label="Analytics" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
