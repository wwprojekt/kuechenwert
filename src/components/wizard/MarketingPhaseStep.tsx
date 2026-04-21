/**
 * MarketingPhaseStep - Step 9 des Wizards (final, vor Submit)
 *
 * Trust-First Design: zeigt zuerst was der Verkäufer GEWINNT (Mindesterlös-Garantie),
 * dann kompakt was wir tun, optional juristische Details im Aufklapper, dann
 * kompakter Pflicht-Consent gemäß AGB §6 / §6.4 (v7).
 *
 * Wird ÜBERSPRUNGEN für sale_channel = 'station' (kein Marketing-Phasen-Modell).
 *
 * Conversion-Optimierung gegenüber alter Box in Step 7:
 *   - "Mindesterlös-Garantie" als positiver Anker (statt "Sicherheitsboden 6 %")
 *   - Konkrete Euro-Zahl statt Prozent (z.B. "Niemals unter 28.200 €")
 *   - Auto-Senkung-Toggle in Aufklapper, nicht im Hauptview (kein Druckgefühl)
 *   - Pflicht-Checkbox als kompakte Inline-Zeile (kein eigener farbiger Kasten)
 *   - Submit-Button auf derselben Seite → klarer Abschluss-Moment
 */

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { ShieldCheck, TrendingUp, ChevronDown, Info, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MARKETING_CONFIG, formatMarketingDuration } from "@/lib/marketing-config";

interface MarketingPhaseStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  fieldErrors?: Record<string, string>;
}

