import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";

interface MenuItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  showBadge?: boolean;
}

const menuItems: MenuItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Aktive Auktionen", url: "/dashboard/auctions", icon: Gavel, showBadge: true },
  { title: "Inventar", url: "/dashboard/inventory", icon: Package },
  { title: "Meine Gebote", url: "/dashboard/bids", icon: Gavel },
  { title: "Kaufchancen", url: "/dashboard/kaufchancen", icon: Zap },
  { title: "Meine Termine", url: "/dashboard/appointments", icon: Calendar },
  { title: "Nachrichten", url: "/dashboard/messages", icon: MessageSquare },
  { title: "Rechnungen", url: "/dashboard/invoices", icon: FileText },
  { title: "Profil", url: "/dashboard/profile", icon: User },
  { title: "Einstellungen", url: "/dashboard/settings", icon: Settings },
];

export function DealerSidebar() {
  const { state } = useSidebar();
  const { signOut } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";
  const [activeAuctionCount, setActiveAuctionCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchAuctionCount = async () => {
      const { count } = await supabase
        .from('auctions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      setActiveAuctionCount(count ?? 0);
    };
    fetchAuctionCount();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent>
        <div className="p-4 border-b border-border">
          {!collapsed ? (
            <div className="space-y-1">
              <img 
                src="/logo.png" 
                alt={settings?.site_name || 'CaravanWert'} 
                className="h-10 w-auto mb-2" 
              />
              <p className="text-xs text-muted-foreground">Händler Portal</p>
            </div>
          ) : (
            <img 
              src="/logo.png" 
              alt={settings?.site_name || 'CaravanWert'} 
              className="h-8 w-8 object-contain" 
            />
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="font-semibold">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <NavLink
                    to={item.url}
                    end={item.url === "/dealer"}
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
                        {item.showBadge && activeAuctionCount !== null && (
                          <Badge variant={activeAuctionCount > 0 ? 'default' : 'secondary'} className="text-xs px-1.5 py-0 h-5 min-w-[20px] justify-center">
                            {activeAuctionCount}
                          </Badge>
                        )}
                      </span>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              ))}
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
