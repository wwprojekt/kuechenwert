import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  XCircle,
  AlertCircle,
  Mail,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Building2,
  Calendar,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { DealerApplication } from "@/hooks/useDealerPending";
import { getPendingDealerTranslations } from "@/lib/pendingDealerTranslations";
import { getLanguageForCountry } from "@/lib/dealerRegistrationTranslations";

interface PendingDealerBannerProps {
  application: DealerApplication;
  onRefresh?: () => void;
  /** ISO country code for localisation (e.g. "DE", "FR", "NL") */
  countryCode?: string;
}

/**
 * Prominent banner shown at the top of the dealer dashboard when the
 * dealer application is still pending or has been rejected.
 *
 * Informs the user that all dealer features are currently locked and
 * will be unlocked after admin approval.
 *
 * Fully localised based on the dealer's country code.
 */
export default function PendingDealerBanner({
  application,
  onRefresh,
  countryCode = "DE",
}: PendingDealerBannerProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [reapplying, setReapplying] = useState(false);
  const isPending = application.status === "pending";
  const tr = getPendingDealerTranslations(countryCode);

  const handleReapply = async () => {
    setReapplying(true);
    try {
      const { error } = await supabase.rpc('reapply_dealer_application', {
        application_id_param: application.id,
      });
      if (error) throw error;
      toast({ title: "Bewerbung erneut eingereicht", description: "Ihr Antrag wird erneut geprüft." });
      onRefresh?.();
    } catch (err: any) {
      toast({ title: "Fehler", description: err.message || "Bitte versuchen Sie es später erneut.", variant: "destructive" });
    } finally {
      setReapplying(false);
    }
  };

  // Resolve locale string for date formatting (e.g. "de-DE", "fr-FR")
  const lang = getLanguageForCountry(countryCode);
  const localeMap: Record<string, string> = {
    de: "de-DE",
    en: "en-GB",
    nl: "nl-NL",
    fr: "fr-FR",
    it: "it-IT",
    es: "es-ES",
    pt: "pt-PT",
    pl: "pl-PL",
  };
  const dateLocale = localeMap[lang] ?? "en-GB";

  return (
    <div
      className={`rounded-xl border-2 overflow-hidden ${
        isPending
          ? "border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 dark:border-amber-700"
          : "border-red-300 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/40 dark:border-red-700"
      }`}
    >
      {/* Main Banner */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div
            className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isPending
                ? "bg-amber-100 dark:bg-amber-900/50"
                : "bg-red-100 dark:bg-red-900/50"
            }`}
          >
            {isPending ? (
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <h3
                className={`font-bold text-lg ${
                  isPending
                    ? "text-amber-800 dark:text-amber-200"
                    : "text-red-800 dark:text-red-200"
                }`}
              >
                {isPending
                  ? tr.bannerPendingTitle
                  : tr.bannerRejectedTitle}
              </h3>
              <Badge
                variant="outline"
                className={`text-xs ${
                  isPending
                    ? "bg-amber-100/50 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300"
                    : "bg-red-100/50 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300"
                }`}
              >
                {isPending ? tr.bannerPendingBadge : tr.bannerRejectedBadge}
              </Badge>
            </div>

            <p
              className={`text-sm ${
                isPending
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-red-700 dark:text-red-300"
              }`}
            >
              {isPending
                ? tr.bannerPendingDescription
                : tr.bannerRejectedDescription}
            </p>

            {/* Rejection reason + re-apply button */}
            {!isPending && application.rejection_reason && (
              <Alert
                variant="destructive"
                className="mt-3 border-red-200 bg-red-100/50 dark:border-red-800 dark:bg-red-900/30"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{tr.bannerRejectionReason}</strong>{" "}
                  {application.rejection_reason}
                </AlertDescription>
              </Alert>
            )}
            {!isPending && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleReapply}
                disabled={reapplying}
                className="mt-3 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/50"
              >
                <RotateCcw className={`w-4 h-4 mr-2 ${reapplying ? 'animate-spin' : ''}`} />
                {reapplying ? 'Wird eingereicht...' : 'Erneut zur Prüfung einreichen'}
              </Button>
            )}

            {/* Expandable details */}
            <button
              onClick={() => setExpanded(!expanded)}
              className={`mt-2 text-xs font-medium flex items-center gap-1 hover:underline ${
                isPending
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {expanded ? tr.bannerHideDetails : tr.bannerShowDetails}
              {expanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>

            {expanded && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {tr.bannerCompany}
                  </span>
                  <span className="font-medium">
                    {application.company_name}
                  </span>
                </div>
                {application.legal_form && (
                  <div className="flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {tr.bannerLegalForm}
                    </span>
                    <span className="font-medium">
                      {application.legal_form}
                    </span>
                  </div>
                )}
                {application.submitted_at && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {tr.bannerSubmittedAt}
                    </span>
                    <span className="font-medium">
                      {new Date(application.submitted_at).toLocaleDateString(
                        dateLocale
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                className={`${
                  isPending
                    ? "text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50"
                    : "text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/50"
                }`}
                title={tr.bannerRefreshStatus}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/kontakt")}
              className={`${
                isPending
                  ? "text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/50"
                  : "text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/50"
              }`}
              title={tr.bannerContact}
            >
              <Mail className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom info bar */}
      {isPending && (
        <div className="px-5 py-2.5 bg-amber-100/50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <Clock className="w-3 h-3" />
            {tr.bannerProcessingTime}
          </p>
        </div>
      )}
    </div>
  );
}
