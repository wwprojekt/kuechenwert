import { useLocation, Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { useMemo } from "react";

const ROUTE_LABELS: Record<string, string> = {
  admin: "Admin",
  leads: "Leads & Anfragen",
  auctions: "Auktionen",
  motorhomes: "Wohnmobile",
  users: "Benutzer",
  dealers: "Händler",
  "dealer-stats": "Händler-Statistik",
  email: "E-Mail-Center",
  messages: "Support-Nachrichten",
  questions: "Fahrzeugfragen",
  commissions: "Provisionen",
  contracts: "Kaufverträge",
  financials: "Finanzen",
  stations: "Ankaufstationen",
  appointments: "Termine",
  handover: "Übergabe",
  claims: "Reklamationen",
  offers: "Nachauktions-Angebote",
  reviews: "Bewertungen",
  analytics: "Analytics",
  blog: "Blog",
  legal: "Rechtliches",
  "error-logs": "Fehlerprotokoll",
  "audit-log": "Audit-Log",
  settings: "Einstellungen",
};

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export function AdminBreadcrumbs() {
  const location = useLocation();

  const crumbs = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    if (parts.length <= 1) return [];

    const result: { label: string; path: string }[] = [];
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      currentPath += `/${segment}`;

      if (segment === "admin" && i === 0) continue;

      if (isUuid(segment)) {
        result.push({ label: "Details", path: currentPath });
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

  return (
    <nav className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground min-w-0">
      <Link to="/admin" className="hover:text-foreground transition-colors flex-shrink-0">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((crumb, index) => (
        <div key={crumb.path} className="flex items-center gap-1 min-w-0">
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
          {index === crumbs.length - 1 ? (
            <span className="font-medium text-foreground truncate max-w-[200px]">
              {crumb.label}
            </span>
          ) : (
            <Link
              to={crumb.path}
              className="hover:text-foreground transition-colors truncate max-w-[150px]"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
