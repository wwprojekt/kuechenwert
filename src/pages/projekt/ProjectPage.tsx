import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Hourglass, Inbox, Loader2, PartyPopper, XCircle } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import PageLayout from "@/components/PageLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, errorMessage } from "@/features/marketplace/api-client";
import { OfferCard } from "@/features/marketplace/components/OfferCard";
import { acceptOffer, cancelProject, getProject, type ProjectOffer, type ProjectView } from "@/features/marketplace/project-api";
import { BeforeAfterSlider } from "@/features/planner/components/BeforeAfterSlider";
import { ProjectLinkRequest } from "./ProjectLinkRequest";
import { cn } from "@/lib/utils";

const euro = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;
const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "long" }) : "–");

function remaining(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  return days > 0 ? `${days} Tag${days === 1 ? "" : "e"} ${hours} Std.` : `${hours} Std.`;
}

function Timeline({ view }: { view: ProjectView }) {
  const status = view.tender?.status ?? "draft";
  const steps = [
    { label: "Projekt angelegt", done: true },
    { label: status === "draft" ? "Prüfung durch KüchenWert" : "Studios geben Angebote ab", done: ["active", "completed", "awarded", "expired"].includes(status) },
    { label: "Sie vergleichen & wählen", done: ["completed", "awarded"].includes(status) || view.offers.length > 0 },
    { label: "Studio beauftragt", done: status === "awarded" },
  ];
  return (
    <ol className="grid gap-3 sm:grid-cols-4">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-2.5 sm:flex-col sm:items-start">
          <span className={cn("grid h-8 w-8 flex-none place-items-center rounded-full text-sm font-bold", s.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {s.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </span>
          <span className={cn("text-sm font-medium", s.done ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

export default function ProjectPage() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const isNew = params.get("neu") === "1";
  const qc = useQueryClient();
  const [pending, setPending] = useState<ProjectOffer | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const query = useQuery({
    queryKey: ["kw-project", token],
    queryFn: () => getProject(token),
    enabled: token.length > 20,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  const accept = useMutation({
    mutationFn: (bidId: string) => acceptOffer(token, bidId),
    onSuccess: (view) => {
      qc.setQueryData(["kw-project", token], view);
      toast.success("Geschafft! Das Studio erhält Ihre Kontaktdaten und meldet sich bei Ihnen.");
      setPending(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const cancel = useMutation({
    mutationFn: () => cancelProject(token, cancelReason),
    onSuccess: (view) => {
      qc.setQueryData(["kw-project", token], view);
      setCancelOpen(false);
      toast.success("Ihr Projekt wurde beendet. Die Studios wurden informiert.");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (query.isLoading) {
    return (
      <PageLayout title="Ihr Küchenprojekt" description="Ihre Küchenplanung und Angebote" canonicalPath="/projekt" noIndex>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PageLayout>
    );
  }

  if (query.isError || !query.data) {
    return (
      <PageLayout title="Projektlink ungültig" description="Fordern Sie einen neuen Projektlink an" canonicalPath="/projekt" noIndex>
        <section className="container max-w-xl py-16">
          <div className="rounded-2xl border bg-card p-8 text-center">
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-4 text-2xl font-bold">Dieser Link funktioniert nicht</h1>
            <p className="mt-2 text-muted-foreground">{errorMessage(query.error)}</p>
          </div>
          <div className="mt-8">
            <ProjectLinkRequest />
          </div>
        </section>
      </PageLayout>
    );
  }

  const view = query.data;
  const tender = view.tender;
  const estimate = tender?.summary?.estimate ?? (tender?.estimate_min_eur && tender.estimate_max_eur ? { min: tender.estimate_min_eur, max: tender.estimate_max_eur, mid: (tender.estimate_min_eur + tender.estimate_max_eur) / 2 } : null);
  const reference = estimate?.mid ?? tender?.reference_price_eur ?? null;
  const offers = [...view.offers].sort((a, b) => a.price_eur - b.price_eur);
  const activeOffers = offers.filter((o) => o.status === "active");
  const canAccept = !!tender && ["active", "completed"].includes(tender.status);
  const awarded = offers.find((o) => o.status === "accepted");
  const latestRender = view.renders.find((r) => r.url);
  const photo = view.photos.find((p) => p.url);
  const labels = tender?.summary?.labels;
  const endsIn = remaining(tender?.ends_at ?? null);

  return (
    <PageLayout title="Ihr Küchenprojekt" description="Ihre Küchenplanung und die Angebote der Studios" canonicalPath="/projekt" noIndex>
      <section className="bg-gradient-to-b from-muted/50 to-background">
        <div className="container max-w-6xl py-8 sm:py-12">
          {isNew && !awarded && (
            <div className="mb-8 flex gap-4 rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <PartyPopper className="h-8 w-8 flex-none text-primary" />
              <div>
                <p className="text-lg font-bold text-foreground">Geschafft – Ihr Küchenprojekt ist online!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Speichern Sie diese Seite als Lesezeichen. Den Link haben wir Ihnen zusätzlich per E-Mail geschickt. Bei jedem neuen Angebot
                  benachrichtigen wir Sie.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-primary">Ihr Küchenprojekt · PLZ {view.lead.postal_code}</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
                {awarded ? "Ihr Studio steht fest" : view.lead.first_name ? `Hallo ${view.lead.first_name}!` : "Ihre Angebote"}
              </h1>
            </div>
            {estimate && (
              <div className="rounded-xl border bg-card px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">KI-Preisschätzung</p>
                <p className="text-lg font-extrabold tabular-nums">
                  {euro(estimate.min)} – {euro(estimate.max)}
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 rounded-2xl border bg-card p-5">
            <Timeline view={view} />
          </div>
        </div>
      </section>

      <section className="container max-w-6xl pb-16">
        <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
          <div className="space-y-5">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-2xl font-bold">
                {offers.length > 0 ? `${activeOffers.length || offers.length} ${offers.length === 1 ? "Angebot" : "Angebote"}` : "Angebote"}
              </h2>
              {tender?.status === "active" && endsIn && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-medium">
                  <Clock className="h-4 w-4 text-primary" /> Angebotsphase noch {endsIn}
                </span>
              )}
            </div>

            {offers.length === 0 && (
              <div className="rounded-2xl border border-dashed bg-card p-8 text-center">
                {tender?.status === "draft" ? <Hourglass className="mx-auto h-9 w-9 text-primary" /> : <Inbox className="mx-auto h-9 w-9 text-primary" />}
                <p className="mt-3 text-lg font-semibold">
                  {tender?.status === "draft" ? "Ihr Projekt wird gerade geprüft" : "Die Studios prüfen Ihr Projekt"}
                </p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  {tender?.status === "draft"
                    ? "Unser Küchen-Team meldet sich kurz bei Ihnen und gibt Ihr Projekt dann für die Studios frei."
                    : `Geprüfte Küchenstudios in Ihrer Region sehen Ihre Planung und geben ihre Angebote ab${tender?.ends_at ? ` – bis zum ${date(tender.ends_at)}` : ""}. Sie erhalten bei jedem Angebot eine E-Mail.`}
                </p>
              </div>
            )}

            {offers.map((offer, i) => (
              <OfferCard key={offer.bid_id} offer={offer} rank={i + 1} referenceEur={reference} canAccept={canAccept} onAccept={setPending} />
            ))}

            {canAccept && offers.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Sie müssen kein Angebot annehmen. Entscheiden Sie in Ruhe{tender?.decision_deadline_at ? ` – bis spätestens ${date(tender.decision_deadline_at)}` : ""}.
              </p>
            )}
          </div>

          <aside className="space-y-5">
            {latestRender?.url && (
              <div className="overflow-hidden rounded-2xl border bg-card">
                {photo?.url && latestRender.mode === "edit" ? (
                  <BeforeAfterSlider before={photo.url} after={latestRender.url} beforeLabel="Heute" afterLabel="Geplant" className="aspect-[4/3]" />
                ) : (
                  <img src={latestRender.url} alt="Ihre geplante Küche" className="aspect-[4/3] w-full object-cover" />
                )}
              </div>
            )}

            {labels && (
              <div className="rounded-2xl border bg-card p-5">
                <h3 className="font-bold">Ihre Planung</h3>
                <dl className="mt-3 space-y-2 text-sm">
                  {[
                    ["Raum", tender?.summary?.room?.description],
                    ["Qualität", labels.quality],
                    ["Stil", labels.style],
                    ["Fronten", labels.front],
                    ["Arbeitsplatte", labels.worktop],
                    ["Geräte", labels.appliance_level ? `${labels.appliance_level}: ${(labels.appliances ?? []).join(", ")}` : undefined],
                    ["Extras", (labels.extras ?? []).join(", ") || undefined],
                  ]
                    .filter(([, v]) => !!v)
                    .map(([k, v]) => (
                      <div key={k} className="flex gap-3">
                        <dt className="w-28 flex-none text-muted-foreground">{k}</dt>
                        <dd className="font-medium text-foreground">{v}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            )}

            <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Gut zu wissen</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>Für Sie ist KüchenWert komplett kostenlos.</li>
                <li>Das gewählte Studio misst vor Ort nach und bestätigt den finalen Preis.</li>
                {tender && tender.contact_unlocks > 0 && (
                  <li>
                    {tender.contact_unlocks} {tender.contact_unlocks === 1 ? "Studio hat" : "Studios haben"} Ihre Kontaktdaten für eine persönliche Beratung erhalten.
                  </li>
                )}
              </ul>
              {tender && ["draft", "active", "completed"].includes(tender.status) && (
                <button type="button" onClick={() => setCancelOpen(true)} className="mt-4 text-sm font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground">
                  Projekt beenden
                </button>
              )}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Fragen? <Link to="/kontakt" className="underline">Kontaktieren Sie uns</Link> – wir helfen gern.
            </p>
          </aside>
        </div>
      </section>

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Angebot von {pending?.dealer.company_name} wählen?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Preis: <strong className="text-foreground">{pending ? euro(pending.price_eur) : ""}</strong>
                </p>
                <p>Das Studio erhält Ihre Kontaktdaten und vereinbart mit Ihnen einen Termin für Aufmaß und Detailplanung. Die übrigen Angebote werden abgesagt.</p>
                <p>Der Kaufvertrag entsteht erst direkt mit dem Studio nach dem Aufmaß – für Sie bleibt KüchenWert kostenlos.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={accept.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={accept.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (pending) accept.mutate(pending.bid_id);
              }}
            >
              {accept.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verbindlich wählen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Projekt beenden?</AlertDialogTitle>
            <AlertDialogDescription>Die Studios werden informiert und können keine Angebote mehr abgeben. Verraten Sie uns kurz den Grund?</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value.slice(0, 500))} rows={3} placeholder="z. B. Küche bereits gekauft, Projekt verschoben …" />
          <AlertDialogFooter>
            <AlertDialogCancel>Zurück</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                cancel.mutate();
              }}
              disabled={cancel.isPending}
            >
              Projekt beenden
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {awarded && <span className="sr-only" aria-live="polite">Angebot von {awarded.dealer.company_name} angenommen</span>}
    </PageLayout>
  );
}
