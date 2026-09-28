import PageLayout from "@/components/PageLayout";
import { generateBreadcrumbSchema, getBreadcrumbsFromPath } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MapPin, Clock, MessageSquare, Send, CheckCircle2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsContext";
import { useSupportPhone } from "@/hooks/useSupportPhone";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { handleValidationError } from "@/lib/errorLogService";
import { trackEvent } from "@/lib/analyticsService";
import { trackMetaContact } from "@/lib/metaPixelService";
import { useTurnstile } from "@/hooks/useTurnstile";
import { HoneypotField, useHoneypot } from "@/components/ui/HoneypotField";
import { BRAND } from "@/lib/brand";

const kontaktSchema = z.object({
  name: z.string().trim().min(2, "Bitte geben Sie Ihren Namen ein"),
  email: z.string().trim().email("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
  phone: z.string().trim().optional(),
  subject: z.string().trim().min(2, "Bitte geben Sie einen Betreff ein"),
  message: z.string().trim().min(10, "Die Nachricht muss mindestens 10 Zeichen lang sein"),
});

const EMPTY_FORM = { name: "", email: "", phone: "", subject: "", message: "" };
const FORM_FIELDS = ["name", "email", "phone", "subject", "message"];
const SEND_FAILED_MESSAGE = `Ihre Nachricht konnte nicht gesendet werden. Bitte versuchen Sie es später erneut oder schreiben Sie an ${BRAND.supportEmail}.`;

/**
 * Fehlertext und betroffenes Feld aus der JSON-Antwort von kw-contact ({ error, code }).
 * Bei Validierungsfehlern trägt `code` den Feldnamen (z. B. "email").
 */
async function readContactError(error: unknown): Promise<{ message: string; field?: string }> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body: unknown = await error.context.json();
      if (body && typeof body === "object") {
        const { error: message, code, field } = body as { error?: unknown; code?: unknown; field?: unknown };
        if (typeof message === "string" && message.trim()) {
          const target = typeof field === "string" ? field : code;
          return { message, field: typeof target === "string" && FORM_FIELDS.includes(target) ? target : undefined };
        }
      }
    } catch {
      // Antwort ohne JSON-Body
    }
  }
  return { message: SEND_FAILED_MESSAGE };
}

