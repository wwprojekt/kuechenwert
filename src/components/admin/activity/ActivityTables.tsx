import type { ElementType } from "react";
import { format } from "date-fns";
import { ClipboardList, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LEAD_TYPE_LABELS, leadSummary } from "@/components/admin/dashboard/useAdminDashboardData";
import { leadStatusBadge, offerStatusBadge } from "@/components/admin/leadLabels";
import type { ProjectFacts, UserOffer, UserProject } from "./activityData";

const formatEuro = (value: number) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);

const formatDay = (iso: string) => format(new Date(iso), "dd.MM.yyyy");

const placeLabel = (facts: ProjectFacts) => [facts.postal_code, facts.city].filter(Boolean).join(" ") || "—";

function EmptyState({ icon: Icon, text }: { icon: ElementType; text: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Icon className="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>{text}</p>
    </div>
  );
}

export function ProjectsTable({ projects }: { projects: UserProject[] }) {
  if (projects.length === 0) return <EmptyState icon={ClipboardList} text="Keine Küchenprojekte vorhanden" />;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Projekt</TableHead>
            <TableHead>Ort</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Erstellt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => {
            const status = leadStatusBadge(project.status);
            return (
              <TableRow key={project.id}>
                <TableCell>
                  <p className="font-medium">{leadSummary(project)}</p>
                  <p className="text-xs text-muted-foreground">
                    {LEAD_TYPE_LABELS[project.funnel_type] ?? project.funnel_type}
                  </p>
                </TableCell>
                <TableCell>{placeLabel(project)}</TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDay(project.created_at)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function OffersTable({ offers }: { offers: UserOffer[] }) {
  if (offers.length === 0) return <EmptyState icon={FileText} text="Keine Angebote abgegeben" />;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Projekt</TableHead>
            <TableHead>Angebot</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Abgegeben</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {offers.map((offer) => {
            const status = offerStatusBadge(offer.status);
            const lead = offer.auction?.lead ?? null;
            return (
              <TableRow key={offer.id}>
                <TableCell>
                  <p className="font-medium">{lead ? leadSummary(lead) : "Projekt nicht verfügbar"}</p>
                  {lead && <p className="text-xs text-muted-foreground">{placeLabel(lead)}</p>}
                </TableCell>
                <TableCell className="font-semibold">{formatEuro(offer.price_eur)}</TableCell>
                <TableCell>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDay(offer.created_at)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
