import { Suspense, lazy } from "react";
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
import ScrollRestoration from "./components/ScrollRestoration";
import { usePageTracking } from "./hooks/useAnalytics";

// ---------------------------------------------------------------------------
// Lazy-loaded pages – each page becomes its own chunk, loaded on demand.
// Only the Index page is eagerly loaded for fast initial render.
// ---------------------------------------------------------------------------
import Index from "./pages/Index";

// Auth pages
const Login = lazy(() => import("./pages/Login"));
const LoginHaendler = lazy(() => import("./pages/LoginHaendler"));
const Register = lazy(() => import("./pages/Register"));
const RegisterHaendler = lazy(() => import("./pages/RegisterHaendler"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

// Core pages
const Verkaufen = lazy(() => import("./pages/Verkaufen"));
const VerkaufenWizard = lazy(() => import("./pages/VerkaufenWizard"));
const Kaufen = lazy(() => import("./pages/Kaufen"));
const AuctionDetail = lazy(() => import("./pages/AuctionDetail"));
const Ratgeber = lazy(() => import("./pages/Ratgeber"));
const UeberUns = lazy(() => import("./pages/UeberUns"));
const Kontakt = lazy(() => import("./pages/Kontakt"));
const Haendler = lazy(() => import("./pages/Haendler"));
const DealerRegister = lazy(() => import("./pages/DealerRegister"));
const DealerOnboarding = lazy(() => import("./pages/DealerOnboarding"));
const Ankaufstationen = lazy(() => import("./pages/Ankaufstationen"));
const Wertermittlung = lazy(() => import("./pages/Wertermittlung"));
const Wertrechner = lazy(() => import("./pages/Wertrechner"));

// Legal pages
const Impressum = lazy(() => import("./pages/Impressum"));
const Datenschutz = lazy(() => import("./pages/Datenschutz"));
const AGB = lazy(() => import("./pages/AGB"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Preise = lazy(() => import("./pages/Preise"));

// Blog
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));

// Admin pages
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminAuctions = lazy(() => import("./pages/admin/AdminAuctions"));
const AdminMotorhomes = lazy(() => import("./pages/admin/AdminMotorhomes"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminDealers = lazy(() => import("./pages/admin/AdminDealers"));
const AdminStations = lazy(() => import("./pages/admin/AdminStations"));
const AdminAppointments = lazy(() => import("./pages/admin/AdminAppointments"));
const AdminStationHandover = lazy(() => import("./pages/admin/AdminStationHandover"));
const AdminBlog = lazy(() => import("./pages/admin/AdminBlog"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminCommissions = lazy(() => import("./pages/admin/AdminCommissions"));
const AdminFinancials = lazy(() => import("./pages/admin/AdminFinancials"));
const AdminLegal = lazy(() => import("./pages/admin/AdminLegal"));
const AdminQuestions = lazy(() => import("./pages/admin/AdminQuestions"));
const AdminMessages = lazy(() => import("./pages/admin/AdminMessages"));
const AdminErrorLogs = lazy(() => import("./pages/admin/AdminErrorLogs"));
const AdminAuctionDetail = lazy(() => import("./pages/admin/AdminAuctionDetail"));
const AdminMotorhomeDetail = lazy(() => import("./pages/admin/AdminMotorhomeDetail"));
const AdminUserDetail = lazy(() => import("./pages/admin/AdminUserDetail"));
const AdminDealerDetail = lazy(() => import("./pages/admin/AdminDealerDetail"));
const AdminAppointmentDetail = lazy(() => import("./pages/admin/AdminAppointmentDetail"));

// SEO Landing Pages
const WohnmobilVerkaufen = lazy(() => import("./pages/landing/WohnmobilVerkaufen"));
const WohnwagenVerkaufen = lazy(() => import("./pages/landing/WohnwagenVerkaufen"));
const WohnmobilWert = lazy(() => import("./pages/landing/WohnmobilWert"));
const WohnmobilWertermittlungKostenlos = lazy(() => import("./pages/landing/WohnmobilWertermittlungKostenlos"));
const WirKaufenDeinWohnmobil = lazy(() => import("./pages/landing/WirKaufenDeinWohnmobil"));
const WievielWohnmobilWert = lazy(() => import("./pages/landing/WievielWohnmobilWert"));

// Ratgeber detail
const RatgeberPage = lazy(() => import("./pages/ratgeber/RatgeberPage"));

// Dashboard
const SmartDashboard = lazy(() => import("./components/SmartDashboard").then(m => ({ default: m.SmartDashboard })));

// Not Found
const NotFound = lazy(() => import("./pages/NotFound"));

// ---------------------------------------------------------------------------
// Loading fallback for lazy-loaded pages
// ---------------------------------------------------------------------------
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

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
            <Suspense fallback={<PageLoader />}>
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
                <Route path="error-logs" element={<AdminErrorLogs />} />
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
            </Suspense>
          </PageTransition>
          <WhatsAppButton />
          <CookieBanner />
        </BrowserRouter>
      </TooltipProvider>
  </QueryClientProvider>
</ErrorBoundary>
);

export default App;
