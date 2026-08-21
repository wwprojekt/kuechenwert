import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Car,
  Gavel,
  User,
  LogOut,
  Plus,
  Home,
  Calendar,
  Heart,
  MessageSquare,
  FileText,
  Zap,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { SiteLogo } from "@/components/SiteLogo";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { ensureValidRLSSession } from "@/lib/sessionGuard";

// ============================================================================
// User Badge Counts Hook
// ============================================================================

function useUserBadges() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['userSidebarBadges', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return null;

      const [
        messagesRes,
        appointmentsRes,
      ] = await Promise.all([
        // Support-Nachrichten mit Admin-Antwort (offene Konversationen)
        supabase.from('support_messages').select('*', { count: 'exact', head: true }).eq('user_id', user.id).not('admin_response', 'is', null).or('status.eq.open,status.is.null'),
        // Anstehende Termine
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('seller_id', user.id).eq('status', 'scheduled').gte('appointment_date', new Date().toISOString().split('T')[0]),
      ]);

      return {
        messages: messagesRes.count ?? 0,
        appointments: appointmentsRes.count ?? 0,
      };
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

// ============================================================================
// Badge Component
// ============================================================================

function UserBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ============================================================================
// Types & Menu Items
// ============================================================================

/**
 * Menu items with role-based visibility.
 * - showForRoles: if set, item is ONLY shown for these roles (whitelist)
 * - hideForRoles: if set, item is hidden for these roles (blacklist)
 * - If neither is set, item is shown for all roles
 */
interface MenuItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  hideForRoles: string[];
  showForRoles?: string[];
  badgeKey?: string;
}

const baseMenuItems: MenuItem[] = [
  { title: "Übersicht", url: "/dashboard", icon: LayoutDashboard, hideForRoles: [] },
  { title: "Meine Inserate", url: "/dashboard/listings", icon: Car, hideForRoles: ['dealer'] },
  { title: "Meine Gebote", url: "/dashboard/bids", icon: Gavel, hideForRoles: ['seller'] },
  { title: "Meine Favoriten", url: "/dashboard/favorites", icon: Heart, hideForRoles: ['seller'] },
  { title: "Kaufchancen", url: "/dashboard/kaufchancen", icon: Zap, hideForRoles: ['seller'] },
  { title: "Meine Termine", url: "/dashboard/appointments", icon: Calendar, hideForRoles: ['seller'], badgeKey: "appointments" },
  { title: "Nachrichten", url: "/dashboard/messages", icon: MessageSquare, hideForRoles: [], badgeKey: "messages" },
  { title: "Rechnungen", url: "/dashboard/invoices", icon: FileText, showForRoles: ['dealer'] },
  { title: "Dokumente", url: "/dashboard/documents", icon: FileText, showForRoles: ['seller'] },
  { title: "Profil", url: "/dashboard/profile", icon: User, hideForRoles: [] },
];

/**
 * Roles that should see the "Neue Anfrage" button.
 * Dealers have their own dashboard with different CTAs.
 */
const ROLES_WITH_NEW_LISTING = ['seller'];

// ============================================================================
// Main Component
// ============================================================================

export function UserSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const { signOut } = useAuth();
  const { primaryRole } = useUserRole();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";
  const { data: badges } = useUserBadges();

  // Auf Mobile rendert die Sidebar als Sheet-Overlay. Nach Klick auf einen
  // Menüpunkt muss das Overlay geschlossen werden, sonst bleibt es vor dem
  // neu gerouteten Content stehen.
  const closeMobileIfOpen = () => {
    if (isMobile) setOpenMobile(false);
  };
  
  const badgeCounts: Record<string, number> = {
    messages: badges?.messages || 0,
    appointments: badges?.appointments || 0,
  };

  // Filter menu items based on user role
  const menuItems = baseMenuItems.filter(item => {
    const role = primaryRole || '';
    // If showForRoles is defined, only show for those roles
    if (item.showForRoles && item.showForRoles.length > 0) {
      return item.showForRoles.includes(role);
    }
    // Otherwise, hide for specified roles
    return !item.hideForRoles.includes(role);
  });

  // Bug 3.2 fix: Only show "Neues Inserat" button for seller role
  const showNewListingButton = ROLES_WITH_NEW_LISTING.includes(primaryRole || '');

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <Sidebar 
      className={`${collapsed ? "w-16" : "w-64"} border-r border-border/50 bg-gradient-to-b from-background to-muted/20`} 
      collapsible="icon"
    >
      <SidebarContent>
        {/* Brand Header */}
        <div className="p-4 mb-2">
          {!collapsed ? (
            <div className="space-y-1 animate-fade-in">
              <SiteLogo variant="icon-text-compact" className="mb-2" />
              <p className="text-xs text-muted-foreground">Mein Dashboard</p>
            </div>
          ) : (
            <SiteLogo variant="icon-only" iconSize="h-8 w-8" asLink={false} />
          )}
        </div>

        <Separator className="mb-4" />

        {/* Quick Actions – only for sellers */}
        {showNewListingButton && !collapsed && (
          <div className="px-3 mb-6 animate-fade-in">
            <Button
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-lg hover:shadow-xl transition-all"
              onClick={() => { closeMobileIfOpen(); navigate("/funnel/a"); }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Neue Anfrage
            </Button>
          </div>
        )}

        {showNewListingButton && collapsed && (
          <div className="px-2 mb-6">
            <Button
              size="icon"
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
              onClick={() => { closeMobileIfOpen(); navigate("/funnel/a"); }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Navigation */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider px-3 mb-2">
              Navigation
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 px-2">
              {menuItems.map((item, index) => {
                const badgeCount = item.badgeKey ? (badgeCounts[item.badgeKey] || 0) : 0;

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/dashboard"}
                        onClick={closeMobileIfOpen}
                        className={({ isActive }) =>
                          `group relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                            isActive
                              ? "bg-gradient-to-r from-primary/10 to-primary/5 text-primary font-medium shadow-sm"
                              : "hover:bg-muted/50 text-foreground/70 hover:text-foreground"
                          }`
                        }
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <span className="absolute left-0 w-1 h-8 bg-gradient-to-b from-primary to-primary/50 rounded-r-full" />
                            )}
                            {collapsed ? (
                              <div className="relative">
                                <item.icon 
                                  className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                                    isActive ? "text-primary" : ""
                                  }`} 
                                />
                                {badgeCount > 0 && (
                                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold text-white bg-red-500 rounded-full">
                                    {badgeCount > 9 ? "9+" : badgeCount}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <>
                                <item.icon 
                                  className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                                    isActive ? "text-primary" : ""
                                  }`} 
                                />
                                <span className="flex-1 text-sm">
                                  {item.title}
                                </span>
                                {badgeCount > 0 && (
                                  <UserBadge count={badgeCount} />
                                )}
                              </>
                            )}
                          </>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Quick Link to Main Site */}
        {!collapsed && (
          <>
            <Separator className="my-4" />
            <div className="px-3 mb-4">
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground hover:text-foreground"
                onClick={() => { closeMobileIfOpen(); navigate("/"); }}
              >
                <Home className="w-4 h-4 mr-2" />
                Zurück zur Website
              </Button>
            </div>
          </>
        )}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-border/50 p-3 sticky bottom-0 bg-sidebar z-10">
        <Button
          variant="ghost"
          className={`w-full ${
            collapsed ? "justify-center" : "justify-start"
          } text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors`}
          onClick={() => { closeMobileIfOpen(); handleSignOut(); }}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span className="ml-2">Abmelden</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
