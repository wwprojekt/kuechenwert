import PageLayout from "@/components/PageLayout";
import { getStoredProjectToken } from "@/features/marketplace/project-token";
import { ProjectView } from "./ProjectPage";
import { ProjectLinkRequest } from "./ProjectLinkRequest";

/**
 * /projekt: zeigt das Projekt, wenn in diesem Tab ein Projektlink geöffnet
 * wurde (Token in sessionStorage), sonst das Formular für einen neuen Link.
 */
export default function ProjectLinkPage() {
  const token = getStoredProjectToken();
  if (token) return <ProjectView token={token} />;

  return (
    <PageLayout
      title="Mein Küchenprojekt"
      description="Zugang zu Ihrem Küchenprojekt und allen Studio-Angeboten per E-Mail anfordern."
      canonicalPath="/projekt"
      noIndex
    >
      <section className="container max-w-xl py-14 sm:py-20">
        <h1 className="text-3xl font-extrabold tracking-tight">Mein Küchenprojekt</h1>
        <p className="mt-2 text-muted-foreground">
          Ihre Planung, die KI-Visualisierung und alle Angebote der Studios finden Sie auf Ihrer persönlichen Projektseite.
        </p>
        <div className="mt-8">
          <ProjectLinkRequest />
        </div>
      </section>
    </PageLayout>
  );
}
