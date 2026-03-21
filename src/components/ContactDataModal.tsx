/**
 * ContactDataModal - Erfasst Kontaktdaten bevor der Nutzer zum Wizard weitergeleitet wird.
 * Speichert die Daten sofort als Lead und übergibt sie als URL-Parameter an den Wizard.
 * Im letzten Wizard-Schritt (Registrierung) werden die Daten automatisch vorausgefüllt.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Phone, ArrowRight, Shield } from "lucide-react";
import { captureOrUpdateLead } from "@/lib/leadTrackingService";

interface ContactDataModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Zusätzliche URL-Parameter die an den Wizard übergeben werden (z.B. station=...) */
  additionalParams?: Record<string, string>;
  /** Quelle/Landing Page von der der Nutzer kommt */
  source?: string;
}

export const ContactDataModal = ({
  open,
  onOpenChange,
  additionalParams = {},
  source = "verkaufen",
}: ContactDataModalProps) => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      newErrors.name = "Bitte geben Sie Ihren Namen ein";
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      newErrors.email = "Bitte geben Sie Ihre E-Mail-Adresse ein";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = "Bitte geben Sie eine gültige E-Mail-Adresse ein";
    }

    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      newErrors.phone = "Bitte geben Sie Ihre Telefonnummer ein";
    } else if (trimmedPhone.replace(/[\s\-\(\)\/\+]/g, "").length < 6) {
      newErrors.phone = "Bitte geben Sie eine gültige Telefonnummer ein";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    try {
      // Lead sofort in Supabase speichern
      await captureOrUpdateLead({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        source: `${source}_contact_modal`,
        pageUrl: window.location.pathname,
      });
    } catch (err) {
      // Fehler beim Speichern soll den Nutzer nicht blockieren
      console.error("Lead-Speicherung fehlgeschlagen:", err);
    }

    // URL-Parameter für den Wizard zusammenbauen
    const params = new URLSearchParams();
    params.set("customerName", name.trim());
    params.set("customerEmail", email.trim());
    params.set("customerPhone", phone.trim());

    // Zusätzliche Parameter (z.B. station, manufacturer, model) hinzufügen
    Object.entries(additionalParams).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    setIsSubmitting(false);
    onOpenChange(false);

    // Zum Wizard navigieren mit allen Parametern
    navigate(`/verkaufen/wizard?${params.toString()}`);
  };

  const handleClose = () => {
    // Wenn der Nutzer das Modal schließt, Felder zurücksetzen
    setErrors({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2">
            <User className="w-6 h-6 text-primary" />
            Ihre Kontaktdaten
          </DialogTitle>
          <DialogDescription className="text-base">
            Damit wir Sie bei Fragen zu Ihrem Wohnmobil erreichen können, benötigen wir kurz Ihre Kontaktdaten.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="contact-name" className="text-sm font-medium">
              Name *
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="contact-name"
                type="text"
                placeholder="Max Mustermann"
                className={`pl-10 ${errors.name ? "border-destructive" : ""}`}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors((prev) => ({ ...prev, name: "" }));
                }}
                autoFocus
              />
            </div>
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* E-Mail */}
          <div className="space-y-2">
            <Label htmlFor="contact-email" className="text-sm font-medium">
              E-Mail-Adresse *
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="contact-email"
                type="email"
                placeholder="ihre@email.de"
                className={`pl-10 ${errors.email ? "border-destructive" : ""}`}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                }}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          {/* Telefon */}
          <div className="space-y-2">
            <Label htmlFor="contact-phone" className="text-sm font-medium">
              Telefonnummer *
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="contact-phone"
                type="tel"
                placeholder="+49 123 456789"
                className={`pl-10 ${errors.phone ? "border-destructive" : ""}`}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors((prev) => ({ ...prev, phone: "" }));
                }}
              />
            </div>
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone}</p>
            )}
          </div>

          {/* Datenschutz-Hinweis */}
          <div className="flex items-start gap-2 bg-primary/5 rounded-lg p-3 border border-primary/10">
            <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Ihre Daten werden vertraulich behandelt und ausschließlich für die Bearbeitung Ihrer Anfrage verwendet. 
              Sie werden bei der Registrierung automatisch übernommen.
            </p>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            size="lg"
            className="w-full gradient-hero hover:gradient-hero-hover shadow-lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              "Wird gespeichert..."
            ) : (
              <>
                Weiter zum Fahrzeug-Wizard
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
