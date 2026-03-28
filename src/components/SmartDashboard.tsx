/**
 * Smart Dashboard Component
 * Automatically routes users to appropriate dashboard based on their role.
 *
 * ARCHITECTURE:
 * - Uses React Router <Routes>/<Route> for sub-routing instead of manual path matching
 * - Admin users are redirected to /admin on ALL /dashboard/* paths (not just /dashboard)
 * - Dealer vs. Seller layout is determined by useUserRole() and rendered via wrapper components
 * - Pending dealer applicants (role=seller + pending application) see the dealer dashboard
 *   in a read-only/locked state with a prominent banner
 * - Lazy-loaded page components are defined at module level (required by React.lazy)
 */

import React, { useEffect, Suspense } from 'react';
import { lazyRetry } from '@/lib/lazyRetry';
import { useNavigate, Link, Routes, Route } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useDealerPending } from '@/hooks/useDealerPending';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import { Loader2 } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { SiteLogo } from '@/components/SiteLogo';
import { DealerSidebar } from '@/components/DealerSidebar';
import { UserSidebar } from '@/components/UserSidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// Import dashboard components (non-lazy for main views)
import DealerDashboard from '@/pages/dealer/DealerDashboard';
import DashboardOverview from '@/pages/dashboard/DashboardOverview';

/**
 * Module-level lazy imports for code splitting
 * Uses lazyRetry() to auto-reload on stale chunk errors after deployments.
 * IMPORTANT: Must be called at module level, NOT inside render functions.
 */
const DealerAuctions = lazyRetry(() => import('@/pages/dealer/DealerAuctions'));
const DealerInventory = lazyRetry(() => import('@/pages/dealer/DealerInventory'));
const ListingEdit = lazyRetry(() => import('@/pages/dashboard/ListingEdit'));
const ListingDetail = lazyRetry(() => import('@/pages/dashboard/ListingDetail'));
const MyListings = lazyRetry(() => import('@/pages/dashboard/MyListings'));
const MyBids = lazyRetry(() => import('@/pages/dashboard/MyBids'));
const MyAppointments = lazyRetry(() => import('@/pages/dashboard/MyAppointments'));
const MyFavorites = lazyRetry(() => import('@/pages/dashboard/MyFavorites'));
const MyKaufchancen = lazyRetry(() => import('@/pages/dashboard/MyKaufchancen'));
const MyMessages = lazyRetry(() => import('@/pages/dashboard/MyMessages'));
const MyInvoices = lazyRetry(() => import('@/pages/dashboard/MyInvoices'));
const MyDocuments = lazyRetry(() => import('@/pages/dashboard/MyDocuments'));
const UserProfile = lazyRetry(() => import('@/pages/dashboard/UserProfile'));
const DealerSettings = lazyRetry(() => import('@/pages/dealer/DealerSettings'));
const DealerInstantBuy = lazyRetry(() => import('@/pages/dealer/DealerInstantBuy'));
const DealerClaims = lazyRetry(() => import('@/pages/dealer/DealerClaims'));
const SearchAlerts = lazyRetry(() => import('@/components/SearchAlerts'));

/**
 * Wrap a lazy component in Suspense with a consistent loading fallback
 */
function LazyPage({ Component }: { Component: React.LazyExoticComponent<React.ComponentType<any>> }) {
  return (
    <Suspense fallback={<DashboardLoadingState />}>
      <Component />
    </Suspense>
  );
}

export const SmartDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const { primaryRole, isLoading: roleLoading, error } = useUserRole();
  const { hasDealerApplication, isLoading: pendingLoading } = useDealerPending();
  const navigate = useNavigate();

  // If user is not authenticated, redirect to login
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Bug 1.1 fix: Redirect admin on ALL /dashboard/* paths, not just exact /dashboard
  useEffect(() => {
    if (!roleLoading && primaryRole === 'admin') {
      navigate('/admin', { replace: true });
    }
  }, [primaryRole, roleLoading, navigate]);

  // Not authenticated — useEffect will redirect to /login
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

  // Safety net: if primaryRole is still null after loading completed
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

  // For sellers with pending dealer applications: wait for the check to complete
  if (primaryRole === 'seller' && pendingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <div className="space-y-2">
            <p className="text-sm font-medium">Lade Dashboard...</p>
            <p className="text-xs text-muted-foreground">
              Überprüfe Kontostatus
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Pending/rejected dealer applicants see the dealer dashboard (locked)
  if (primaryRole === 'seller' && hasDealerApplication) {
    return <DealerDashboardWrapper />;
  }

  // Render appropriate dashboard based on primary role
  switch (primaryRole) {
    case 'admin':
      // Admin should have been redirected by the useEffect above.
      // Render user dashboard as fallback while redirect is pending.
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
 * Uses React Router <Routes> for proper sub-routing instead of path.includes()
 *
 * Bug 1.2 fix: Each route is explicitly defined, preventing false matches
 * Bug 1.3 fix: No more fragile string matching that breaks with new paths
 */
