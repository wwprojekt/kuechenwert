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
  auction?: {
    id?: string;
    status?: string | null;
    current_bid?: number | null;
    kaufchance_expires_at?: string | null;
    end_time?: string | null;
  } | null;
  topOffers?: OfferLite[];
}

interface NewOfferAlertProps {
  motorhomes: MotorhomeWithOffers[];
}

const SEEN_KEY = "cw_seen_offer_ids";

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function persistSeen(ids: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* noop */
  }
}

interface RankedOffer {
  offer: OfferLite;
  motorhome: MotorhomeWithOffers;
  baseline: number;
  baselineLabel: string;
  uplift: number;
  upliftPct: number;
  bidderLabel: string;
}

function rankOffers(motorhomes: MotorhomeWithOffers[]): RankedOffer[] {
  const ranked: RankedOffer[] = [];
  for (const mh of motorhomes) {
    const auction = mh.auction;
    if (!auction) continue;
    const isFestpreis = mh.sale_channel === "instant_price";
    const isKaufchance = auction.status === "kaufchance";
    const isFestpreisActive = isFestpreis && auction.status === "active";
    if (!isKaufchance && !isFestpreisActive) continue;

    const offers = (mh.topOffers || [])
      .filter((o) => o.status === "pending")
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
      ranked.push({
        offer,
        motorhome: mh,
        baseline,
        baselineLabel,
        uplift,
        upliftPct,
        bidderLabel: `Bieter ${idx + 1}`,
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

  const ranked = useMemo(() => rankOffers(motorhomes), [motorhomes]);

  // ── Auto-Popup-Logik: Modal beim ersten Sehen eines neuen Angebots ──
  const [seen, setSeen] = useState<Set<string>>(() => loadSeen());
  const [popupOffer, setPopupOffer] = useState<RankedOffer | null>(null);

  useEffect(() => {
    if (ranked.length === 0) return;
    const fresh = ranked.find((r) => !seen.has(r.offer.id));
    if (fresh && !popupOffer) {
      setPopupOffer(fresh);
    }
  }, [ranked, seen, popupOffer]);

  const dismissPopup = (offerId?: string) => {
    if (offerId) {
      const next = new Set(seen);
      next.add(offerId);
      setSeen(next);
      persistSeen(next);
    }
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
      // Offer als gesehen markieren + Popup/Confirm schließen
      const next = new Set(seen);
      next.add(offerId);
      setSeen(next);
      persistSeen(next);
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
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg flex-shrink-0">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                  {ranked.length === 1
                    ? "Neues Händler-Angebot"
                    : `${ranked.length} neue Händler-Angebote`}
                </p>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight mt-0.5">
                  {topOffer.motorhome.manufacturer} {topOffer.motorhome.model}
                  {topOffer.motorhome.year && (
                    <span className="text-muted-foreground font-medium ml-2">
                      ({topOffer.motorhome.year})
                    </span>
                  )}
                </h2>
              </div>
            </div>

            {topOffer.motorhome.auction?.kaufchance_expires_at && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-background/60 border border-emerald-200 dark:border-emerald-700 text-xs font-medium text-emerald-800 dark:text-emerald-200 self-start">
                <Clock className="h-3.5 w-3.5" />
                Frist endet{" "}
                {formatDistanceToNowStrict(
                  new Date(topOffer.motorhome.auction.kaufchance_expires_at),
                  { addSuffix: true, locale: de },
                )}
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
                {topOffer.baseline > 0
                  ? `€ ${topOffer.baseline.toLocaleString("de-DE")}`
                  : "—"}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-lg sm:scale-105">
              <p className="text-[11px] text-emerald-50 uppercase tracking-wide">
                Händlerangebot
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold leading-tight">
                € {Number(topOffer.offer.offer_amount).toLocaleString("de-DE")}
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
                    + € {topOffer.uplift.toLocaleString("de-DE")}
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
              Angebot annehmen für € {Number(
                topOffer.offer.offer_amount,
              ).toLocaleString("de-DE")}
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
                        € {Number(r.offer.offer_amount).toLocaleString("de-DE")}
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
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  {popupOffer.motorhome.manufacturer}{" "}
                  {popupOffer.motorhome.model}
                  {popupOffer.motorhome.year && ` · ${popupOffer.motorhome.year}`}
                </p>
                <p className="text-4xl font-extrabold text-emerald-600 mt-2">
                  € {Number(popupOffer.offer.offer_amount).toLocaleString("de-DE")}
                </p>
                {popupOffer.uplift > 0 && (
                  <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-sm font-semibold">
                    <TrendingUp className="h-3.5 w-3.5" />+{" "}
                    {popupOffer.uplift.toLocaleString("de-DE")} € (
                    {popupOffer.upliftPct.toFixed(1)} %) über{" "}
                    {popupOffer.baselineLabel.toLowerCase()}
                  </div>
                )}
              </div>

              {popupOffer.motorhome.auction?.kaufchance_expires_at && (
                <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3" />
                  Frist:{" "}
                  {format(
                    new Date(popupOffer.motorhome.auction.kaufchance_expires_at),
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
                if (popupOffer) setConfirmTarget(popupOffer);
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
                <p>
                  Sie verkaufen Ihr Fahrzeug{" "}
                  <strong className="text-foreground">
                    {confirmTarget?.motorhome.manufacturer}{" "}
                    {confirmTarget?.motorhome.model}
                  </strong>{" "}
                  für{" "}
                  <strong className="text-emerald-600 text-base">
                    €{" "}
                    {confirmTarget &&
                      Number(confirmTarget.offer.offer_amount).toLocaleString(
                        "de-DE",
                      )}
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
