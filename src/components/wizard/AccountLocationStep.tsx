/**
 * AccountLocationStep - Step 8 des Wizards (letzter Schritt vor Submit)
 *
 * Enthält: Standort des Wohnmobils (Land, Straße, Hausnummer, PLZ, Ort) +
 * Konto erstellen (Passwort) + Pflicht-Consent für die Marketingphase
 * gemäß AGB §6 (nur für sale_channel ∈ {auction, instant_price}).
 *
 * Warum die Marketing-Checkbox HIER und nicht in einem eigenen Step:
 *   - Die Bindungsphase + automatische Preisanpassung sind „überraschende
 *     Klauseln" iSv § 305c BGB → eine separate, hervorgehobene Bestätigung
 *     ist juristisch erforderlich, ein bloßer AGB-Hinweis reicht NICHT.
 *   - Eine eigene Step-9-Seite ("Marketingphase erklären") wirkte als
 *     Conversion-Killer (Trust-First-Belehrung erzeugt Schock-Moment kurz
 *     vor Submit).
 *   - Die kompakte Inline-Checkbox erfüllt § 305c und reduziert die
 *     Klick-Distanz auf 1 Klick (Checkbox + Submit) statt 2 (Weiter →
 *     Consent → Submit).
 *
 * Für sale_channel = 'station' wird die Checkbox ausgeblendet – dort
 * existiert keine Marketingphase und kein § 305c-Risiko.
 */

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Lock, Eye, EyeOff, Shield, CheckCircle2, Megaphone } from "lucide-react";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { EU_COUNTRIES } from "@/lib/euCountries";
import { CountryFlag } from "@/components/CountryFlag";
import { cn } from "@/lib/utils";

/**
 * PLZ-Konfiguration pro Land:
 * - maxLength: Maximale Zeichenanzahl
 * - placeholder: Beispiel-PLZ
 * - numericOnly: Nur Ziffern erlaubt (false = auch Buchstaben, z.B. GB, IE, MT, NL)
 */
const postalCodeConfig: Record<string, { maxLength: number; placeholder: string; numericOnly: boolean }> = {
  DE: { maxLength: 5, placeholder: "12345", numericOnly: true },
  AT: { maxLength: 4, placeholder: "1010", numericOnly: true },
  CH: { maxLength: 4, placeholder: "8001", numericOnly: true },
  NL: { maxLength: 7, placeholder: "1234 AB", numericOnly: false },
  BE: { maxLength: 4, placeholder: "1000", numericOnly: true },
  FR: { maxLength: 5, placeholder: "75001", numericOnly: true },
  IT: { maxLength: 5, placeholder: "00100", numericOnly: true },
  ES: { maxLength: 5, placeholder: "28001", numericOnly: true },
  PT: { maxLength: 8, placeholder: "1000-001", numericOnly: false },
  PL: { maxLength: 6, placeholder: "00-001", numericOnly: false },
  CZ: { maxLength: 6, placeholder: "100 00", numericOnly: false },
  SK: { maxLength: 6, placeholder: "811 01", numericOnly: false },
  HU: { maxLength: 4, placeholder: "1011", numericOnly: true },
  RO: { maxLength: 6, placeholder: "010011", numericOnly: true },
  BG: { maxLength: 4, placeholder: "1000", numericOnly: true },
  HR: { maxLength: 5, placeholder: "10000", numericOnly: true },
  SI: { maxLength: 4, placeholder: "1000", numericOnly: true },
  DK: { maxLength: 4, placeholder: "1000", numericOnly: true },
  SE: { maxLength: 6, placeholder: "111 22", numericOnly: false },
  FI: { maxLength: 5, placeholder: "00100", numericOnly: true },
  IE: { maxLength: 8, placeholder: "D01 F5P2", numericOnly: false },
  LU: { maxLength: 4, placeholder: "1009", numericOnly: true },
  GR: { maxLength: 5, placeholder: "10431", numericOnly: true },
  EE: { maxLength: 5, placeholder: "10111", numericOnly: true },
  LV: { maxLength: 7, placeholder: "LV-1001", numericOnly: false },
  LT: { maxLength: 5, placeholder: "01001", numericOnly: true },
  MT: { maxLength: 7, placeholder: "VLT 1000", numericOnly: false },
  CY: { maxLength: 4, placeholder: "1000", numericOnly: true },
};

