import type { ComponentType, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  gradient: string;
  /** Veränderung gegenüber den vorherigen 30 Tagen in Prozent. */
  trend?: number | null;
}

export function KpiCard({ title, value, icon: Icon, gradient, trend }: KpiCardProps) {
  return (
    <Card className="overflow-hidden border-2">
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${gradient}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          {trend != null && trend !== 0 && (
            <div className={`flex items-center gap-1 text-sm ${trend > 0 ? "text-green-600" : "text-red-600"}`}>
              {trend > 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              {`${trend > 0 ? "+" : ""}${trend.toFixed(1)}%`}
            </div>
          )}
        </div>
        <p className="mb-1 text-sm text-muted-foreground">{title}</p>
        <p className="text-xl font-bold sm:text-2xl md:text-3xl">{value}</p>
      </CardContent>
    </Card>
  );
}

export function ChartCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function EmptyChart({ icon: Icon }: { icon: ComponentType<{ className?: string }> }) {
  return (
    <div className="py-8 text-center text-muted-foreground">
      <Icon className="mx-auto mb-3 h-12 w-12 opacity-50" />
      <p>Noch keine Daten vorhanden</p>
    </div>
  );
}
