/**
 * QuickContactStep - Step 3 des Wizards (NEU)
 * 
 * Erfasst Name und E-Mail-Adresse FRÜH im Prozess, direkt nach den
 * Fahrzeug-Basisdaten. So wird der Lead gesichert, bevor der Nutzer
 * bei den aufwendigeren Schritten (Fotos, Ausstattung) abspringt.
 * 
 * Psychologisches Prinzip: "Wir speichern Ihren Fortschritt" gibt dem
 * Nutzer einen Grund, seine E-Mail einzugeben, ohne dass es sich wie
 * ein Verkaufsprozess anfühlt.
 */

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Mail, User, Shield, Save, CheckCircle2 } from "lucide-react";

interface QuickContactStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
}

export const QuickContactStep = ({ formData, updateFormData }: QuickContactStepProps) => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header mit Motivation */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-4">
          <Save className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">
          Fortschritt speichern
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Damit wir Ihnen ein unverbindliches Angebot zusenden können, benötigen wir Ihren Namen und Ihre E-Mail-Adresse.
        </p>
      </div>

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
          <Label htmlFor="quickName" className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="quickName"
            type="text"
            placeholder="Vor- und Nachname"
            value={formData.customerName || ""}
            onChange={(e) => updateFormData({ customerName: e.target.value })}
            className="h-12 text-base"
            autoComplete="name"
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="quickEmail" className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            E-Mail <span className="text-red-500">*</span>
          </Label>
          <Input
            id="quickEmail"
            type="email"
            placeholder="ihre@email.de"
            value={formData.customerEmail || ""}
            onChange={(e) => updateFormData({ customerEmail: e.target.value })}
            className="h-12 text-base"
            autoComplete="email"
          />
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
          <span className="flex items-center gap-1">✓ Unverbindlich</span>
          <span className="flex items-center gap-1">✓ Kein Spam</span>
        </div>
      </div>
    </div>
  );
};
