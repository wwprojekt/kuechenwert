/**
 * Smart Dashboard Component
 * Automatically routes users to appropriate dashboard based on their role
 */

import React, { useEffect, Suspense } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Loader2 } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { DealerSidebar } from '@/components/DealerSidebar';
import { UserSidebar } from '@/components/UserSidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// Import dashboard components (non-lazy for main views)
import DealerDashboard from '@/pages/dealer/DealerDashboard';
import DashboardOverview from '@/pages/dashboard/DashboardOverview';

/**
 * Module-level lazy imports for code splitting
 * IMPORTANT: React.lazy() must be called at module level, NOT inside render functions
 */
const DealerAuctions = React.lazy(() => import('@/pages/dealer/DealerAuctions'));
const DealerInventory = React.lazy(() => import('@/pages/dealer/DealerInventory'));
const ListingEdit = React.lazy(() => import('@/pages/dashboard/ListingEdit'));
const ListingDetail = React.lazy(() => import('@/pages/dashboard/ListingDetail'));
const MyListings = React.lazy(() => import('@/pages/dashboard/MyListings'));
const MyBids = React.lazy(() => import('@/pages/dashboard/MyBids'));
const MyAppointments = React.lazy(() => import('@/pages/dashboard/MyAppointments'));
const MyFavorites = React.lazy(() => import('@/pages/dashboard/MyFavorites'));
const MyKaufchancen = React.lazy(() => import('@/pages/dashboard/MyKaufchancen'));
const MyMessages = React.lazy(() => import('@/pages/dashboard/MyMessages'));
const MyInvoices = React.lazy(() => import('@/pages/dashboard/MyInvoices'));
const UserProfile = React.lazy(() => import('@/pages/dashboard/UserProfile'));
const DealerSettings = React.lazy(() => import('@/pages/dealer/DealerSettings'));

export const SmartDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { primaryRole, isLoading: roleLoading, error } = useUserRole();
  const navigate = useNavigate();
  const location = useLocation();

  // If user is not authenticated, redirect to login
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Handle role-based redirection for /admin access
  useEffect(() => {
    if (!roleLoading && primaryRole && location.pathname === '/dashboard') {
      // If user is admin and accessing /dashboard, redirect to /admin
      if (primaryRole === 'admin') {
        navigate('/admin', { replace: true });
        return;
      }
    }
  }, [primaryRole, roleLoading, navigate, location.pathname]);

  // Not authenticated — useEffect will redirect to /login
  // Return null to prevent rendering any dashboard with stale/default role data
  if (!authLoading && !user) {
    return null;
  }

  // Show loading state while checking authentication and roles
  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <div className="space-y-2">
            <p className="text-sm font-medium">Lade Dashboard...</p>
            <p className="text-xs text-muted-foreground">
              Überprüfe Benutzerberechtigungen
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Handle errors
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-red-500 text-lg font-semibold">
            Fehler beim Laden der Benutzerrolle
          </div>
          <p className="text-sm text-muted-foreground">
            {error.message || 'Unbekannter Fehler aufgetreten'}
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="text-primary hover:underline"
          >
            Seite neu laden
          </button>
        </div>
      </div>
    );
  }

  // Safety net: if primaryRole is still null (role data not yet resolved),
  // show loading spinner. This catches any race condition where isLoading
  // is false but roleData hasn't arrived yet.
  if (!primaryRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <div className="space-y-2">
            <p className="text-sm font-medium">Benutzerrolle wird ermittelt...</p>
          </div>
        </div>
      </div>
    );
  }

  // Render appropriate dashboard based on primary role
  switch (primaryRole) {
    case 'admin':
      // Admin should have been redirected by the useEffect above
      return <UserDashboardWrapper />;
    case 'dealer':
      return <DealerDashboardWrapper />;
    case 'seller':
    default:
      return <UserDashboardWrapper />;
  }
};

/**
 * Dealer Dashboard Wrapper
 * Renders dealer dashboard within unified system
 */
const DealerDashboardWrapper = () => {
  const location = useLocation();
  
  // Handle dealer sub-routes using module-level lazy imports
  const renderDealerContent = () => {
    const path = location.pathname;
    
    if (path === '/dashboard' || path === '/dashboard/') {
      return <DealerDashboard />;
    }
    
    // Handle sub-routes using pre-defined lazy components
    if (path.includes('/auctions')) {
      return (
        <Suspense fallback={<DashboardLoadingState />}>
          <DealerAuctions />
        </Suspense>
      );
    }
    
    if (path.includes('/inventory')) {
      return (
        <Suspense fallback={<DashboardLoadingState />}>
          <DealerInventory />
        </Suspense>
      );
    }
    
    if (path.includes('/bids')) {
      return (
        <Suspense fallback={<DashboardLoadingState />}>
          <MyBids />
        </Suspense>
      );
    }
    
    if (path.includes('/favorites')) {
      return (
        <Suspense fallback={<DashboardLoadingState />}>
          <MyFavorites />
        </Suspense>
      );
    }
    
    if (path.includes('/kaufchancen')) {
      return (
        <Suspense fallback={<DashboardLoadingState />}>
          <MyKaufchancen />
        </Suspense>
      );
    }
    
    if (path.includes('/appointments')) {
      return (
        <Suspense fallback={<DashboardLoadingState />}>
          <MyAppointments />
        </Suspense>
      );
    }
    
    if (path.includes('/messages')) {
      return (
        <Suspense fallback={<DashboardLoadingState />}>
          <MyMessages />
        </Suspense>
      );
    }
    
    if (path.includes('/invoices')) {
      return (
        <Suspense fallback={<DashboardLoadingState />}>
          <MyInvoices />
        </Suspense>
      );
    }
    
    if (path.includes('/settings')) {
      return (
        <Suspense fallback={<DashboardLoadingState />}>
          <DealerSettings />
        </Suspense>
      );
    }
    
    if (path.includes('/profile')) {
      return (
        <Suspense fallback={<DashboardLoadingState />}>
          <UserProfile />
        </Suspense>
      );
    }
    
    // Default to main dashboard
    return <DealerDashboard />;
  };

  return (
    <DealerLayoutContent>
      {renderDealerContent()}
    </DealerLayoutContent>
  );
};

