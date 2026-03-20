import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import PageTransition from "./components/PageTransition";
import { ErrorBoundary, AuctionErrorBoundary, FormErrorBoundary } from "./components/ErrorBoundary";
import { WhatsAppButton } from "./components/WhatsAppButton";
import CookieBanner from "./components/CookieBanner";
import Index from "./pages/Index";
import Login from "./pages/Login";
import LoginHaendler from "./pages/LoginHaendler";
import Register from "./pages/Register";
import RegisterHaendler from "./pages/RegisterHaendler";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Verkaufen from "./pages/Verkaufen";
import VerkaufenWizard from "./pages/VerkaufenWizard";
import Kaufen from "./pages/Kaufen";
import AuctionDetail from "./pages/AuctionDetail";
import Ratgeber from "./pages/Ratgeber";
import UeberUns from "./pages/UeberUns";
import Kontakt from "./pages/Kontakt";
import Haendler from "./pages/Haendler";
import DealerRegister from "./pages/DealerRegister";
import DealerOnboarding from "./pages/DealerOnboarding";
import Ankaufstationen from "./pages/Ankaufstationen";
import Impressum from "./pages/Impressum";
import Datenschutz from "./pages/Datenschutz";
import AGB from "./pages/AGB";
import FAQ from "./pages/FAQ";
import Preise from "./pages/Preise";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import NotFound from "./pages/NotFound";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAuctions from "./pages/admin/AdminAuctions";
import AdminMotorhomes from "./pages/admin/AdminMotorhomes";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminDealers from "./pages/admin/AdminDealers";
import AdminStations from "./pages/admin/AdminStations";
import AdminAppointments from "./pages/admin/AdminAppointments";
import AdminStationHandover from "./pages/admin/AdminStationHandover";
import AdminBlog from "./pages/admin/AdminBlog";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminCommissions from "./pages/admin/AdminCommissions";
import AdminFinancials from "./pages/admin/AdminFinancials";
import AdminLegal from "./pages/admin/AdminLegal";
import AdminQuestions from "./pages/admin/AdminQuestions";
import AdminMessages from "./pages/admin/AdminMessages";
import AdminAuctionDetail from "./pages/admin/AdminAuctionDetail";
import AdminMotorhomeDetail from "./pages/admin/AdminMotorhomeDetail";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminDealerDetail from "./pages/admin/AdminDealerDetail";
import AdminAppointmentDetail from "./pages/admin/AdminAppointmentDetail";
import Wertermittlung from "./pages/Wertermittlung";
import Wertrechner from "./pages/Wertrechner";
import WohnmobilVerkaufen from "./pages/landing/WohnmobilVerkaufen";
import WohnwagenVerkaufen from "./pages/landing/WohnwagenVerkaufen";
import WohnmobilWert from "./pages/landing/WohnmobilWert";
import WohnmobilWertermittlungKostenlos from "./pages/landing/WohnmobilWertermittlungKostenlos";
import WirKaufenDeinWohnmobil from "./pages/landing/WirKaufenDeinWohnmobil";
import WievielWohnmobilWert from "./pages/landing/WievielWohnmobilWert";
import RatgeberPage from "./pages/ratgeber/RatgeberPage";
import { SmartDashboard } from "./components/SmartDashboard";
import ScrollRestoration from "./components/ScrollRestoration";
import { usePageTracking } from "./hooks/useAnalytics";

// Wrapper that resets error boundary when auction ID changes
function AuctionRoute() {
  const { id } = useParams();
  return (
    <AuctionErrorBoundary key={id}>
      <AuctionDetail />
    </AuctionErrorBoundary>
  );
}

// Component to track page views
function PageTracker() {
  usePageTracking();
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache data for 5 minutes by default
      staleTime: 5 * 60 * 1000,
      // Keep data in cache for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed requests 2 times
      retry: 2,
      // Retry with exponential backoff
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Refetch on window focus for critical data
      refetchOnWindowFocus: true,
      // Don't refetch on reconnect by default
      refetchOnReconnect: 'always',
    },
    mutations: {
      // Retry mutations once
      retry: 1,
      // Show error for 4 seconds
      gcTime: 4 * 1000,
    },
  },
});