const Kontakt = () => {
  const { toast } = useToast();
  const { settings } = useSettings();
  const phone = useSupportPhone();
  const siteName = settings?.site_name || BRAND.name;
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submissionId, setSubmissionId] = useState(() => crypto.randomUUID());

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { resetTurnstile, waitForToken, turnstileCallbackRef } = useTurnstile();
  const [honeypotValue, setHoneypotValue] = useHoneypot();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const parsed = kontaktSchema.safeParse(formData);
    if (!parsed.success) {
      toast({
        title: "Bitte prüfen Sie Ihre Eingaben",
        description: handleValidationError(parsed.error, "Kontakt"),
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const turnstileToken = await waitForToken(4000);
      const { error } = await supabase.functions.invoke("kw-contact", {
        body: {
          name: parsed.data.name,
          email: parsed.data.email,
          phone: parsed.data.phone || undefined,
          subject: parsed.data.subject,
          message: parsed.data.message,
          turnstile_token: turnstileToken,
          website: honeypotValue,
          submission_id: submissionId,
        },
      });

      if (error) {
        const { message, field } = await readContactError(error);
        toast({ title: "Fehler beim Senden", description: message, variant: "destructive" });
        if (field && FORM_FIELDS.includes(field)) document.getElementById(field)?.focus();
        return;
      }

      setIsSubmitted(true);
      setFormData(EMPTY_FORM);
      setSubmissionId(crypto.randomUUID());
      trackMetaContact();
      trackEvent("kontakt_submitted", { category: "business" });
      toast({
        title: "Nachricht gesendet!",
        description: "Wir melden uns werktags so schnell wie möglich bei Ihnen.",
      });
    } catch {
      toast({ title: "Fehler beim Senden", description: SEND_FAILED_MESSAGE, variant: "destructive" });
    } finally {
      // Turnstile-Tokens sind einmalig gültig, auch nach einem Fehler.
      resetTurnstile();
      setIsLoading(false);
    }
  };

  const contactEmail = settings?.contact_email || BRAND.supportEmail;
  const companyAddress = settings?.company_address || '';
  const companyCity = settings?.company_city || '';
  const companyPostalCode = settings?.company_postal_code || '';
  // Filter out placeholder values ("Bitte eintragen", "00000", etc.)
  const isPlaceholder = (val: string) => !val || val.toLowerCase().includes('bitte') || val === '00000';
  const fullAddress = !isPlaceholder(companyAddress) && !isPlaceholder(companyCity)
    ? `${companyAddress}, ${companyPostalCode} ${companyCity}` 
    : '';

  const contactMethods = [
    {
      icon: Phone,
      title: "Telefon",
      detail: phone.display,
      description: "Mo–Fr: 10:00–18:00 Uhr",
      action: phone.href
    },
    {
      icon: Mail,
      title: "E-Mail",
      detail: contactEmail,
      description: "Wir antworten werktags",
      action: contactEmail ? `mailto:${contactEmail}` : '#'
    },
    {
      icon: MapPin,
      title: "Anschrift",
      detail: fullAddress || BRAND.legalName,
      description: "Beratung telefonisch oder per E-Mail",
      action: "#"
    },
    {
      icon: Clock,
      title: "Telefonzeiten",
      detail: "Mo–Fr: 10:00–18:00 Uhr",
      description: "Sa/So: nicht besetzt",
      action: "#"
    }
  ];

  const faqs: { q: string; a: ReactNode }[] = [
    {
      q: "Wie schnell erhalte ich eine Antwort?",
      a: "Wir melden uns werktags so schnell wie möglich. Telefonisch erreichen Sie uns Montag bis Freitag von 10 bis 18 Uhr.",
    },
    {
      q: "Ich bin Küchenstudio – an wen wende ich mich?",
      a: (
        <>
          Wie die Teilnahme funktioniert und was sie kostet, lesen Sie auf der Seite{" "}
          <Link to="/haendler" className="font-medium underline underline-offset-4">
            Für Küchenstudios
          </Link>
          . Weitere Fragen beantworten wir gern per E-Mail oder Telefon.
        </>
      ),
    },
    {
      q: "Kann ich auch am Wochenende Kontakt aufnehmen?",
      a: "Ja, per Kontaktformular oder E-Mail. Wir antworten dann ab Montag; telefonisch sind wir Montag bis Freitag von 10 bis 18 Uhr erreichbar.",
    },
  ];

  return (
    <PageLayout
      breadcrumbs={true}
      title="Kontakt – Beratung & Support"
      description={`Kontaktieren Sie ${siteName} - Wir sind für Sie da! Telefon, E-Mail oder Kontaktformular. Wir melden uns schnellstmöglich bei Ihnen.`}
      keywords="Kontakt, KüchenWert Kontakt, Küchen-Beratung, Küchen-Planung Support, neue Küche kaufen Kontakt, Küchenstudio Vermittlung"
      canonicalPath="/kontakt"
      structuredData={generateBreadcrumbSchema(getBreadcrumbsFromPath("/kontakt"))}
    >
      {/* Hero Section */}
      <PageHero size="lg">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl gradient-hero mb-6 shadow-glow-sm">
            <MessageSquare className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            <span className="gradient-text">Kontaktieren</span> Sie uns
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
            Wir sind für Sie da! Egal ob telefonisch, per E-Mail oder über unser Kontaktformular - 
            Ihr Anliegen ist uns wichtig.
          </p>
          
          {/* Prominent Contact Info */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mt-8">
            <a 
              href={phone.href} 
              className="flex items-center gap-3 bg-card/80 dark:bg-card/80 backdrop-blur-sm px-6 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 border border-border/50"
            >
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-xs text-muted-foreground font-medium">Telefon</p>
                <p className="text-lg font-bold text-foreground">{phone.display}</p>
              </div>
            </a>
            {contactEmail && (
              <a 
                href={`mailto:${contactEmail}`} 
                className="flex items-center gap-3 bg-card/80 dark:bg-card/80 backdrop-blur-sm px-6 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 border border-border/50"
              >
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-xs text-muted-foreground font-medium">E-Mail</p>
                  <p className="text-lg font-bold text-foreground">{contactEmail}</p>
                </div>
              </a>
            )}
          </div>
        </div>
      </PageHero>

      {/* Quick Contact Methods */}
      <section aria-labelledby="kontaktwege" className="py-20">
        <div className="container">
          <h2 id="kontaktwege" className="sr-only">So erreichen Sie uns</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {contactMethods.map((method, index) => (
              <Card key={index} className="hover-lift border-2 text-center animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <CardHeader>
                  <div className="h-14 w-14 rounded-xl gradient-hero flex items-center justify-center mb-4 shadow-glow-sm mx-auto">
                    <method.icon className="h-7 w-7 text-primary-foreground" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-lg">{method.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {method.action !== "#" ? (
                    <a href={method.action} className="font-semibold text-primary hover:underline block">
                      {method.detail}
                    </a>
                  ) : (
                    <p className="font-semibold">{method.detail}</p>
                  )}
                  <CardDescription>{method.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Schreiben Sie uns</h2>
              <p className="text-lg text-muted-foreground">
                Füllen Sie das Formular aus – wir melden uns werktags so schnell wie möglich bei Ihnen.
              </p>
            </div>

            <Card className="border-2">
              {isSubmitted ? (
                <CardContent className="py-16 text-center" role="status">
                  <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden="true" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Vielen Dank für Ihre Nachricht!</h3>
                  <p className="text-muted-foreground mb-6">
                    Wir haben Ihre Nachricht erhalten und melden uns werktags so schnell wie möglich bei Ihnen.
                  </p>
                  <Button variant="outline" onClick={() => setIsSubmitted(false)}>
                    Weitere Nachricht senden
                  </Button>
                </CardContent>
              ) : (
                <>
              <CardHeader>
                <CardTitle>Kontaktformular</CardTitle>
                <CardDescription>Alle Felder mit * sind Pflichtfelder</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-sm font-medium">
                        Name *
                      </label>
                      <Input
                        id="name"
                        name="name"
                        type="text"
                        autoComplete="name"
                        autoCapitalize="words"
                        placeholder="Ihr vollständiger Name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="email" className="text-sm font-medium">
                        E-Mail *
                      </label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="ihre.email@beispiel.de"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="phone" className="text-sm font-medium">
                        Telefon
                      </label>
                      <Input
                        id="phone"
                        name="tel"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="+49 123 456789"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label htmlFor="subject" className="text-sm font-medium">
                        Betreff *
                      </label>
                      <Input
                        id="subject"
                        name="subject"
                        type="text"
                        autoCapitalize="sentences"
                        placeholder="Worum geht es?"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="message" className="text-sm font-medium">
                      Nachricht *
                    </label>
                    <Textarea
                      id="message"
                      name="message"
                      placeholder="Beschreiben Sie Ihr Anliegen..."
                      rows={6}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    />
                  </div>

                  <HoneypotField value={honeypotValue} onChange={setHoneypotValue} />
                  <div ref={turnstileCallbackRef} />
                  <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                    <Send className="h-5 w-5 mr-2" />
                    {isLoading ? "Wird gesendet..." : "Nachricht senden"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Hinweise zur Verarbeitung Ihrer Daten finden Sie in der{" "}
                    <Link to="/datenschutz" className="link-inline">
                      Datenschutzerklärung
                    </Link>
                    .
                  </p>
                </form>
              </CardContent>
                </>
              )}
            </Card>
          </div>
        </div>
      </section>


      {/* FAQ Quick Help */}
      <section className="py-20 bg-secondary text-secondary-foreground">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Häufig gestellte Fragen</h2>
              <p className="text-lg opacity-90">
                Vielleicht finden Sie hier bereits die Antwort auf Ihre Frage.
              </p>
            </div>
            
            <div className="space-y-6">
              {faqs.map((faq, index) => (
                <Card key={faq.q} className="border-primary/20 animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                  <CardHeader>
                    <CardTitle className="text-xl">{faq.q}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="opacity-90">{faq.a}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-primary via-primary-light to-primary text-primary-foreground">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Wir freuen uns auf Ihre Nachricht!</h2>
            <p className="text-xl mb-8 opacity-95">
              Unser Team steht Ihnen mit Rat und Tat zur Seite. Kontaktieren Sie uns noch heute!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
                <a href={phone.href}>
                  <Phone className="h-5 w-5 mr-2" />
                  Jetzt anrufen
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto bg-white/10 border-white/30 hover:bg-white/20 text-white">
                <a href={`mailto:${contactEmail}`}>
                  <Mail className="h-5 w-5 mr-2" />
                  E-Mail schreiben
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default Kontakt;
