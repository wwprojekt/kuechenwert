import { useState } from "react";
import { Mail, Phone, MapPin, ArrowRight, Facebook, Instagram, Youtube, Linkedin, Shield, Award, Clock, CheckCircle2, Cookie } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SiteLogo } from "@/components/SiteLogo";
import { CookieSettingsModal } from "@/components/CookieSettingsModal";
import { trackPhoneClick, trackEmailClick } from "@/lib/gadsConversionService";
import { trackMetaPhoneClick } from "@/lib/metaPixelService";
import { BRAND } from "@/lib/brand/config";

const SOCIAL_LINKS = [
  { key: "facebook_url", label: "Facebook", icon: Facebook },
  { key: "instagram_url", label: "Instagram", icon: Instagram },
  { key: "youtube_url", label: "YouTube", icon: Youtube },
  { key: "linkedin_url", label: "LinkedIn", icon: Linkedin },
] as const;

// Nicht Teil von SiteSettings: nur vorhanden, wenn get_public_site_settings die Spalten liefert.
type SocialSettings = Partial<Record<(typeof SOCIAL_LINKS)[number]["key"], string | null>>;

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { settings } = useSettings();
  const socialSettings = settings as SocialSettings | null;
  const location = useLocation();
  const [showCookieSettings, setShowCookieSettings] = useState(false);

  return (
    <footer className="relative overflow-hidden safe-bottom">
      {/* Trust Section */}
      <div className="bg-gradient-to-b from-slate-50 dark:from-slate-900 to-slate-100 dark:to-slate-800 border-t border-slate-200 dark:border-slate-700">
        <div className="container py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-8 items-center">
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">SSL-Verschlüsselt</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Sichere Datenübertragung</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Geprüfte Küchenstudios</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Vor der Freischaltung manuell geprüft</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Preis sofort</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Schätzung in wenigen Minuten</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2 text-center">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Kostenlos für Sie</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Unverbindlich, ohne versteckte Gebühren</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Final-CTA Section */}
      <div className="bg-slate-900 border-t border-slate-800">
        <div className="container py-12">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="text-center lg:text-left">
              <h2 className="text-xl font-semibold text-white mb-2">
                Bereit für Ihre Traumküche?
              </h2>
              <p className="text-slate-400 text-sm">
                Raumfoto hochladen, Küche gestalten, Preis sehen – auf Wunsch machen Ihnen geprüfte Studios Angebote.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <Button asChild className="h-11 px-6 bg-primary hover:bg-primary/90 text-white font-medium w-full sm:w-auto">
                <Link to="/funnel/c">
                  Traumküche planen
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 px-6 border-slate-700 bg-transparent text-slate-300 hover:text-white hover:bg-slate-800 w-full sm:w-auto"
              >
                <Link to="/formular">Angebote einholen</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
      {/* Main Footer */}
      <div className="bg-slate-950">
        <div className="container py-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-10 mb-12">
            {/* Brand Column */}
            <div className="space-y-6 md:col-span-2 lg:col-span-5">
              <SiteLogo variant="footer" />
              <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
                {settings?.site_description ||
                  `${BRAND.name} ist das Vergleichsportal für neue Küchen. Angebote einholen, Studio-Preise unterbieten lassen oder mit KI visualisieren – kostenlos und unverbindlich.`}
              </p>

              <div className="flex items-center gap-3">
                {SOCIAL_LINKS.map(({ key, label, icon: Icon }) => {
                  const url = socialSettings?.[key];
                  if (!url) return null;
                  return (
                    <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="h-10 w-10 rounded-lg bg-slate-800 hover:bg-primary flex items-center justify-center transition-colors" aria-label={label}>
                      <Icon className="h-4 w-4 text-slate-300" aria-hidden="true" />
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Services Column */}
            <div>
              <h2 className="font-semibold text-white mb-5 text-sm">Services</h2>
              <ul className="space-y-3">
                <li>
                  <Link to="/funnel/c" className="text-sm text-slate-400 hover:text-white transition-colors font-medium">
                    Traumküche planen (KI)
                  </Link>
                </li>
                <li>
                  <Link to="/formular" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Angebote einholen
                  </Link>
                </li>
                <li>
                  <Link to="/funnel/b" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Studio-Preis unterbieten
                  </Link>
                </li>
                <li>
                  <Link to="/projekt" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Mein Projekt & Angebote
                  </Link>
                </li>
                <li>
                  <Link to="/kuechenrechner" className="text-sm text-slate-400 hover:text-white transition-colors">
                    KüchenRechner (Preis-Check)
                  </Link>
                </li>
                <li>
                  <Link to="/haendler" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Für Küchenstudios
                  </Link>
                </li>
              </ul>
            </div>

            {/* Ratgeber Column */}
            <div>
              <h2 className="font-semibold text-white mb-5 text-sm">Ratgeber</h2>
              <ul className="space-y-3">
                <li>
                  <Link to="/ratgeber" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Küchen-Ratgeber
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
                  <Link to="/preise" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Preise
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company Column */}
            <div>
              <h2 className="font-semibold text-white mb-5 text-sm">Unternehmen</h2>
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
                  <Link to="/impressum" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Impressum
                  </Link>
                </li>
                <li>
                  <Link to="/datenschutz" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Datenschutz
                  </Link>
                </li>
                <li>
                  <Link to="/agb" className="text-sm text-slate-400 hover:text-white transition-colors">
                    AGB
                  </Link>
                </li>
                <li>
                  <Link to="/barrierefreiheit" className="text-sm text-slate-400 hover:text-white transition-colors">
                    Barrierefreiheit
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact Column */}
            <div className="lg:col-span-2">
              <h2 className="font-semibold text-white mb-5 text-sm">Kontakt</h2>
              <ul className="space-y-4">
                <li>
                  {(() => { const phone = settings?.support_phone || '+49 511 51532476'; return (
                    <a href={`tel:${phone.replace(/\s/g, '')}`} onClick={() => { trackPhoneClick(phone, location.pathname); trackMetaPhoneClick(); }} className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors group">
                      <div className="h-9 w-9 rounded-lg bg-slate-800 group-hover:bg-primary flex items-center justify-center flex-shrink-0 transition-colors">
                        <Phone className="h-4 w-4" />
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">{phone}</div>
                        <div className="text-xs text-slate-400">Mo-Fr 10:00-18:00</div>
                      </div>
                    </a>
                  ); })()}
                </li>
                <li>
                  {(() => { const email = settings?.contact_email || BRAND.supportEmail; return (
                    <a href={`mailto:${email}`} onClick={() => trackEmailClick(location.pathname)} className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors group">
                      <div className="h-9 w-9 rounded-lg bg-slate-800 group-hover:bg-primary flex items-center justify-center flex-shrink-0 transition-colors">
                        <Mail className="h-4 w-4" />
                      </div>
                      <div className="text-sm">
                        <div className="font-medium">{email}</div>
                        <div className="text-xs text-slate-400">Wir antworten werktags</div>
                      </div>
                    </a>
                  ); })()}
                </li>
                <li>
                  <div className="flex items-center gap-3 text-slate-400">
                    <div className="h-9 w-9 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">{settings?.site_name || BRAND.name}</div>
                      <div className="text-xs text-slate-400">
                        {(settings?.company_city && !settings.company_city.toLowerCase().includes('bitte'))
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
            <p className="text-sm text-slate-400">
              © {currentYear} {settings?.site_name || BRAND.name}. Eine Marke der {BRAND.legalName}. Alle Rechte vorbehalten.
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <Link to="/impressum" className="text-slate-400 hover:text-white transition-colors">
                Impressum
              </Link>
              <Link to="/datenschutz" className="text-slate-400 hover:text-white transition-colors">
                Datenschutz
              </Link>
              <Link to="/agb" className="text-slate-400 hover:text-white transition-colors">
                AGB
              </Link>
              <Link to="/barrierefreiheit" className="text-slate-400 hover:text-white transition-colors">
                Barrierefreiheit
              </Link>
              <button
                type="button"
                onClick={() => setShowCookieSettings(true)}
                className="text-slate-400 hover:text-white transition-colors flex items-center gap-1.5"
              >
                <Cookie className="w-3.5 h-3.5" aria-hidden="true" />
                Cookie-Einstellungen
              </button>
            </div>
          </div>
        </div>
      </div>

      <CookieSettingsModal
        open={showCookieSettings}
        onOpenChange={setShowCookieSettings}
      />
    </footer>
  );
};

export default Footer;
