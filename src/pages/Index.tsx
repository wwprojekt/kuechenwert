import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import MotorhomeShowcase from "@/components/MotorhomeShowcase";
import HowItWorks from "@/components/HowItWorks";
import Listings from "@/components/Listings";
import Benefits from "@/components/Benefits";
import Process from "@/components/Process";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import { Helmet } from "react-helmet";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";

const Index = () => {
  const { settings } = useSettings();
  const { user } = useAuth();
  const { primaryRole } = useUserRole();
  const navigate = useNavigate();
  const siteName = settings?.site_name || 'CaravanWert';

  // Auto-redirect logged-in users to their dashboard
  useEffect(() => {
    if (user && primaryRole) {
      const dashboardRoute = primaryRole === 'admin' ? "/admin" : "/dashboard";
      navigate(dashboardRoute, { replace: true });
    }
  }, [user, primaryRole, navigate]);
  
  return (
    <div className="flex flex-col min-h-screen">
      <Helmet>
        <title>{siteName} - Deutschlands modernste Wohnmobil-Ankaufsplattform</title>
        <meta name="description" content="Verkaufen Sie Ihr Wohnmobil schnell, sicher und zum besten Preis. Sofortpreis-Ankauf, Online-Auktion oder Übergabe an einer Ankaufstation - Sie haben die Wahl!" />
        <meta name="keywords" content="Wohnmobil verkaufen, Wohnmobil Ankauf, Camper verkaufen, Reisemobil verkaufen, Wohnmobil Ankaufstation" />
        <link rel="canonical" href="https://caravanwert.de/" />
        <meta property="og:url" content="https://caravanwert.de/" />
        <meta property="og:title" content={`${siteName} - Wohnmobil verkaufen leicht gemacht`} />
        <meta property="og:description" content="Verkaufen Sie Ihr Wohnmobil schnell, sicher und zum besten Preis. Sofortpreis, Auktion oder Ankaufstation." />
        <meta name="twitter:title" content={`${siteName} - Wohnmobil verkaufen leicht gemacht`} />
        <meta name="twitter:description" content="Verkaufen Sie Ihr Wohnmobil schnell, sicher und zum besten Preis." />
      </Helmet>
      <Header />
      <main className="flex-1">
        <Hero />
        <MotorhomeShowcase />
        <HowItWorks />
        <Listings />
        <Benefits />
        <Process />
        <FAQ />
        <CTA />
      </main>
      <Footer />
      <ScrollToTop />
    </div>
  );
};

export default Index;
