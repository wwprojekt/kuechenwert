/**
 * Shared layout component for admin detail pages
 * Provides consistent structure with back navigation, title, and action buttons
 */

import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AdminDetailLayoutProps {
  /** Page title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Status badge configuration */
  status?: {
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  /** Back button URL (defaults to browser back) */
  backUrl?: string;
  /** Back button label */
  backLabel?: string;
  /** Action buttons to show in the header */
  actions?: ReactNode;
  /** Loading state */
  isLoading?: boolean;
  /** Main content */
  children: ReactNode;
  /** Icon to show next to title */
  icon?: ReactNode;
}

export function AdminDetailLayout({
  title,
  subtitle,
  status,
  backUrl,
  backLabel = "Zurück",
  actions,
  isLoading,
  children,
  icon,
}: AdminDetailLayoutProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backUrl) {
      navigate(backUrl);
    } else {
      navigate(-1);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Wird geladen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          {/* Back Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-2 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </Button>

          {/* Title Section */}
          <div className="flex items-start gap-3 min-w-0">
            {icon && (
              <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-xl sm:text-2xl font-bold text-foreground break-words">
                  {title}
                </h1>
                {status && (
                  <Badge variant={status.variant || "default"}>
                    {status.label}
                  </Badge>
                )}
              </div>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1 break-words">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}

/**
 * Detail section component for organizing content
 */
interface DetailSectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function DetailSection({
  title,
  icon,
  children,
  className = "",
  actions,
}: DetailSectionProps) {
  return (
    <div className={`bg-card rounded-lg border shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b">
        <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {actions}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}

/**
 * Info grid component for displaying key-value pairs
 */
interface InfoGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
}

export function InfoGrid({ children, columns = 3 }: InfoGridProps) {
  const colsClass = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  };

  return <div className={`grid ${colsClass[columns]} gap-4`}>{children}</div>;
}

/**
 * Info item component for displaying a single key-value pair
 */
interface InfoItemProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function InfoItem({ label, value, icon, className = "" }: InfoItemProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

/**
 * Stats card component for displaying metrics
 */
interface StatsCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
}

export function StatsCard({
  label,
  value,
  icon,
  trend,
  className = "",
}: StatsCardProps) {
  return (
    <div className={`p-4 rounded-lg border bg-card ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      <p className="text-2xl font-bold mt-2">{value}</p>
      {trend && (
        <p
          className={`text-xs mt-1 ${
            trend.value >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {trend.value >= 0 ? "+" : ""}
          {trend.value}% {trend.label}
        </p>
      )}
    </div>
  );
}

export default AdminDetailLayout;
