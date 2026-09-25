import { Button } from "@/components/ui/button";
import {
  Briefcase,
  Building2,
  Calculator,
  ClipboardList,
  FileText,
  FolderOpen,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Phone,
  Sparkles,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { DarkModeToggle, DarkModeSimpleToggle } from "@/components/DarkModeToggle";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { BRAND } from "@/lib/brand/config";
import { useUserRole } from "@/hooks/useUserRole";
import { SiteLogo } from "@/components/SiteLogo";
import { trackPhoneClick, trackEmailClick } from "@/lib/gadsConversionService";
import { trackMetaPhoneClick } from "@/lib/metaPixelService";
import NotificationCenter from "@/components/NotificationCenter";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  to: string;
  label: string;
  icon?: LucideIcon;
  /** Erst ab xl – zwischen 1024 und 1280 px passt die Leiste sonst nicht neben das Logo. */
  wideOnly?: boolean;
  /** Weitere Pfade, unter denen der Eintrag als aktiv gilt (z. B. die Funnel-Schritte hinter der Landing). */
  activePaths?: string[];
}

const MAIN_NAV: NavItem[] = [
  { to: "/formular", label: "Angebote holen", activePaths: ["/funnel/a"] },
  { to: "/funnel/b", label: "Preis unterbieten" },
  { to: "/kuechenrechner", label: "KüchenRechner", wideOnly: true },
  { to: "/kuechenstudios", label: "Küchenstudios", wideOnly: true },
];

const TOP_NAV: NavItem[] = [
  { to: "/ueber-uns", label: "Über uns" },
  { to: "/ratgeber", label: "Ratgeber" },
  { to: "/faq", label: "FAQ" },
  { to: "/kontakt", label: "Kontakt" },
  { to: "/projekt", label: "Mein Projekt", icon: FolderOpen },
];

interface AccountLink {
  to: string;
  label: string;
  icon: LucideIcon;
}

const ADMIN_ACCOUNT: AccountLink[] = [{ to: "/admin", label: "Admin Dashboard", icon: LayoutDashboard }];

const DEALER_ACCOUNT: AccountLink[] = [
  { to: "/dashboard", label: "Übersicht", icon: LayoutDashboard },
  { to: "/dashboard/projekte", label: "Projekt-Börse", icon: Briefcase },
  { to: "/dashboard/projekte?tab=mine", label: "Meine Angebote & Kunden", icon: HandCoins },
  { to: "/dashboard/messages", label: "Nachrichten", icon: MessageSquare },
  { to: "/dashboard/invoices", label: "Rechnungen", icon: FileText },
  { to: "/dashboard/profile", label: "Profil", icon: User },
];

