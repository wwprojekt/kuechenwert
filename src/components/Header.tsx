import { Button } from "@/components/ui/button";
import { Menu, X, Phone, Mail, LogOut, User, ChevronDown, Building2 } from "lucide-react";
import { DarkModeToggle, DarkModeSimpleToggle } from "@/components/DarkModeToggle";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useUserRole } from "@/hooks/useUserRole";
import { SiteLogo } from "@/components/SiteLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const languages = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
];

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState(languages[0]);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { settings } = useSettings();

  // Use shared role hook for consistent cache behavior
  const { isAdmin, isDealer } = useUserRole();

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
  };

  return (
    <>
      {/* Skip Link for Keyboard Navigation (Accessibility) */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 
                   focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground 
                   focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Zum Hauptinhalt springen
      </a>
      
      {/* Top Header Bar */}
      <div className="w-full bg-slate-900 text-slate-300 py-2.5 hidden md:block border-b border-slate-800">
        <div className="container flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            {settings?.support_phone && (
              <a href={`tel:${settings.support_phone.replace(/\s/g, '')}`} className="flex items-center gap-2 hover:text-white transition-colors">
                <Phone className="h-3.5 w-3.5" />
                <span>{settings.support_phone}</span>
              </a>
            )}
            {settings?.contact_email && (
              <a href={`mailto:${settings.contact_email}`} className="flex items-center gap-2 hover:text-white transition-colors">
                <Mail className="h-3.5 w-3.5" />
                <span>{settings.contact_email}</span>
              </a>
            )}
          </div>
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-4">
              <Link to="/ueber-uns" className="hover:text-white transition-colors">Über uns</Link>
              <span className="text-slate-600">•</span>
              <Link to="/faq" className="hover:text-white transition-colors">FAQ</Link>
              <span className="text-slate-600">•</span>
              <Link to="/haendler" className="hover:text-white transition-colors flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Für Händler
              </Link>
            </div>
            <span className="text-slate-700">|</span>
            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 hover:text-white transition-colors focus:outline-none">
                  <span className="text-sm">{currentLanguage.flag}</span>
                  <span>{currentLanguage.code.toUpperCase()}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 bg-slate-900 border-slate-700">
                {languages.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => setCurrentLanguage(lang)}
                    className={`cursor-pointer flex items-center gap-2 text-slate-300 hover:text-white hover:bg-slate-800 focus:bg-slate-800 focus:text-white ${
                      currentLanguage.code === lang.code ? 'bg-slate-800 text-white' : ''
                    }`}
                  >
                    <span className="text-base">{lang.flag}</span>
                    <span>{lang.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur-md border-b border-border/50 shadow-sm">
        <nav className="container flex h-20 items-center justify-between">
          <SiteLogo variant="icon-text" />

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {/* Verkaufen Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button 
                  className={`text-sm font-medium transition-smooth flex items-center gap-1 ${
                    isActive('/verkaufen') || isActive('/wertermittlung') || isActive('/wertrechner') 
                      ? 'text-primary' 
                      : 'text-foreground/80 hover:text-primary'
                  }`}
                >
                  Verkaufen
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to="/verkaufen" className="cursor-pointer">
                    Wohnmobil verkaufen
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs text-muted-foreground">Wertermittlung</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link to="/wertermittlung" className="cursor-pointer">
                    Kostenlose Expertenbewertung
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/wertrechner" className="cursor-pointer">
                    Sofort-Wertrechner
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link 
              to="/kaufen" 
              className={`text-sm font-medium transition-smooth ${
                isActive('/kaufen') ? 'text-primary' : 'text-foreground/80 hover:text-primary'
              }`}
            >
              Kaufen
            </Link>
            <Link 
              to="/preise" 
              className={`text-sm font-medium transition-smooth ${
                isActive('/preise') ? 'text-primary' : 'text-foreground/80 hover:text-primary'
              }`}
            >
              Preise
            </Link>
            <Link 
              to="/ankaufstationen" 
              className={`text-sm font-medium transition-smooth ${
                isActive('/ankaufstationen') ? 'text-primary' : 'text-foreground/80 hover:text-primary'
              }`}
            >
              Ankaufstationen
            </Link>
            <Link 
              to="/ratgeber" 
              className={`text-sm font-medium transition-smooth ${
                isActive('/ratgeber') ? 'text-primary' : 'text-foreground/80 hover:text-primary'
              }`}
            >
              Ratgeber
            </Link>
            <Link 
              to="/kontakt" 
              className={`text-sm font-medium transition-smooth ${
                isActive('/kontakt') ? 'text-primary' : 'text-foreground/80 hover:text-primary'
              }`}
            >
              Kontakt
            </Link>
            <div className="h-6 w-px bg-border/50" />
            <DarkModeToggle />
            <div className="flex items-center gap-2">
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 px-5 text-sm font-medium gap-2">
                      <User className="h-4 w-4" />
                      Mein Konto
                    </Button>
                  </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Mein Konto</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link 
                      to={isAdmin ? "/admin" : "/dashboard"} 
                      className="cursor-pointer"
                    >
                      <User className="h-4 w-4 mr-2" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  {isDealer && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/dashboard/auctions" className="cursor-pointer">
                          Auktionen
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/dashboard/inventory" className="cursor-pointer">
                          Mein Inventar
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {!isDealer && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/verkaufen/wizard" className="cursor-pointer">
                          Wohnmobil verkaufen
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive">
                    <LogOut className="h-4 w-4 mr-2" />
                    Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="outline" className="h-10 px-5 text-sm font-medium">
                    Anmelden
                  </Button>
                </Link>
                <Link to="/register">
                  <Button className="h-10 px-5 text-sm font-semibold bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all">
                    Registrieren
                  </Button>
                </Link>
              </>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </nav>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t bg-background/95">
            <div className="container py-4 flex flex-col gap-4">
              <Link
                to="/verkaufen"
                className={`text-sm font-medium transition-smooth ${
                  isActive('/verkaufen') ? 'text-primary' : 'text-foreground/80 hover:text-primary'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Verkaufen
              </Link>
              <Link
                to="/wertermittlung"
                className={`text-sm font-medium transition-smooth pl-4 ${
                  isActive('/wertermittlung') ? 'text-primary' : 'text-foreground/60 hover:text-primary'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                → Expertenbewertung
              </Link>
              <Link
                to="/wertrechner"
                className={`text-sm font-medium transition-smooth pl-4 ${
                  isActive('/wertrechner') ? 'text-primary' : 'text-foreground/60 hover:text-primary'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                → Wertrechner
              </Link>
              <Link
                to="/kaufen"
                className={`text-sm font-medium transition-smooth ${
                  isActive('/kaufen') ? 'text-primary' : 'text-foreground/80 hover:text-primary'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Kaufen
              </Link>
              <Link
                to="/preise"
                className={`text-sm font-medium transition-smooth ${
                  isActive('/preise') ? 'text-primary' : 'text-foreground/80 hover:text-primary'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Preise
              </Link>
              <Link
                to="/ankaufstationen"
                className={`text-sm font-medium transition-smooth ${
                  isActive('/ankaufstationen') ? 'text-primary' : 'text-foreground/80 hover:text-primary'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Ankaufstationen
              </Link>
              <Link
                to="/ratgeber"
                className={`text-sm font-medium transition-smooth ${
                  isActive('/ratgeber') ? 'text-primary' : 'text-foreground/80 hover:text-primary'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Ratgeber
              </Link>
              <Link
                to="/kontakt"
                className={`text-sm font-medium transition-smooth ${
                  isActive('/kontakt') ? 'text-primary' : 'text-foreground/80 hover:text-primary'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Kontakt
              </Link>
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground/80">Dark Mode</span>
                <DarkModeSimpleToggle />
              </div>
              <div className="h-px bg-border/50" />
              {user ? (
                <>
                  <Link 
                    to={isAdmin ? "/admin" : "/dashboard"} 
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      <User className="h-4 w-4 mr-2" />
                      Dashboard
                    </Button>
                  </Link>
                  {!isDealer && (
                    <Link to="/verkaufen/wizard" onClick={() => setMobileMenuOpen(false)}>
                      <Button size="sm" className="w-full bg-primary hover:bg-primary/90">
                        Wohnmobil verkaufen
                      </Button>
                    </Link>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-destructive border-destructive/20 hover:bg-destructive/10"
                    onClick={handleSignOut}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Abmelden
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="flex-1">
                      <Button size="sm" variant="outline" className="w-full">
                        Anmelden
                      </Button>
                    </Link>
                    <Link to="/register" onClick={() => setMobileMenuOpen(false)} className="flex-1">
                      <Button size="sm" className="w-full bg-primary hover:bg-primary/90">
                        Registrieren
                      </Button>
                    </Link>
                  </div>
                  <Link 
                    to="/haendler" 
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-sm text-center text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    Für Händler
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
};

export default Header;
