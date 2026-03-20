import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { UserSidebar } from "@/components/UserSidebar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function DashboardLayout() {
  const { user } = useAuth();
  const { settings } = useSettings();

  const userInitials = user?.email
    ?.split("@")[0]
    .substring(0, 2)
    .toUpperCase() || "U";

  return (
    <ProtectedRoute>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-muted/20">
          <UserSidebar />
          <div className="flex-1 flex flex-col">
            {/* Modern Header */}
            <header className="h-20 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-10">
              <div className="h-full px-6 lg:px-8 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <SidebarTrigger className="hover:bg-primary/10 hover:text-primary transition-colors" />
                </div>

                {/* User Section */}
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-3">
                    <Avatar className="h-10 w-10 ring-2 ring-primary/20 hover:ring-primary/40 transition-all cursor-pointer">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground font-semibold">
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden lg:block">
                      <p className="text-sm font-medium text-foreground leading-none mb-1">
                        {user?.email?.split("@")[0]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {settings?.site_name || "CaravanWert"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 p-6 lg:p-8 xl:p-10">
              <div className="max-w-7xl mx-auto">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
