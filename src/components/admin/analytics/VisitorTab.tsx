import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock, Eye, Globe, MousePointer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ChartCard, EmptyChart, KpiCard } from "./AnalyticsCards";
import { CHART_COLORS } from "./chartTheme";
import type { VisitorStats } from "./useVisitorStats";

export function VisitorTab({ stats }: { stats: VisitorStats | null | undefined }) {
  const hasData = (stats?.totalPageViews ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Seitenaufrufe" value={stats?.totalPageViews ?? 0} icon={Eye} gradient="from-indigo-500 to-purple-500" />
        <KpiCard title="Sitzungen" value={stats?.sessions ?? 0} icon={Globe} gradient="from-teal-500 to-green-500" />
        <KpiCard
          title="Ø Sitzungsdauer"
          value={stats?.avgSessionSeconds ? `${Math.max(1, Math.round(stats.avgSessionSeconds / 60))} min` : "—"}
          icon={Clock}
          gradient="from-amber-500 to-orange-500"
        />
        <KpiCard
          title="Seiten/Sitzung"
          value={stats?.sessions ? (stats.totalPageViews / stats.sessions).toFixed(1) : "—"}
          icon={MousePointer}
          gradient="from-rose-500 to-pink-500"
        />
      </div>

      {!hasData && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-4 p-6">
            <div className="rounded-lg bg-amber-100 p-2 dark:bg-amber-900/30">
              <Eye className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-100">Noch keine Besucherdaten</h3>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                Seitenaufrufe werden DSGVO-konform nur erfasst, wenn Besucher der Statistik-Erfassung im Cookie-Banner
                zugestimmt haben.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Seitenaufrufe (letzte 30 Tage)" description="Tägliche Seitenaufrufe mit Zustimmung">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats?.dailyPageViews ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="views" stroke={CHART_COLORS[0]} strokeWidth={2} name="Aufrufe" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Geräteverteilung" description="Desktop, Mobil und Tablet">
          {stats?.devices.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.devices}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {stats.devices.map((entry, index) => (
                    <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart icon={MousePointer} />
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Beliebteste Seiten" description="Meistbesuchte Seiten der letzten 30 Tage">
          {stats?.topPages.length ? (
            <div className="space-y-3">
              {stats.topPages.map((page) => (
                <div key={page.name} className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                  <span className="max-w-[200px] truncate text-sm font-medium">{page.name}</span>
                  <span className="text-sm text-muted-foreground">{page.value} Aufrufe</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyChart icon={Eye} />
          )}
        </ChartCard>

        <ChartCard title="Besucher nach Land" description="Geografische Verteilung der Seitenaufrufe">
          {stats?.countries.length ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.countries} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="value" fill={CHART_COLORS[0]} name="Aufrufe" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart icon={Globe} />
          )}
        </ChartCard>
      </div>
    </div>
  );
}
