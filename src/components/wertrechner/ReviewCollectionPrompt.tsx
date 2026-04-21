import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, X, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { HoneypotField, useHoneypot } from "@/components/ui/HoneypotField";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analyticsService";
import { wertrechnerReviewStatsQueryKey } from "@/hooks/useWertrechnerReviewStats";

const LOCAL_STORAGE_SUBMITTED_KEY = "cw:wertrechner-review-submitted";
const LOCAL_STORAGE_DISMISSED_KEY = "cw:wertrechner-review-dismissed";
const LOCAL_STORAGE_SESSION_KEY = "cw:wertrechner-review-session";
const DEFAULT_DELAY_MS = 20_000;

type SubmitStatus = "idle" | "submitting" | "success" | "error";

interface ReviewCollectionPromptProps {
  /**
   * `wohnmobil` | `wohnwagen` — used to tag the review for distribution.
   * Optional; leave undefined when the category is unknown.
   */
  vehicleType?: "wohnmobil" | "wohnwagen";
  /**
   * Milliseconds to wait after mount before rendering the prompt.
   * Default 20s — long enough that users who immediately proceed to the
   * primary Verkaufen-CTA never see it.
   */
  delayMs?: number;
  /**
   * Optional class for positioning in host layouts.
   */
  className?: string;
}

