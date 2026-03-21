import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Gavel,
  Users,
  Car,
  Settings,
  LogOut,
  Home,
  Building2,
  Calendar,
  HandshakeIcon,
  FileText,
  TrendingUp,
  Calculator,
  CreditCard,
  Scale,
  MessageCircle,
  MessageSquare,
  AlertTriangle,
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

const menuItems = [
  { title: "Übersicht", url: "/admin", icon: LayoutDashboard },
  { title: "Analytics", url: "/admin/analytics", icon: TrendingUp },
  { title: "Auktionen", url: "/admin/auctions", icon: Gavel },
  { title: "Wohnmobile", url: "/admin/motorhomes", icon: Car },
  { title: "Fahrzeugfragen", url: "/admin/questions", icon: MessageCircle },
  { title: "Support-Nachrichten", url: "/admin/messages", icon: MessageSquare },
  { title: "Benutzer", url: "/admin/users", icon: Users },
  { title: "Händler", url: "/admin/dealers", icon: Building2 },
  { title: "Provisionen", url: "/admin/commissions", icon: Calculator },
  { title: "Finanzen", url: "/admin/financials", icon: CreditCard },
  { title: "Ankaufstationen", url: "/admin/stations", icon: Building2 },
  { title: "Termine", url: "/admin/appointments", icon: Calendar },
  { title: "Übergabe", url: "/admin/handover", icon: HandshakeIcon },
  { title: "Blog", url: "/admin/blog", icon: FileText },
  { title: "Rechtliches", url: "/admin/legal", icon: Scale },
  { title: "Fehlerprotokoll", url: "/admin/error-logs", icon: AlertTriangle },
  { title: "Einstellungen", url: "/admin/settings", icon: Settings },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const collapsed = state === "collapsed";

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
              <SiteLogo variant="icon-text-compact" className="mb-2" />
              <p className="text-xs text-muted-foreground">Admin Dashboard</p>
            </div>
          ) : (
            <SiteLogo variant="icon-only" iconSize="h-8 w-8" />
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel style={{ color: '#111827' }} className="font-semibold">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <NavLink
                    to={item.url}
                    end={item.url === "/admin"}
                    style={{ color: '#111827' }}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 font-medium ${
                        isActive
                          ? "bg-primary !text-white shadow-sm"
                          : "hover:bg-gray-200 dark:hover:bg-gray-800"
                      }`
                    }
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
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
          style={{ color: '#111827' }}
          className="w-full justify-start gap-3 hover:bg-gray-100 dark:hover:bg-gray-800"
          onClick={() => navigate("/")}
        >
          <Home className="w-5 h-5" />
          {!collapsed && <span>Zur Startseite</span>}
        </Button>
        <Button
          variant="ghost"
          style={{ color: '#111827' }}
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
