/**
 * SaleChannelStep - Step 7 des Wizards
 * 
 * Enthält: Verkaufsweg-Auswahl, Mindestpreis, Kontaktdaten (Name, E-Mail, Telefon), Anmerkungen.
 * Name und E-Mail werden bereits in Step 5 (QuickContactStep) erfasst und hier vorausgefüllt.
 */

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Mail, Phone, User as UserIcon, Gavel, Zap, MapPin, Users, TrendingUp, CheckCircle2, Info, ChevronDown, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MARKETING_CONFIG, formatMarketingDuration } from "@/lib/marketing-config";

interface SaleChannelStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  fieldErrors?: Record<string, string>;
}

export const SaleChannelStep = ({ formData, updateFormData, fieldErrors = {} }: SaleChannelStepProps) => {
  const [marketingDetailsOpen, setMarketingDetailsOpen] = useState(false);

  // Pre-select recommended option to reduce friction (user can change).
  // Runs once on mount: re-running on saleChannel change would undo the
  // user's choice if they switch away and back, and updateFormData is
  // a stable useCallback so it would otherwise trigger the same effect
  // twice on re-renders.
  useEffect(() => {
    if (!formData.saleChannel) {
      updateFormData({ saleChannel: "auction" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Channel-spezifische Marketing-Phase-Daten für Aufklärungs-Box + Auto-Senkung-Toggle.
  // Quelle: src/lib/marketing-config.ts (gespiegelt von _shared/marketing-config.ts).
  const isAuction = formData.saleChannel === "auction";
  const isInstantPrice = formData.saleChannel === "instant_price";
  const showMarketingPhase = isAuction || isInstantPrice;

  // Effektives dynamic_pricing für die UI (null = Channel-Default).
  const dynamicPricingDefault = isInstantPrice
    ? MARKETING_CONFIG.INSTANT_PRICE_DYNAMIC_PRICING_DEFAULT
    : MARKETING_CONFIG.AUCTION_DYNAMIC_PRICING_DEFAULT;
  const dynamicPricingValue =
    formData.dynamicPricing != null ? formData.dynamicPricing : dynamicPricingDefault;

  const reductionPct = isInstantPrice
    ? MARKETING_CONFIG.INSTANT_PRICE_MAX_TOTAL_REDUCTION * 100
    : MARKETING_CONFIG.AUCTION_MAX_TOTAL_REDUCTION * 100;
  const perRoundPct = isInstantPrice
    ? MARKETING_CONFIG.INSTANT_PRICE_REDUCTION_PER_ROUND * 100
    : MARKETING_CONFIG.AUCTION_REDUCTION_PER_ROUND * 100;
  const totalDays = isInstantPrice
    ? MARKETING_CONFIG.INSTANT_PRICE_MAX_TOTAL_DAYS
    : MARKETING_CONFIG.AUCTION_DURATION_DAYS * MARKETING_CONFIG.AUCTION_MAX_ROUNDS +
      MARKETING_CONFIG.AUCTION_MAX_ROUNDS;

  return (
    <div className="space-y-3 sm:space-y-6 animate-fade-in">
      <div className="mb-3 sm:mb-6">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-1 sm:mb-2 flex items-center gap-2">
          <Mail className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Verkaufsweg wählen
        </h2>
        <p className="text-xs sm:text-base text-muted-foreground">
          Wählen Sie Ihren Verkaufsweg und vervollständigen Sie Ihre Kontaktdaten
        </p>
      </div>

      {/* FOMO-Banner */}
      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 text-green-600">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-200">
              Geprüfte Händler suchen aktuell nach {formData.bodyType || "Wohnmobilen"} wie Ihrem {formData.manufacturer || ""}
            </p>
            <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
              Durchschnittlich erhalten Verkäufer innerhalb von 24 Stunden ihr erstes Angebot
            </p>
          </div>
        </div>
      </div>

      {/* Verkaufsweg */}
      <div className="space-y-3">
        <Label className={cn("text-base font-semibold", fieldErrors.saleChannel && "text-red-600")}>Wie möchten Sie verkaufen? <span className="text-red-500">*</span></Label>
        <RadioGroup
          value={formData.saleChannel}
          onValueChange={(value) => {
            const updates: Partial<WizardFormData> = { saleChannel: value };
            if (value !== 'instant_price') updates.instantPrice = null;
            if (value !== 'auction') updates.reservePrice = null;
            updateFormData(updates);
          }}
          className="grid grid-cols-1 gap-3"
        >
          {/* Sofortpreis */}
          <Card
            className={`relative p-4 md:p-5 cursor-pointer transition-all duration-300 rounded-xl group ${
              formData.saleChannel === "instant_price"
                ? "border-2 border-primary bg-primary/5 shadow-lg shadow-primary/10 md:scale-[1.01]"
                : "border-2 border-transparent bg-card hover:border-primary/30 hover:shadow-md md:hover:scale-[1.005]"
            }`}
            onClick={() => updateFormData({ saleChannel: "instant_price", reservePrice: null })}
          >
            <div className="flex items-center gap-3 md:gap-4">
              <div className={`flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                formData.saleChannel === "instant_price"
                  ? "bg-yellow-500 text-white shadow-md shadow-yellow-500/30"
                  : "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-500 group-hover:bg-yellow-100 dark:group-hover:bg-yellow-950/50"
              }`}>
                <Zap className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Label htmlFor="instant_price" className="cursor-pointer text-base font-semibold text-foreground">
                    Sofortpreis
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Erhalten Sie sofort ein verbindliches Kaufangebot von geprüften Händlern
                </p>
              </div>
              <RadioGroupItem value="instant_price" id="instant_price" className="flex-shrink-0" onClick={(e) => e.stopPropagation()} />
            </div>
          </Card>

          {/* Händler-Auktion - Empfohlen */}
          <Card
            className={`relative p-4 md:p-5 cursor-pointer transition-all duration-300 rounded-xl group ${
              formData.saleChannel === "auction"
                ? "border-2 border-primary bg-primary/5 shadow-lg shadow-primary/10 md:scale-[1.01]"
                : "border-2 border-primary/20 bg-card hover:border-primary/40 hover:shadow-md md:hover:scale-[1.005]"
            }`}
            onClick={() => updateFormData({ saleChannel: "auction", instantPrice: null })}
          >
            <div className="absolute -top-3 right-4">
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1 rounded-full shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Empfohlen
              </span>
            </div>
            <div className="flex items-center gap-3 md:gap-4">
              <div className={`flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                formData.saleChannel === "auction"
                  ? "bg-blue-500 text-white shadow-md shadow-blue-500/30"
                  : "bg-blue-50 dark:bg-blue-950/30 text-blue-500 group-hover:bg-blue-100 dark:group-hover:bg-blue-950/50"
              }`}>
                <Gavel className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Label htmlFor="auction" className="cursor-pointer text-base font-semibold text-foreground">
                    Händler-Auktion
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Mehrere Händler bieten auf Ihr Fahrzeug – oft der höchste Preis
                </p>
              </div>
              <RadioGroupItem value="auction" id="auction" className="flex-shrink-0" onClick={(e) => e.stopPropagation()} />
            </div>
          </Card>

          {/* Ankaufstation */}
          <Card
            className={`relative p-4 md:p-5 cursor-pointer transition-all duration-300 rounded-xl group ${
              formData.saleChannel === "station"
                ? "border-2 border-primary bg-primary/5 shadow-lg shadow-primary/10 md:scale-[1.01]"
                : "border-2 border-transparent bg-card hover:border-primary/30 hover:shadow-md md:hover:scale-[1.005]"
            }`}
            onClick={() => updateFormData({ saleChannel: "station", instantPrice: null, reservePrice: null })}
          >
            <div className="flex items-center gap-3 md:gap-4">
              <div className={`flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
                formData.saleChannel === "station"
                  ? "bg-green-500 text-white shadow-md shadow-green-500/30"
                  : "bg-green-50 dark:bg-green-950/30 text-green-500 group-hover:bg-green-100 dark:group-hover:bg-green-950/50"
              }`}>
                <MapPin className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Label htmlFor="station" className="cursor-pointer text-base font-semibold text-foreground">
                    Ankaufstation
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Persönliche Bewertung vor Ort – Bargeld am selben Tag
                </p>
              </div>
              <RadioGroupItem value="station" id="station" className="flex-shrink-0" onClick={(e) => e.stopPropagation()} />
            </div>
          </Card>
        </RadioGroup>
        {fieldErrors.saleChannel && (
          <p className="text-sm text-red-600 font-medium animate-fade-in">{fieldErrors.saleChannel}</p>
        )}
      </div>

      {/* Preis-Felder je nach Verkaufsweg */}
      {formData.saleChannel === "instant_price" && (
        <div className="space-y-2 animate-fade-in">
          <Label htmlFor="instantPrice" className={cn(fieldErrors.instantPrice && "text-red-600")}>
            Ihr Wunschpreis <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">€</span>
            <Input
              id="instantPrice"
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="z.B. 45000"
              value={formData.instantPrice || ""}
              onChange={(e) => updateFormData({ instantPrice: e.target.value ? parseInt(e.target.value) : null })}
              min={1}
              className={cn("pl-8", fieldErrors.instantPrice && "border-red-500 ring-red-500/20 ring-2")}
            />
          </div>
          {fieldErrors.instantPrice && (
            <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.instantPrice}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Händler können Ihr Fahrzeug sofort zu diesem Preis kaufen – ohne Auktion oder Bieterverfahren.
          </p>
        </div>
      )}

      {formData.saleChannel === "auction" && (
        <div className="space-y-2 animate-fade-in">
          <Label
            htmlFor="reservePrice"
            className={cn("flex items-center gap-1", fieldErrors.reservePrice && "text-red-600")}
          >
            Mindestpreis <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
            <Input
              id="reservePrice"
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="z.B. 35000"
              value={formData.reservePrice || ""}
              onChange={(e) => updateFormData({ reservePrice: e.target.value ? parseInt(e.target.value) : null })}
              min={1}
              aria-invalid={Boolean(fieldErrors.reservePrice)}
              aria-describedby={fieldErrors.reservePrice ? "reservePrice-error" : undefined}
              className={cn("pl-8", fieldErrors.reservePrice && "border-red-500 ring-red-500/20 ring-2")}
            />
          </div>
          {fieldErrors.reservePrice ? (
            <p id="reservePrice-error" className="text-sm text-red-600 font-medium animate-fade-in">
              {fieldErrors.reservePrice}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Unter diesem Preis wird Ihr Fahrzeug nicht verkauft. Pflichtfeld zur juristischen Absicherung der automatischen Preisanpassung (AGB §6.4).
            </p>
          )}
        </div>
      )}

      {/* ===== MARKETINGPHASE: AUFKLÄRUNG + PFLICHT-CONSENT + AUTO-SENKUNG ===== */}
      {/*
        Pflicht-Consent für die Marketingphase. Wird nur bei Auktion / Festpreis
        angezeigt – Ankaufstationen laufen unter dem normalen Ankauf-Modell ohne
        Auto-Relist. Conversion-Sprache zuerst, juristische Details optional
        per Aufklapper – alles, was zur AGB-Bindung gehört, steht im Aufklapper.
      */}
      {showMarketingPhase && (
        <div className="space-y-3 animate-fade-in">
          <Card className="border-primary/30 bg-primary/[0.03] p-4 sm:p-5 rounded-xl space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="text-sm sm:text-base font-semibold text-foreground">
                  So verkaufen wir Ihr Fahrzeug am besten
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  {isAuction
                    ? `${MARKETING_CONFIG.AUCTION_DURATION_DAYS} Tage Auktion + ${MARKETING_CONFIG.KAUFCHANCE_DURATION_HOURS}h Kaufchance, bis zu ${MARKETING_CONFIG.AUCTION_MAX_ROUNDS} Runden – ohne Verkauf wird der Mindestpreis pro Runde leicht angepasst, damit Händler aktiv bieten. Sie können die Senkung jederzeit im Dashboard stoppen.`
                    : `${MARKETING_CONFIG.INSTANT_PRICE_DURATION_DAYS} Tage Festpreis-Inserat, automatische Verlängerung bis max. ${MARKETING_CONFIG.INSTANT_PRICE_MAX_TOTAL_DAYS} Tage. Sie behalten jederzeit die volle Kontrolle über Preis und Sichtbarkeit.`}
                </p>
              </div>
            </div>

            {/* Details-Aufklapper – juristische Klartext-Erklärung */}
            <Collapsible open={marketingDetailsOpen} onOpenChange={setMarketingDetailsOpen}>
              <CollapsibleTrigger className="flex items-center gap-1.5 text-xs sm:text-sm text-primary hover:underline">
                <Info className="w-3.5 h-3.5" />
                {marketingDetailsOpen ? "Details schließen" : "Details ansehen"}
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform",
                    marketingDetailsOpen && "rotate-180",
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-2 text-xs text-muted-foreground leading-relaxed">
                <p>
                  <strong className="text-foreground">Bindungsdauer:</strong> {formatMarketingDuration(isAuction ? "auction" : "instant_price")}.
                </p>
                <p>
                  <strong className="text-foreground">Automatische Preissenkung:</strong> Pro Runde max. {perRoundPct.toFixed(0)} %, insgesamt max. {reductionPct.toFixed(0)} % vom heute eingegebenen Wunschpreis. Unter diese Untergrenze wird Ihr Fahrzeug niemals verkauft.
                </p>
                <p>
                  <strong className="text-foreground">Ihre Kontrolle:</strong> Sie können die automatische Verlängerung und Preissenkung jederzeit im Dashboard ein- und ausschalten – auch während einer laufenden Kaufchance. Bei wichtigem Grund (z. B. Verkauf an Privat) gilt unsere außerordentliche Kündigungsklausel der AGB §6.
                </p>
                <p>
                  <strong className="text-foreground">Was passiert nach {totalDays} Tagen?</strong> Wir kontaktieren Sie per E-Mail mit drei Optionen: erneut einstellen, Preis anpassen oder archivieren. Es passiert nichts ohne Ihre aktive Bestätigung.
                </p>
              </CollapsibleContent>
            </Collapsible>

            {/* Auto-Senkung Toggle (Default richtet sich nach Channel) */}
            <div className="flex items-start justify-between gap-3 border-t border-primary/10 pt-3">
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
                      ? `Reserve sinkt pro Runde um max. ${perRoundPct.toFixed(0)} % (Boden: ${reductionPct.toFixed(0)} % unter Wunschpreis).`
                      : "Wunschpreis bleibt konstant – Sie entscheiden manuell."}
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
          </Card>

          {/* Pflicht-Checkbox – juristisch verankert in AGB §6 */}
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 sm:p-3.5 transition-colors",
              fieldErrors.marketingConsent
                ? "border-red-500 bg-red-50/50 dark:bg-red-950/10"
                : formData.marketingConsent
                  ? "border-green-500/40 bg-green-50/50 dark:bg-green-950/10"
                  : "border-border bg-muted/30",
            )}
          >
            <Checkbox
              id="marketingConsent"
              checked={formData.marketingConsent}
              onCheckedChange={(v) => updateFormData({ marketingConsent: v === true })}
              className="mt-0.5 flex-shrink-0"
              aria-describedby={fieldErrors.marketingConsent ? "marketingConsent-error" : undefined}
            />
            <div className="flex-1 space-y-1">
              <Label htmlFor="marketingConsent" className="text-sm font-medium cursor-pointer leading-snug">
                Ich verstehe und akzeptiere die Marketingphase{" "}
                <span className="text-red-500">*</span>
              </Label>
              <p className="text-xs text-muted-foreground leading-snug">
                Ich stimme der bis zu {totalDays}-tägigen Bindungsphase und der automatischen Preisanpassung gemäß{" "}
                <a href="/agb" target="_blank" rel="noopener" className="text-primary hover:underline">AGB §6</a>{" "}
                zu. Ich kann sie jederzeit im Dashboard deaktivieren.
              </p>
              {fieldErrors.marketingConsent && (
                <p id="marketingConsent-error" className="text-xs text-red-600 font-medium animate-fade-in">
                  {fieldErrors.marketingConsent}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Telefonnummer */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Kontaktdaten vervollständigen</h3>

        {/* Anzeige der bereits erfassten Daten */}
        {(formData.customerName || formData.customerEmail) && (
          <div className="bg-muted/50 rounded-lg p-3 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-muted-foreground">
              <p>
                {formData.customerName && <span className="font-medium text-foreground">{formData.customerName}</span>}
                {formData.customerName && formData.customerEmail && " · "}
                {formData.customerEmail && <span>{formData.customerEmail}</span>}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name - vorausgefüllt aus Step 5, aber editierbar */}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="customerName" className={cn("flex items-center gap-2", fieldErrors.customerName && "text-red-600")}>
              <UserIcon className="w-4 h-4" />
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="customerName"
              type="text"
              placeholder="Vor- und Nachname"
              value={formData.customerName || ""}
              onChange={(e) => updateFormData({ customerName: e.target.value })}
              autoComplete="name"
              className={cn(fieldErrors.customerName && "border-red-500 ring-red-500/20 ring-2")}
            />
            {fieldErrors.customerName && (
              <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.customerName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerEmail" className={cn("flex items-center gap-2", fieldErrors.customerEmail && "text-red-600")}>
              <Mail className="w-4 h-4" />
              E-Mail <span className="text-red-500">*</span>
            </Label>
            <Input
              id="customerEmail"
              type="email"
              placeholder="ihre@email.de"
              value={formData.customerEmail || ""}
              onChange={(e) => updateFormData({ customerEmail: e.target.value })}
              autoComplete="email"
              className={cn(fieldErrors.customerEmail && "border-red-500 ring-red-500/20 ring-2")}
            />
            {fieldErrors.customerEmail && (
              <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.customerEmail}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerPhone" className={cn("flex items-center gap-2", fieldErrors.customerPhone && "text-red-600")}>
              <Phone className="w-4 h-4" />
              Telefon <span className="text-red-500">*</span>
            </Label>
            <Input
              id="customerPhone"
              name="phone"
              type="tel"
              inputMode="tel"
              pattern="^\+?[0-9\s\(\)\-]{7,}$"
              placeholder="+49 123 456789"
              value={formData.customerPhone || ""}
              onChange={(e) => updateFormData({ customerPhone: e.target.value })}
              autoComplete="tel"
              className={cn(fieldErrors.customerPhone && "border-red-500 ring-red-500/20 ring-2")}
            />
            {fieldErrors.customerPhone && (
              <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.customerPhone}</p>
            )}
          </div>
        </div>
      </div>

      {/* Beschreibung */}
      <div className="space-y-2 border-t pt-4">
        <Label htmlFor="description">
          Anmerkungen zum Fahrzeug <span className="text-muted-foreground text-xs">(optional)</span>
        </Label>
        <Textarea
          id="description"
          placeholder="Besondere Merkmale, Wartungshistorie, Zusatzausstattung..."
          value={formData.description}
          onChange={(e) => updateFormData({ description: e.target.value })}
          rows={3}
          className="resize-none"
        />
      </div>
    </div>
  );
};

export type { SaleChannelStepProps };
