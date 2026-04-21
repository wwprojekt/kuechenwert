import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { User, Mail, Phone, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickContactStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  isAuthenticated: boolean;
  fieldErrors?: Record<string, string>;
}

export const QuickContactStep = ({
  formData,
  updateFormData,
  isAuthenticated,
  fieldErrors = {},
}: QuickContactStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">Kontaktdaten</h2>
        <p className="text-sm text-muted-foreground">
          {isAuthenticated
            ? "Bitte überprüfen Sie Ihre Kontaktdaten."
            : "Damit wir Sie über den Fortschritt Ihres Inserats informieren können."}
        </p>
      </div>

      <div className="space-y-4 max-w-md mx-auto">
        <div className="space-y-2">
          <Label htmlFor="customerName" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="customerName"
            name="name"
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            placeholder="Max Mustermann"
            value={formData.customerName || ""}
            onChange={(e) => updateFormData({ customerName: e.target.value })}
            className={cn(fieldErrors.customerName && "border-destructive")}
            aria-invalid={!!fieldErrors.customerName}
            aria-describedby={fieldErrors.customerName ? "customerName-error" : undefined}
          />
          {fieldErrors.customerName && (
            <p id="customerName-error" className="text-xs text-destructive" role="alert">
              {fieldErrors.customerName}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="customerEmail" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            E-Mail-Adresse <span className="text-destructive">*</span>
          </Label>
          <Input
            id="customerEmail"
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="email"
            placeholder="max@beispiel.de"
            value={formData.customerEmail || ""}
            onChange={(e) => updateFormData({ customerEmail: e.target.value })}
            className={cn(fieldErrors.customerEmail && "border-destructive")}
            aria-invalid={!!fieldErrors.customerEmail}
            aria-describedby={fieldErrors.customerEmail ? "customerEmail-error" : undefined}
          />
          {fieldErrors.customerEmail && (
            <p id="customerEmail-error" className="text-xs text-destructive" role="alert">
              {fieldErrors.customerEmail}
            </p>
          )}
        </div>

        {/* Telefon optional – Lead-Recovery für Step 6/7-Abbrecher.
            Pflicht-Validierung erst in Step 7 (SaleChannelStep). */}
        <div className="space-y-2">
          <Label htmlFor="customerPhoneEarly" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Telefon
            <span className="text-xs text-muted-foreground font-normal ml-1">
              (optional)
            </span>
          </Label>
          <Input
            id="customerPhoneEarly"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+49 123 456789"
            value={formData.customerPhone || ""}
            onChange={(e) => updateFormData({ customerPhone: e.target.value })}
            className={cn(fieldErrors.customerPhone && "border-destructive")}
            aria-invalid={!!fieldErrors.customerPhone}
            aria-describedby={fieldErrors.customerPhone ? "customerPhone-early-error" : undefined}
          />
          {fieldErrors.customerPhone && (
            <p id="customerPhone-early-error" className="text-xs text-destructive" role="alert">
              {fieldErrors.customerPhone}
            </p>
          )}
          <p className="text-xs text-muted-foreground leading-snug">
            Sichern Sie sich schnellere Rückfragen vom Sales-Team und ein
            persönliches Angebot. Wird nicht öffentlich angezeigt.
          </p>
        </div>

        {isAuthenticated && formData.customerName && formData.customerEmail && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-300">
              Kontaktdaten vollständig
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
