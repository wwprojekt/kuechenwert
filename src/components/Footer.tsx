import { useState } from "react";
import { Mail, Phone, MapPin, ArrowRight, Facebook, Instagram, Youtube, Linkedin, Shield, Award, Clock, CheckCircle2, Cookie } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SiteLogo } from "@/components/SiteLogo";
import { CookieSettingsModal } from "@/components/CookieSettingsModal";
import { trackPhoneClick, trackEmailClick } from "@/lib/gadsConversionService";
import { trackMetaPhoneClick } from "@/lib/metaPixelService";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { settings } = useSettings();
  const location = useLocation();
  const [showCookieSettings, setShowCookieSettings] = useState(false);

  return (
    <footer className="relative overflow-hidden">
      {/* Trust Section */}
      <div className="bg-gradient-to-b from-slate-50 dark:from-slate-900 to-slate-100 dark:to-slate-800 border-t border-slate-200 dark:border-slate-700">
        <div className="container py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8 items-center">
            {/* Trust Badges */}
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">SSL-Verschlüsselt</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Sichere Datenübertragung</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              {settings?.tuv_badge_url ? (
                <div className="h-14 w-14 rounded-full overflow-hidden flex items-center justify-center bg-white dark:bg-slate-800">
                  <img 
                    src={settings.tuv_badge_url} 
                    alt="TÜV-Zertifikat" 
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Award className="h-6 w-6 text-primary" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Geprüfter Service</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Verifizierte Händler</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">24h Bewertung</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Schnelle Bearbeitung</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">100% Kostenlos</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Keine versteckten Gebühren</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Verkaufs-CTA Section */}
      <div className="bg-slate-900 border-t border-slate-800">
        <div className="container py-12">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="text-center lg:text-left">
              <h3 className="text-xl font-semibold text-white mb-2">
                Bereit, Ihr Wohnmobil zu verkaufen?
              </h3>
              <p className="text-slate-400 text-sm">
                Starten Sie jetzt mit der kostenlosen Bewertung – unverbindlich und in nur 2 Minuten.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <Link to="/verkaufen/wizard">
                <Button
                  className="h-11 px-6 bg-primary hover:bg-primary/90 text-white font-medium"
                >
                  Jetzt kostenlos bewerten
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/wertrechner">
                <Button
                  variant="outline"
                  className="h-11 px-6 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
                >
                  Wert berechnen
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      {/* Main Footer */}
      <div className="bg-slate-950">
        <div className="container py-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-x-6 gap-y-10 mb-12">
            {/* Brand Column */}
            <div className="space-y-6 md:col-span-2 lg:col-span-6">
              <SiteLogo variant="footer" />
              <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
                {settings?.site_description || 'Ihre Plattform für den Wohnmobil-Verkauf. Schnell, transparent und kostenlos für Privatverkäufer.'}
              </p>
              
              {/* Social Links - only show if URLs are configured in settings */}
              <div className="flex items-center gap-3">
                {settings?.facebook_url && (
                  <a 
                    href={settings.facebook_url} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 w-10 rounded-lg bg-slate-800 hover:bg-primary flex items-center justify-center transition-colors"
                    aria-label="Facebook"
                  >
                    <Facebook className="h-4 w-4 text-slate-300" />
                  </a>
                )}
                {settings?.instagram_url && (
                  <a 
                    href={settings.instagram_url} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 w-10 rounded-lg bg-slate-800 hover:bg-primary flex items-center justify-center transition-colors"
                    aria-label="Instagram"
                  >
                    <Instagram className="h-4 w-4 text-slate-300" />
                  </a>
                )}
                {settings?.youtube_url && (
                  <a 
                    href={settings.youtube_url} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 w-10 rounded-lg bg-slate-800 hover:bg-primary flex items-center justify-center transition-colors"
                    aria-label="Youtube"
                  >
                    <Youtube className="h-4 w-4 text-slate-300" />
                  </a>
                )}
                {settings?.linkedin_url && (
                  <a 
                    href={settings.linkedin_url} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 w-10 rounded-lg bg-slate-800 hover:bg-primary flex items-center justify-center transition-colors"
                    aria-label="LinkedIn"
                  >
                    <Linkedin className="h-4 w-4 text-slate-300" />
                  </a>
                )}
              </div>
            </div>

            {/* Services Column */}
            <div>
              <h3 className="font-semibold text-white mb-5 text-sm">Services</h3>
              <ul className="space-y-3">
                <li>
                  <Link to="/verkaufen" className="text-sm text-slate-400 hover:text-white transition-colors font-medium">
                    Jetzt verkaufen
                  </Link>
                </li>
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
              <h3 className="font-semibold text-white mb-5 text-sm">Bewertung</h3>
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
                  <Link to="/wertermittlung" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Experten-Bewertung
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
              <h3 className="font-semibold text-white mb-5 text-sm">Ratgeber</h3>
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
              <h3 className="font-semibold text-white mb-5 text-sm">Unternehmen</h3>
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
                  <Link to="/impressum" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Impressum
                  </Link>
                </li>
                <li>
                  <Link to="/datenschutz" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Datenschutz
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact Column */}
            <div className="lg:col-span-2">
              <h3 className="font-semibold text-white mb-5 text-sm">Kontakt</h3>
              <ul className="space-y-4">
                {settings?.support_phone && (
                  <li>
                    <a 
                      href={`tel:${settings.support_phone.replace(/\s/g, '')}`}
                      onClick={() => { trackPhoneClick(settings.support_phone || '', location.pathname); trackMetaPhoneClick(); }}
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
                      onClick={() => trackEmailClick(location.pathname)}
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
                        {settings?.company_city && !settings.company_city.toLowerCase().includes('bitte') 
                          ? `${settings.company_city}, ${settings.company_country || 'Deutschland'}` 
                          : 'Deutschland'}
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
              <Link to="/impressum" className="text-slate-500 hover:text-white transition-colors">
                Impressum
              </Link>
              <Link to="/datenschutz" className="text-slate-500 hover:text-white transition-colors">
                Datenschutz
              </Link>
              <Link to="/agb" className="text-slate-500 hover:text-white transition-colors">
                AGB
              </Link>
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