const App = () => (
  <ErrorBoundary showDetails={!import.meta.env.PROD}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollRestoration />
            <PageTracker />
            <PageTransition>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/login/haendler" element={<LoginHaendler />} />
              <Route path="/register" element={<Register />} />
              <Route path="/register/haendler" element={<RegisterHaendler />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/verkaufen" element={<Verkaufen />} />
              <Route path="/verkaufen/wizard" element={
                <FormErrorBoundary>
                  <VerkaufenWizard />
                </FormErrorBoundary>
              } />
              <Route path="/ankaufstationen" element={<Ankaufstationen />} />
              <Route path="/wertermittlung" element={<Wertermittlung />} />
              <Route path="/wertrechner" element={<Wertrechner />} />
              <Route path="/kaufen" element={<Kaufen />} />
              <Route path="/auktion/:id" element={<AuctionRoute />} />
              <Route path="/ratgeber" element={<Ratgeber />} />
              <Route path="/ratgeber/:slug" element={<RatgeberPage />} />
              <Route path="/ueber-uns" element={<UeberUns />} />
              <Route path="/kontakt" element={<Kontakt />} />
              <Route path="/haendler" element={<Haendler />} />
              <Route path="/dealer-register" element={<ProtectedRoute><DealerRegister /></ProtectedRoute>} />
              <Route path="/dealer-onboarding" element={<DealerOnboarding />} />
              
              <Route path="/impressum" element={<Impressum />} />
              <Route path="/datenschutz" element={<Datenschutz />} />
              <Route path="/agb" element={<AGB />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/preise" element={<Preise />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              
              {/* Admin Routes */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboard />} />
                <Route path="analytics" element={<AdminAnalytics />} />
                <Route path="auctions" element={<AdminAuctions />} />
                <Route path="auctions/:id" element={<AdminAuctionDetail />} />
                <Route path="motorhomes" element={<AdminMotorhomes />} />
                <Route path="motorhomes/:id" element={<AdminMotorhomeDetail />} />
                <Route path="questions" element={<AdminQuestions />} />
                <Route path="messages" element={<AdminMessages />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="users/:id" element={<AdminUserDetail />} />
                <Route path="dealers" element={<AdminDealers />} />
                <Route path="dealers/:id" element={<AdminDealerDetail />} />
                <Route path="commissions" element={<AdminCommissions />} />
                <Route path="financials" element={<AdminFinancials />} />
                <Route path="stations" element={<AdminStations />} />
                <Route path="appointments" element={<AdminAppointments />} />
                <Route path="appointments/:id" element={<AdminAppointmentDetail />} />
                <Route path="handover" element={<AdminStationHandover />} />
                <Route path="blog" element={<AdminBlog />} />
                <Route path="legal" element={<AdminLegal />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>

              {/* Unified Dashboard Routes - Smart routing based on user role */}
              <Route path="/dashboard/*" element={<SmartDashboard />} />
              
              {/* SEO Landing Pages */}
              <Route path="/wohnmobil-verkaufen" element={<WohnmobilVerkaufen />} />
              <Route path="/wohnwagen-verkaufen" element={<WohnwagenVerkaufen />} />
              <Route path="/was-ist-mein-wohnmobil-wert" element={<WohnmobilWert />} />
              <Route path="/wohnmobil-wertermittlung-kostenlos" element={<WohnmobilWertermittlungKostenlos />} />
              <Route path="/wir-kaufen-dein-wohnmobil" element={<WirKaufenDeinWohnmobil />} />
              <Route path="/wieviel-ist-mein-wohnmobil-wert" element={<WievielWohnmobilWert />} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </PageTransition>
          <WhatsAppButton />
          <CookieBanner />
        </BrowserRouter>
      </TooltipProvider>
  </QueryClientProvider>
</ErrorBoundary>
);

export default App;
