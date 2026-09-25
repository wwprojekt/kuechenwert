import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Clock, Download, FileJson, KeyRound, Loader2, MapPin, Phone, Printer, Trophy, Users } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/features/marketplace/api-client";
import { buildBriefing, buildFloorPlanDxf, downloadFile } from "@/features/marketplace/briefing-export";
import { projectTitle, projectValue, timeLeft } from "@/features/marketplace/components/DealerProjectCard";
import {
  fetchDealerProject,
  fetchMarketProfile,
  placeOffer,
  signPlannerMedia,
  unlockContact,
  withdrawOffer,
  type DealerProjectDetail as Detail,
} from "@/features/marketplace/dealer-api";
import { OFFER_INCLUDE_LABELS, type OfferIncludes } from "@/features/marketplace/project-api";
import { BeforeAfterSlider } from "@/features/planner/components/BeforeAfterSlider";
import { FloorPlanSketch } from "@/features/planner/components/FloorPlanSketch";
import { sanitizeRoom } from "@/features/planner/core";

const euro = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;

const offerSchema = z.object({
  price: z.coerce.number({ invalid_type_error: "Bitte einen Preis angeben" }).min(500, "Bitte einen realistischen Preis angeben").max(1_999_999),
  delivery_weeks: z.coerce.number().int().min(1).max(78).optional().or(z.literal("").transform(() => undefined)),
  valid_until: z.string().optional(),
  message: z.string().max(2000).optional(),
  includes: z.object({
    delivery: z.boolean(),
    assembly: z.boolean(),
    appliances: z.boolean(),
    removal: z.boolean(),
    connection: z.boolean(),
    measurement: z.boolean(),
  }),
});
type OfferValues = z.infer<typeof offerSchema>;

