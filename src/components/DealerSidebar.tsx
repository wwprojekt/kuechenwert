import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Gavel,
  LogOut,
  Home,
  Zap,
  Calendar,
  MessageSquare,
  FileText,
  User,
  Settings,
  Lock,
  Heart,
  AlertTriangle,
  Search,
  ShoppingBag,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { SiteLogo } from "@/components/SiteLogo";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useDealerPending } from "@/hooks/useDealerPending";

// ============================================================================
// Dealer Badge Counts Hook
// ============================================================================

function useDealerBadges() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['dealerSidebarBadges', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const [
        activeAuctionsRes,
        notificationsRes,
        messagesRes,
        appointmentsRes,
        claimsRes,
      ] = await Promise.all([
        // Aktive Auktionen (Gesamtzahl)
        supabase.from('auctions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        // Ungelesene Benachrichtigungen
        supabase.from('dealer_notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
        // Offene Support-Nachrichten mit Admin-Antwort (neue Antworten)
        supabase.from('support_messages').select('*', { count: 'exact', head: true }).eq('user_id', user.id).not('admin_response', 'is', null).or('status.eq.open,status.is.null'),
        // Anstehende Termine
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'scheduled').gte('appointment_date', new Date().toISOString().split('T')[0]),
        // Offene Reklamationen mit Status-Update
        supabase.from('claims').select('*', { count: 'exact', head: true }).eq('dealer_id', user.id).or('status.eq.submitted,status.eq.in_review'),
      ]);

      return {
        activeAuctions: activeAuctionsRes.count ?? 0,
        notifications: notificationsRes.count ?? 0,
        messages: messagesRes.count ?? 0,
        appointments: appointmentsRes.count ?? 0,
        claims: claimsRes.count ?? 0,
      };
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

// ============================================================================
// Types & Menu Items
// ============================================================================

interface MenuItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  badgeKey?: string;
  showCountBadge?: boolean; // Zeigt Gesamtzahl (z.B. aktive Auktionen)
  /** If true, this item remains accessible even when the account is locked (pending/rejected) */
  allowWhenLocked?: boolean;
}

const menuItems: MenuItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, allowWhenLocked: true },
  { title: "Marktplatz", url: "/kaufen", icon: ShoppingBag, allowWhenLocked: true },
  { title: "Aktive Auktionen", url: "/dashboard/auctions", icon: Gavel, showCountBadge: true, badgeKey: "activeAuctions" },
  { title: "Inventar", url: "/dashboard/inventory", icon: Package },
  { title: "Meine Gebote", url: "/dashboard/bids", icon: Gavel },
  { title: "Meine Favoriten", url: "/dashboard/favorites", icon: Heart },
  { title: "Kaufchancen", url: "/dashboard/kaufchancen", icon: Zap },
  { title: "Suchaufträge", url: "/dashboard/search-alerts", icon: Search },
  { title: "Meine Termine", url: "/dashboard/appointments", icon: Calendar, badgeKey: "appointments" },
  { title: "Nachrichten", url: "/dashboard/messages", icon: MessageSquare, badgeKey: "messages" },
  { title: "Rechnungen", url: "/dashboard/invoices", icon: FileText },
  { title: "Reklamationen", url: "/dashboard/claims", icon: AlertTriangle, badgeKey: "claims" },
  { title: "Profil", url: "/dashboard/profile", icon: User, allowWhenLocked: true },
  { title: "Einstellungen", url: "/dashboard/settings", icon: Settings, allowWhenLocked: true },
];

// ============================================================================
// Badge Component (roter Punkt mit Zahl)
// ============================================================================

function DealerBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function DealerSidebar() {
  const { state } = useSidebar();
  const { signOut } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";
  const { isPendingDealer, isRejectedDealer } = useDealerPending();
  const isLocked = isPendingDealer || isRejectedDealer;
  const { data: badges } = useDealerBadges();

  const badgeCounts: Record<string, number> = {
    activeAuctions: badges?.activeAuctions || 0,
    notifications: badges?.notifications || 0,
    messages: badges?.messages || 0,
    appointments: badges?.appointments || 0,
    claims: badges?.claims || 0,
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
        <div className="p-4 border-b border-border">
          {!collapsed ? (
            <div className="space-y-1">
              <SiteLogo variant="icon-text-compact" linkTo="/" className="mb-2" />
              <p className="text-xs text-muted-foreground">
                {isLocked ? "Händler Portal (Antrag in Prüfung)" : "Händler Portal"}
              </p>
            </div>
          ) : (
            <SiteLogo variant="icon-only" linkTo="/" iconSize="h-8 w-8" />
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="font-semibold">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const itemLocked = isLocked && !item.allowWhenLocked;

                if (itemLocked) {
                  // Render a non-clickable, greyed-out item
                  return (
                    <SidebarMenuItem key={item.title}>
                      <div
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg opacity-40 cursor-not-allowed select-none"
                        title="Wird nach Freigabe verfügbar"
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
                        {!collapsed && (
                          <span className="flex items-center gap-2 text-muted-foreground">
                            {item.title}
                            <Lock className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    </SidebarMenuItem>
                  );
                }

                const badgeCount = item.badgeKey ? (badgeCounts[item.badgeKey] || 0) : 0;

                return (
                  <SidebarMenuItem key={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 font-medium ${
                          isActive
                            ? "bg-primary text-white shadow-sm"
                            : "hover:bg-muted"
                        }`
                      }
                    >
                      {collapsed ? (
                        <div className="relative">
                          <item.icon className="w-5 h-5 flex-shrink-0" />
                          {badgeCount > 0 && !item.showCountBadge && (
                            <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold text-white bg-red-500 rounded-full">
                              {badgeCount > 9 ? "9+" : badgeCount}
                            </span>
                          )}
                        </div>
                      ) : (
                        <>
                          <item.icon className="w-5 h-5 flex-shrink-0" />
                          <span className="flex-1">{item.title}</span>
                          {item.showCountBadge && badgeCount > 0 && (
                            <Badge variant={badgeCount > 0 ? 'default' : 'secondary'} className="text-xs px-1.5 py-0 h-5 min-w-[20px] justify-center">
                              {badgeCount}
                            </Badge>
                          )}
                          {!item.showCountBadge && badgeCount > 0 && (
                            <DealerBadge count={badgeCount} />
                          )}
                        </>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-2 sticky bottom-0 bg-sidebar z-10">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3"
          onClick={() => navigate("/")}
        >
          <Home className="w-5 h-5" />
          {!collapsed && <span>Zur Startseite</span>}
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 hover:bg-destructive/10 hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Abmelden</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
