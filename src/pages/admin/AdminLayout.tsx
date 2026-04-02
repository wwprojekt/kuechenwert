import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { AdminRoute } from "@/components/AdminRoute";

export default function AdminLayout() {
  return (
    <AdminRoute>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AdminSidebar />
          <div className="flex-1 flex flex-col">
            <header className="h-14 sm:h-16 border-b border-border flex items-center px-3 sm:px-6 bg-background sticky top-0 z-10">
              <SidebarTrigger />
            </header>
            <main className="flex-1 p-2 sm:p-4 lg:p-6 bg-muted/50">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </AdminRoute>
  );
}
