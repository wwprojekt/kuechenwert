import { useQuery } from "@tanstack/react-query";
import { Inbox, Loader2, MapPinned, Settings2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/features/marketplace/api-client";
import { DealerProjectCard } from "@/features/marketplace/components/DealerProjectCard";
import { fetchDealerProjects, fetchMarketProfile, signPlannerMedia, type DealerScope } from "@/features/marketplace/dealer-api";

const TABS: Array<{ id: DealerScope; label: string; empty: string }> = [
  { id: "open", label: "In meiner Region", empty: "Aktuell gibt es keine offenen Projekte in Ihrem Einzugsgebiet." },
  { id: "all", label: "Alle offenen Projekte", empty: "Aktuell sind keine Projekte ausgeschrieben." },
  { id: "mine", label: "Meine Angebote & Kunden", empty: "Sie haben noch kein Angebot abgegeben und keinen Kontakt freigeschaltet." },
];

export default function DealerProjects() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const scope = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "open") as DealerScope;

  const projects = useQuery({
    queryKey: ["dealer-projects", scope],
    queryFn: () => fetchDealerProjects(scope),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const profile = useQuery({
    queryKey: ["dealer-market-profile", user?.id],
    queryFn: () => fetchMarketProfile(user!.id),
    enabled: !!user?.id,
  });

  const coverPaths = (projects.data ?? [])
    .map((p) => (p.summary?.cover?.bucket === "planner-media" ? p.summary.cover.path : null))
    .filter((p): p is string => !!p);
  const covers = useQuery({
    queryKey: ["dealer-project-covers", coverPaths.join("|")],
    queryFn: () => signPlannerMedia(coverPaths),
    enabled: coverPaths.length > 0,
    staleTime: 30 * 60_000,
  });

  const tab = TABS.find((t) => t.id === scope)!;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Projekt-Börse</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Echte Küchenprojekte mit Maßen, Wunschkonfiguration und KI-Visualisierung. Geben Sie ein Angebot ab oder schalten Sie den Kontakt direkt frei.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/dashboard/projekte/einstellungen">
            <Settings2 className="mr-2 h-4 w-4" /> Einzugsgebiet
          </Link>
        </Button>
      </div>

      {profile.isSuccess && !profile.data?.service_postal_code && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm">
            <MapPinned className="mt-0.5 h-4 w-4 flex-none text-primary" />
            Legen Sie Ihr Einzugsgebiet fest, damit wir Ihnen passende Projekte zeigen und Sie bei neuen Anfragen sofort benachrichtigen.
          </p>
          <Button asChild size="sm">
            <Link to="/dashboard/projekte/einstellungen">Jetzt festlegen</Link>
          </Button>
        </div>
      )}

      <Tabs value={scope} onValueChange={(v) => setParams({ tab: v })}>
        <TabsList className="h-auto flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="py-2">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {projects.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : projects.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">{errorMessage(projects.error)}</div>
      ) : (projects.data ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
          <Inbox className="mx-auto h-9 w-9 text-primary" />
          <p className="mt-3 font-semibold">{tab.empty}</p>
          <p className="mt-1 text-sm text-muted-foreground">Wir benachrichtigen Sie per E-Mail, sobald neue Projekte in Ihrer Region eingehen.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {(projects.data ?? []).map((p) => (
            <DealerProjectCard key={p.auction_id} project={p} imageUrl={p.summary?.cover?.path ? covers.data?.[p.summary.cover.path] : null} />
          ))}
        </div>
      )}
    </div>
  );
}
