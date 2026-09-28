import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Briefcase, Building2, Euro, HandCoins, Inbox, LayoutGrid, Trophy, Users } from "lucide-react";
import type { ComponentType } from "react";
import { ChartCard, EmptyChart, KpiCard } from "./AnalyticsCards";
import { CHART_COLORS } from "./chartTheme";
import type { PlatformStats } from "./usePlatformStats";

function QuickStat({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-4">
      <Icon className="h-8 w-8 text-primary" />
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

export function PlatformTab({ stats }: { stats: PlatformStats | null | undefined }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Anfragen (30 Tage)" value={stats?.leads30 ?? 0} trend={stats?.leadsTrend} icon={Inbox} gradient="from-blue-500 to-cyan-500" />
        <KpiCard title="Studio-Angebote (30 Tage)" value={stats?.offers30 ?? 0} trend={stats?.offersTrend} icon={HandCoins} gradient="from-purple-500 to-pink-500" />
        <KpiCard title="Aktive Ausschreibungen" value={stats?.activeTenders ?? 0} icon={Briefcase} gradient="from-orange-500 to-red-500" />
        <KpiCard title="Vergebene Projekte" value={stats?.awardedTenders ?? 0} icon={Trophy} gradient="from-green-500 to-emerald-500" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Aktivität (letzte 30 Tage)" description="Neue Anfragen und Studio-Angebote pro Tag">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats?.daily ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="leads" stroke={CHART_COLORS[0]} strokeWidth={2} name="Anfragen" />
              <Line type="monotone" dataKey="offers" stroke={CHART_COLORS[1]} strokeWidth={2} name="Angebote" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Küchenformen" description="Anfragen der letzten 30 Tage nach Grundriss">
          {stats?.kitchenForms.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.kitchenForms}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {stats.kitchenForms.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart icon={LayoutGrid} />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Aktivste Küchenstudios" description="Abgegebene Angebote der letzten 30 Tage">
          {stats?.topStudios.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.topStudios} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={150} />
                <Tooltip />
                <Bar dataKey="count" fill={CHART_COLORS[0]} name="Angebote" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart icon={Building2} />
          )}
        </ChartCard>

        <ChartCard title="Schnellübersicht" description="Wichtige Kennzahlen auf einen Blick">
          <div className="space-y-4">
            <QuickStat icon={Users} label="Registrierte Nutzer" value={stats?.totalUsers ?? 0} />
            <QuickStat icon={Building2} label="Freigeschaltete Küchenstudios" value={stats?.activeStudios ?? 0} />
            <QuickStat
              icon={Euro}
              label="Ø Angebotspreis (30 Tage)"
              value={stats?.avgOfferEur != null ? `${Math.round(stats.avgOfferEur).toLocaleString("de-DE")} €` : "–"}
            />
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
