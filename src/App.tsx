import { Suspense, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useParams, useLocation, Navigate } from "react-router-dom";
import PageTransition from "./components/PageTransition";
import { ErrorBoundary, AuctionErrorBoundary } from "./components/ErrorBoundary";
import { WhatsAppButton } from "./components/WhatsAppButton";
import CookieBanner from "./components/CookieBanner";
import ScrollRestoration from "./components/ScrollRestoration";
import { SessionExpiredProvider } from "./components/SessionExpiredDialog";
import { usePageTracking } from "./hooks/useAnalytics";
import { lazyRetry, clearChunkReloadFlag } from "./lib/lazyRetry";
import { detectAndSetTrafficType } from "./lib/gadsConversionService";
import { captureClickIds } from "./lib/clickIdService";
import { initMetaPixelConsentListener, trackMetaPageView } from "./lib/metaPixelService";

// ---------------------------------------------------------------------------
// Lazy-loaded pages – each page becomes its own chunk, loaded on demand.
// Uses lazyRetry() to auto-reload on stale chunk errors after deployments.
// ---------------------------------------------------------------------------
import Index from "./pages/Index";

// Auth pages
const Login = lazyRetry(() => import("./pages/Login"));
const LoginHaendler = lazyRetry(() => import("./pages/LoginHaendler"));
const RegisterChoice = lazyRetry(() => import("./pages/RegisterChoice"));
const Register = lazyRetry(() => import("./pages/Register"));
const RegisterHaendler = lazyRetry(() => import("./pages/RegisterHaendler"));
const ForgotPassword = lazyRetry(() => import("./pages/ForgotPassword"));
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"));
const AuthConfirm = lazyRetry(() => import("./pages/AuthConfirm"));

// Core pages
const Verkaufen = lazyRetry(() => import("./pages/Verkaufen"));
// VerkaufenWizard (alter Caravan-8-Step-Wizard) ist deaktiviert – die Route
// /verkaufen/wizard leitet jetzt auf /funnel/a um. Die Datei bleibt vorerst
// im Repo, falls Teile (Steps, Hooks) fuer Funnel-Features wiederverwendet
// werden sollen. Kein lazy()-Import => kein Bundle-Chunk.
const VerkaufenDanke = lazyRetry(() => import("./pages/VerkaufenDanke"));
const Kaufen = lazyRetry(() => import("./pages/Kaufen"));
const AuctionDetail = lazyRetry(() => import("./pages/AuctionDetail"));
const Ratgeber = lazyRetry(() => import("./pages/Ratgeber"));
const UeberUns = lazyRetry(() => import("./pages/UeberUns"));
const Kontakt = lazyRetry(() => import("./pages/Kontakt"));
const Haendler = lazyRetry(() => import("./pages/Haendler"));
const Ankaufstationen = lazyRetry(() => import("./pages/Ankaufstationen"));
const Wertermittlung = lazyRetry(() => import("./pages/Wertermittlung"));
const Wertrechner = lazyRetry(() => import("./pages/Wertrechner"));
const Kuechenrechner = lazyRetry(() => import("./pages/Kuechenrechner"));

// Legal pages
const Impressum = lazyRetry(() => import("./pages/Impressum"));
const Datenschutz = lazyRetry(() => import("./pages/Datenschutz"));
const AGB = lazyRetry(() => import("./pages/AGB"));
const FAQ = lazyRetry(() => import("./pages/FAQ"));
const Preise = lazyRetry(() => import("./pages/Preise"));

// Blog
const Blog = lazyRetry(() => import("./pages/Blog"));
const BlogPost = lazyRetry(() => import("./pages/BlogPost"));

