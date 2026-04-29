import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Gavel,
  Users,
  Car,
  Settings,
  LogOut,
  BarChart3,
  Home,
  Building2,
  Calendar,
  HandshakeIcon,
  FileText,
  FileSignature,
  TrendingUp,
  Calculator,
  CreditCard,
  Scale,
  MessageCircle,
  MessageSquare,
  AlertTriangle,
  UserPlus,
  Mail,
  Shield,
  FileWarning,
  Star,
  ChevronDown,
  Inbox,
  DollarSign,
  Wrench,
  Database,
  TimerReset,
  Sparkles,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { SiteLogo } from "@/components/SiteLogo";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

// ============================================================================
// Badge Counts Hook – nutzt den geteilten Cache von AdminNotificationBell
// ============================================================================

import { useAdminNotificationCounts } from "@/components/admin/AdminNotificationBell";

function useSidebarBadges() {
  const { data } = useAdminNotificationCounts();
  return {
    data: data
      ? {
          leads: data.leads,
          messages: data.support,
          support: data.support,
          contacts: 0,
          dealers: data.dealers,
          questions: data.questions,
          unreadEmails: data.unreadEmails,
          reviews: data.reviews,
          claims: data.claims,
          appointments: data.appointments,
          offers: data.offers,
        }
      : undefined,
  };
}

// ============================================================================
// Types
// ============================================================================

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
  badgeKey?: string;
}

interface MenuGroup {
  label: string;
  icon: React.ElementType;
  items: MenuItem[];
  defaultOpen?: boolean;
}

// ============================================================================
// Menu Structure - Grouped
// ============================================================================

const menuGroups: MenuGroup[] = [
  {
    label: "Hauptbereich",
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [
      { title: "Übersicht", url: "/admin", icon: LayoutDashboard },
      { title: "Leads & Anfragen", url: "/admin/leads", icon: UserPlus, badgeKey: "leads" },
      { title: "Traumküchen-KI", url: "/admin/planner-sessions", icon: Sparkles },
      { title: "Wohnmobile", url: "/admin/kitchens", icon: Car },
      { title: "Auktionen", url: "/admin/auctions", icon: Gavel },
      { title: "Nachauktions-Angebote", url: "/admin/offers", icon: HandshakeIcon, badgeKey: "offers" },
    ],
  },
  {
    label: "Kommunikation",
    icon: Inbox,
    defaultOpen: true,
    items: [
      { title: "E-Mail-Center", url: "/admin/email", icon: Mail, badgeKey: "unreadEmails" },
      { title: "Support-Nachrichten", url: "/admin/messages", icon: MessageSquare, badgeKey: "support" },
      { title: "Fahrzeugfragen", url: "/admin/questions", icon: MessageCircle, badgeKey: "questions" },
      { title: "Google-Review-Outreach", url: "/admin/google-reviews", icon: Star },
    ],
  },
  {
    label: "Benutzer & Händler",
    icon: Users,
    defaultOpen: true,
    items: [
      { title: "Benutzer", url: "/admin/users", icon: Users },
      { title: "Händler", url: "/admin/dealers", icon: Building2, badgeKey: "dealers" },
      { title: "Händler-Statistik", url: "/admin/dealer-stats", icon: BarChart3 },
      { title: "Bewertungen", url: "/admin/reviews", icon: Star, badgeKey: "reviews" },
    ],
  },
  {
    label: "Finanzen",
    icon: DollarSign,
    defaultOpen: false,
    items: [
      { title: "Provisionen", url: "/admin/commissions", icon: Calculator },
      { title: "Kaufverträge", url: "/admin/contracts", icon: FileSignature },
      { title: "Finanzen", url: "/admin/financials", icon: CreditCard },
    ],
  },
  {
    label: "Betrieb",
    icon: Wrench,
    defaultOpen: false,
    items: [
      { title: "Ankaufstationen", url: "/admin/stations", icon: Building2 },
      { title: "Termine", url: "/admin/appointments", icon: Calendar, badgeKey: "appointments" },
      { title: "Übergabe", url: "/admin/handover", icon: HandshakeIcon },
      { title: "Reklamationen", url: "/admin/claims", icon: FileWarning, badgeKey: "claims" },
    ],
  },
  {
    label: "System",
    icon: Database,
    defaultOpen: false,
    items: [
      { title: "Analytics", url: "/admin/analytics", icon: TrendingUp },
      { title: "Blog", url: "/admin/blog", icon: FileText },
      { title: "Rechtliches", url: "/admin/legal", icon: Scale },
      { title: "Fehlerprotokoll", url: "/admin/error-logs", icon: AlertTriangle },
      { title: "Cron-Health", url: "/admin/cron-health", icon: TimerReset },
      { title: "Audit-Log", url: "/admin/audit-log", icon: Shield },
      { title: "Einstellungen", url: "/admin/settings", icon: Settings },
    ],
  },
];

