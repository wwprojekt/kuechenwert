import PageLayout from "@/components/PageLayout";
import { generateBreadcrumbSchema, getBreadcrumbsFromPath } from "@/lib/seo";
import PageHero from "@/components/PageHero";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, MapPin, Clock, MessageSquare, Send, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsContext";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { handleValidationError, handleApiError } from "@/lib/errorLogService";
import { trackKontaktformularGesendet } from "@/lib/gadsConversionService";

const kontaktSchema = z.object({
  name: z.string().trim().min(2, "Bitte geben Sie Ihren Namen ein"),
  email: z.string().trim().email("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
  phone: z.string().optional(),
  subject: z.string().trim().min(2, "Bitte geben Sie einen Betreff ein"),
  message: z.string().trim().min(10, "Die Nachricht muss mindestens 10 Zeichen lang sein"),
});

const Kontakt = () => {
  const { toast } = useToast();
  const { settings } = useSettings();
  const siteName = settings?.site_name || 'CaravanWert';
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: ""
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      kontaktSchema.parse(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const germanMessage = handleValidationError(error, 'Kontakt');
        toast({
          title: "Bitte prüfen Sie Ihre Eingaben",
          description: germanMessage,
          variant: "destructive",
        });
      }
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.from("contact_messages").insert({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        subject: formData.subject.trim(),
        message: formData.message.trim(),
      });

      if (error) throw error;

      // Send email notification to admin + confirmation to customer
      try {
        await supabase.functions.invoke("send-lead-notification", {
          body: {
            type: "kontakt",
            name: formData.name.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim() || undefined,
            subject: formData.subject.trim(),
            messageText: formData.message.trim(),
          },
        });
      } catch (emailError) {
        console.error("Failed to send contact notification:", emailError);
      }

      setIsSubmitted(true);

      // Google Ads Conversion Tracking: Kontaktformular gesendet (Primäre Conversion)
      trackKontaktformularGesendet();

      toast({
        title: "Nachricht gesendet!",
        description: "Wir melden uns schnellstmöglich bei Ihnen.",
      });
      setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch (error) {
      const germanMessage = handleApiError(error, 'Kontakt');
      toast({
        title: "Fehler beim Senden",
        description: germanMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const supportPhone = settings?.support_phone || '';
  const contactEmail = settings?.contact_email || '';
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
      detail: supportPhone,
      description: "Mo-Fr: 8:00-18:00 Uhr",
      action: supportPhone ? `tel:${supportPhone.replace(/\s/g, '')}` : '#'
    },
    {
      icon: Mail,
      title: "E-Mail",
      detail: contactEmail,
      description: "Antwort innerhalb 24h",
      action: contactEmail ? `mailto:${contactEmail}` : '#'
    },
    {
      icon: MapPin,
      title: "Hauptsitz",
      detail: fullAddress || `${siteName} GmbH`,
      description: "Besuch nach Terminvereinbarung",
      action: "#"
    },
    {
      icon: Clock,
      title: "Öffnungszeiten",
      detail: "Mo-Fr: 8:00-18:00 Uhr",
      description: "Sa: 9:00-14:00 Uhr",
      action: "#"
    }
  ];

  return (
    <PageLayout
      breadcrumbs={true}
      title="Kontakt – Beratung & Support"
      description={`Kontaktieren Sie ${siteName} - Wir sind für Sie da! Telefon, E-Mail oder Kontaktformular. Schnelle Antwort garantiert.`}
      keywords="kontakt, caravanwert kontakt, wohnmobil ankauf kontakt, beratung wohnmobil"
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
            {supportPhone && (
              <a 
                href={`tel:${supportPhone.replace(/\s/g, '')}`} 
                className="flex items-center gap-3 bg-white/80 dark:bg-card/80 backdrop-blur-sm px-6 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 border border-border/50"
              >
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-xs text-muted-foreground font-medium">Telefon</p>
                  <p className="text-lg font-bold text-foreground">{supportPhone}</p>
                </div>
              </a>
            )}
            {contactEmail && (
              <a 
                href={`mailto:${contactEmail}`} 
                className="flex items-center gap-3 bg-white/80 backdrop-blur-sm px-6 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 border border-border/50"
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
      <section className="py-20">
        <div className="container">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {contactMethods.map((method, index) => (
              <Card key={index} className="hover-lift border-2 text-center animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <CardHeader>
                  <div className="h-14 w-14 rounded-xl gradient-hero flex items-center justify-center mb-4 shadow-glow-sm mx-auto">
                    <method.icon className="h-7 w-7 text-primary-foreground" />
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
                Füllen Sie das Formular aus und wir melden uns innerhalb von 24 Stunden bei Ihnen.
              </p>
            </div>

            <Card className="border-2">
              {isSubmitted ? (
                <CardContent className="py-16 text-center">
                  <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Vielen Dank f\u00fcr Ihre Nachricht!</h3>
                  <p className="text-muted-foreground mb-6">
                    Wir haben Ihre Anfrage erhalten und melden uns innerhalb von 24 Stunden bei Ihnen.
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
                        type="email"
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
                        type="tel"
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
                      placeholder="Beschreiben Sie Ihr Anliegen..."
                      rows={6}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    />
                  </div>

                  <Button type="submit" size="lg" className="w-full gradient-hero hover:gradient-hero-hover" disabled={isLoading}>
                    <Send className="h-5 w-5 mr-2" />
                    {isLoading ? "Wird gesendet..." : "Nachricht senden"}
                  </Button>
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
              {[
                {
                  q: "Wie schnell erhalte ich eine Antwort?",
                  a: "Wir antworten auf alle Anfragen innerhalb von 24 Stunden, meist sogar deutlich schneller."
                },
                {
                  q: "Muss ich einen Termin vereinbaren?",
                  a: "Für Besichtigungen empfehlen wir eine Terminvereinbarung, damit wir uns ausreichend Zeit für Sie nehmen können."
                },
                {
                  q: "Kann ich auch am Wochenende Kontakt aufnehmen?",
                  a: "Ja, über unser Kontaktformular erreichen Sie uns rund um die Uhr. Telefonisch sind wir Samstags von 9-14 Uhr erreichbar."
                }
              ].map((faq, index) => (
                <Card key={index} className="border-primary/20 animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
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
              {supportPhone && (
                <a href={`tel:${supportPhone.replace(/\s/g, '')}`}>
                  <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                    <Phone className="h-5 w-5 mr-2" />
                    Jetzt anrufen
                  </Button>
                </a>
              )}
              <a href={`mailto:${contactEmail}`}>
                <Button size="lg" variant="outline" className="w-full sm:w-auto bg-white/10 border-white/30 hover:bg-white/20 text-white">
                  <Mail className="h-5 w-5 mr-2" />
                  E-Mail schreiben
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default Kontakt;
