/**
 * SendOwnerEmailDialog
 * Admin-Dialog zum Versenden individueller E-Mails an Wohnmobil-Besitzer
 * Nutzt die bestehende send-admin-email Edge Function mit CaravanWert-Branding
 */

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth, SessionExpiredError } from "@/lib/sessionGuard";
import { toast } from "sonner";
import {
  Mail,
  Send,
  FileText,
  Phone,
  Camera,
  ClipboardList,
  Info,
  MessageSquare,
  CheckCircle2,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface SellerInfo {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
}

interface MotorhomeInfo {
  id: string;
  manufacturer: string;
  model: string;
  year: number;
  listing_number?: string | null;
}

interface SendOwnerEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seller: SellerInfo;
  motorhome: MotorhomeInfo;
}

interface EmailTemplate {
  id: string;
  label: string;
  icon: React.ReactNode;
  subject: string;
  body: string;
  color: string;
}

export function SendOwnerEmailDialog({
  open,
  onOpenChange,
  seller,
  motorhome,
}: SendOwnerEmailDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const sellerName = [seller.first_name, seller.last_name].filter(Boolean).join(" ") || "Kunde";
  const vehicleLabel = `${motorhome.manufacturer} ${motorhome.model} (${motorhome.year})`;

  // E-Mail-Vorlagen
  const templates: EmailTemplate[] = [
    {
      id: "callback",
      label: "Bitte um Rückruf",
      icon: <Phone className="w-4 h-4" />,
      color: "bg-blue-50 border-blue-200 hover:bg-blue-100",
      subject: `Rückruf erbeten – ${vehicleLabel}`,
      body: `wir bearbeiten gerade Ihr Inserat für Ihr Fahrzeug ${vehicleLabel} und hätten noch einige Fragen.\n\nKönnten Sie uns bitte unter der Nummer +49 511 51532476 zurückrufen? Alternativ können Sie uns auch eine bevorzugte Uhrzeit für einen Rückruf mitteilen.\n\nWir freuen uns auf Ihre Rückmeldung.`,
    },
    {
      id: "photos",
      label: "Fotos hochladen",
      icon: <Camera className="w-4 h-4" />,
      color: "bg-amber-50 border-amber-200 hover:bg-amber-100",
      subject: `Fotos benötigt – ${vehicleLabel}`,
      body: `um Ihr Fahrzeug ${vehicleLabel} optimal an Händler vermitteln zu können, benötigen wir aussagekräftige Fotos.\n\nBitte laden Sie mindestens 5 Fotos hoch:\n• Außenansicht (Front, Seite, Heck)\n• Innenraum (Wohnbereich, Küche, Bad)\n• Cockpit und Armaturenbrett\n• Eventuelle Schäden oder Gebrauchsspuren\n\nSo geht's: Loggen Sie sich in Ihr Dashboard ein und klicken Sie auf „Fotos hochladen".\n\nInserate mit Fotos erhalten durchschnittlich 3x mehr Anfragen von Händlern.`,
    },
    {
      id: "documents",
      label: "Fehlende Unterlagen",
      icon: <ClipboardList className="w-4 h-4" />,
      color: "bg-purple-50 border-purple-200 hover:bg-purple-100",
      subject: `Unterlagen benötigt – ${vehicleLabel}`,
      body: `für die weitere Bearbeitung Ihres Inserats (${vehicleLabel}) benötigen wir noch folgende Unterlagen:\n\n• Fahrzeugschein (Zulassungsbescheinigung Teil I)\n• Letzte HU/AU-Bescheinigung\n• Serviceheft / Wartungsnachweise\n\nBitte senden Sie die Dokumente als Scan oder Foto an diese E-Mail-Adresse oder laden Sie sie in Ihrem Dashboard hoch.\n\nMit vollständigen Unterlagen können wir Ihnen ein deutlich besseres Ergebnis erzielen.`,
    },
    {
      id: "status",
      label: "Status-Update",
      icon: <Info className="w-4 h-4" />,
      color: "bg-green-50 border-green-200 hover:bg-green-100",
      subject: `Neues zu Ihrem Inserat – ${vehicleLabel}`,
      body: `wir möchten Sie über den aktuellen Stand Ihres Inserats (${vehicleLabel}) informieren.\n\n[Bitte ergänzen Sie hier Ihr Status-Update]\n\nBei Fragen stehen wir Ihnen jederzeit zur Verfügung.`,
    },
  ];

  const handleSelectTemplate = (templateId: string) => {
    if (selectedTemplate === templateId) {
      // Deselect
      setSelectedTemplate(null);
      setSubject("");
      setMessage("");
      return;
    }

    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setSelectedTemplate(templateId);
      setSubject(template.subject);
      setMessage(template.body);
    }
  };

  const handleSelectCustom = () => {
    setSelectedTemplate("custom");
    setSubject(`Nachricht zu Ihrem Fahrzeug – ${vehicleLabel}`);
    setMessage("");
  };

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Bitte Betreff und Nachricht ausfüllen");
      return;
    }

    if (!seller.email) {
      toast.error("Keine E-Mail-Adresse für den Verkäufer vorhanden");
      return;
    }

    setIsSending(true);

    try {
      // Nachricht in HTML umwandeln (Zeilenumbrüche → <br>, Aufzählungen → HTML)
      const htmlBody = message
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (trimmed.startsWith("•") || trimmed.startsWith("-")) {
            return `<p style="margin: 4px 0 4px 16px; color: #374151; font-size: 15px; line-height: 1.7;">&#8226; ${trimmed.replace(/^[•\-]\s*/, "")}</p>`;
          }
          if (trimmed === "") {
            return `<br/>`;
          }
          return `<p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 8px 0;">${trimmed}</p>`;
        })
        .join("\n");

      const { data, error } = await invokeWithAuth("send-admin-email", {
        body: {
          to: seller.email,
          subject: subject,
          body_html: htmlBody,
          recipient_name: sellerName,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setIsSent(true);
      toast.success(`E-Mail an ${sellerName} gesendet`);

      // Nach 2 Sekunden Dialog schließen und zurücksetzen
      setTimeout(() => {
        onOpenChange(false);
        // Reset nach dem Schließen
        setTimeout(() => {
          setIsSent(false);
          setSelectedTemplate(null);
          setSubject("");
          setMessage("");
        }, 300);
      }, 2000);
    } catch (err: any) {
      console.error("E-Mail senden fehlgeschlagen:", err);
      toast.error(`Fehler beim Senden: ${err.message || "Unbekannter Fehler"}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!isSending) {
      onOpenChange(open);
      if (!open) {
        // Reset nach dem Schließen
        setTimeout(() => {
          setIsSent(false);
          setSelectedTemplate(null);
          setSubject("");
          setMessage("");
        }, 300);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            E-Mail an Fahrzeugbesitzer
          </DialogTitle>
          <DialogDescription>
            Senden Sie eine E-Mail im CaravanWert-Design an{" "}
            <span className="font-semibold text-foreground">{sellerName}</span>
            {seller.email && (
              <span className="text-muted-foreground"> ({seller.email})</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Erfolgs-Ansicht */}
        {isSent ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-green-700">E-Mail erfolgreich gesendet!</h3>
            <p className="text-sm text-muted-foreground text-center">
              Die E-Mail wurde an <span className="font-medium">{seller.email}</span> gesendet
              <br />
              im professionellen CaravanWert-Layout.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Fahrzeug-Info-Badge */}
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Fahrzeug:</span>
              <Badge variant="secondary" className="font-medium">
                {vehicleLabel}
              </Badge>
              {motorhome.listing_number && (
                <Badge variant="outline" className="text-xs">
                  {motorhome.listing_number}
                </Badge>
              )}
            </div>

            {/* Vorlagen-Auswahl */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Vorlage wählen</Label>
              <div className="grid grid-cols-2 gap-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleSelectTemplate(template.id)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-left text-sm transition-all ${
                      selectedTemplate === template.id
                        ? "ring-2 ring-primary border-primary bg-primary/5 font-medium"
                        : template.color
                    }`}
                  >
                    {template.icon}
                    <span>{template.label}</span>
                  </button>
                ))}
              </div>
              {/* Individuelle Nachricht */}
              <button
                onClick={handleSelectCustom}
                className={`flex items-center gap-2 p-3 rounded-lg border text-left text-sm w-full transition-all ${
                  selectedTemplate === "custom"
                    ? "ring-2 ring-primary border-primary bg-primary/5 font-medium"
                    : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Individuelle Nachricht</span>
              </button>
            </div>

            {/* Formular - nur sichtbar wenn Vorlage gewählt */}
            {selectedTemplate && (
              <>
                <Separator />

                {/* Betreff */}
                <div className="space-y-2">
                  <Label htmlFor="email-subject" className="text-sm font-semibold">
                    Betreff
                  </Label>
                  <Input
                    id="email-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="E-Mail-Betreff eingeben..."
                    className="font-medium"
                  />
                </div>

                {/* Nachricht */}
                <div className="space-y-2">
                  <Label htmlFor="email-message" className="text-sm font-semibold">
                    Nachricht
                  </Label>
                  <div className="text-xs text-muted-foreground mb-1">
                    Die Anrede "Guten Tag, {sellerName}" und die Signatur "Ihr CaravanWert Team" werden automatisch ergänzt.
                  </div>
                  <Textarea
                    id="email-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ihre Nachricht an den Fahrzeugbesitzer..."
                    rows={10}
                    className="resize-y font-normal leading-relaxed"
                  />
                </div>

                {/* Info-Hinweis */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                  <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <span className="text-blue-700">
                    Die E-Mail wird im professionellen CaravanWert-Layout versendet, mit Logo, Branding und Footer.
                  </span>
                </div>

                {/* Aktions-Buttons */}
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => handleClose(false)}
                    disabled={isSending}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={isSending || !subject.trim() || !message.trim()}
                    className="min-w-[160px]"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Wird gesendet...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        E-Mail senden
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
