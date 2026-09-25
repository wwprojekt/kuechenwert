import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Briefcase, KeyRound, Loader2, MapPinned, Send, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import PendingDealerBanner from "@/components/dashboard/PendingDealerBanner";
import PendingDealerDocumentUpload from "@/components/dashboard/PendingDealerDocumentUpload";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { DealerProjectCard } from "@/features/marketplace/components/DealerProjectCard";
import { fetchDealerProjects, fetchMarketProfile, signPlannerMedia } from "@/features/marketplace/dealer-api";
import { useDealerPending } from "@/hooks/useDealerPending";

function Kpi({ icon, label, value, to }: { icon: JSX.Element; label: string; value: number | string; to: string }) {
  return (
    <Link to={to} className="group rounded-2xl border bg-card p-5 transition hover:border-primary/50 hover:shadow-md">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-extrabold tabular-nums text-foreground">{value}</p>
    </Link>
  );
}

export default function DealerHome() {
  const { user } = useAuth();
  const { isPendingDealer, isRejectedDealer, hasDealerApplication, application, dealerCountry, refetch } = useDealerPending();
  const locked = isPendingDealer || isRejectedDealer;

  const open = useQuery({ queryKey: ["dealer-projects", "open"], queryFn: () => fetchDealerProjects("open"), enabled: !locked });
  const mine = useQuery({ queryKey: ["dealer-projects", "mine"], queryFn: () => fetchDealerProjects("mine"), enabled: !locked });
  const profile = useQuery({ queryKey: ["dealer-market-profile", user?.id], queryFn: () => fetchMarketProfile(user!.id), enabled: !!user?.id && !locked });

  const latest = (open.data ?? []).slice(0, 3);
  const coverPaths = latest.map((p) => p.summary?.cover?.path).filter((p): p is string => !!p);
  const covers = useQuery({
    queryKey: ["dealer-project-covers", coverPaths.join("|")],
    queryFn: () => signPlannerMedia(coverPaths),
    enabled: coverPaths.length > 0,
    staleTime: 30 * 60_000,
  });

  const activeOffers = (mine.data ?? []).filter((p) => p.my_offer?.status === "active").length;
  const won = (mine.data ?? []).filter((p) => p.awarded_to_me).length;
  const contacts = (mine.data ?? []).filter((p) => p.contact_unlocked).length;

  return (
    <div className="space-y-8">
      {hasDealerApplication && application && (
        <div className="space-y-4">
          <PendingDealerBanner application={application} onRefresh={() => refetch()} countryCode={dealerCountry} />
          {locked && <PendingDealerDocumentUpload dealerApplicationId={application.id} countryCode={dealerCountry} />}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Willkommen im Studio-Portal</h1>
        <p className="mt-1 text-sm text-muted-foreground">Neue Küchenprojekte aus Ihrer Region – mit Maßen, Wunschkonfiguration und KI-Visualisierung.</p>
      </div>

      {locked ? (
        <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
          Nach der Freischaltung Ihres Studios sehen Sie hier alle Projekte in Ihrem Einzugsgebiet und können Angebote abgeben.
        </div>
      ) : (
        <>
          {profile.isSuccess && !profile.data?.service_postal_code && (
            <div className="flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-sm">
                <MapPinned className="mt-0.5 h-5 w-5 flex-none text-primary" />
                <span>
                  <strong>Letzter Schritt:</strong> Legen Sie Ihr Einzugsgebiet fest – dann benachrichtigen wir Sie sofort bei neuen Projekten in Ihrer Nähe.
                </span>
              </p>
              <Button asChild>
                <Link to="/dashboard/projekte/einstellungen">Einzugsgebiet festlegen</Link>
              </Button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={<Briefcase className="h-5 w-5" />} label="Offene Projekte in Ihrer Region" value={open.data?.length ?? "–"} to="/dashboard/projekte" />
            <Kpi icon={<Send className="h-5 w-5" />} label="Aktive Angebote" value={mine.data ? activeOffers : "–"} to="/dashboard/projekte?tab=mine" />
            <Kpi icon={<KeyRound className="h-5 w-5" />} label="Freigeschaltete Kontakte" value={mine.data ? contacts : "–"} to="/dashboard/projekte?tab=mine" />
            <Kpi icon={<Trophy className="h-5 w-5" />} label="Zuschläge" value={mine.data ? won : "–"} to="/dashboard/projekte?tab=mine" />
          </div>

          <section className="space-y-4">
            <div className="flex items-end justify-between">
              <h2 className="text-xl font-bold">Neueste Projekte in Ihrer Region</h2>
              <Link to="/dashboard/projekte" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                Alle ansehen <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            {open.isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : latest.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
                Gerade keine offenen Projekte in Ihrem Umkreis. Wir melden uns per E-Mail, sobald etwas Passendes eingeht.
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {latest.map((p) => (
                  <DealerProjectCard key={p.auction_id} project={p} imageUrl={p.summary?.cover?.path ? covers.data?.[p.summary.cover.path] : null} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