const DealerDashboardWrapper = () => {
  const { isPendingDealer, isRejectedDealer } = useDealerPending();
  const isLocked = isPendingDealer || isRejectedDealer;

  return (
    <DealerLayoutContent>
      <Routes>
        {/* Exact match for /dashboard */}
        <Route index element={<DealerDashboard />} />
        
        {/* Routes that remain accessible even when locked */}
        <Route path="profile" element={<LazyPage Component={UserProfile} />} />
        <Route path="settings" element={<LazyPage Component={DealerSettings} />} />

        {/* All other routes: only accessible when NOT locked */}
        {!isLocked && (
          <>
            {/* Dealer-specific routes */}
            <Route path="auctions" element={<LazyPage Component={DealerAuctions} />} />
            <Route path="inventory" element={<LazyPage Component={DealerInventory} />} />
            <Route path="inventory/:id" element={<LazyPage Component={ListingDetail} />} />
            
            {/* Shared routes */}
            <Route path="bids" element={<LazyPage Component={MyBids} />} />
            <Route path="favorites" element={<LazyPage Component={MyFavorites} />} />
            <Route path="sofortkauf" element={<LazyPage Component={DealerInstantBuy} />} />
            <Route path="kaufchancen" element={<LazyPage Component={MyKaufchancen} />} />
            <Route path="appointments" element={<LazyPage Component={MyAppointments} />} />
            <Route path="messages" element={<LazyPage Component={MyMessages} />} />
            <Route path="invoices" element={<LazyPage Component={MyInvoices} />} />
            <Route path="claims" element={<LazyPage Component={DealerClaims} />} />
            <Route path="search-alerts" element={<LazyPage Component={SearchAlerts} />} />
            
            {/* Listing routes */}
            <Route path="listings" element={<LazyPage Component={MyListings} />} />
            <Route path="listings/:id/edit" element={<LazyPage Component={ListingEdit} />} />
            <Route path="listings/:id" element={<LazyPage Component={ListingDetail} />} />
          </>
        )}
        
        {/* Fallback: show main dealer dashboard for unknown sub-routes
            When locked, ALL locked routes also fall through here */}
        <Route path="*" element={<DealerDashboard />} />
      </Routes>
    </DealerLayoutContent>
  );
};

/**
 * User Dashboard Wrapper
 * Uses React Router <Routes> for proper sub-routing instead of path.includes()
 */
const UserDashboardWrapper = () => {
  return (
    <UserLayoutContent>
      <Routes>
        {/* Exact match for /dashboard */}
        <Route index element={<DashboardOverview />} />
        
        {/* Seller-specific routes */}
        <Route path="listings" element={<LazyPage Component={MyListings} />} />
        <Route path="listings/:id/edit" element={<LazyPage Component={ListingEdit} />} />
        <Route path="listings/:id" element={<LazyPage Component={ListingDetail} />} />
        
        {/* Seller-relevant routes */}
        <Route path="messages" element={<LazyPage Component={MyMessages} />} />
        <Route path="documents" element={<LazyPage Component={MyDocuments} />} />
        <Route path="search-alerts" element={<LazyPage Component={SearchAlerts} />} />
        <Route path="profile" element={<LazyPage Component={UserProfile} />} />
        
        {/* Fallback: show overview for unknown sub-routes
            This also catches /bids, /favorites, /kaufchancen, /appointments
            which are dealer-only routes not relevant for sellers */}
        <Route path="*" element={<DashboardOverview />} />
      </Routes>
    </UserLayoutContent>
  );
};

/**
 * Dealer Layout Content (extracted from DealerLayout)
 */
const DealerLayoutContent = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { isPendingDealer, isRejectedDealer } = useDealerPending();

  const userInitials = user?.email
    ?.split("@")[0]
    .substring(0, 2)
    .toUpperCase() || "D";

  // Show appropriate label based on status
  const statusLabel = isPendingDealer
    ? "Händler (Antrag in Prüfung)"
    : isRejectedDealer
    ? "Händler (Antrag abgelehnt)"
    : `Händler • ${settings?.site_name || "CaravanWert"}`;

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
                <SiteLogo variant="icon-text-compact" linkTo="/" className="hidden sm:flex" />
              </div>

              {/* User Section */}
              <div className="flex items-center gap-3">
                <Link to="/" className="sm:hidden flex items-center hover:opacity-80 transition-opacity">
                  <SiteLogo variant="icon-only" linkTo="/" iconSize="h-8 w-8" />
                </Link>
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
                      {statusLabel}
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
                <SiteLogo variant="icon-text-compact" linkTo="/" className="hidden sm:flex" />
              </div>

              {/* User Section */}
              <div className="flex items-center gap-3">
                <Link to="/" className="sm:hidden flex items-center hover:opacity-80 transition-opacity">
                  <SiteLogo variant="icon-only" linkTo="/" iconSize="h-8 w-8" />
                </Link>
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
