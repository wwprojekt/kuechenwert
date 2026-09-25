import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  LogOut,
  Home,
  MessageSquare,
  FileText,
  User,
  Settings,
  Lock,
  ClipboardList,
  HandCoins,
  PlusCircle,
  Briefcase,
  MapPinned,
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
import { ensureValidRLSSession } from "@/lib/sessionGuard";
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
      const sessionValid = await ensureValidRLSSession();
      if (!sessionValid) return null;

      const [notificationsRes, messagesRes] = await Promise.all([
        supabase.from('dealer_notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
        supabase.from('support_messages').select('id', { count: 'exact', head: true }).eq('user_id', user.id).not('admin_response', 'is', null).or('status.eq.open,status.is.null'),
      ]);

      return {
        notifications: notificationsRes.count ?? 0,
        messages: messagesRes.count ?? 0,
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
  showCountBadge?: boolean;
  /** If true, this item remains accessible even when the account is locked (pending/rejected) */
  allowWhenLocked?: boolean;
  /** If true, this item gets a special visual highlight in the sidebar */
  highlight?: boolean;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: "Übersicht",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, allowWhenLocked: true },
    ],
  },
  {
    label: "Kundenprojekte",
    items: [
      { title: "Projekt-Börse", url: "/dashboard/projekte", icon: Briefcase, highlight: true },
      { title: "Meine Angebote & Kunden", url: "/dashboard/projekte?tab=mine", icon: HandCoins },
      { title: "Einzugsgebiet", url: "/dashboard/projekte/einstellungen", icon: MapPinned },
    ],
  },
  {
    label: "Ausstellungsküchen",
    items: [
      { title: "Meine Inserate", url: "/dashboard/listings", icon: ClipboardList },
      { title: "Küche inserieren", url: "/dashboard/listings/new", icon: PlusCircle },
    ],
  },
  {
    label: "Konto",
    items: [
      { title: "Nachrichten", url: "/dashboard/messages", icon: MessageSquare, badgeKey: "messages" },
      { title: "Rechnungen", url: "/dashboard/invoices", icon: FileText },
      { title: "Profil", url: "/dashboard/profile", icon: User, allowWhenLocked: true },
      { title: "Einstellungen", url: "/dashboard/settings", icon: Settings, allowWhenLocked: true },
    ],
  },
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
  const { state, setOpenMobile, isMobile } = useSidebar();
  const { signOut } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";
  const { isPendingDealer, isRejectedDealer } = useDealerPending();
  const isLocked = isPendingDealer || isRejectedDealer;
  const { data: badges } = useDealerBadges();

  // Auf Mobile rendert die Sidebar als Sheet-Overlay. Ohne diesen Helper
  // bleibt das Overlay nach einem Klick auf einen Menüpunkt offen und
  // verdeckt den frisch geladenen Content – fühlt sich wie ein Bug an.
  const closeMobileIfOpen = () => {
    if (isMobile) setOpenMobile(false);
  };

  const badgeCounts: Record<string, number> = {
    notifications: badges?.notifications || 0,
    messages: badges?.messages || 0,
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

        {menuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="font-semibold">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const itemLocked = isLocked && !item.allowWhenLocked;

                  if (itemLocked) {
                    return (
                      <SidebarMenuItem key={item.title}>
                        <div
                          className="flex items-center gap-3 px-3 py-3 rounded-lg opacity-40 cursor-not-allowed select-none min-h-[44px]"
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
                        onClick={closeMobileIfOpen}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 font-medium min-h-[44px] ${
                            isActive
                              ? "bg-primary text-white shadow-sm"
                              : item.highlight
                                ? "text-primary bg-primary/5 hover:bg-primary/10 ring-1 ring-primary/20"
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
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-2 sticky bottom-0 bg-sidebar z-10">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 min-h-[44px]"
          onClick={() => { closeMobileIfOpen(); navigate("/"); }}
        >
          <Home className="w-5 h-5" />
          {!collapsed && <span>Zur Startseite</span>}
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 min-h-[44px] text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => { closeMobileIfOpen(); handleSignOut(); }}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Abmelden</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
