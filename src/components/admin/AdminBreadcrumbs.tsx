import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ensureValidRLSSession } from "@/lib/sessionGuard";

const ROUTE_LABELS: Record<string, string> = {
  admin: "Admin",
  leads: "Leads & Anfragen",
  auctions: "Auktionen",
  kitchens: "Küchen",
  users: "Benutzer",
  dealers: "Händler",
  "dealer-stats": "Händler-Statistik",
  email: "E-Mail-Center",
  messages: "Support-Nachrichten",
  questions: "Küchenfragen",
  commissions: "Provisionen",
  contracts: "Kaufverträge",
  financials: "Finanzen",
  stations: "Ankaufstationen",
  appointments: "Termine",
  handover: "Übergabe",
  claims: "Reklamationen",
  offers: "Nachauktions-Angebote",
  reviews: "Händler-Bewertungen",
  "wertrechner-reviews": "Wertrechner-Bewertungen",
  analytics: "Analytics",
  blog: "Blog",
  legal: "Rechtliches",
  "error-logs": "Fehlerprotokoll",
  "cron-health": "Cron-Health",
  "audit-log": "Audit-Log",
  settings: "Einstellungen",
};

const BREADCRUMB_QUERY_PARENTS = new Set(["kitchens", "auctions", "users", "dealers"]);

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function formatKitchenLabel(manufacturer: string | null | undefined, model: string | null | undefined): string | null {
  const label = [manufacturer, model].filter(Boolean).join(" ").trim();
  return label || null;
}

function UuidBreadcrumbLabel({ parentSegment, uuidSegment }: { parentSegment: string; uuidSegment: string }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["breadcrumb", parentSegment, uuidSegment],
    enabled: BREADCRUMB_QUERY_PARENTS.has(parentSegment),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string | null> => {
      const sessionOk = await ensureValidRLSSession();
      if (!sessionOk) return null;

      switch (parentSegment) {
        case "kitchens": {
          const { data: row, error } = await supabase
            .from("kitchens")
            .select("manufacturer, model")
            .eq("id", uuidSegment)
            .maybeSingle();
          if (error) throw error;
          return formatKitchenLabel(row?.manufacturer, row?.model);
        }
        case "auctions": {
          const { data: row, error } = await supabase
            .from("auctions")
            .select("kitchen:kitchens(manufacturer, model)")
            .eq("id", uuidSegment)
            .maybeSingle();
          if (error) throw error;
          const mh = row?.kitchen as { manufacturer: string; model: string } | null | undefined;
          const vehicle = formatKitchenLabel(mh?.manufacturer, mh?.model);
          return vehicle ? `Auktion: ${vehicle}` : null;
        }
        case "users": {
          const { data: row, error } = await supabase
            .from("profiles")
            .select("first_name, last_name, email")
            .eq("id", uuidSegment)
            .maybeSingle();
          if (error) throw error;
          if (!row) return null;
          const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
          return name || row.email || null;
        }
        case "dealers": {
          const { data: row, error } = await supabase
            .from("dealer_applications")
            .select("company_name")
            .eq("id", uuidSegment)
            .maybeSingle();
          if (error) throw error;
          const name = row?.company_name?.trim();
          return name || null;
        }
        default:
          return null;
      }
    },
  });

  if (parentSegment === "appointments") {
    return <>Termin-Details</>;
  }

  if (!BREADCRUMB_QUERY_PARENTS.has(parentSegment)) {
    return <>Details</>;
  }

  if (isPending) {
    return <>…</>;
  }

  if (isError || !data) {
    return <>Details</>;
  }

  return <>{data}</>;
}

export function AdminBreadcrumbs() {
  const location = useLocation();

  const crumbs = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    if (parts.length <= 1) return [];

    const result: { label: string; path: string; uuidContext?: { parentSegment: string; uuidSegment: string } }[] = [];
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      currentPath += `/${segment}`;

      if (segment === "admin" && i === 0) continue;

      if (isUuid(segment)) {
        const parentSegment = i > 0 ? parts[i - 1] : "";
        result.push({
          label: "Details",
          path: currentPath,
          uuidContext: parentSegment ? { parentSegment, uuidSegment: segment } : undefined,
        });
      } else {
        result.push({
          label: ROUTE_LABELS[segment] || segment,
          path: currentPath,
        });
      }
    }

    return result;
  }, [location.pathname]);

  if (crumbs.length === 0) return null;

  const lastIndex = crumbs.length - 1;

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground min-w-0 flex-1">
      <Link
        to="/admin"
        className="hover:text-foreground transition-colors flex-shrink-0"
        aria-label="Admin Home"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((crumb, index) => {
        const isLast = index === lastIndex;
        // Auf Mobile alle Zwischen-Krümel ausblenden — nur Home + letzter Krümel sichtbar
        const wrapperClass = isLast
          ? "flex items-center gap-1 min-w-0"
          : "hidden sm:flex items-center gap-1 min-w-0";
        return (
          <div key={crumb.path} className={wrapperClass}>
            <ChevronRight className="h-3 w-3 flex-shrink-0" />
            {isLast ? (
              <span className="font-medium text-foreground truncate max-w-[160px] sm:max-w-[200px]">
                {crumb.uuidContext ? (
                  <UuidBreadcrumbLabel
                    parentSegment={crumb.uuidContext.parentSegment}
                    uuidSegment={crumb.uuidContext.uuidSegment}
                  />
                ) : (
                  crumb.label
                )}
              </span>
            ) : (
              <Link
                to={crumb.path}
                className="hover:text-foreground transition-colors truncate max-w-[150px]"
              >
                {crumb.uuidContext ? (
                  <UuidBreadcrumbLabel
                    parentSegment={crumb.uuidContext.parentSegment}
                    uuidSegment={crumb.uuidContext.uuidSegment}
                  />
                ) : (
                  crumb.label
                )}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
