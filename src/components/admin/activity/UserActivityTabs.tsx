import { Link } from "react-router-dom";
import { ClipboardList, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailSection } from "@/components/admin/AdminDetailLayout";
import { OffersTable, ProjectsTable } from "./ActivityTables";
import type { UserOffer, UserProject } from "./activityData";

interface UserActivityTabsProps {
  email: string | null;
  isDealer: boolean;
  projects: UserProject[];
  projectsTotal: number;
  offers: UserOffer[];
  offersTotal: number;
}

export function UserActivityTabs({ email, isDealer, projects, projectsTotal, offers, offersTotal }: UserActivityTabsProps) {
  const leadsLink = email ? (
    <Button variant="link" className="h-auto p-0 text-sm" asChild>
      <Link to={`/admin/leads?q=${encodeURIComponent(email)}`}>
        Alle Anfragen anzeigen
        <ExternalLink className="w-3.5 h-3.5 ml-1 inline" />
      </Link>
    </Button>
  ) : null;

  const projectsSection = (
    <DetailSection title="Küchenprojekte" icon={<ClipboardList className="w-5 h-5" />} actions={leadsLink}>
      <ProjectsTable projects={projects} />
    </DetailSection>
  );

  if (!isDealer && offersTotal === 0) return projectsSection;

  return (
    <Tabs defaultValue={isDealer ? "offers" : "projects"} className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="offers">Angebote ({offersTotal})</TabsTrigger>
        <TabsTrigger value="projects">Küchenprojekte ({projectsTotal})</TabsTrigger>
      </TabsList>
      <TabsContent value="offers">
        <DetailSection title="Angebote" icon={<FileText className="w-5 h-5" />}>
          <OffersTable offers={offers} />
        </DetailSection>
      </TabsContent>
      <TabsContent value="projects">{projectsSection}</TabsContent>
    </Tabs>
  );
}