/**
 * User Dashboard Wrapper
 * Renders user dashboard within unified system
 */
const UserDashboardWrapper = () => {
  const location = useLocation();
  
  // Handle user sub-routes using module-level lazy imports
  const renderUserContent = () => {
    const path = location.pathname;
    
    if (path === '/dashboard' || path === '/dashboard/') {
      return <DashboardOverview />;
    }
    
    // Handle sub-routes using pre-defined lazy components
    if (path.includes('/listings')) {
      if (path.includes('/edit')) {
        return (
          <Suspense fallback={<DashboardLoadingState />}>
            <ListingEdit />
          </Suspense>
        );
      }
      
      if (path.match(/\/listings\/[^/]+$/)) {
        return (
          <Suspense fallback={<DashboardLoadingState />}>
            <ListingDetail />
          </Suspense>
        );
      }
      
      return (
        <Suspense fallback={<DashboardLoadingState />}>
          <MyListings />
        </Suspense>
      );
    }
    
    if (path.includes('/bids')) {
      return (
        <Suspense fallback={<DashboardLoadingState />}>
          <MyBids />
        </Suspense>
      );
    }
    
    if (path.includes('/appointments')) {
      return (
        <Suspense fallback={<DashboardLoadingState />}>
          <MyAppointments />
        </Suspense>
      );
    }
    
    if (path.includes('/favorites')) {
      return (
        <Suspense fallback={<DashboardLoadingState />}>
          <MyFavorites />
        </Suspense>
      );
    }
    
    if (path.includes('/kaufchancen')) {
      return (
        <Suspense fallback={<DashboardLoadingState />}>
          <MyKaufchancen />
        </Suspense>
      );
    }
    
    if (path.includes('/messages')) {
      return (
        <Suspense fallback={<DashboardLoadingState />}>
          <MyMessages />
        </Suspense>
      );
    }
    
    if (path.includes('/invoices')) {
      return (
        <Suspense fallback={<DashboardLoadingState />}>
          <MyInvoices />
        </Suspense>
      );
    }
    
    if (path.includes('/profile')) {
      return (
        <Suspense fallback={<DashboardLoadingState />}>
          <UserProfile />
        </Suspense>
      );
    }
    
    // Default to overview
    return <DashboardOverview />;
  };

  return (
    <UserLayoutContent>
      {renderUserContent()}
    </UserLayoutContent>
  );
};

/**
 * Dealer Layout Content (extracted from DealerLayout)
 */
const DealerLayoutContent = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { settings } = useSettings();

  const userInitials = user?.email
    ?.split("@")[0]
    .substring(0, 2)
    .toUpperCase() || "D";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-muted/20">
        <DealerSidebar />
        <div className="flex-1 flex flex-col">
          {/* Modern Header */}
          <header className="h-20 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-10">
            <div className="h-full px-6 lg:px-8 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <SidebarTrigger className="hover:bg-primary/10 hover:text-primary transition-colors" />
              </div>

              {/* User Section */}
              <div className="flex items-center gap-3">
                <Link to="/dashboard/profile" className="hidden sm:flex items-center gap-3 hover:opacity-80 transition-opacity">
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
                      Händler • {settings?.site_name || "CaravanWert"}
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 p-6 bg-muted/30">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

/**
 * User Layout Content (extracted from DashboardLayout)
 */
const UserLayoutContent = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { settings } = useSettings();

  const userInitials = user?.email
    ?.split("@")[0]
    .substring(0, 2)
    .toUpperCase() || "U";

  return (
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
                <Link to="/dashboard/profile" className="hidden sm:flex items-center gap-3 hover:opacity-80 transition-opacity">
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
                </Link>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 p-6 lg:p-8 xl:p-10">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

/**
 * Loading state for dashboard content
 */
const DashboardLoadingState = () => (
  <div className="flex items-center justify-center py-12">
    <div className="text-center space-y-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
      <p className="text-sm text-muted-foreground">Lade Dashboard-Inhalte...</p>
    </div>
  </div>
);

export default SmartDashboard;