const defaultPostalConfig = { maxLength: 10, placeholder: "PLZ", numericOnly: false };

interface AccountLocationStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  registerPassword: string;
  setRegisterPassword: (pw: string) => void;
  confirmPassword: string;
  setConfirmPassword: (pw: string) => void;
  isAuthenticated: boolean;
  fieldErrors?: Record<string, string>;
}

export const AccountLocationStep = ({
  formData,
  updateFormData,
  registerPassword,
  setRegisterPassword,
  confirmPassword,
  setConfirmPassword,
  isAuthenticated,
  fieldErrors = {},
}: AccountLocationStepProps & { fieldErrors?: Record<string, string> }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const selectedCountry = formData.country || "DE";
  const postalConfig = postalCodeConfig[selectedCountry] || defaultPostalConfig;

  // Passwort-Stärke berechnen
  const getPasswordStrength = (pw: string): { label: string; color: string; width: string } => {
    if (!pw) return { label: "", color: "", width: "0%" };
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 2) return { label: "Schwach", color: "bg-red-500", width: "33%" };
    if (score <= 3) return { label: "Mittel", color: "bg-yellow-500", width: "66%" };
    return { label: "Stark", color: "bg-green-500", width: "100%" };
  };

  const passwordStrength = getPasswordStrength(registerPassword);
  const passwordsMatch = registerPassword && confirmPassword && registerPassword === confirmPassword;

  const handleCountryChange = (newCountry: string) => {
    updateFormData({ country: newCountry, zipCode: "" });
  };

  const handleZipCodeChange = (value: string) => {
    let val = value;
    if (postalConfig.numericOnly) {
      val = val.replace(/\D/g, "");
    }
    val = val.slice(0, postalConfig.maxLength);
    updateFormData({ zipCode: val });
  };

  return (
    <div className="space-y-3 sm:space-y-6 animate-fade-in">
      {/* Motivational banner */}
      <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-2.5 sm:p-3 flex items-center gap-2 text-xs sm:text-sm">
        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
        <span className="text-green-800 dark:text-green-200 font-medium">
          Fast geschafft! Nur noch Standort angeben{!isAuthenticated ? " und Passwort wählen" : ""} — dann erhalten Sie Ihr Angebot.
        </span>
      </div>

      <div className="mb-3 sm:mb-6">
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mb-1 sm:mb-2 flex items-center gap-2">
          <MapPin className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Standort & Konto
        </h2>
        <p className="text-xs sm:text-base text-muted-foreground">
          Letzter Schritt – geben Sie den Standort Ihres {formData.vehicleType === 'Wohnwagen' ? 'Wohnwagens' : 'Wohnmobils'} an{!isAuthenticated ? " und erstellen Sie Ihr Konto" : ""}.
        </p>
      </div>

      {/* ===== STANDORT DES WOHNMOBILS ===== */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <h3 className="text-base font-semibold">Standort des {formData.vehicleType === 'Wohnwagen' ? 'Wohnwagens' : 'Wohnmobils'}</h3>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          Wichtig für die Entfernungsanzeige der Händler und den späteren Kaufvertrag.
        </p>

        {/* Land-Auswahl */}
        <div className="space-y-2">
          <Label htmlFor="country">
            Land <span className="text-red-500">*</span>
          </Label>
          <Select value={selectedCountry} onValueChange={handleCountryChange}>
            <SelectTrigger id="country">
              <SelectValue placeholder="Land auswählen" />
            </SelectTrigger>
            <SelectContent>
              {EU_COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  <span className="inline-flex items-center gap-2">
                    <CountryFlag countryCode={c.code} size="sm" />
                    <span>{c.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="street" className={cn(fieldErrors.street && "text-red-600")}>
              Straße <span className="text-red-500">*</span>
            </Label>
            <Input
              id="street"
              type="text"
              placeholder="Musterstraße"
              value={formData.street || ""}
              onChange={(e) => updateFormData({ street: e.target.value })}
              autoComplete="street-address"
              className={cn(fieldErrors.street && "border-red-500 ring-red-500/20 ring-2")}
            />
            {fieldErrors.street && (
              <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.street}</p>
            )}
          </div>

          <div className="space-y-2 md:col-span-1">
            <Label htmlFor="houseNumber" className={cn(fieldErrors.houseNumber && "text-red-600")}>
              Hausnummer <span className="text-red-500">*</span>
            </Label>
            <Input
              id="houseNumber"
              type="text"
              placeholder="12a"
              value={formData.houseNumber || ""}
              onChange={(e) => updateFormData({ houseNumber: e.target.value })}
              className={cn(fieldErrors.houseNumber && "border-red-500 ring-red-500/20 ring-2")}
            />
            {fieldErrors.houseNumber && (
              <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.houseNumber}</p>
            )}
          </div>

          <div className="space-y-2 md:col-span-1">
            <Label htmlFor="zipCode" className={cn(fieldErrors.zipCode && "text-red-600")}>
              PLZ <span className="text-red-500">*</span>
            </Label>
            <Input
              id="zipCode"
              type="text"
              inputMode={postalConfig.numericOnly ? "numeric" : "text"}
              maxLength={postalConfig.maxLength}
              placeholder={postalConfig.placeholder}
              value={formData.zipCode || ""}
              onChange={(e) => handleZipCodeChange(e.target.value)}
              autoComplete="postal-code"
              className={cn(fieldErrors.zipCode && "border-red-500 ring-red-500/20 ring-2")}
            />
            {fieldErrors.zipCode && (
              <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.zipCode}</p>
            )}
          </div>

          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="city" className={cn(fieldErrors.city && "text-red-600")}>
              Ort <span className="text-red-500">*</span>
            </Label>
            <Input
              id="city"
              type="text"
              placeholder="Berlin"
              value={formData.city || ""}
              onChange={(e) => updateFormData({ city: e.target.value })}
              autoComplete="address-level2"
              className={cn(fieldErrors.city && "border-red-500 ring-red-500/20 ring-2")}
            />
            {fieldErrors.city && (
              <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.city}</p>
            )}
          </div>
        </div>
      </div>

      {/* ===== KONTO ERSTELLEN (PFLICHT) ===== */}
      {/*
        Passwort-Felder stehen in einem <form>, damit Browser/Password-Manager
        (1Password, LastPass, iCloud Keychain, Chrome Autofill) die Felder als
        zusammengehöriges Registrierungs-Formular erkennen und die DOM-Warnung
        "Password field is not contained in a form" vermieden wird. Der
        eigentliche Wizard-Submit erfolgt außerhalb dieses <form>-Elements;
        onSubmit wird daher neutralisiert, damit ein versehentliches Enter
        im Passwort-Feld kein Navigations-Reload auslöst.
      */}
      {!isAuthenticated && (
        <form
          className="space-y-4 border-t pt-4 sm:pt-6"
          onSubmit={(e) => e.preventDefault()}
          autoComplete="on"
        >
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            <h3 className="text-base font-semibold">Konto erstellen</h3>
          </div>
          <p className="text-sm text-muted-foreground -mt-2">
            Nur ein Passwort – damit können Sie Ihr Inserat verwalten, Gebote verfolgen und Nachrichten empfangen.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="registerPassword" className={cn(fieldErrors.registerPassword && "text-red-600")}>
                Passwort <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="registerPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mindestens 8 Zeichen"
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground active:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Passwort-Anforderungen */}
              {registerPassword ? (
                <div className="space-y-1.5">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${passwordStrength.color} transition-all duration-300 rounded-full`}
                      style={{ width: passwordStrength.width }}
                    />
                  </div>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    <li className={registerPassword.length >= 8 ? "text-green-600" : ""}>
                      • Mindestens 8 Zeichen
                    </li>
                    <li className={/[A-Z]/.test(registerPassword) ? "text-green-600" : ""}>
                      • Mindestens ein Großbuchstabe
                    </li>
                    <li className={/[a-z]/.test(registerPassword) ? "text-green-600" : ""}>
                      • Mindestens ein Kleinbuchstabe
                    </li>
                    <li className={/[0-9]/.test(registerPassword) ? "text-green-600" : ""}>
                      • Mindestens eine Zahl
                    </li>
                    <li className={/[^A-Za-z0-9]/.test(registerPassword) ? "text-green-600" : ""}>
                      • Mindestens ein Sonderzeichen
                    </li>
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                Passwort bestätigen <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Passwort wiederholen"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className={`pr-10 ${
                    confirmPassword && !passwordsMatch ? "border-red-500 focus-visible:ring-red-500" : ""
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground active:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-red-500">Passwörter stimmen nicht überein</p>
              )}
              {passwordsMatch && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Passwörter stimmen überein
                </p>
              )}
            </div>
          </div>
        </form>
      )}

      {/* Bereits eingeloggt - Info */}
      {isAuthenticated && (
        <div className="border-t pt-6">
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Sie sind bereits angemeldet
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                Ihr Inserat wird automatisch mit Ihrem Konto verknüpft.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Marketingphasen-Consent (Pflicht für auction + instant_price)
          --------------------------------------------------------------
          Juristische Grundlage: § 305c BGB („überraschende Klauseln")
          verlangt für die automatische Preisanpassung eine besondere
          Bestätigung – ein bloßer AGB-Hinweistext reicht NICHT aus,
          sonst wird die Klausel nicht Vertragsbestandteil.

          Der Mikro-Text nennt daher (a) die Klausel namentlich
          ("automatisch sinken") und (b) verweist auf die in AGB §6
          konkret festgelegte Untergrenze (Mindestpreis-Floor =
          seller_initial × (1 - MAX_TOTAL_REDUCTION), siehe
          src/lib/marketing-config.ts). Keine Prozent-Zahl im Wizard,
          da diese je nach Kanal (Auktion: -6 %, Festpreis: -10 %)
          differiert und Conversion senkt.

          KEINE falschen Garantien formulieren ("nie unter Wunschpreis"
          o.ä.) – der Wunschpreis IST die Obergrenze, NICHT der
          Mindestpreis. § 5 UWG. */}
      {(formData.saleChannel === "auction" || formData.saleChannel === "instant_price") && (
        <div
          data-marketing-consent
          className={cn(
            "flex items-start gap-3 rounded-lg border-2 p-3 sm:p-4 transition-colors",
            fieldErrors.marketingConsent
              ? "border-red-500 bg-red-50/60 dark:bg-red-950/10 ring-2 ring-red-500/20"
              : formData.marketingConsent
                ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/10"
                : "border-primary/20 bg-primary/5",
          )}
        >
          <Megaphone
            className={cn(
              "w-5 h-5 mt-0.5 flex-shrink-0 transition-colors",
              fieldErrors.marketingConsent
                ? "text-red-500"
                : formData.marketingConsent
                  ? "text-green-600"
                  : "text-primary",
            )}
            aria-hidden="true"
          />
          <div className="flex-1 space-y-1.5">
            <div className="flex items-start gap-2.5">
              <Checkbox
                id="marketingConsent"
                checked={formData.marketingConsent}
                onCheckedChange={(v) => updateFormData({ marketingConsent: v === true })}
                className="mt-0.5 flex-shrink-0"
                aria-describedby={fieldErrors.marketingConsent ? "marketingConsent-error" : "marketingConsent-desc"}
                aria-invalid={!!fieldErrors.marketingConsent}
              />
              <Label htmlFor="marketingConsent" className="text-sm font-medium cursor-pointer leading-snug">
                Ich akzeptiere die Marketingphase gemäß{" "}
                <a href="/agb" target="_blank" rel="noopener" className="text-primary hover:underline">
                  AGB §6
                </a>{" "}
                <span className="text-red-500">*</span>
              </Label>
            </div>
            <p id="marketingConsent-desc" className="text-xs text-muted-foreground leading-snug pl-6">
              Ich verstehe, dass der Wunschpreis im Rahmen der Marketingphase
              automatisch sinken kann — begrenzt auf den in AGB §6 festgelegten Mindestpreis.
            </p>
            {fieldErrors.marketingConsent && (
              <p id="marketingConsent-error" className="text-xs text-red-600 font-medium animate-fade-in pl-6" role="alert">
                {fieldErrors.marketingConsent}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Datenschutz-Hinweis */}
      <div className="bg-muted/50 rounded-lg p-3 sm:p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Mit dem Absenden stimmen Sie unseren{" "}
          <a href="/datenschutz" className="text-primary hover:underline" target="_blank" rel="noopener">
            Datenschutzbestimmungen
          </a>{" "}
          und{" "}
          <a href="/agb" className="text-primary hover:underline" target="_blank" rel="noopener">
            AGB
          </a>{" "}
          zu. Ihre Daten werden verschlüsselt übertragen und nicht an Dritte weitergegeben.
        </p>
      </div>
    </div>
  );
};

export type { AccountLocationStepProps };