function readLocalStorageBool(key: string): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function getOrCreateSessionId(): string {
  try {
    if (typeof window === "undefined") return "";
    let id = window.localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `cw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

/**
 * Non-blocking review collection prompt shown AFTER the primary Verkaufen CTA
 * on the Wertrechner result view.
 *
 * Design principles (do NOT regress):
 * 1. Inline Card, never a Dialog / Modal / overlay — primary CTA must stay
 *    above and visually dominant.
 * 2. Delayed render (default 20s) — users who immediately click Verkaufen
 *    never see this component, so conversion is unaffected.
 * 3. Once dismissed (×) or submitted, persisted in localStorage so we never
 *    show it to the same browser again.
 * 4. Spam defense: client honeypot + server-side rate limit (session_id 1x
 *    ever, ip_hash 3x per 24h) + admin moderation.
 */
export function ReviewCollectionPrompt({
  vehicleType,
  delayMs = DEFAULT_DELAY_MS,
  className,
}: ReviewCollectionPromptProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const alreadySubmitted = useMemo(() => readLocalStorageBool(LOCAL_STORAGE_SUBMITTED_KEY), []);
  const alreadyDismissed = useMemo(() => readLocalStorageBool(LOCAL_STORAGE_DISMISSED_KEY), []);

  const [shouldRender, setShouldRender] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [honeypotValue, setHoneypotValue, isBot] = useHoneypot();
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");

  useEffect(() => {
    if (alreadySubmitted || alreadyDismissed) return;
    const t = window.setTimeout(() => setShouldRender(true), delayMs);
    return () => window.clearTimeout(t);
  }, [alreadySubmitted, alreadyDismissed, delayMs]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const sessionId = getOrCreateSessionId();
      const userAgent =
        typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : "";

      const args: {
        p_rating: number;
        p_comment?: string;
        p_reviewer_name?: string;
        p_reviewer_location?: string;
        p_vehicle_type?: string;
        p_session_id?: string;
        p_user_agent?: string;
        p_honeypot?: string;
      } = { p_rating: rating };

      const trimmedComment = comment.trim();
      if (trimmedComment) args.p_comment = trimmedComment;
      const trimmedName = name.trim();
      if (trimmedName) args.p_reviewer_name = trimmedName;
      const trimmedLoc = location.trim();
      if (trimmedLoc) args.p_reviewer_location = trimmedLoc;
      if (vehicleType) args.p_vehicle_type = vehicleType;
      if (sessionId) args.p_session_id = sessionId;
      if (userAgent) args.p_user_agent = userAgent;
      if (honeypotValue) args.p_honeypot = honeypotValue;

      const { data, error } = await supabase.rpc("submit_wertrechner_review", args);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      try {
        window.localStorage.setItem(LOCAL_STORAGE_SUBMITTED_KEY, "1");
      } catch {
        /* ignore storage errors */
      }
      setSubmitStatus("success");
      queryClient.invalidateQueries({ queryKey: wertrechnerReviewStatsQueryKey });
      trackEvent("wertrechner_review_submitted", {
        category: "wertrechner",
        value: rating,
        properties: { rating, has_comment: comment.trim().length > 0 },
      });
      toast({
        title: "Danke für deine Bewertung!",
        description:
          "Wir prüfen jede Bewertung kurz und schalten sie danach frei. Das dauert meist unter 24 Stunden.",
      });
    },
    onError: (err: unknown) => {
      setSubmitStatus("error");
      const message = err instanceof Error ? err.message : String(err);
      const hint =
        message.includes("rate_limit_session") || message.includes("rate_limit_ip")
          ? "Du hast bereits eine Bewertung abgegeben."
          : "Bitte versuche es später erneut.";
      toast({
        title: "Bewertung konnte nicht gesendet werden",
        description: hint,
        variant: "destructive",
      });
    },
  });

  if (!shouldRender) return null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_DISMISSED_KEY, "1");
    } catch {
      /* ignore storage errors */
    }
    setShouldRender(false);
    trackEvent("wertrechner_review_dismissed", {
      category: "wertrechner",
      properties: { expanded, rating },
    });
  };

  const handleStarSelect = (value: number) => {
    setRating(value);
    if (!expanded) {
      setExpanded(true);
      trackEvent("wertrechner_review_expanded", {
        category: "wertrechner",
        value,
        properties: { initial_rating: value },
      });
    }
  };

  const handleSubmit = (evt?: React.FormEvent) => {
    evt?.preventDefault();
    if (isBot) {
      // Silently pretend success
      setSubmitStatus("success");
      try {
        window.localStorage.setItem(LOCAL_STORAGE_SUBMITTED_KEY, "1");
      } catch {
        /* ignore */
      }
      return;
    }
    if (rating < 1 || rating > 5) return;
    if (comment.trim().length > 0 && comment.trim().length < 3) {
      toast({
        title: "Kommentar zu kurz",
        description: "Bitte mindestens 3 Zeichen — oder Feld leer lassen.",
        variant: "destructive",
      });
      return;
    }
    setSubmitStatus("submitting");
    submitMutation.mutate();
  };

  const displayRating = hoverRating || rating;

  if (submitStatus === "success") {
    return (
      <Card
        className={cn(
          "border-dashed bg-muted/20 transition-all",
          className,
        )}
      >
        <CardContent className="flex items-center gap-3 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
            <Check className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm text-muted-foreground">
            Danke! Deine Bewertung wird nach kurzer Prüfung veröffentlicht.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "relative border-dashed bg-muted/10 transition-all",
        className,
      )}
      aria-label="Wertrechner bewerten"
    >
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Bewertungs-Prompt ausblenden"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>

      <CardContent className="space-y-3 py-5">
        {!expanded ? (
          <div className="flex flex-col gap-2 pr-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Wie fandest du unsere Wertschätzung?
              </p>
              <p className="text-xs text-muted-foreground">
                Deine Bewertung hilft anderen beim Wohnmobil-Verkauf.
              </p>
            </div>
            <div
              className="flex items-center gap-1"
              onMouseLeave={() => setHoverRating(0)}
              role="radiogroup"
              aria-label="Bewertung 1 bis 5 Sterne"
            >
              {[1, 2, 3, 4, 5].map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => handleStarSelect(pos)}
                  onMouseEnter={() => setHoverRating(pos)}
                  onFocus={() => setHoverRating(pos)}
                  onBlur={() => setHoverRating(0)}
                  aria-label={`${pos} Stern${pos === 1 ? "" : "e"}`}
                  aria-checked={rating === pos}
                  role="radio"
                  className="p-1 rounded hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <Star
                    className={cn(
                      "h-5 w-5 transition-colors",
                      displayRating >= pos
                        ? "fill-amber-400 text-amber-400"
                        : "text-gray-300 dark:text-gray-600",
                    )}
                    strokeWidth={1.5}
                  />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pr-6" noValidate>
            <HoneypotField value={honeypotValue} onChange={setHoneypotValue} fieldName="website_url" />

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Deine Bewertung</p>
                <p className="text-xs text-muted-foreground">
                  {rating === 5
                    ? "Danke, das freut uns!"
                    : rating >= 4
                      ? "Danke, hilft anderen weiter."
                      : rating > 0
                        ? "Danke — wir lesen jedes Feedback."
                        : ""}
                </p>
              </div>
              <div
                className="flex items-center gap-1"
                onMouseLeave={() => setHoverRating(0)}
                role="radiogroup"
                aria-label="Bewertung 1 bis 5 Sterne"
              >
                {[1, 2, 3, 4, 5].map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setRating(pos)}
                    onMouseEnter={() => setHoverRating(pos)}
                    onFocus={() => setHoverRating(pos)}
                    onBlur={() => setHoverRating(0)}
                    aria-label={`${pos} Stern${pos === 1 ? "" : "e"}`}
                    aria-checked={rating === pos}
                    role="radio"
                    className="p-1 rounded hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <Star
                      className={cn(
                        "h-5 w-5 transition-colors",
                        displayRating >= pos
                          ? "fill-amber-400 text-amber-400"
                          : "text-gray-300 dark:text-gray-600",
                      )}
                      strokeWidth={1.5}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="review-comment" className="text-xs">
                Kommentar (optional)
              </Label>
              <Textarea
                id="review-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Was war gut oder könnte besser sein?"
                rows={3}
                maxLength={1000}
                className="text-sm"
              />
              <div className="flex justify-end">
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {comment.length}/1000
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="review-name" className="text-xs">
                  Vorname (optional)
                </Label>
                <Input
                  id="review-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z.B. Max"
                  maxLength={80}
                  className="text-sm"
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="review-location" className="text-xs">
                  Ort (optional)
                </Label>
                <Input
                  id="review-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="z.B. Hannover"
                  maxLength={80}
                  className="text-sm"
                  autoComplete="address-level2"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={rating < 1 || submitMutation.isPending}
              >
                {submitMutation.isPending ? "Sendet..." : "Bewertung senden"}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Wir veröffentlichen Bewertungen nur nach kurzer Prüfung. Name + Ort erscheinen
              (falls angegeben), weitere Daten bleiben intern.
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export default ReviewCollectionPrompt;