const formatEuro = (n: number): string =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export const MarketingPhaseStep = ({ formData, updateFormData, fieldErrors = {} }: MarketingPhaseStepProps) => {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const isAuction = formData.saleChannel === "auction";
  const isInstantPrice = formData.saleChannel === "instant_price";

  const reductionPct = isInstantPrice
    ? MARKETING_CONFIG.INSTANT_PRICE_MAX_TOTAL_REDUCTION
    : MARKETING_CONFIG.AUCTION_MAX_TOTAL_REDUCTION;
  const perRoundPct = isInstantPrice
    ? MARKETING_CONFIG.INSTANT_PRICE_REDUCTION_PER_ROUND * 100
    : MARKETING_CONFIG.AUCTION_REDUCTION_PER_ROUND * 100;
  const totalDays = isInstantPrice
    ? MARKETING_CONFIG.INSTANT_PRICE_MAX_TOTAL_DAYS
    : MARKETING_CONFIG.AUCTION_DURATION_DAYS * MARKETING_CONFIG.AUCTION_MAX_ROUNDS +
      MARKETING_CONFIG.AUCTION_MAX_ROUNDS;

  // Konkreter Mindesterlös in Euro – das ist der Trust-Anchor
  const wishPrice = isInstantPrice ? formData.instantPrice : formData.reservePrice;
  const minimumPayout =
    typeof wishPrice === "number" && wishPrice > 0
      ? Math.round(wishPrice * (1 - reductionPct))
      : null;
  const minimumPayoutLabel = minimumPayout !== null ? formatEuro(minimumPayout) : null;

  const dynamicPricingDefault = isInstantPrice
    ? MARKETING_CONFIG.INSTANT_PRICE_DYNAMIC_PRICING_DEFAULT
    : MARKETING_CONFIG.AUCTION_DYNAMIC_PRICING_DEFAULT;
  const dynamicPricingValue =
    formData.dynamicPricing != null ? formData.dynamicPricing : dynamicPricingDefault;

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="mb-2 sm:mb-4">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-1 sm:mb-2 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Letzter Schritt: Vermarktung bestätigen
        </h2>
        <p className="text-xs sm:text-base text-muted-foreground">
          So vermarkten wir Ihr Fahrzeug optimal – mit garantiertem Schutz für Sie.
        </p>
      </div>

      {/* HERO: Mindesterlös-Garantie (positiver Trust-Anker) */}
      <Card className="border-2 border-green-200 dark:border-green-800/50 bg-gradient-to-br from-green-50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/10 p-4 sm:p-6 rounded-2xl">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-green-500 text-white flex items-center justify-center shadow-md shadow-green-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="flex-1 space-y-1.5">
            <h3 className="text-base sm:text-lg font-bold text-green-900 dark:text-green-100">
              Mindesterlös-Garantie
            </h3>
            {minimumPayoutLabel ? (
              <p className="text-sm sm:text-base text-green-800 dark:text-green-200 leading-relaxed">
                Ihr Fahrzeug wird <strong>niemals unter {minimumPayoutLabel}</strong> verkauft.
                {isAuction
                  ? " In der Auktion bieten Händler typischerweise deutlich darüber."
                  : " Sie bekommen mindestens diesen Erlös – garantiert."}
              </p>
            ) : (
              <p className="text-sm sm:text-base text-green-800 dark:text-green-200 leading-relaxed">
                Ihr Fahrzeug wird <strong>niemals unter Ihrem persönlichen Schutzpreis</strong> verkauft.
              </p>
            )}
            <p className="text-xs text-green-700/80 dark:text-green-300/80 leading-snug">
              Schutz festgelegt nach AGB §6.4 ({reductionPct === 0.06 ? "max. -6 % vom Wunschpreis" : "max. -10 % vom Wunschpreis"}).
              Sie können diesen Schutz jederzeit im Dashboard erhöhen.
            </p>
          </div>
        </div>
      </Card>

      {/* So vermarkten wir Ihr Fahrzeug (kompakt) */}
      <Card className="border border-border bg-card p-4 sm:p-5 rounded-xl space-y-2">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-sm sm:text-base font-semibold text-foreground">
              So vermarkten wir Ihr Fahrzeug
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {isAuction
                ? `${MARKETING_CONFIG.AUCTION_DURATION_DAYS} Tage Auktion + ${MARKETING_CONFIG.KAUFCHANCE_DURATION_HOURS} h Kaufchance, bis zu ${MARKETING_CONFIG.AUCTION_MAX_ROUNDS} Runden.`
                : `${MARKETING_CONFIG.INSTANT_PRICE_DURATION_DAYS}-Tage-Festpreis-Inserat, automatisch verlängert bis max. ${MARKETING_CONFIG.INSTANT_PRICE_MAX_TOTAL_DAYS} Tage.`}{" "}
              Vermarktung jederzeit im Dashboard steuerbar.
            </p>
          </div>
        </div>

        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-xs sm:text-sm text-primary hover:underline pt-1">
            <Info className="w-3.5 h-3.5" />
            {detailsOpen ? "Details schließen" : "Details ansehen"}
            <ChevronDown
              className={cn("w-3.5 h-3.5 transition-transform", detailsOpen && "rotate-180")}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-2 text-xs text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">Bindungsdauer:</strong>{" "}
              {formatMarketingDuration(isAuction ? "auction" : "instant_price")}.
            </p>
            <p>
              <strong className="text-foreground">Automatische Preisanpassung:</strong> Pro Runde max.{" "}
              {perRoundPct.toFixed(0)} %, insgesamt max. {(reductionPct * 100).toFixed(0)} % vom Wunschpreis.
              Unter dem Mindesterlös wird Ihr Fahrzeug niemals verkauft.
            </p>
            <p>
              <strong className="text-foreground">Ihre Kontrolle:</strong> Automatische Verlängerung und
              Preisanpassung können Sie jederzeit im Dashboard ein- und ausschalten – auch während einer
              laufenden Kaufchance. Bei wichtigem Grund (z.&nbsp;B. Verkauf an Privat) gilt unsere
              außerordentliche Kündigungsklausel der AGB §6.
            </p>
            <p>
              <strong className="text-foreground">Preisänderung:</strong> Solange das Inserat im Entwurf ist,
              ändern Sie Mindest- und Sofortpreis direkt im Dashboard. Sobald es live ist, stellen Sie eine
              Preisänderungs-Anfrage per Klick – unser Team setzt sie zeitnah um.
            </p>
            <p>
              <strong className="text-foreground">Was passiert nach {totalDays} Tagen?</strong> Wir
              kontaktieren Sie per E-Mail mit drei Optionen: erneut einstellen, Preis anpassen oder
              archivieren. Es passiert nichts ohne Ihre aktive Bestätigung.
            </p>

            {/* Auto-Senkung Toggle in den Details (nicht mehr im Hauptview) */}
            <div className="flex items-start justify-between gap-3 border-t border-border pt-3 mt-2">
              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                <TrendingDown className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="space-y-0.5">
                  <Label htmlFor="dynamicPricing" className="text-sm font-medium text-foreground cursor-pointer">
                    Automatische Preisanpassung
                    {isAuction && (
                      <span className="ml-2 text-xs font-normal text-green-600 dark:text-green-400">
                        Empfohlen
                      </span>
                    )}
                  </Label>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {dynamicPricingValue
                      ? `Erhöht Ihre Verkaufschance. Schutz: niemals unter ${minimumPayoutLabel || "Ihrem Mindesterlös"}.`
                      : "Wunschpreis bleibt konstant – Sie entscheiden manuell über jede Anpassung."}
                  </p>
                </div>
              </div>
              <Switch
                id="dynamicPricing"
                checked={dynamicPricingValue}
                onCheckedChange={(v) => updateFormData({ dynamicPricing: v })}
                className="flex-shrink-0 mt-0.5"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Kompakter Pflicht-Consent (eine Zeile, keine farbige Box mehr) */}
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border p-3 transition-colors",
          fieldErrors.marketingConsent
            ? "border-red-500 bg-red-50/50 dark:bg-red-950/10"
            : formData.marketingConsent
              ? "border-green-500/40 bg-green-50/40 dark:bg-green-950/10"
              : "border-border bg-background",
        )}
      >
        <Checkbox
          id="marketingConsent"
          checked={formData.marketingConsent}
          onCheckedChange={(v) => updateFormData({ marketingConsent: v === true })}
          className="mt-0.5 flex-shrink-0"
          aria-describedby={fieldErrors.marketingConsent ? "marketingConsent-error" : undefined}
        />
        <div className="flex-1 space-y-0.5">
          <Label htmlFor="marketingConsent" className="text-sm font-medium cursor-pointer leading-snug">
            Ich akzeptiere die Vermarktung gemäß{" "}
            <a href="/agb" target="_blank" rel="noopener" className="text-primary hover:underline">
              AGB §6
            </a>{" "}
            <span className="text-red-500">*</span>
          </Label>
          <p className="text-xs text-muted-foreground leading-snug">
            Bindungsphase bis zu {totalDays} Tagen. Vermarktungs-Einstellungen jederzeit im Dashboard
            anpassbar.
          </p>
          {fieldErrors.marketingConsent && (
            <p id="marketingConsent-error" className="text-xs text-red-600 font-medium animate-fade-in">
              {fieldErrors.marketingConsent}
            </p>
          )}
        </div>
      </div>

      {/* Final-Hint */}
      <p className="text-xs text-center text-muted-foreground">
        Nach dem Klick auf <strong>„Inserat veröffentlichen"</strong> wird Ihr Fahrzeug für geprüfte Händler
        sichtbar. Sie erhalten eine Bestätigungs-E-Mail.
      </p>
    </div>
  );
};

export type { MarketingPhaseStepProps };