// Admin pages
const AdminLayout = lazyRetry(() => import("./pages/admin/AdminLayout"));
const AdminDashboard = lazyRetry(() => import("./pages/admin/AdminDashboard"));
const AdminAuctions = lazyRetry(() => import("./pages/admin/AdminAuctions"));
const AdminKitchens = lazyRetry(() => import("./pages/admin/AdminKitchens"));
const AdminUsers = lazyRetry(() => import("./pages/admin/AdminUsers"));
const AdminSettings = lazyRetry(() => import("./pages/admin/AdminSettings"));
const AdminDealers = lazyRetry(() => import("./pages/admin/AdminDealers"));
const AdminStations = lazyRetry(() => import("./pages/admin/AdminStations"));
const AdminAppointments = lazyRetry(() => import("./pages/admin/AdminAppointments"));
const AdminStationHandover = lazyRetry(() => import("./pages/admin/AdminStationHandover"));
const AdminBlog = lazyRetry(() => import("./pages/admin/AdminBlog"));
const AdminAnalytics = lazyRetry(() => import("./pages/admin/AdminAnalytics"));
const AdminCommissions = lazyRetry(() => import("./pages/admin/AdminCommissions"));
const AdminFinancials = lazyRetry(() => import("./pages/admin/AdminFinancials"));
const AdminLegal = lazyRetry(() => import("./pages/admin/AdminLegal"));
const AdminQuestions = lazyRetry(() => import("./pages/admin/AdminQuestions"));
const AdminMessages = lazyRetry(() => import("./pages/admin/AdminMessages"));
const AdminEmailCenter = lazyRetry(() => import("./pages/admin/AdminEmailCenter"));
const AdminErrorLogs = lazyRetry(() => import("./pages/admin/AdminErrorLogs"));
const AdminCronHealth = lazyRetry(() => import("./pages/admin/AdminCronHealth"));
const AdminAuditLog = lazyRetry(() => import("./pages/admin/AdminAuditLog"));
const AdminLeads = lazyRetry(() => import("./pages/admin/AdminLeads"));
const AdminPlannerSessions = lazyRetry(() => import("./pages/admin/AdminPlannerSessions"));
const AdminAuctionDetail = lazyRetry(() => import("./pages/admin/AdminAuctionDetail"));
const AdminKitchenDetail = lazyRetry(() => import("./pages/admin/AdminKitchenDetail"));
const AdminUserDetail = lazyRetry(() => import("./pages/admin/AdminUserDetail"));
const AdminDealerDetail = lazyRetry(() => import("./pages/admin/AdminDealerDetail"));
const AdminAppointmentDetail = lazyRetry(() => import("./pages/admin/AdminAppointmentDetail"));
const AdminClaims = lazyRetry(() => import("./pages/admin/AdminClaims"));
const AdminPostAuctionOffers = lazyRetry(() => import("./pages/admin/AdminPostAuctionOffers"));
const AdminReviews = lazyRetry(() => import("./pages/admin/AdminReviews"));
const AdminWertrechnerReviews = lazyRetry(() => import("./pages/admin/AdminWertrechnerReviews"));
const AdminGoogleReviews = lazyRetry(() => import("./pages/admin/AdminGoogleReviews"));
const AdminContracts = lazyRetry(() => import("./pages/admin/AdminContracts"));
const AdminDealerStats = lazyRetry(() => import("./pages/admin/AdminDealerStats"));

// SEO Landing Pages (Kuechen-Themen).
// Die Wohnmobil-/Wohnwagen-/Schwacke-Landing-Pages (17 Pages + 16 Data-Files)
// wurden beim Caravan-Cleanup komplett entfernt. Kuechen-Landing-Pages werden
// sobald verfuegbar hier als `lazyRetry`-Chunks registriert und in der
// Routen-Tabelle weiter unten ergaenzt (`/nobilia-kueche-planen`,
// `/kueche-guenstig-kaufen-2026`, …).

// Ratgeber detail
const RatgeberPage = lazyRetry(() => import("./pages/ratgeber/RatgeberPage"));

// Funnel (Lead-Gen + Angebot-Compare + Traumkueche)
const FunnelA = lazyRetry(() => import("./pages/funnel/FunnelA"));
const FunnelB = lazyRetry(() => import("./pages/funnel/FunnelB"));
const FunnelC = lazyRetry(() => import("./pages/funnel/FunnelC"));
const FunnelDanke = lazyRetry(() => import("./pages/funnel/FunnelDanke"));

// Dashboard
const SmartDashboard = lazyRetry(() => import("./components/SmartDashboard").then(m => ({ default: m.SmartDashboard })));

// Not Found
const NotFound = lazyRetry(() => import("./pages/NotFound"));

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

