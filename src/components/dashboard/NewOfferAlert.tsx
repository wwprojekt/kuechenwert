import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import {
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle2,
  Eye,
  Handshake,
  ArrowRight,
  Car,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { invokeWithAuth, SessionExpiredError } from "@/lib/sessionGuard";
import { useSessionExpired } from "@/components/SessionExpiredDialog";
import { useAuth } from "@/contexts/AuthContext";

/**
 * NewOfferAlert
 *
 * Prominentes Highlight-Modul + Auto-Popup-Modal für eingehende
 * Kaufchance-/Festpreis-Angebote im Verkäufer-Dashboard.
 *
 * Zweck (UX):
 * - Verkäufer SOFORT sehen lassen, dass ein neues Angebot eingegangen ist
 * - Den Angebotsbetrag mit dem Auktions-Höchstgebot/Festpreis vergleichen,
 *   damit der Verkäufer den Vorteil erkennt ("+ X % über letztem Gebot")
 * - 1-Klick-Annahme direkt aus dem Dashboard (mit Sicherheits-Bestätigung,
 *   weil die Annahme verbindlich ist gem. AGB §7)
 *
 * Wird zweimal getriggert:
 * 1. Auto-Popup (Dialog) beim ersten Sehen eines neuen Angebots
 *    (Tracking via localStorage, key: cw_seen_offer_ids)
 * 2. Permanenter Banner solange `pending` Offers existieren, die über dem
 *    aktuellen Höchstgebot liegen
 */

export interface OfferLite {
  id: string;
  offer_amount: number;
  status: string;
  created_at: string;
  message?: string | null;
  expires_at?: string | null;
  counter_offer_amount?: number | null;
}

export interface MotorhomeWithOffers {
  id: string;
  manufacturer: string | null;
  model: string | null;
  year: number | null;
  sale_channel: string | null;
  instant_price: number | null;
  reserve_price: number | null;
  /**
   * Wohnmobil-Fotos (Supabase-Relation kann Array oder Objekt sein).
   * Wird genutzt für Thumbnails im Alert-Banner / Popup / Bestätigungsdialog,
   * damit der Verkäufer bei mehreren Fahrzeugen sofort erkennt um welches es geht.
   */
  photos?: Array<{
    url: string;
    card_url?: string | null;
    medium_url?: string | null;
    display_order?: number | null;
  }> | null;
  auction?: {
    id?: string;
    status?: string | null;
    current_bid?: number | null;
    kaufchance_expires_at?: string | null;
    end_time?: string | null;
  } | null;
  topOffers?: OfferLite[];
}

/**
 * Liefert das Titelbild (niedrigste display_order) zur Anzeige in den Alerts.
 * Supabase-Relation kann als Array oder Objekt zurückkommen — beides
 * wird robust behandelt.
 */
function pickThumb(
  motorhome:
    | Pick<MotorhomeWithOffers, "photos">
    | null
    | undefined,
): string | null {
  if (!motorhome) return null;
  const raw = motorhome.photos;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (arr.length === 0) return null;
  const first = [...arr].sort(
    (a, b) => (a?.display_order ?? 0) - (b?.display_order ?? 0),
  )[0];
  return first?.card_url || first?.url || null;
}

/**
 * Kleine Thumbnail-Komponente mit Fallback-Icon, optional als Link.
 */
function MotorhomeThumb({
  motorhome,
  href,
  size = "md",
  className = "",
}: {
  motorhome: Pick<MotorhomeWithOffers, "photos" | "manufacturer" | "model">;
  href?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const url = pickThumb(motorhome);
  const alt =
    `${motorhome.manufacturer ?? ""} ${motorhome.model ?? ""}`.trim() ||
    "Fahrzeug";
  const dim =
    size === "xs"
      ? "w-10 h-8"
      : size === "sm"
        ? "w-12 h-9"
        : size === "lg"
          ? "w-24 h-20"
          : "w-16 h-12";
  const content = url ? (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className="w-full h-full object-cover"
    />
  ) : (
    <div className="w-full h-full flex items-center justify-center">
      <Car className="w-4 h-4 text-muted-foreground" />
    </div>
  );
  const base = `flex-shrink-0 ${dim} rounded-md overflow-hidden bg-muted border`;
  if (href) {
    return (
      <Link
        to={href}
        className={`${base} hover:border-primary/60 hover:shadow-sm transition-all ${className}`}
        title="Zum Inserat öffnen"
        onClick={(e) => e.stopPropagation()}
      >
        {content}
      </Link>
    );
  }
  return <div className={`${base} ${className}`}>{content}</div>;
}

interface NewOfferAlertProps {
  motorhomes: MotorhomeWithOffers[];
}

/**
 * localStorage-Key für „bereits gesehene" Offer-IDs.
 * Pro User scoped, damit zwei Verkäufer-Accounts am selben Browser
 * (z. B. Familien-PC) nicht den State teilen — jeder sieht den Auto-Popup
 * für seine neuen Angebote separat. Vor dem Fix war der Key global, was
 * dazu geführt hätte, dass User B den Popup für sein neues Angebot nicht
 * mehr sieht, sobald User A ihn einmal weggeklickt hat.
 */
function makeSeenKey(userId: string | undefined): string {
  return userId ? `cw_seen_offer_ids:${userId}` : "cw_seen_offer_ids:anon";
}

/**
 * Maximale Größe des seen-Sets im localStorage.
 * Verhindert, dass der Set über Wochen/Monate hinweg unbegrenzt wächst
 * (jeder Account bekommt typisch wenige Offers, aber wir cappen
 * defensive). Bei Überschreitung werden die ältesten Einträge verworfen
 * (FIFO durch Insertion-Order in JS Sets).
 */
const SEEN_MAX = 100;

function loadSeen(userId: string | undefined): Set<string> {
  try {
    const raw = localStorage.getItem(makeSeenKey(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function persistSeen(userId: string | undefined, ids: Set<string>) {
  try {
    let arr = Array.from(ids);
    if (arr.length > SEEN_MAX) {
      arr = arr.slice(arr.length - SEEN_MAX);
    }
    localStorage.setItem(makeSeenKey(userId), JSON.stringify(arr));
  } catch {
    /* localStorage voll/disabled → ignorieren, Popup zeigt sich evtl. nochmal */
  }
}

/**
 * Deutsches Währungsformat: „1.234 €" — konsistent mit dem Rest der Codebase
 * (siehe DashboardOverview.tsx Preisinfos). Vorher war „€ 1.234" inkonsistent.
 */
function formatEUR(amount: number): string {
  return `${Math.round(amount).toLocaleString("de-DE")} €`;
}

interface RankedOffer {
  offer: OfferLite;
  motorhome: MotorhomeWithOffers;
  baseline: number;
  baselineLabel: string;
  uplift: number;
  upliftPct: number;
  bidderLabel: string;
  /**
   * Effektive Annahme-Frist: kaufchance_expires_at hat Vorrang
   * (entspricht der Auktions-globalen Frist), sonst offer.expires_at als
   * Fallback (für Festpreis-Inserate gibt es keine kaufchance_expires_at).
   * `null` wenn weder noch existiert.
   */
  effectiveExpiresAt: string | null;
}

function rankOffers(motorhomes: MotorhomeWithOffers[]): RankedOffer[] {
  const ranked: RankedOffer[] = [];
  const nowTs = Date.now();
  for (const mh of motorhomes) {
    const auction = mh.auction;
    if (!auction) continue;
    const isFestpreis = mh.sale_channel === "instant_price";
    const isKaufchance = auction.status === "kaufchance";
    const isFestpreisActive = isFestpreis && auction.status === "active";
    if (!isKaufchance && !isFestpreisActive) continue;

    // Wenn die Kaufchance-Frist insgesamt schon vorbei ist, blende den
    // Banner aus — die Edge Function würde Annahme mit 410 ablehnen,
    // also sollten wir den Verkäufer nicht in die Sackgasse locken.
    if (
      isKaufchance &&
      auction.kaufchance_expires_at &&
      new Date(auction.kaufchance_expires_at).getTime() < nowTs
    ) {
      continue;
    }

    const offers = (mh.topOffers || [])
      .filter((o) => {
        if (o.status !== "pending") return false;
        // Pro-Offer Ablauf: status='pending' aber expires_at in der
        // Vergangenheit ist effektiv abgelaufen. Edge Function würde es
        // beim Annehmen mit 4xx ablehnen → nicht im Banner anzeigen.
        if (o.expires_at && new Date(o.expires_at).getTime() < nowTs) {
          return false;
        }
        return true;
      })
      .sort((a, b) => Number(b.offer_amount) - Number(a.offer_amount));

    if (offers.length === 0) continue;

    const baseline = isFestpreis
      ? Number(mh.instant_price ?? 0)
      : Number(auction.current_bid ?? 0);
    const baselineLabel = isFestpreis ? "Ihr Festpreis" : "Letztes Höchstgebot";

    offers.forEach((offer, idx) => {
      const amount = Number(offer.offer_amount);
      // Nur "spannende" Offers ins Ranking: über baseline ODER baseline=0
      // (Festpreis-Inserate ohne instant_price wären sonst rausgefiltert).
      if (baseline > 0 && amount <= baseline) return;
      const uplift = baseline > 0 ? amount - baseline : 0;
      const upliftPct = baseline > 0 ? (uplift / baseline) * 100 : 0;
      const effectiveExpiresAt =
        auction.kaufchance_expires_at ?? offer.expires_at ?? null;
      ranked.push({
        offer,
        motorhome: mh,
        baseline,
        baselineLabel,
        uplift,
        upliftPct,
        bidderLabel: `Bieter ${idx + 1}`,
        effectiveExpiresAt,
      });
    });
  }
  return ranked.sort(
    (a, b) => Number(b.offer.offer_amount) - Number(a.offer.offer_amount),
  );
}

export function NewOfferAlert({ motorhomes }: NewOfferAlertProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { showSessionExpired } = useSessionExpired();
  const { user } = useAuth();
  const userId = user?.id;

  const ranked = useMemo(() => rankOffers(motorhomes), [motorhomes]);

  // ── Auto-Popup-Logik: Modal beim ersten Sehen eines neuen Angebots ──
  const [seen, setSeen] = useState<Set<string>>(() => loadSeen(userId));
  const [popupOffer, setPopupOffer] = useState<RankedOffer | null>(null);

  // Wenn der Auth-Kontext nachträglich den User liefert (z. B. lazy hydration
  // nach dem ersten Mount), rebooten wir das seen-Set aus dem korrekten
  // localStorage-Key. Sonst hätten wir kurz „anon"-State im Speicher.
  useEffect(() => {
    setSeen(loadSeen(userId));
  }, [userId]);

  useEffect(() => {
    if (ranked.length === 0) return;
    const fresh = ranked.find((r) => !seen.has(r.offer.id));
    if (fresh && !popupOffer) {
      setPopupOffer(fresh);
    }
  }, [ranked, seen, popupOffer]);

  const markSeen = (offerId: string) => {
    setSeen((prev) => {
      if (prev.has(offerId)) return prev;
      const next = new Set(prev);
      next.add(offerId);
      persistSeen(userId, next);
      return next;
    });
  };

  const dismissPopup = (offerId?: string) => {
    if (offerId) markSeen(offerId);
    setPopupOffer(null);
  };

  // ── Bestätigungs-Dialog für Annahme ──
  const [confirmTarget, setConfirmTarget] = useState<RankedOffer | null>(null);

  const acceptMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const { data, error } = await invokeWithAuth("accept-kaufchance-offer", {
        body: { offerId },
      });
      if (error) throw error;
      if (!(data as { success?: boolean })?.success) {
        throw new Error(
          (data as { error?: string })?.error || "Unbekannter Fehler",
        );
      }
      return data;
    },
    onSuccess: (_data, offerId) => {
      toast({
        title: "Angebot angenommen",
        description:
          "Der Kaufvertrag wird erstellt. Sie erhalten in Kürze eine E-Mail mit allen Details.",
      });
      markSeen(offerId);
      setConfirmTarget(null);
      setPopupOffer(null);
      queryClient.invalidateQueries({ queryKey: ["sellerTimeline"] });
      queryClient.invalidateQueries({ queryKey: ["myListings"] });
    },
    onError: (err: Error) => {
      if (err instanceof SessionExpiredError) {
        showSessionExpired("/dashboard");
        return;
      }
      toast({
        title: "Fehler",
        description:
          err.message || "Annahme konnte nicht verarbeitet werden. Bitte erneut versuchen.",
        variant: "destructive",
      });
    },
  });

  if (ranked.length === 0) return null;

  const topOffer = ranked[0];

  return (
    <>
      {/* ── Permanenter Banner oben im Dashboard ───────────────────── */}
      <div className="relative overflow-hidden rounded-xl border-2 border-emerald-300 dark:border-emerald-700 shadow-2xl animate-fade-in">
        {/* Gradient-Hintergrund mit dezentem Pulse */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-green-50 to-amber-50 dark:from-emerald-950/40 dark:via-green-950/30 dark:to-amber-950/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-amber-500/10 animate-pulse" />

        <div className="relative p-5 sm:p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
            <div className="flex items-start gap-3 min-w-0">
              {/* Sparkles-Icon: nur ab sm sichtbar, um auf Mobile mehr Platz
                  fuer den Wohnmobil-Titel zu lassen (360px-Phones). Die Info
                  "neues Angebot" steckt ausserdem im Uppercase-Text darunter. */}
              <div className="hidden sm:flex h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 items-center justify-center shadow-lg flex-shrink-0">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <MotorhomeThumb
                motorhome={topOffer.motorhome}
                href={`/dashboard/listings/${topOffer.motorhome.id}`}
                size="lg"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                  {ranked.length === 1
                    ? "Neues Händler-Angebot"
                    : `${ranked.length} neue Händler-Angebote`}
                </p>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight mt-0.5 break-words">
                  <Link
                    to={`/dashboard/listings/${topOffer.motorhome.id}`}
                    className="hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline"
                  >
                    {topOffer.motorhome.manufacturer} {topOffer.motorhome.model}
                  </Link>
                  {topOffer.motorhome.year && (
                    <span className="text-muted-foreground font-medium ml-2">
                      ({topOffer.motorhome.year})
                    </span>
                  )}
                </h2>
              </div>
            </div>

            {topOffer.effectiveExpiresAt && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-background/60 border border-emerald-200 dark:border-emerald-700 text-xs font-medium text-emerald-800 dark:text-emerald-200 self-start">
                <Clock className="h-3.5 w-3.5" />
                Frist endet{" "}
                {formatDistanceToNowStrict(new Date(topOffer.effectiveExpiresAt), {
                  addSuffix: true,
                  locale: de,
                })}
              </div>
            )}
          </div>

          {/* Preis-Vergleich (groß und auffällig) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-lg bg-white/70 dark:bg-background/40 border border-emerald-100 dark:border-emerald-800">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">
                {topOffer.baselineLabel}
              </p>
              <p className="text-lg sm:text-xl font-bold text-muted-foreground line-through decoration-2">
                {topOffer.baseline > 0 ? formatEUR(topOffer.baseline) : "—"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg sm:scale-105">
              <p className="text-[11px] text-emerald-50 uppercase tracking-wide">
                Händlerangebot
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold leading-tight">
                {formatEUR(Number(topOffer.offer.offer_amount))}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-white/70 dark:bg-background/40 border border-amber-200 dark:border-amber-700 flex flex-col justify-center">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-emerald-600" />
                Mehrwert
              </p>
              {topOffer.uplift > 0 ? (
                <>
                  <p className="text-lg sm:text-xl font-bold text-emerald-600">
                    + {formatEUR(topOffer.uplift)}
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                    + {topOffer.upliftPct.toFixed(1)} % über{" "}
                    {topOffer.baselineLabel.toLowerCase()}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Erstes Angebot eingegangen
                </p>
              )}
            </div>
          </div>

          {topOffer.offer.message && (
            <p className="text-sm italic text-muted-foreground mb-4 px-3 py-2 rounded-md bg-white/50 dark:bg-background/30 border-l-4 border-emerald-400">
              „{topOffer.offer.message}"
              <span className="block text-xs not-italic mt-1 text-muted-foreground/70">
                — {topOffer.bidderLabel}
              </span>
            </p>
          )}

          {/* Action-Buttons */}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              size="lg"
              className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg gap-2 font-semibold"
              onClick={() => setConfirmTarget(topOffer)}
              disabled={acceptMutation.isPending}
            >
              <CheckCircle2 className="h-5 w-5" />
              Angebot annehmen für{" "}
              {formatEUR(Number(topOffer.offer.offer_amount))}
            </Button>
            <Link
              to={`/dashboard/listings/${topOffer.motorhome.id}`}
              className="sm:w-auto"
            >
              <Button variant="outline" size="lg" className="w-full gap-2">
                <Eye className="h-4 w-4" />
                Details &amp; Gegenangebot
              </Button>
            </Link>
          </div>

          {/* Hinweis auf weitere Angebote */}
          {ranked.length > 1 && (
            <div className="mt-4 pt-3 border-t border-emerald-200 dark:border-emerald-800">
              <p className="text-xs text-muted-foreground mb-2">
                Weitere Angebote über aktuellem{" "}
                {topOffer.baselineLabel.toLowerCase()}:
              </p>
              <div className="space-y-1.5">
                {ranked.slice(1, 4).map((r) => (
                  <Link
                    key={r.offer.id}
                    to={`/dashboard/listings/${r.motorhome.id}`}
                    className="flex items-center justify-between p-2 rounded-md bg-white/60 dark:bg-background/40 hover:bg-white dark:hover:bg-background/70 transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MotorhomeThumb motorhome={r.motorhome} size="xs" />
                      <Handshake className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate">
                        {r.motorhome.manufacturer} {r.motorhome.model}
                      </span>
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        · {r.bidderLabel}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                        {formatEUR(Number(r.offer.offer_amount))}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Auto-Popup-Modal beim ersten Sehen ──────────────────────── */}
      <Dialog
        open={!!popupOffer}
        onOpenChange={(open) => {
          if (!open) dismissPopup(popupOffer?.offer.id);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="mx-auto h-14 w-14 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg mb-3">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <DialogTitle className="text-center text-2xl">
              Neues Angebot eingegangen!
            </DialogTitle>
            <DialogDescription className="text-center">
              Ein Händler hat ein verbindliches Angebot für Ihr Fahrzeug
              abgegeben.
            </DialogDescription>
          </DialogHeader>

          {popupOffer && (
            <div className="space-y-4 py-2">
              <div className="flex flex-col items-center gap-2 text-center">
                <MotorhomeThumb
                  motorhome={popupOffer.motorhome}
                  href={`/dashboard/listings/${popupOffer.motorhome.id}`}
                  size="lg"
                />
                <Link
                  to={`/dashboard/listings/${popupOffer.motorhome.id}`}
                  className="text-sm font-medium hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline"
                >
                  {popupOffer.motorhome.manufacturer}{" "}
                  {popupOffer.motorhome.model}
                  {popupOffer.motorhome.year && ` · ${popupOffer.motorhome.year}`}
                </Link>
                <p className="text-4xl font-extrabold text-emerald-600 mt-2">
                  {formatEUR(Number(popupOffer.offer.offer_amount))}
                </p>
                {popupOffer.uplift > 0 && (
                  <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
                    <TrendingUp className="h-3.5 w-3.5" />+{" "}
                    {formatEUR(popupOffer.uplift)} (
                    {popupOffer.upliftPct.toFixed(1)} %) über{" "}
                    {popupOffer.baselineLabel.toLowerCase()}
                  </div>
                )}
              </div>

              {popupOffer.effectiveExpiresAt && (
                <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3" />
                  Frist:{" "}
                  {format(
                    new Date(popupOffer.effectiveExpiresAt),
                    "dd.MM.yyyy 'um' HH:mm 'Uhr'",
                    { locale: de },
                  )}
                </p>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => dismissPopup(popupOffer?.offer.id)}
            >
              Später entscheiden
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white"
              onClick={() => {
                if (popupOffer) {
                  setConfirmTarget(popupOffer);
                  // Als gesehen markieren, sonst springt der Popup wieder auf
                  // wenn der Verkäufer die Verbindlich-Bestätigung abbricht.
                  markSeen(popupOffer.offer.id);
                }
                setPopupOffer(null);
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Annehmen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bestätigungs-Dialog (verbindlicher Verkauf) ─────────────── */}
      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(open) => {
          if (!open && !acceptMutation.isPending) setConfirmTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Angebot verbindlich annehmen?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                {confirmTarget && (
                  <div className="flex items-center gap-3 p-2 rounded-md bg-muted/40">
                    <MotorhomeThumb
                      motorhome={confirmTarget.motorhome}
                      href={`/dashboard/listings/${confirmTarget.motorhome.id}`}
                      size="md"
                    />
                    <div className="min-w-0">
                      <Link
                        to={`/dashboard/listings/${confirmTarget.motorhome.id}`}
                        className="font-semibold text-foreground hover:underline block truncate"
                      >
                        {confirmTarget.motorhome.manufacturer}{" "}
                        {confirmTarget.motorhome.model}
                      </Link>
                      {confirmTarget.motorhome.year && (
                        <span className="text-xs text-muted-foreground">
                          Baujahr {confirmTarget.motorhome.year}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <p>
                  Sie verkaufen Ihr Fahrzeug{" "}
                  <strong className="text-foreground">
                    {confirmTarget?.motorhome.manufacturer}{" "}
                    {confirmTarget?.motorhome.model}
                  </strong>{" "}
                  für{" "}
                  <strong className="text-emerald-600 text-base">
                    {confirmTarget &&
                      formatEUR(Number(confirmTarget.offer.offer_amount))}
                  </strong>
                  .
                </p>
                <p className="text-muted-foreground">
                  Mit der Annahme entsteht ein <strong>rechtsverbindlicher
                  Kaufvertrag</strong> gemäß AGB §7. Alle anderen Angebote werden
                  automatisch abgelehnt. Wir versenden anschließend Vertrag und
                  Rechnung per E-Mail.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acceptMutation.isPending}>
              Abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
              disabled={acceptMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirmTarget) {
                  acceptMutation.mutate(confirmTarget.offer.id);
                }
              }}
            >
              {acceptMutation.isPending
                ? "Wird verarbeitet…"
                : "Verbindlich annehmen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
