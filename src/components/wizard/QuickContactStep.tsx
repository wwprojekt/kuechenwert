/**
 * QuickContactStep - Step 5 des Wizards
 * 
 * Erfasst Name und E-Mail-Adresse NACH den Fahrzeugdetails und der Ausstattung.
 * Der Nutzer hat bereits viel Zeit investiert (Sunk-Cost-Effekt), was die
 * Bereitschaft zur Kontaktdaten-Eingabe deutlich erhöht.
 * 
 * Für registrierte Nutzer: Zeigt vorausgefüllte Profildaten zur Bestätigung.
 * Für anonyme Nutzer: "Fortschritt speichern" als Motivation zur Dateneingabe.
 */

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Mail, User, Shield, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickContactStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  isAuthenticated?: boolean;
  fieldErrors?: Record<string, string>;
}

export const QuickContactStep = ({ formData, updateFormData, isAuthenticated = false, fieldErrors = {} }: QuickContactStepProps) => {
  // Prüfen ob Felder bereits vorausgefüllt sind (z.B. aus Profil)
  const hasPrefilled = !!(formData.customerName && formData.customerEmail);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header mit Motivation */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
          {isAuthenticated && hasPrefilled ? (
            <CheckCircle2 className="w-7 h-7 text-primary" />
          ) : (
            <Mail className="w-7 h-7 text-primary" />
          )}
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">
          {isAuthenticated && hasPrefilled ? "Kontaktdaten bestätigen" : "Ihre Kontaktdaten"}
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          {isAuthenticated && hasPrefilled
            ? "Ihre Daten wurden aus Ihrem Profil übernommen. Bitte prüfen Sie die Angaben und passen Sie diese bei Bedarf an."
            : "Damit wir Ihnen eine kostenlose Bewertung zusenden können, benötigen wir Ihren Namen und Ihre E-Mail-Adresse."
          }
        </p>
      </div>

      {/* Hinweis für eingeloggte Nutzer mit vorausgefüllten Daten */}
      {isAuthenticated && hasPrefilled && (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-green-800 dark:text-green-200">
              Aus Ihrem Profil übernommen
            </span>
          </div>
          <p className="text-xs text-green-700 dark:text-green-300 mt-1">
            Sie sind angemeldet. Ihre Kontaktdaten wurden automatisch eingetragen. Sie können diese hier noch ändern.
          </p>
        </div>
      )}

      {/* Zusammenfassung der bisherigen Angaben */}
      {formData.manufacturer && (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm font-semibold text-green-800 dark:text-green-200">Ihr Fahrzeug</span>
          </div>
          <p className="text-sm text-green-700 dark:text-green-300">
            {formData.manufacturer} {formData.model}
            {formData.year ? ` · ${formData.year}` : ""}
            {formData.bodyType ? ` · ${formData.bodyType}` : ""}
          </p>
        </div>
      )}

      {/* Kontaktfelder */}
      <div className="space-y-4 max-w-md mx-auto">
        <div className="space-y-2">
          <Label htmlFor="quickName" className={cn("flex items-center gap-2", fieldErrors.customerName && "text-red-600")}>
            <User className="w-4 h-4 text-muted-foreground" />
            Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="quickName"
            type="text"
            placeholder="Vor- und Nachname"
            value={formData.customerName || ""}
            onChange={(e) => updateFormData({ customerName: e.target.value })}
            className={cn("h-12 text-base", fieldErrors.customerName && "border-red-500 ring-red-500/20 ring-2")}
            autoComplete="name"
            autoFocus={!hasPrefilled}
          />
          {fieldErrors.customerName && (
            <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.customerName}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="quickEmail" className={cn("flex items-center gap-2", fieldErrors.customerEmail && "text-red-600")}>
            <Mail className="w-4 h-4 text-muted-foreground" />
            E-Mail <span className="text-red-500">*</span>
          </Label>
          <Input
            id="quickEmail"
            type="email"
            placeholder="ihre@email.de"
            value={formData.customerEmail || ""}
            onChange={(e) => updateFormData({ customerEmail: e.target.value })}
            className={cn("h-12 text-base", fieldErrors.customerEmail && "border-red-500 ring-red-500/20 ring-2")}
            autoComplete="email"
          />
          {fieldErrors.customerEmail && (
            <p className="text-sm text-red-600 animate-fade-in">{fieldErrors.customerEmail}</p>
          )}
        </div>
      </div>

      {/* Trust-Elemente */}
      <div className="flex flex-col items-center gap-3 pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="w-3.5 h-3.5 text-green-500" />
          <span>Ihre Daten werden verschlüsselt übertragen und nicht an Dritte weitergegeben.</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">✓ 100% kostenlos</span>
          <span className="flex items-center gap-1">✓ Bewertung unverbindlich</span>
          <span className="flex items-center gap-1">✓ Kein Spam</span>
        </div>
      </div>
    </div>
  );
};
