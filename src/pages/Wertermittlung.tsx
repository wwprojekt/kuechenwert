import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import PageLayout from "@/components/PageLayout";
import { generateServiceSchema, generateBreadcrumbSchema, getBreadcrumbsFromPath } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2,
  Euro,
  Clock,
  Shield,
  Phone,
  Mail,
  ArrowRight,
  Calculator,
  Users,
  Award,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useSettings } from "@/contexts/SettingsContext";
import { z } from "zod";
import { handleValidationError, handleApiError } from "@/lib/errorLogService";
import { trackWertermittlungLead, setEnhancedConversionFromForm, generateTransactionId } from "@/lib/gadsConversionService";
import { getTrackingData } from "@/lib/clickIdService";
import { trackMetaLead } from "@/lib/metaPixelService";
import { useTurnstile } from "@/hooks/useTurnstile";
import { HoneypotField, useHoneypot } from "@/components/ui/HoneypotField";

const wertermittlungSchema = z.object({
  name: z.string().trim().min(2, "Bitte geben Sie Ihren Namen ein"),
  email: z.string().trim().email("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
  phone: z.string().optional(),
});

const CONDITIONS = [
  { value: "new", label: "Neu / Wie neu" },
  { value: "excellent", label: "Ausgezeichnet" },
  { value: "good", label: "Gut" },
  { value: "fair", label: "Befriedigend" },
  { value: "poor", label: "Renovierungsbedürftig" },
];

const Wertermittlung = () => {
  const { toast } = useToast();
  const { settings } = useSettings();
  const siteName = settings?.site_name || 'CaravanWert';
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    manufacturer: "",
    model: "",
    year: "",
    mileage: "",
    condition: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const { turnstileToken, turnstileReady, resetTurnstile, turnstileCallbackRef } = useTurnstile();
  const [honeypotValue, setHoneypotValue, isHoneypotBot] = useHoneypot();

  const submitMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Bot-Check: Honeypot ausgefüllt → still abbrechen (Bot merkt nichts)
      if (isHoneypotBot) {
        return; // Fake-Erfolg
      }

      const { error } = await supabase.from("value_assessment_leads").insert({
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        manufacturer: data.manufacturer || null,
        model: data.model || null,
        year: data.year ? parseInt(data.year, 10) : null,
        mileage: data.mileage ? parseInt(data.mileage, 10) : null,
        condition: data.condition || null,
        message: data.message || null,
        source: "wertermittlung",
        vehicle_type: "Wohnmobil",
      } as any);

      if (error) throw error;

      // Trigger notification Edge Function
      try {
        const trackingData = getTrackingData();
        // Transaction ID für Deduplizierung über alle 3 Tracking-Schichten
        const transactionId = generateTransactionId('wertermittlung');
        (window as any).__lastTransactionId = transactionId;
        await supabase.functions.invoke("send-lead-notification", {
          body: {
            type: "wertermittlung",
            name: data.name,
            email: data.email,
            phone: data.phone,
            manufacturer: data.manufacturer,
            model: data.model,
            gclid: trackingData.gclid,
            gbraid: trackingData.gbraid,
            wbraid: trackingData.wbraid,
            ga4ClientId: trackingData.ga4ClientId,
            transactionId,
            turnstileToken,
            honeypot: honeypotValue,
          },
        });
      } catch {
        // Don't fail if notification fails
      }
    },
    onSuccess: async () => {
      resetTurnstile();
      setSubmitted(true);

      // Google Ads: Enhanced Conversions + Wertermittlung Lead (Primäre Conversion)
      await setEnhancedConversionFromForm({ email: formData.email, name: formData.name, phone: formData.phone });
      const txId = (window as any).__lastTransactionId || generateTransactionId('wertermittlung');
      await trackWertermittlungLead(
        `${formData.manufacturer} ${formData.model} ${formData.year}`, txId
      );

      // Meta Pixel: Lead Event
      trackMetaLead({ content_name: `${formData.manufacturer} ${formData.model}`, content_category: 'Wertermittlung' });

      toast({
        title: "Anfrage gesendet!",
        description: "Wir melden uns innerhalb von 24 Stunden bei Ihnen.",
      });
    },
    onError: (error: unknown) => {
      const germanMessage = handleApiError(error, 'Wertermittlung');
      toast({
        title: "Fehler beim Senden",
        description: germanMessage,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      wertermittlungSchema.parse({ name: formData.name, email: formData.email, phone: formData.phone });
      submitMutation.mutate(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const germanMessage = handleValidationError(error, 'Wertermittlung');
        toast({
          title: "Bitte prüfen Sie Ihre Eingaben",
          description: germanMessage,
          variant: "destructive",
        });
      }
    }
  };

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <PageLayout
      breadcrumbs={true}
      title="Wohnmobil bewerten lassen – Kostenlos in 24h"
      description="Lassen Sie Ihr Wohnmobil kostenlos und unverbindlich von unseren Experten bewerten. Erhalten Sie eine professionelle Einschätzung des Marktwerts."
      keywords="wohnmobil wertermittlung, wohnmobil bewertung, camper wert, reisemobil wert"
      canonicalPath="/wertermittlung"
      structuredData={[generateServiceSchema("Kostenlose Wohnmobil-Wertermittlung", "Professionelle Bewertung Ihres Wohnmobils durch Experten. Kostenlos und unverbindlich."), generateBreadcrumbSchema(getBreadcrumbsFromPath("/wertermittlung"))]}
    >
      <PageHero>
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
            Kostenlose Wohnmobil-Wertermittlung
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8">
            Erfahren Sie den aktuellen Marktwert Ihres Wohnmobils - 
            kostenlos, unverbindlich und von Experten bewertet.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span>100% kostenlos</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span>Unverbindlich</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span>Experteneinschätzung</span>
            </div>
          </div>
        </div>
      </PageHero>

      <div className="container py-16">
        <div className="grid lg:grid-cols-2 gap-12">
          {/* Form Section */}
          <div>
            <Card className="p-8">
              {submitted ? (
                <div className="text-center py-8">
                  <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold mb-4">Vielen Dank!</h2>
                  <p className="text-muted-foreground mb-6">
                    Ihre Anfrage wurde erfolgreich übermittelt. Unser Experten-Team 
                    wird sich innerhalb von 24 Stunden bei Ihnen melden.
                  </p>
                  <div className="space-y-4">
                    <Link to="/wertrechner">
                      <Button variant="outline" className="w-full">
                        <Calculator className="w-4 h-4 mr-2" />
                        Sofort-Schätzung mit Wertrechner
                      </Button>
                    </Link>
                    <Link to="/verkaufen">
                      <Button className="w-full gradient-hero">
                        Wohnmobil verkaufen
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold mb-6">
                    Bewertung anfordern
                  </h2>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Contact Info */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">Ihre Kontaktdaten</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Name *</Label>
                          <Input
                            id="name"
                            placeholder="Max Mustermann"
                            value={formData.name}
                            onChange={(e) => updateField("name", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">E-Mail *</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="max@beispiel.de"
                            value={formData.email}
                            onChange={(e) => updateField("email", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefon (optional)</Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+49 123 456789"
                          value={formData.phone}
                          onChange={(e) => updateField("phone", e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Vehicle Info */}
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">Fahrzeugdaten</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="manufacturer">Hersteller</Label>
                          <Input
                            id="manufacturer"
                            placeholder="z.B. Hymer, Dethleffs"
                            value={formData.manufacturer}
                            onChange={(e) => updateField("manufacturer", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="model">Modell</Label>
                          <Input
                            id="model"
                            placeholder="z.B. B-Klasse, Globebus"
                            value={formData.model}
                            onChange={(e) => updateField("model", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="year">Baujahr</Label>
                          <Input
                            id="year"
                            type="number"
                            placeholder="2020"
                            min={1980}
                            max={new Date().getFullYear()}
                            value={formData.year}
                            onChange={(e) => updateField("year", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mileage">Kilometerstand</Label>
                          <Input
                            id="mileage"
                            type="number"
                            placeholder="50000"
                            value={formData.mileage}
                            onChange={(e) => updateField("mileage", e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Zustand</Label>
                          <Select
                            value={formData.condition}
                            onValueChange={(value) => updateField("condition", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Zustand wählen" />
                            </SelectTrigger>
                            <SelectContent>
                              {CONDITIONS.map((c) => (
                                <SelectItem key={c.value} value={c.value}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Message */}
                    <div className="space-y-2">
                      <Label htmlFor="message">Zusätzliche Informationen (optional)</Label>
                      <Textarea
                        id="message"
                        placeholder="Besonderheiten, Ausstattung, bekannte Mängel..."
                        rows={4}
                        value={formData.message}
                        onChange={(e) => updateField("message", e.target.value)}
                      />
                    </div>

                    <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
                    <div ref={turnstileCallbackRef} />
                    <Button
                      type="submit"
                      className="w-full h-12 text-base gradient-hero hover:gradient-hero-hover"
                      disabled={submitMutation.isPending}
                    >
                      {submitMutation.isPending ? "Wird gesendet..." : "Kostenlose Bewertung anfordern"}
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      Mit dem Absenden stimmen Sie unserer{" "}
                      <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Datenschutzerklärung
                      </a>{" "}
                      zu.
                    </p>
                  </form>
                </>
              )}
            </Card>
          </div>

          {/* Benefits Section */}
          <div className="space-y-8">
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6">
                So funktioniert die Wertermittlung
              </h2>
              <div className="space-y-6">
                {[
                  {
                    step: "1",
                    title: "Daten eingeben",
                    description: "Füllen Sie das Formular mit den Basisdaten Ihres Wohnmobils aus.",
                    icon: Calculator,
                  },
                  {
                    step: "2",
                    title: "Experten-Analyse",
                    description: "Unsere Experten analysieren den aktuellen Markt und vergleichbare Fahrzeuge.",
                    icon: Users,
                  },
                  {
                    step: "3",
                    title: "Bewertung erhalten",
                    description: "Sie erhalten eine detaillierte Einschätzung des Marktwerts innerhalb von 24 Stunden.",
                    icon: Euro,
                  },
                ].map((item, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">{item.title}</h3>
                      <p className="text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust Signals */}
            <Card className="p-6 bg-muted/50">
              <h3 className="font-semibold mb-4">Ihre Vorteile</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: Euro, text: "100% kostenlos" },
                  { icon: Clock, text: "Antwort in 24h" },
                  { icon: Shield, text: "Unverbindlich" },
                  { icon: Award, text: "Expertenteam" },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <item.icon className="w-5 h-5 text-primary" />
                    <span className="text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Contact Alternative */}
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Lieber telefonisch?</h3>
              <p className="text-muted-foreground mb-4">
                Rufen Sie uns an - wir beraten Sie gerne persönlich.
              </p>
              <div className="space-y-2">
                {settings?.support_phone && (
                  <a
                    href={`tel:${settings.support_phone.replace(/\s/g, '')}`}
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Phone className="w-4 h-4" />
                    {settings.support_phone}
                  </a>
                )}
                {settings?.contact_email && (
                  <a
                    href={`mailto:${settings.contact_email}`}
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <Mail className="w-4 h-4" />
                    {settings.contact_email}
                  </a>
                )}
              </div>
            </Card>

            {/* CTA to Wertrechner */}
            <Card className="p-6 border-primary/20 bg-primary/5">
              <h3 className="font-semibold mb-2">Sofort-Schätzung gewünscht?</h3>
              <p className="text-muted-foreground mb-4">
                Mit unserem Wertrechner erhalten Sie sofort eine erste Einschätzung.
              </p>
              <Link to="/wertrechner">
                <Button variant="outline" className="w-full">
                  <Calculator className="w-4 h-4 mr-2" />
                  Zum Wertrechner
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="bg-muted/30 py-16">
        <div className="container max-w-4xl">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-center mb-12">
            Häufige Fragen
          </h2>
          <div className="space-y-6">
            {[
              {
                q: "Ist die Wertermittlung wirklich kostenlos?",
                a: "Ja, unsere Wertermittlung ist zu 100% kostenlos und unverbindlich. Die Bewertung selbst ist ohne jede Verpflichtung. Erst wenn Sie sich für eine Auktion entscheiden und das Mindestgebot erreicht wird, ist der Verkauf für beide Seiten verbindlich.",
              },
              {
                q: "Wie genau ist die Bewertung?",
                a: "Unsere Experten analysieren aktuelle Marktdaten und vergleichbare Verkäufe, um Ihnen eine realistische Einschätzung zu geben. Die finale Bewertung kann je nach individuellem Zustand variieren.",
              },
              {
                q: "Was passiert mit meinen Daten?",
                a: "Ihre Daten werden ausschließlich für die Wertermittlung verwendet und gemäß unserer Datenschutzerklärung behandelt. Wir geben keine Daten an Dritte weiter.",
              },
              {
                q: "Wie schnell erhalte ich die Bewertung?",
                a: "In der Regel melden wir uns innerhalb von 24 Stunden mit einer ersten Einschätzung bei Ihnen.",
              },
            ].map((item, idx) => (
              <div key={idx} className="bg-background rounded-lg p-6">
                <h3 className="font-semibold mb-2">{item.q}</h3>
                <p className="text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default Wertermittlung;
