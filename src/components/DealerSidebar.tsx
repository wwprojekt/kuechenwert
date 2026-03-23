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

interface MenuItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  showBadge?: boolean;
  /** If true, this item remains accessible even when the account is locked (pending/rejected) */
  allowWhenLocked?: boolean;
}

const menuItems: MenuItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, allowWhenLocked: true },
  { title: "Aktive Auktionen", url: "/dashboard/auctions", icon: Gavel, showBadge: true },
  { title: "Inventar", url: "/dashboard/inventory", icon: Package },
  { title: "Meine Gebote", url: "/dashboard/bids", icon: Gavel },
  { title: "Kaufchancen", url: "/dashboard/kaufchancen", icon: Zap },
  { title: "Meine Termine", url: "/dashboard/appointments", icon: Calendar },
  { title: "Nachrichten", url: "/dashboard/messages", icon: MessageSquare },
  { title: "Rechnungen", url: "/dashboard/invoices", icon: FileText },
  { title: "Profil", url: "/dashboard/profile", icon: User, allowWhenLocked: true },
  { title: "Einstellungen", url: "/dashboard/settings", icon: Settings, allowWhenLocked: true },
];

export function DealerSidebar() {
  const { state } = useSidebar();
  const { signOut } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";
  const { isPendingDealer, isRejectedDealer } = useDealerPending();
  const isLocked = isPendingDealer || isRejectedDealer;

  // Bug 2.4 + 2.5 fix: Use React Query instead of useEffect+useState,
  // and count only active auctions (all auctions visible to dealers)
  const { data: activeAuctionCount } = useQuery({
    queryKey: ['dealerActiveAuctionCount'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('auctions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      if (error) return 0;
      return count ?? 0;
    },
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
    refetchOnWindowFocus: true,
  });

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
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && (
                        <span className="flex items-center gap-2">
                          {item.title}
                          {item.showBadge && activeAuctionCount != null && (
                            <Badge variant={activeAuctionCount > 0 ? 'default' : 'secondary'} className="text-xs px-1.5 py-0 h-5 min-w-[20px] justify-center">
                              {activeAuctionCount}
                            </Badge>
                          )}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-2">
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
