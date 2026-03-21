import { useState } from "react";
import { Mail, Phone, MapPin, ArrowRight, Facebook, Instagram, Youtube, Linkedin, Shield, Award, Clock, CheckCircle2, Cookie } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteLogo } from "@/components/SiteLogo";
import { CookieSettingsModal } from "@/components/CookieSettingsModal";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const newsletterSchema = z.object({
  email: z.string().trim().email("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
});

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [showCookieSettings, setShowCookieSettings] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterSubmitted, setNewsletterSubmitted] = useState(false);

  const handleNewsletterSubmit = () => {
    try {
      newsletterSchema.parse({ email: newsletterEmail });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Ungültige E-Mail",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
      return;
    }
    setNewsletterSubmitted(true);
    toast({
      title: "Anmeldung erfolgreich!",
      description: "Sie erhalten ab sofort unseren Newsletter.",
    });
  };

  return (
    <footer className="relative overflow-hidden">
      {/* Trust Section */}
      <div className="bg-gradient-to-b from-slate-50 to-slate-100 border-t border-slate-200">
        <div className="container py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8 items-center">
            {/* Trust Badges */}
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">SSL-Verschlüsselt</p>
                <p className="text-xs text-slate-500">Sichere Datenübertragung</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              {settings?.tuv_badge_url ? (
                <div className="h-14 w-14 rounded-full overflow-hidden flex items-center justify-center bg-white">
                  <img 
                    src={settings.tuv_badge_url} 
                    alt="TÜV-Zertifikat" 
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Award className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900">TÜV-Geprüft</p>
                <p className="text-xs text-slate-500">Zertifizierter Service</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">24h Bewertung</p>
                <p className="text-xs text-slate-500">Schnelle Bearbeitung</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">100% Kostenlos</p>
                <p className="text-xs text-slate-500">Keine versteckten Gebühren</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Newsletter Section */}
      <div className="bg-slate-900 border-t border-slate-800">
        <div className="container py-12">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="text-center lg:text-left">
              <h3 className="text-xl font-semibold text-white mb-2">
                Bleiben Sie informiert
              </h3>
              <p className="text-slate-400 text-sm">
                Erhalten Sie die neuesten Angebote und Tipps direkt in Ihr Postfach.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              {newsletterSubmitted ? (
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">Vielen Dank für Ihre Anmeldung!</span>
                </div>
              ) : (
                <>
                  <Input 
                    type="email" 
                    placeholder="Ihre E-Mail-Adresse" 
                    value={newsletterEmail}
                    onChange={(e) => setNewsletterEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNewsletterSubmit()}
                    className="h-11 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-primary w-full sm:w-72"
                  />
                  <Button 
                    onClick={handleNewsletterSubmit}
                    className="h-11 px-6 bg-primary hover:bg-primary/90 text-white font-medium"
                  >
                    Anmelden
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="bg-slate-950">
        <div className="container py-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-7 gap-8 mb-12">
            {/* Brand Column */}
            <div className="space-y-6 lg:col-span-2">
              <SiteLogo variant="footer" />
              <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
                {settings?.site_description || 'Deutschlands führende Plattform für den An- und Verkauf von Wohnmobilen. Schnell, sicher und fair.'}
              </p>
              
              {/* Social Links */}
              <div className="flex items-center gap-3">
                <a 
                  href="#" 
                  className="h-10 w-10 rounded-lg bg-slate-800 hover:bg-primary flex items-center justify-center transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="h-4 w-4 text-slate-300" />
                </a>
                <a 
                  href="#" 
                  className="h-10 w-10 rounded-lg bg-slate-800 hover:bg-primary flex items-center justify-center transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="h-4 w-4 text-slate-300" />
                </a>
                <a 
                  href="#" 
                  className="h-10 w-10 rounded-lg bg-slate-800 hover:bg-primary flex items-center justify-center transition-colors"
                  aria-label="Youtube"
                >
                  <Youtube className="h-4 w-4 text-slate-300" />
                </a>
                <a 
                  href="#" 
                  className="h-10 w-10 rounded-lg bg-slate-800 hover:bg-primary flex items-center justify-center transition-colors"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-4 w-4 text-slate-300" />
                </a>
              </div>
            </div>

            {/* Services Column */}
            <div>
              <h3 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">Services</h3>
              <ul className="space-y-3">
                <li>
                  <Link to="/wohnmobil-verkaufen" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Wohnmobil verkaufen
                  </Link>
                </li>
                <li>
                  <Link to="/wohnwagen-verkaufen" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Wohnwagen verkaufen
                  </Link>
                </li>
                <li>
                  <Link to="/wir-kaufen-dein-wohnmobil" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Wohnmobil Ankauf
                  </Link>
                </li>
                <li>
                  <Link to="/kaufen" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Wohnmobil kaufen
                  </Link>
                </li>
                <li>
                  <Link to="/ankaufstationen" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Ankaufstationen
                  </Link>
                </li>
                <li>
                  <Link to="/haendler" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Für Händler
                  </Link>
                </li>
              </ul>
            </div>

            {/* Bewertung Column */}
            <div>
              <h3 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">Bewertung</h3>
              <ul className="space-y-3">
                <li>
                  <Link to="/was-ist-mein-wohnmobil-wert" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Wohnmobil Wert
                  </Link>
                </li>
                <li>
                  <Link to="/wieviel-ist-mein-wohnmobil-wert" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Wert berechnen
                  </Link>
                </li>
                <li>
                  <Link to="/wohnmobil-wertermittlung-kostenlos" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Kostenlose Wertermittlung
                  </Link>
                </li>
                <li>
                  <Link to="/wertrechner" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Wertrechner
                  </Link>
                </li>
                <li>
                  <Link to="/ratgeber" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Ratgeber & Tipps
                  </Link>
                </li>
                <li>
                  <Link to="/preise" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Preise
                  </Link>
                </li>
              </ul>
            </div>

            {/* Ratgeber Column */}
            <div>
              <h3 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">Ratgeber</h3>
              <ul className="space-y-3">
                <li>
                  <Link to="/ratgeber/hymer-wohnmobil-verkaufen" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Hymer verkaufen
                  </Link>
                </li>
                <li>
                  <Link to="/ratgeber/dethleffs-wohnmobil-verkaufen" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Dethleffs verkaufen
                  </Link>
                </li>
                <li>
                  <Link to="/ratgeber/knaus-wohnmobil-verkaufen" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Knaus verkaufen
                  </Link>
                </li>
                <li>
                  <Link to="/ratgeber/wohnmobil-mit-motorschaden-verkaufen" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Mit Motorschaden verkaufen
                  </Link>
                </li>
                <li>
                  <Link to="/ratgeber/wohnmobil-ohne-tuev-verkaufen" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Ohne TÜV verkaufen
                  </Link>
                </li>
                <li>
                  <Link to="/ratgeber/wohnmobil-trotz-finanzierung-verkaufen" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Trotz Finanzierung verkaufen
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company Column */}
            <div>
              <h3 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">Unternehmen</h3>
              <ul className="space-y-3">
                <li>
                  <Link to="/ueber-uns" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Über uns
                  </Link>
                </li>
                <li>
                  <Link to="/kontakt" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Kontakt
                  </Link>
                </li>
                <li>
                  <Link to="/faq" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Häufige Fragen
                  </Link>
                </li>
                <li>
                  <Link to="/blog" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Blog & News
                  </Link>
                </li>
                <li>
                  <a href="/impressum" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Impressum
                  </a>
                </li>
                <li>
                  <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Datenschutz
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact Column */}
            <div>
              <h3 className="font-semibold text-white mb-5 text-sm uppercase tracking-wider">Kontakt</h3>
              <ul className="space-y-4">
                {settings?.support_phone && (
                  <li>
                    <a 
                      href={`tel:${settings.support_phone.replace(/\s/g, '')}`}
                      className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors group"
                    >
                      <div className="h-9 w-9 rounded-lg bg-slate-800 group-hover:bg-primary flex items-center justify-center flex-shrink-0 transition-colors">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">
                          {settings.support_phone}
                        </div>
                        <div className="text-xs text-slate-500">Mo-Fr 8:00-18:00</div>
                      </div>
                    </a>
                  </li>
                )}
                {settings?.contact_email && (
                  <li>
                    <a 
                      href={`mailto:${settings.contact_email}`}
                      className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors group"
                    >
                      <div className="h-9 w-9 rounded-lg bg-slate-800 group-hover:bg-primary flex items-center justify-center flex-shrink-0 transition-colors">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">
                          {settings.contact_email}
                        </div>
                        <div className="text-xs text-slate-500">24h Antwortzeit</div>
                      </div>
                    </a>
                  </li>
                )}
                <li>
                  <div className="flex items-center gap-3 text-slate-400">
                    <div className="h-9 w-9 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">{settings?.site_name || 'CaravanWert'} GmbH</div>
                      <div className="text-xs text-slate-500">
                        {settings?.company_city ? `${settings.company_city}, ${settings.company_country || 'Deutschland'}` : 'Deutschland'}
                      </div>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bg-black">
        <div className="container py-5">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-500">
              © {currentYear} {settings?.site_name || 'CaravanWert'} GmbH. Alle Rechte vorbehalten.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <a href="/impressum" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white transition-colors">
                Impressum
              </a>
              <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white transition-colors">
                Datenschutz
              </a>
              <a href="/agb" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-white transition-colors">
                AGB
              </a>
              <button 
                onClick={() => setShowCookieSettings(true)}
                className="text-slate-500 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <Cookie className="w-3.5 h-3.5" />
                Cookie-Einstellungen
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Cookie Settings Modal */}
      <CookieSettingsModal 
        open={showCookieSettings} 
        onOpenChange={setShowCookieSettings} 
      />
    </footer>
  );
};

export default Footer;