// Component to track page views, set user properties & clear chunk reload flag
function PageTracker() {
  usePageTracking();
  clearChunkReloadFlag();

  // User Properties einmalig pro Session setzen (Traffic-Typ erkennen)
  // Click-IDs (GCLID, GBRAID, WBRAID) aus URL-Parametern erfassen
  useEffect(() => {
    detectAndSetTrafficType();
    captureClickIds();
    initMetaPixelConsentListener();
  }, []);

  // Meta Pixel: PageView bei jedem Route-Wechsel tracken
  const location = useLocation();
  const previousMetaPath = useRef<string | null>(null);
  useEffect(() => {
    if (previousMetaPath.current !== location.pathname) {
      trackMetaPageView();
      previousMetaPath.current = location.pathname;
    }
  }, [location.pathname]);

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
      // Do NOT refetch every time the user alt-tabs back.
      // Admin pages alone run ~25 queries; focus-refetch caused a visible
      // freeze whenever an admin switched tabs. Individual hot queries can
      // still opt-in via refetchOnWindowFocus: true on their own useQuery.
      refetchOnWindowFocus: false,
      // Only refetch on reconnect – not "always" (which re-runs even if
      // the connection never actually dropped, just visibility flickered).
      refetchOnReconnect: true,
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
      <ThemeProvider>
      <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SessionExpiredProvider>
            <ScrollRestoration />
            <PageTracker />
            <PageTransition>
            <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/login/haendler" element={<LoginHaendler />} />
              <Route path="/register" element={<RegisterChoice />} />
              <Route path="/register/privat" element={<Register />} />
              <Route path="/register/haendler" element={<RegisterHaendler />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/auth/confirm" element={<AuthConfirm />} />
              <Route path="/verkaufen" element={<Verkaufen />} />
              {/* Alte Caravan-Wizard-Route leitet auf den neuen Kuechen-Funnel um. */}
              <Route path="/verkaufen/wizard" element={<Navigate to="/funnel/a" replace />} />
              <Route path="/verkaufen/danke" element={<VerkaufenDanke />} />
              <Route path="/ankaufstationen" element={<Ankaufstationen />} />
              {/* Legacy Wert-Routen → neuer KuechenRechner (Phase 3 Rebrand).
                  Komponenten liefern nur noch <Navigate to="/kuechenrechner" />. */}
              <Route path="/wertermittlung" element={<Wertermittlung />} />
              <Route path="/wertrechner" element={<Wertrechner />} />
              <Route path="/kuechenrechner" element={<Kuechenrechner />} />
              <Route path="/kaufen" element={<Kaufen />} />
              <Route path="/auktion/:id" element={<AuctionRoute />} />

              {/* Funnel A/B/C - Lead-Gen, Offer-Compare, Traumkueche */}
              <Route path="/funnel/a" element={<FunnelA />} />
              <Route path="/funnel/a/:step" element={<FunnelA />} />
              <Route path="/funnel/b" element={<FunnelB />} />
              <Route path="/funnel/c" element={<FunnelC />} />
              <Route path="/funnel/danke" element={<FunnelDanke />} />
              <Route path="/ratgeber" element={<Ratgeber />} />
              <Route path="/ratgeber/:slug" element={<RatgeberPage />} />
              <Route path="/ueber-uns" element={<UeberUns />} />
              <Route path="/kontakt" element={<Kontakt />} />
              <Route path="/haendler" element={<Haendler />} />
              
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
                <Route path="leads" element={<AdminLeads />} />
                <Route path="planner-sessions" element={<AdminPlannerSessions />} />
                <Route path="auctions" element={<AdminAuctions />} />
                <Route path="auctions/:id" element={<AdminAuctionDetail />} />
                <Route path="kitchens" element={<AdminKitchens />} />
                <Route path="kitchens/:id" element={<AdminKitchenDetail />} />
                <Route path="questions" element={<AdminQuestions />} />
                <Route path="email" element={<AdminEmailCenter />} />
                <Route path="messages" element={<AdminMessages />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="users/:id" element={<AdminUserDetail />} />
                <Route path="dealers" element={<AdminDealers />} />
                <Route path="dealers/:id" element={<AdminDealerDetail />} />
                <Route path="dealer-stats" element={<AdminDealerStats />} />
                <Route path="commissions" element={<AdminCommissions />} />
                <Route path="contracts" element={<AdminContracts />} />
                <Route path="financials" element={<AdminFinancials />} />
                <Route path="stations" element={<AdminStations />} />
                <Route path="appointments" element={<AdminAppointments />} />
                <Route path="appointments/:id" element={<AdminAppointmentDetail />} />
                <Route path="handover" element={<AdminStationHandover />} />
                <Route path="claims" element={<AdminClaims />} />
                <Route path="offers" element={<AdminPostAuctionOffers />} />
                <Route path="reviews" element={<AdminReviews />} />
                <Route path="wertrechner-reviews" element={<AdminWertrechnerReviews />} />
                <Route path="google-reviews" element={<AdminGoogleReviews />} />
                <Route path="blog" element={<AdminBlog />} />
                <Route path="legal" element={<AdminLegal />} />
                <Route path="error-logs" element={<AdminErrorLogs />} />
                <Route path="cron-health" element={<AdminCronHealth />} />
                <Route path="audit-log" element={<AdminAuditLog />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>

              {/* Unified Dashboard Routes - Smart routing based on user role */}
              <Route path="/dashboard/*" element={<SmartDashboard />} />
              
              {/* SEO Landing Pages (Kuechen-Themen).
                  Die Caravan-Landings (/wohnmobil-*, /wohnwagen-*,
                  /schwacke-liste-*) wurden beim Cleanup entfernt und laufen
                  in die NotFound-Route. Neue Kuechen-Landing-Pages werden
                  hier als eigene <Route> eingefuegt. */}

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </PageTransition>
          <WhatsAppButton />
          <CookieBanner />
          </SessionExpiredProvider>
        </BrowserRouter>
      </TooltipProvider>
      </ThemeProvider>
  </QueryClientProvider>
</ErrorBoundary>
);

export default App;
