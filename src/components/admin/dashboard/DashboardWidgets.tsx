import { useMemo, useState, type ElementType } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Banknote, ChevronRight, Euro, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { timeAgo, type ActionItem } from "./useAdminDashboardData";

export function CountBadge({ count, color = "bg-red-500" }: { count: number; color?: string }) {
  if (count === 0) return null;
  return (
    <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white rounded-full ${color}`}>
      {count}
    </span>
  );
}

export function UrgencyBadge({ days }: { days: number }) {
  if (days >= 3) return <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">{days} Tage</Badge>;
  if (days >= 1) return <Badge className="bg-orange-500 text-white text-[10px] px-1.5 py-0">{days} Tag{days > 1 ? "e" : ""}</Badge>;
  return <Badge className="bg-green-500 text-white text-[10px] px-1.5 py-0">Heute</Badge>;
}

interface QuickStatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: ElementType;
  color: string;
  bgColor: string;
  link: string;
  badge?: number;
}

export function QuickStatCard({ title, value, subtitle, icon: Icon, color, bgColor, link, badge }: QuickStatCardProps) {
  return (
    <Link to={link} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-xl">
      <Card className="relative overflow-hidden hover:shadow-md border-2 hover:border-primary/30 transition-all duration-200 cursor-pointer group min-h-[88px] sm:min-h-0">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">{title}</p>
              <p className="text-xl sm:text-2xl font-bold mt-0.5">{value}</p>
              {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
            </div>
            <div className={`h-9 w-9 sm:h-11 sm:w-11 rounded-lg ${bgColor} dark:bg-opacity-20 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0`}>
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${color}`} />
            </div>
          </div>
          {badge !== undefined && badge > 0 && (
            <div className="absolute top-2 right-2">
              <CountBadge count={badge} />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

const INITIAL_ACTION_COUNT = 8;

export function ActionItemsList({ items }: { items: ActionItem[] }) {
  const [showAll, setShowAll] = useState(false);

  const grouped = useMemo(() => {
    const groups: Record<string, number> = {};
    for (const item of items) {
      const key = item.badge || item.type;
      groups[key] = (groups[key] || 0) + 1;
    }
    return groups;
  }, [items]);

  const displayed = showAll ? items : items.slice(0, INITIAL_ACTION_COUNT);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5 mb-3">
        {Object.entries(grouped).map(([key, count]) => (
          <span key={key} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-muted">
            <span className="font-medium">{count}</span>
            <span className="text-muted-foreground">{key}</span>
          </span>
        ))}
      </div>

      {displayed.map((item) => (
        <Link key={item.id} to={item.link} className="block">
          <div className={`flex items-start gap-3 p-2.5 sm:p-3 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer group ${
            item.priority === "high" ? "border-l-4 border-l-red-400" : ""
          }`}>
            <div className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg ${item.iconColor} flex items-center justify-center flex-shrink-0 mt-0.5`}>
              <item.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">{item.title}</p>
                {item.badge && (
                  <Badge className={`${item.badgeColor} text-[10px] px-1.5 py-0 h-4 text-white flex-shrink-0`}>
                    {item.badge}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] sm:text-[11px] text-muted-foreground whitespace-nowrap">{timeAgo(item.time)}</span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
            </div>
          </div>
        </Link>
      ))}
      {items.length > INITIAL_ACTION_COUNT && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full text-center py-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          {showAll ? "Weniger anzeigen" : `+ ${items.length - INITIAL_ACTION_COUNT} weitere anzeigen`}
        </button>
      )}
    </div>
  );
}

interface RevenueOverviewProps {
  revenue: {
    weekRevenue: number;
    monthRevenue: number;
    openInvoices: number;
    overdueInvoices: number;
    overdueAmount: number;
  };
}

function RevenueTile({ icon: Icon, iconClass, value, label, className = "" }: {
  icon: ElementType;
  iconClass: string;
  value: string | number;
  label: string;
  className?: string;
}) {
  return (
    <Link to="/admin/financials">
      <Card className={`p-4 hover:shadow-md transition-shadow cursor-pointer ${className}`}>
        <div className="flex items-center gap-3">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${iconClass}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-lg font-bold">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function RevenueOverview({ revenue }: RevenueOverviewProps) {
  const hasOverdue = revenue.overdueInvoices > 0;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
      <RevenueTile
        icon={Euro}
        iconClass="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"
        value={`${revenue.monthRevenue.toLocaleString("de-DE")} €`}
        label="Umsatz Monat"
      />
      <RevenueTile
        icon={Banknote}
        iconClass="bg-blue-100 dark:bg-blue-900/30 text-blue-600"
        value={`${revenue.weekRevenue.toLocaleString("de-DE")} €`}
        label="Umsatz Woche"
      />
      <RevenueTile
        icon={Receipt}
        iconClass="bg-amber-100 dark:bg-amber-900/30 text-amber-600"
        value={revenue.openInvoices}
        label="Offene Rechnungen"
        className={revenue.openInvoices > 0 ? "border-amber-200" : ""}
      />
      <RevenueTile
        icon={AlertTriangle}
        iconClass={hasOverdue ? "bg-red-100 dark:bg-red-900/30 text-red-600" : "bg-gray-100 text-gray-600"}
        value={revenue.overdueInvoices}
        label={`Überfällig (${revenue.overdueAmount.toLocaleString("de-DE")} €)`}
        className={hasOverdue ? "border-red-200 bg-red-50/50 dark:bg-red-950/20" : ""}
      />
    </div>
  );
}