const CONSUMER_ACCOUNT: AccountLink[] = [
  { to: "/dashboard", label: "Übersicht", icon: LayoutDashboard },
  { to: "/dashboard/listings", label: "Meine Inserate", icon: ClipboardList },
  { to: "/dashboard/messages", label: "Nachrichten", icon: MessageSquare },
  { to: "/dashboard/documents", label: "Dokumente", icon: FileText },
  { to: "/dashboard/profile", label: "Profil", icon: User },
];

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { settings } = useSettings();
  const { isAdmin, isDealer } = useUserRole();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const isNavActive = (item: NavItem) => isActive(item.to) || (item.activePaths ?? []).some(isActive);
  const phone = settings?.support_phone || "+49 511 51532476";
  const email = settings?.contact_email || BRAND.supportEmail;
  const accountLinks = isAdmin ? ADMIN_ACCOUNT : isDealer ? DEALER_ACCOUNT : CONSUMER_ACCOUNT;

  const handleSignOut = async () => {
    await signOut();
    setMobileMenuOpen(false);
  };

  // Menü schließt bei jeder Navigation, sonst überlagert es die neue Seite.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKey);
    };
  }, [mobileMenuOpen]);

  const plannerActive = isActive("/funnel/c") || isActive("/traumkueche");

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4
                   focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground
                   focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        Zum Hauptinhalt springen
      </a>

      {/* Top Header Bar */}
      <div className="w-full bg-slate-900 text-slate-300 py-2.5 hidden lg:block border-b border-slate-800">
        <div className="container flex items-center justify-between text-sm">
          <div className="flex items-center gap-6">
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              onClick={() => {
                trackPhoneClick(phone, location.pathname);
                trackMetaPhoneClick();
              }}
              className="flex items-center gap-2 hover:text-white transition-colors"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>{phone}</span>
            </a>
            <a href={`mailto:${email}`} onClick={() => trackEmailClick(location.pathname)} className="hidden xl:flex items-center gap-2 hover:text-white transition-colors">
              <Mail className="h-3.5 w-3.5" />
              <span>{email}</span>
            </a>
          </div>
          <div className="flex items-center gap-4">
            {TOP_NAV.map((item, i) => (
              <span key={item.to} className="flex items-center gap-4">
                {i > 0 && <span className="text-slate-600">•</span>}
                <Link to={item.to} className="flex items-center gap-1.5 hover:text-white transition-colors">
                  {item.icon && <item.icon className="h-3.5 w-3.5" />}
                  {item.label}
                </Link>
              </span>
            ))}
            <span className="text-slate-600">•</span>
            <Link to="/haendler" className="flex items-center gap-1.5 font-semibold text-white hover:text-primary-foreground/80 transition-colors">
              <Building2 className="h-3.5 w-3.5" />
              Für Küchenstudios
            </Link>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur-md border-b border-border/50 shadow-sm safe-top">
        <nav className="container flex h-20 items-center justify-between gap-4" aria-label="Hauptnavigation">
          <SiteLogo variant="icon-text" />

          <div className="hidden lg:flex items-center gap-5">
            <Link
              to="/funnel/c"
              aria-current={plannerActive ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold shadow-sm transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                plannerActive ? "bg-primary text-primary-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md",
              )}
            >
              <Sparkles className="h-4 w-4" />
              Traumküche planen
            </Link>
            {MAIN_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={isNavActive(item) ? "page" : undefined}
                className={cn(
                  "whitespace-nowrap text-sm font-medium transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isNavActive(item) ? "text-primary" : "text-foreground/80 hover:text-primary",
                  item.wideOnly && "hidden xl:inline",
                )}
              >
                {item.label}
              </Link>
            ))}
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
                  <DropdownMenuContent align="end" className="w-60">
                    <DropdownMenuLabel className="flex flex-col">
                      <span className="text-sm font-medium">Mein Konto</span>
                      <span className="text-xs text-muted-foreground font-normal truncate max-w-[200px]">{user.email}</span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {accountLinks.map((item) => (
                      <DropdownMenuItem key={item.to} asChild>
                        <Link to={item.to} className="cursor-pointer">
                          <item.icon className="h-4 w-4 mr-2" />
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10">
                      <LogOut className="h-4 w-4 mr-2" />
                      Abmelden
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button asChild variant="outline" className="h-10 px-5 text-sm font-medium">
                  <Link to="/login">Anmelden</Link>
                </Button>
              )}
            </div>
          </div>

          {/* Mobile */}
          <div className="lg:hidden flex items-center gap-1">
            {!plannerActive && (
              <Button asChild size="sm" className="h-9 gap-1.5 px-3 font-semibold">
                <Link to="/funnel/c">
                  <Sparkles className="h-4 w-4" />
                  Planen
                </Link>
              </Button>
            )}
            {user && isDealer && <NotificationCenter />}
            <button
              className="p-2.5"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Menü schließen" : "Menü öffnen"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </nav>

        {mobileMenuOpen && (
          <div id="mobile-menu" className="lg:hidden border-t bg-background/95 max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain">
            <div className="container py-4 flex flex-col gap-1 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Link
                to="/funnel/c"
                className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <Sparkles className="h-4 w-4" />
                Traumküche planen (KI)
              </Link>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <Link to="/formular" className="rounded-lg bg-primary/10 px-3 py-2.5 text-center text-sm font-semibold text-primary hover:bg-primary/15">
                  Angebote holen
                </Link>
                <Link to="/funnel/b" className="rounded-lg bg-primary/10 px-3 py-2.5 text-center text-sm font-semibold text-primary hover:bg-primary/15">
                  Preis unterbieten
                </Link>
              </div>
              <Link to="/kuechenrechner" className="mt-2 flex items-center gap-2 py-3 text-sm font-medium text-foreground/80 hover:text-primary">
                <Calculator className="h-4 w-4" />
                KüchenRechner (Preis-Check)
              </Link>
              {[{ to: "/kuechenstudios", label: "Küchenstudios & Showrooms" }, ...TOP_NAV].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn("py-3 text-sm font-medium transition-colors", isActive(item.to) ? "text-primary" : "text-foreground/80 hover:text-primary")}
                >
                  {item.label}
                </Link>
              ))}
              <div className="h-px bg-border/50" />
              <div className="flex items-center justify-between py-1">
                <span className="text-sm font-medium text-foreground/80">Dark Mode</span>
                <DarkModeSimpleToggle />
              </div>
              <div className="h-px bg-border/50" />
              {user ? (
                <>
                  <p className="text-xs text-muted-foreground truncate pt-1">{user.email}</p>
                  <div className="flex flex-col gap-1">
                    {accountLinks.map((item) => (
                      <Button key={item.to} asChild variant="ghost" size="sm" className="w-full justify-start">
                        <Link to={item.to}>
                          <item.icon className="h-4 w-4 mr-2" />
                          {item.label}
                        </Link>
                      </Button>
                    ))}
                  </div>
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
                <div className="flex flex-col gap-2 pt-1">
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link to="/login">Anmelden</Link>
                  </Button>
                  <Link
                    to="/haendler"
                    className="flex items-center justify-center gap-1.5 py-2 text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    <Building2 className="h-3.5 w-3.5" />
                    Für Küchenstudios
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
};

export default Header;
