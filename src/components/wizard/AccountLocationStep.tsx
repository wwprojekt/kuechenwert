/**
 * AccountLocationStep - Step 8 des Wizards (letzter Schritt)
 * 
 * Enthält: Standort des Wohnmobils (Straße, Hausnummer, PLZ, Ort) + Konto erstellen (Passwort).
 * Beide Bereiche sind Pflicht.
 */

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MapPin, Lock, Eye, EyeOff, Shield, CheckCircle2 } from "lucide-react";
import type { WizardFormData } from "@/hooks/useWizardForm";

interface AccountLocationStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  registerPassword: string;
  setRegisterPassword: (pw: string) => void;
  confirmPassword: string;
  setConfirmPassword: (pw: string) => void;
  isAuthenticated: boolean;
}

export const AccountLocationStep = ({
  formData,
  updateFormData,
  registerPassword,
  setRegisterPassword,
  confirmPassword,
  setConfirmPassword,
  isAuthenticated,
}: AccountLocationStepProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <MapPin className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Standort & Konto
        </h2>
        <p className="text-muted-foreground">
          Letzter Schritt – geben Sie den Standort Ihres Wohnmobils an und erstellen Sie Ihr Konto
        </p>
      </div>

      {/* ===== STANDORT DES WOHNMOBILS ===== */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <h3 className="text-base font-semibold">Standort des Wohnmobils</h3>
        </div>
        <p className="text-sm text-muted-foreground -mt-2">
          Wichtig für die Entfernungsanzeige der Händler und den späteren Kaufvertrag.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="street">
              Straße <span className="text-red-500">*</span>
            </Label>
            <Input
              id="street"
              type="text"
              placeholder="Musterstraße"
              value={formData.street || ""}
              onChange={(e) => updateFormData({ street: e.target.value })}
              autoComplete="street-address"
            />
          </div>

          <div className="space-y-2 md:col-span-1">
            <Label htmlFor="houseNumber">
              Hausnummer <span className="text-red-500">*</span>
            </Label>
            <Input
              id="houseNumber"
              type="text"
              placeholder="12a"
              value={formData.houseNumber || ""}
              onChange={(e) => updateFormData({ houseNumber: e.target.value })}
            />
          </div>

          <div className="space-y-2 md:col-span-1">
            <Label htmlFor="zipCode">
              PLZ <span className="text-red-500">*</span>
            </Label>
            <Input
              id="zipCode"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{5}"
              maxLength={5}
              placeholder="12345"
              value={formData.zipCode || ""}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 5);
                updateFormData({ zipCode: val });
              }}
              autoComplete="postal-code"
            />
          </div>

          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="city">
              Ort <span className="text-red-500">*</span>
            </Label>
            <Input
              id="city"
              type="text"
              placeholder="Berlin"
              value={formData.city || ""}
              onChange={(e) => updateFormData({ city: e.target.value })}
              autoComplete="address-level2"
            />
          </div>
        </div>
      </div>

      {/* ===== KONTO ERSTELLEN (PFLICHT) ===== */}
      {!isAuthenticated && (
        <div className="space-y-4 border-t pt-6">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            <h3 className="text-base font-semibold">Konto erstellen (Pflicht)</h3>
          </div>
          <p className="text-sm text-muted-foreground -mt-2">
            Legen Sie ein Passwort fest, um Ihr Inserat zu verwalten, Gebote zu verfolgen und Nachrichten zu empfangen.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="registerPassword">
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Passwort-Stärke-Indikator */}
              {registerPassword && (
                <div className="space-y-1">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${passwordStrength.color} transition-all duration-300 rounded-full`}
                      style={{ width: passwordStrength.width }}
                    />
                  </div>
                  <p className={`text-xs ${
                    passwordStrength.label === "Stark" ? "text-green-600" :
                    passwordStrength.label === "Mittel" ? "text-yellow-600" : "text-red-600"
                  }`}>
                    Passwortstärke: {passwordStrength.label}
                  </p>
                </div>
              )}
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
        </div>
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

      {/* Datenschutz-Hinweis */}
      <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
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
