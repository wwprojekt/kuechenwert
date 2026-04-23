import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminRoute } from "@/components/AdminRoute";
import { AdminCommandPalette } from "@/components/admin/AdminCommandPalette";
import { AdminNotificationBell } from "@/components/admin/AdminNotificationBell";
import { AdminBreadcrumbs } from "@/components/admin/AdminBreadcrumbs";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function AdminLayout() {
  const { user } = useAuth();
  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "AD";

  return (
    <AdminRoute>
      <SidebarProvider>
        <div className="min-h-[100dvh] flex w-full overflow-hidden">
          <AdminSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 sm:h-16 border-b border-border flex items-center gap-2 sm:gap-4 px-3 sm:px-6 bg-background sticky top-0 z-10">
              <SidebarTrigger className="flex-shrink-0" />

              {/* Breadcrumbs – Mobile: nur Home + letzter Krümel; Desktop: voller Pfad */}
              <AdminBreadcrumbs />

              {/* Platz füllen */}
              <div className="flex-1" />

              {/* Globale Suche */}
              <AdminCommandPalette />

              {/* Benachrichtigungsglocke */}
              <AdminNotificationBell />

              {/* Admin-Avatar */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Avatar className="h-8 w-8 flex-shrink-0 cursor-default">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">{user?.email || "Admin"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </header>
            <main className="flex-1 p-2 sm:p-4 lg:p-6 bg-muted/50 overflow-x-hidden overflow-y-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AdminRoute>
  );
}
