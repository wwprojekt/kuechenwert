import { Button } from "@/components/ui/button";
import { Menu, X, Phone, Mail, LogOut, User, ChevronDown, Building2, LayoutDashboard, Car, Gavel, Heart, Calendar, MessageSquare, FileText, Zap } from "lucide-react";
import { DarkModeToggle, DarkModeSimpleToggle } from "@/components/DarkModeToggle";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useUserRole } from "@/hooks/useUserRole";
import { SiteLogo } from "@/components/SiteLogo";
import { trackPhoneClick, trackEmailClick } from "@/lib/gadsConversionService";
import { trackMetaPhoneClick } from "@/lib/metaPixelService";
import NotificationCenter from "@/components/NotificationCenter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Language selector removed – site is German-only for now

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Language state removed – site is German-only
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
              <a href={`tel:${settings.support_phone.replace(/\s/g, '')}`} onClick={() => { trackPhoneClick(settings.support_phone || '', location.pathname); trackMetaPhoneClick(); }} className="flex items-center gap-2 hover:text-white transition-colors">
                <Phone className="h-3.5 w-3.5" />
                <span>{settings.support_phone}</span>
              </a>
            )}
            {settings?.contact_email && (
              <a href={`mailto:${settings.contact_email}`} onClick={() => trackEmailClick(location.pathname)} className="flex items-center gap-2 hover:text-white transition-colors">
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
            {/* Language selector removed – site is German-only */}
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur-md border-b border-border/50 shadow-sm safe-top">
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
                  <Link to="/verkaufen/wizard" className="cursor-pointer font-semibold text-primary bg-primary/5 focus:bg-primary/10">
                    Jetzt verkaufen
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/verkaufen" className="cursor-pointer">
                    So funktioniert's
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
              className={`text-sm font-semibold transition-smooth px-3 py-1.5 rounded-full ${
                isActive('/kaufen') 
                  ? 'bg-primary text-white shadow-sm' 
                  : 'text-primary bg-primary/10 hover:bg-primary/15'
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
              {user && isDealer && <NotificationCenter />}
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 px-5 text-sm font-medium gap-2">
                      <User className="h-4 w-4" />
                      Mein Konto
                    </Button>
                  </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">Mein Konto</span>
                      <span className="text-xs text-muted-foreground font-normal truncate max-w-[180px]">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {isAdmin ? (
                    <DropdownMenuItem asChild>
                      <Link to="/admin" className="cursor-pointer">
                        <LayoutDashboard className="h-4 w-4 mr-2" />
                        Admin Dashboard
                      </Link>
                    </DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem asChild>
                        <Link to="/dashboard" className="cursor-pointer">
                          <LayoutDashboard className="h-4 w-4 mr-2" />
                          Übersicht
                        </Link>
                      </DropdownMenuItem>
                      {!isDealer && (
                        <DropdownMenuItem asChild>
                          <Link to="/dashboard/listings" className="cursor-pointer">
                            <Car className="h-4 w-4 mr-2" />
                            Meine Inserate
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {isDealer && (
                        <>
                          <DropdownMenuItem asChild>
                            <Link to="/dashboard/bids" className="cursor-pointer">
                              <Gavel className="h-4 w-4 mr-2" />
                              Meine Gebote
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/dashboard/favorites" className="cursor-pointer">
                              <Heart className="h-4 w-4 mr-2" />
                              Meine Favoriten
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/dashboard/kaufchancen" className="cursor-pointer">
                              <Zap className="h-4 w-4 mr-2" />
                              Kaufchancen
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/dashboard/appointments" className="cursor-pointer">
                              <Calendar className="h-4 w-4 mr-2" />
                              Meine Termine
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem asChild>
                        <Link to="/dashboard/messages" className="cursor-pointer">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Nachrichten
                        </Link>
                      </DropdownMenuItem>
                      {isDealer && (
                        <DropdownMenuItem asChild>
                          <Link to="/dashboard/invoices" className="cursor-pointer">
                            <FileText className="h-4 w-4 mr-2" />
                            Rechnungen
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {!isDealer && (
                        <DropdownMenuItem asChild>
                          <Link to="/dashboard/documents" className="cursor-pointer">
                            <FileText className="h-4 w-4 mr-2" />
                            Dokumente
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/dashboard/profile" className="cursor-pointer">
                          <User className="h-4 w-4 mr-2" />
                          Profil
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
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

          {/* Mobile Notification + Menu Buttons */}
          <div className="lg:hidden flex items-center gap-1">
            {user && isDealer && <NotificationCenter />}
            <button
              className="p-2.5"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
            </button>
          </div>
        </nav>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t bg-background/95">
            <div className="container py-4 flex flex-col gap-1">
              <Link
                to="/verkaufen/wizard"
                className="flex items-center justify-center gap-2 text-sm font-semibold py-3 px-4 rounded-lg bg-primary text-white shadow-sm hover:bg-primary/90 transition-all"
                onClick={() => setMobileMenuOpen(false)}
              >
                Jetzt verkaufen
              </Link>
              <Link
                to="/verkaufen"
                className={`text-sm font-medium transition-smooth pl-4 py-2.5 ${
                  isActive('/verkaufen') ? 'text-primary' : 'text-foreground/60 hover:text-primary'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                → So funktioniert's
              </Link>
              <Link
                to="/wertermittlung"
                className={`text-sm font-medium transition-smooth pl-4 py-2.5 ${
                  isActive('/wertermittlung') ? 'text-primary' : 'text-foreground/60 hover:text-primary'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                → Expertenbewertung
              </Link>
              <Link
                to="/wertrechner"
                className={`text-sm font-medium transition-smooth pl-4 py-2.5 ${
                  isActive('/wertrechner') ? 'text-primary' : 'text-foreground/60 hover:text-primary'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                → Wertrechner
              </Link>
              <Link
                to="/kaufen"
                className={`text-sm font-semibold transition-smooth py-2.5 px-4 rounded-lg ${
                  isActive('/kaufen') 
                    ? 'bg-primary text-white shadow-sm' 
                    : 'text-primary bg-primary/10 hover:bg-primary/15'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Kaufen
              </Link>
              <Link
                to="/preise"
                className={`text-sm font-medium transition-smooth py-3 ${
                  isActive('/preise') ? 'text-primary' : 'text-foreground/80 hover:text-primary'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Preise
              </Link>
              <Link
                to="/ankaufstationen"
                className={`text-sm font-medium transition-smooth py-3 ${
                  isActive('/ankaufstationen') ? 'text-primary' : 'text-foreground/80 hover:text-primary'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Ankaufstationen
              </Link>
              <Link
                to="/ratgeber"
                className={`text-sm font-medium transition-smooth py-3 ${
                  isActive('/ratgeber') ? 'text-primary' : 'text-foreground/80 hover:text-primary'
                }`}
                onClick={() => setMobileMenuOpen(false)}
              >
                Ratgeber
              </Link>
              <Link
                to="/kontakt"
                className={`text-sm font-medium transition-smooth py-3 ${
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
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  {isAdmin ? (
                    <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full">
                        <LayoutDashboard className="h-4 w-4 mr-2" />
                        Admin Dashboard
                      </Button>
                    </Link>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="outline" size="sm" className="w-full justify-start">
                          <LayoutDashboard className="h-4 w-4 mr-2" />
                          Übersicht
                        </Button>
                      </Link>
                      {!isDealer && (
                        <Link to="/dashboard/listings" onClick={() => setMobileMenuOpen(false)}>
                          <Button variant="ghost" size="sm" className="w-full justify-start">
                            <Car className="h-4 w-4 mr-2" />
                            Meine Inserate
                          </Button>
                        </Link>
                      )}
                      {isDealer && (
                        <>
                          <Link to="/dashboard/bids" onClick={() => setMobileMenuOpen(false)}>
                            <Button variant="ghost" size="sm" className="w-full justify-start">
                              <Gavel className="h-4 w-4 mr-2" />
                              Meine Gebote
                            </Button>
                          </Link>
                          <Link to="/dashboard/favorites" onClick={() => setMobileMenuOpen(false)}>
                            <Button variant="ghost" size="sm" className="w-full justify-start">
                              <Heart className="h-4 w-4 mr-2" />
                              Meine Favoriten
                            </Button>
                          </Link>
                          <Link to="/dashboard/kaufchancen" onClick={() => setMobileMenuOpen(false)}>
                            <Button variant="ghost" size="sm" className="w-full justify-start">
                              <Zap className="h-4 w-4 mr-2" />
                              Kaufchancen
                            </Button>
                          </Link>
                          <Link to="/dashboard/appointments" onClick={() => setMobileMenuOpen(false)}>
                            <Button variant="ghost" size="sm" className="w-full justify-start">
                              <Calendar className="h-4 w-4 mr-2" />
                              Meine Termine
                            </Button>
                          </Link>
                        </>
                      )}
                      <Link to="/dashboard/messages" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="ghost" size="sm" className="w-full justify-start">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Nachrichten
                        </Button>
                      </Link>
                      {isDealer && (
                        <Link to="/dashboard/invoices" onClick={() => setMobileMenuOpen(false)}>
                          <Button variant="ghost" size="sm" className="w-full justify-start">
                            <FileText className="h-4 w-4 mr-2" />
                            Rechnungen
                          </Button>
                        </Link>
                      )}
                      {!isDealer && (
                        <Link to="/dashboard/documents" onClick={() => setMobileMenuOpen(false)}>
                          <Button variant="ghost" size="sm" className="w-full justify-start">
                            <FileText className="h-4 w-4 mr-2" />
                            Dokumente
                          </Button>
                        </Link>
                      )}
                      <Link to="/dashboard/profile" onClick={() => setMobileMenuOpen(false)}>
                        <Button variant="ghost" size="sm" className="w-full justify-start">
                          <User className="h-4 w-4 mr-2" />
                          Profil
                        </Button>
                      </Link>
                    </div>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full text-destructive border-destructive/30 bg-destructive/5 hover:bg-destructive/10"
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