// ============================================================================
// Badge Component
// ============================================================================

function SidebarBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ============================================================================
// Collapsible Group Component
// ============================================================================

function CollapsibleGroup({
  group,
  badges,
  collapsed,
}: {
  group: MenuGroup;
  badges: Record<string, number>;
  collapsed: boolean;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  // Mobile: Drawer nach Navigation automatisch schließen, sonst überdeckt das Sheet die neue Seite
  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
  };

  const storageKey = `admin-sidebar-group-${group.label}`;
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored !== null ? stored === "true" : (group.defaultOpen ?? true);
    } catch {
      return group.defaultOpen ?? true;
    }
  });

  const toggleGroup = () => {
    const next = !isOpen;
    setIsOpen(next);
    try { localStorage.setItem(storageKey, String(next)); } catch { /* ignore */ }
  };

  // Berechne Gesamt-Badge für die Gruppe
  const groupBadgeCount = group.items.reduce((sum, item) => {
    if (item.badgeKey && badges[item.badgeKey]) {
      return sum + badges[item.badgeKey];
    }
    return sum;
  }, 0);

  if (collapsed) {
    // Im collapsed Modus: Nur Icons zeigen, keine Gruppen-Header
    return (
      <div className="space-y-0.5 px-1">
        {group.items.map((item) => (
          <SidebarMenuItem key={item.title}>
            <NavLink
              to={item.url}
              end={item.url === "/admin"}
              title={item.title}
              onClick={handleNavClick}
              className={({ isActive }) =>
                `relative flex items-center justify-center p-2 rounded-lg transition-all duration-200 ${
                  isActive
                    ? "bg-primary text-white shadow-sm"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
                }`
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {item.badgeKey && badges[item.badgeKey] > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold text-white bg-red-500 rounded-full">
                  {badges[item.badgeKey] > 9 ? "9+" : badges[item.badgeKey]}
                </span>
              )}
            </NavLink>
          </SidebarMenuItem>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-1">
      {/* Group Header - Clickable to collapse/expand */}
      <button
        onClick={toggleGroup}
        className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <group.icon className="w-3.5 h-3.5" />
        <span className="flex-1 text-left">{group.label}</span>
        {groupBadgeCount > 0 && !isOpen && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold text-white bg-red-500 rounded-full">
            {groupBadgeCount}
          </span>
        )}
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
        />
      </button>

      {/* Group Items */}
      {isOpen && (
        <div className="space-y-0.5 px-1">
          {group.items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <NavLink
                to={item.url}
                end={item.url === "/admin"}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                    isActive
                      ? "bg-primary text-white shadow-sm"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
                  }`
                }
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{item.title}</span>
                {item.badgeKey && (
                  <SidebarBadge count={badges[item.badgeKey] || 0} />
                )}
              </NavLink>
            </SidebarMenuItem>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Sidebar Component
// ============================================================================

export function AdminSidebar() {
  const { state } = useSidebar();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";
  const { data: badges } = useSidebarBadges();

  const badgeCounts: Record<string, number> = {
    leads: badges?.leads || 0,
    messages: badges?.messages || 0,
    support: badges?.support || 0,
    contacts: badges?.contacts || 0,
    dealers: badges?.dealers || 0,
    questions: badges?.questions || 0,
    unreadEmails: badges?.unreadEmails || 0,
    reviews: badges?.reviews || 0,
    claims: badges?.claims || 0,
    appointments: badges?.appointments || 0,
    offers: badges?.offers || 0,
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent className="overflow-y-auto">
        {/* Logo Header */}
        <div className="p-4 border-b border-border">
          {!collapsed ? (
            <div className="space-y-1">
              <SiteLogo variant="icon-text-compact" className="mb-2" />
              <p className="text-xs text-muted-foreground">Admin Dashboard</p>
            </div>
          ) : (
            <SiteLogo variant="icon-only" iconSize="h-8 w-8" />
          )}
        </div>

        {/* Menu Groups */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuGroups.map((group) => (
                <CollapsibleGroup
                  key={group.label}
                  group={group}
                  badges={badgeCounts}
                  collapsed={collapsed}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-border p-2 sticky bottom-0 bg-sidebar z-10">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={() => navigate("/")}
        >
          <Home className="w-5 h-5" />
          {!collapsed && <span>Zur Startseite</span>}
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Abmelden</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