function OfferForm({ detail, intro, onDone }: { detail: Detail; intro: string | null; onDone: () => void }) {
  const mine = detail.my_offer && detail.my_offer.status === "active" ? detail.my_offer : null;
  const includes = (mine?.includes ?? {}) as OfferIncludes;
  const form = useForm<OfferValues>({
    resolver: zodResolver(offerSchema),
    defaultValues: {
      price: mine?.price_eur ?? (undefined as unknown as number),
      delivery_weeks: mine?.delivery_weeks ?? 8,
      valid_until: mine?.valid_until ?? "",
      message: mine?.notes ?? intro ?? "",
      includes: {
        delivery: includes.delivery ?? true,
        assembly: includes.assembly ?? true,
        appliances: includes.appliances ?? true,
        removal: includes.removal ?? false,
        connection: includes.connection ?? false,
        measurement: includes.measurement ?? true,
      },
    },
  });

  const mutation = useMutation({
    mutationFn: (v: OfferValues) =>
      placeOffer({
        auctionId: detail.auction_id,
        priceEur: v.price,
        deliveryWeeks: v.delivery_weeks ?? null,
        includes: v.includes,
        validUntil: v.valid_until || null,
        message: v.message?.trim() || null,
      }),
    onSuccess: (res) => {
      toast.success(res.is_update ? `Angebot aktualisiert – aktuell Platz ${res.rank}.` : `Angebot abgegeben – aktuell Platz ${res.rank}.`);
      onDone();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const withdraw = useMutation({
    mutationFn: () => withdrawOffer(detail.auction_id),
    onSuccess: () => {
      toast.success("Angebot zurückgezogen.");
      onDone();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="price">{mine ? "Neuer Angebotspreis (brutto)" : "Angebotspreis inkl. MwSt."}</Label>
        <div className="relative">
          <Input id="price" inputMode="decimal" className="h-12 pr-10 text-lg font-semibold tabular-nums" {...form.register("price")} />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
        </div>
        {mine && <p className="text-xs text-muted-foreground">Abgegebene Angebote können nur gesenkt werden (aktuell {euro(mine.price_eur)}).</p>}
        {form.formState.errors.price && <p className="text-xs font-medium text-destructive">{form.formState.errors.price.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="delivery_weeks">Lieferzeit (Wochen)</Label>
          <Input id="delivery_weeks" inputMode="numeric" className="h-11" {...form.register("delivery_weeks")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="valid_until">Gültig bis</Label>
          <Input id="valid_until" type="date" className="h-11" {...form.register("valid_until")} />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Im Preis enthalten</legend>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(OFFER_INCLUDE_LABELS) as Array<keyof OfferIncludes>).map((key) => (
            <Controller
              key={key}
              control={form.control}
              name={`includes.${key}`}
              render={({ field }) => (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                  {OFFER_INCLUDE_LABELS[key]}
                </label>
              )}
            />
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="message">Nachricht an den Kunden</Label>
        <Textarea id="message" rows={4} placeholder="Kurz zu Ihrem Studio, Marke/Programm, Besonderheiten Ihres Angebots …" {...form.register("message")} />
      </div>
      <Button type="submit" size="lg" className="h-12 w-full font-semibold" disabled={mutation.isPending}>
        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {mine ? "Angebot senken" : "Verbindliches Angebot abgeben"}
      </Button>
      {mine && (
        <Button type="button" variant="ghost" className="w-full text-muted-foreground" disabled={withdraw.isPending} onClick={() => withdraw.mutate()}>
          Angebot zurückziehen
        </Button>
      )}
    </form>
  );
}

export default function DealerProjectDetail() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirmUnlock, setConfirmUnlock] = useState(false);

  const detailQuery = useQuery({ queryKey: ["dealer-project", id], queryFn: () => fetchDealerProject(id), refetchInterval: 60_000 });
  const profile = useQuery({ queryKey: ["dealer-market-profile", user?.id], queryFn: () => fetchMarketProfile(user!.id), enabled: !!user?.id });
  const mediaPaths = (detailQuery.data?.media ?? []).filter((m) => m.bucket === "planner-media").map((m) => m.path);
  const media = useQuery({
    queryKey: ["dealer-project-media", id, mediaPaths.join("|")],
    queryFn: () => signPlannerMedia(mediaPaths),
    enabled: mediaPaths.length > 0,
    staleTime: 30 * 60_000,
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["dealer-project", id] });
    void qc.invalidateQueries({ queryKey: ["dealer-projects"] });
  };

  const unlock = useMutation({
    mutationFn: () => unlockContact(id),
    onSuccess: (data) => {
      qc.setQueryData(["dealer-project", id], data);
      setConfirmUnlock(false);
      toast.success("Kontakt freigeschaltet. Die Rechnung finden Sie unter „Rechnungen“.");
      void qc.invalidateQueries({ queryKey: ["dealer-projects"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (detailQuery.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="space-y-4">
        <Link to="/dashboard/projekte" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Zur Projekt-Börse
        </Link>
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-destructive">{errorMessage(detailQuery.error)}</div>
      </div>
    );
  }

  const d = detailQuery.data;
  const s = d.summary ?? {};
  const labels = s.labels;
  const renders = d.media.filter((m) => m.kind === "render");
  const photos = d.media.filter((m) => m.kind === "photo");
  const renderUrl = renders[0] ? media.data?.[renders[0].path] : undefined;
  const photoUrl = photos[0] ? media.data?.[photos[0].path] : undefined;
  const room = s.room?.form && s.room.walls ? sanitizeRoom(s.room) : null;
  const slotsLeft = Math.max(0, d.max_contact_purchases - d.contact_purchases);
  const canUnlock = !d.contact_unlocked && !d.awarded_to_me && ["active", "completed"].includes(d.status) && slotsLeft > 0 && (d.contact_price_cents ?? 0) > 0;
  const left = timeLeft(d.ends_at);
  const answers = s.answers && typeof s.answers === "object" ? Object.entries(s.answers).filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)) : [];

  const exportJson = () => {
    const briefing = buildBriefing(d, media.data ?? {});
    downloadFile(`kuechenwert-projekt-${d.auction_id.slice(0, 8)}.json`, JSON.stringify(briefing, null, 2), "application/json");
  };
  const exportDxf = () => {
    const dxf = buildFloorPlanDxf(d);
    if (!dxf) {
      toast.error("Für dieses Projekt liegen keine Wandmaße vor.");
      return;
    }
    downloadFile(`kuechenwert-grundriss-${d.auction_id.slice(0, 8)}.dxf`, dxf, "application/dxf");
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <Link to="/dashboard/projekte" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden">
        <ArrowLeft className="h-4 w-4" /> Zur Projekt-Börse
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" /> PLZ {d.postal_prefix}
            {d.distance_km != null && ` · ${Math.round(d.distance_km)} km entfernt`}
            {left && d.status === "active" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                <Clock className="h-3 w-3" /> {left}
              </span>
            )}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{projectTitle(d)}</h1>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">KI-Schätzung / Budget</p>
          <p className="text-2xl font-extrabold tabular-nums">{projectValue(d)}</p>
        </div>
      </div>

      {d.awarded_to_me && (
        <div className="flex items-start gap-3 rounded-2xl border border-primary bg-primary/5 p-4">
          <Trophy className="h-6 w-6 flex-none text-primary" />
          <p className="text-sm">
            <strong>Zuschlag erhalten!</strong> Der Kunde hat Ihr Angebot gewählt. Bitte kontaktieren Sie ihn zeitnah für Aufmaß und Detailplanung.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {(renderUrl || photoUrl) && (
            <div className="overflow-hidden rounded-2xl border bg-card">
              {renderUrl && photoUrl && renders[0]?.mode === "edit" ? (
                <BeforeAfterSlider before={photoUrl} after={renderUrl} beforeLabel="Raum heute" afterLabel="Wunschküche (KI)" className="aspect-[4/3]" />
              ) : (
                <img src={renderUrl ?? photoUrl} alt="Projekt" className="aspect-[4/3] w-full object-cover" />
              )}
              {photos.length > 1 && (
                <div className="flex gap-2 overflow-x-auto p-3">
                  {photos.map((p) => (media.data?.[p.path] ? <img key={p.path} src={media.data[p.path]} alt="Raumfoto" className="h-20 w-28 flex-none rounded-lg object-cover" /> : null))}
                </div>
              )}
            </div>
          )}

          {labels && (
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="font-bold">Wunschkonfiguration</h2>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {[
                  ["Qualität", labels.quality],
                  ["Stil", labels.style],
                  ["Fronten", labels.front],
                  ["Griffe", labels.handle],
                  ["Oberschränke", labels.wall_cabinets],
                  ["Hochschränke", labels.tall_units != null ? String(labels.tall_units) : undefined],
                  ["Arbeitsplatte", labels.worktop],
                  ["Geräte", labels.appliance_level],
                  ["Gerätewünsche", (labels.appliances ?? []).join(", ")],
                  ["Extras", (labels.extras ?? []).join(", ")],
                  ["Leistungen", (labels.services ?? []).join(", ")],
                ]
                  .filter(([, v]) => !!v)
                  .map(([k, v]) => (
                    <div key={k} className="flex gap-3">
                      <dt className="w-28 flex-none text-muted-foreground">{k}</dt>
                      <dd className="font-medium">{v}</dd>
                    </div>
                  ))}
              </dl>
              {s.wishes && (
                <p className="mt-4 rounded-lg bg-muted/60 p-3 text-sm">
                  <span className="font-semibold">Hinweis des Kunden:</span> {s.wishes}
                </p>
              )}
            </div>
          )}

          {room && (
            <div className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-[1fr_1.2fr]">
              <div>
                <h2 className="font-bold">Raum & Maße</h2>
                <p className="mt-1 text-sm text-muted-foreground">{s.room?.description} (Angaben des Kunden, bitte vor Ort aufmessen)</p>
                {s.layout && (
                  <ul className="mt-3 space-y-1 text-sm">
                    <li>Schrankzeile: {(s.layout.runCm / 100).toLocaleString("de-DE")} m</li>
                    <li>Arbeitsplatte: ca. {(s.layout.worktopCm / 100).toLocaleString("de-DE")} m</li>
                    {s.layout.islandCm > 0 && <li>Insel: {(s.layout.islandCm / 100).toLocaleString("de-DE")} m</li>}
                  </ul>
                )}
              </div>
              <FloorPlanSketch room={room} className="h-52 w-full" />
            </div>
          )}

          {answers.length > 0 && (
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="font-bold">Angaben aus der Anfrage</h2>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                {answers.map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <dt className="w-36 flex-none capitalize text-muted-foreground">{k.replace(/_/g, " ")}</dt>
                    <dd className="font-medium">{Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" onClick={exportJson}>
              <FileJson className="mr-2 h-4 w-4" /> Planungsbriefing (JSON)
            </Button>
            <Button variant="outline" onClick={exportDxf} disabled={!room}>
              <Download className="mr-2 h-4 w-4" /> Grundriss (DXF)
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Drucken
            </Button>
          </div>
        </div>

        <aside className="space-y-5 print:hidden">
          <div className="rounded-2xl border bg-card p-5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-primary" /> {d.offer_count} {d.offer_count === 1 ? "Angebot" : "Angebote"} abgegeben
            </p>
            {d.lowest_offer_eur != null && (
              <p className="mt-1 text-sm text-muted-foreground">
                Aktuell bestes Angebot: <span className="font-bold text-foreground">{euro(d.lowest_offer_eur)}</span>
              </p>
            )}
          </div>

          {(d.contact || d.contact_unlocked) && d.contact && (
            <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5">
              <p className="flex items-center gap-2 font-bold">
                <KeyRound className="h-4 w-4 text-primary" /> Kundenkontakt
              </p>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="font-semibold">{[d.contact.first_name, d.contact.last_name].filter(Boolean).join(" ")}</div>
                {d.contact.phone && (
                  <a href={`tel:${d.contact.phone}`} className="flex items-center gap-1.5 font-semibold text-primary hover:underline">
                    <Phone className="h-3.5 w-3.5" /> {d.contact.phone}
                  </a>
                )}
                {d.contact.email && (
                  <a href={`mailto:${d.contact.email}`} className="block text-primary hover:underline">
                    {d.contact.email}
                  </a>
                )}
                <div className="text-muted-foreground">
                  {d.contact.postal_code} {d.contact.city ?? ""}
                </div>
                {!d.contact.consent_call && <div className="text-xs text-muted-foreground">Kunde bevorzugt Kontakt per E-Mail.</div>}
              </dl>
            </div>
          )}

          {d.status === "active" ? (
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="mb-4 font-bold">{d.my_offer?.status === "active" ? "Ihr Angebot" : "Angebot abgeben"}</h2>
              <OfferForm key={`${d.my_offer?.id ?? "new"}-${d.my_offer?.revision ?? 0}`} detail={d} intro={profile.data?.offer_intro ?? null} onDone={refresh} />
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground">
              {d.status === "completed" ? "Die Angebotsphase ist beendet – der Kunde vergleicht jetzt." : d.status === "awarded" ? "Dieses Projekt wurde vergeben." : "Dieses Projekt ist nicht mehr aktiv."}
              {d.my_offer && <p className="mt-2 font-semibold text-foreground">Ihr Angebot: {euro(d.my_offer.price_eur)}</p>}
            </div>
          )}

          {canUnlock && (
            <div className="rounded-2xl border bg-card p-5">
              <h2 className="font-bold">Kontakt direkt freischalten</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sprechen Sie den Kunden persönlich an – noch {slotsLeft} von {d.max_contact_purchases} Plätzen frei.
              </p>
              <Button className="mt-4 w-full" variant="secondary" onClick={() => setConfirmUnlock(true)}>
                <KeyRound className="mr-2 h-4 w-4" /> Für {euro((d.contact_price_cents ?? 0) / 100)} netto freischalten
              </Button>
            </div>
          )}
        </aside>
      </div>

      <AlertDialog open={confirmUnlock} onOpenChange={setConfirmUnlock}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kontakt kostenpflichtig freischalten?</AlertDialogTitle>
            <AlertDialogDescription>
              Sie erhalten sofort Name, Telefon und E-Mail des Kunden. Wir stellen {euro((d.contact_price_cents ?? 0) / 100)} zzgl. MwSt. in Rechnung. Der Kunde wird
              informiert, dass Ihr Studio sich meldet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlock.isPending}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              disabled={unlock.isPending}
              onClick={(e) => {
                e.preventDefault();
                unlock.mutate();
              }}
            >
              {unlock.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verbindlich freischalten
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
