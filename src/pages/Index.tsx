import { lazy, Suspense } from "react";
import PageLayout from "@/components/PageLayout";
import Hero from "@/components/Hero";
import MotorhomeShowcase from "@/components/MotorhomeShowcase";
import HowItWorks from "@/components/HowItWorks";
import Listings from "@/components/Listings";
import { generateOrganizationSchema, generateServiceSchema } from "@/lib/seo";
import { useSettings } from "@/contexts/SettingsContext";

const Benefits = lazy(() => import("@/components/Benefits"));
const Process = lazy(() => import("@/components/Process"));
const FAQ = lazy(() => import("@/components/FAQ"));
const CTA = lazy(() => import("@/components/CTA"));

const Index = () => {
  const { settings } = useSettings();
  const organizationSchema = generateOrganizationSchema(settings);
  const serviceSchema = generateServiceSchema(
    "Wohnmobil-Ankauf & Vermittlung",
    "Ihre Plattform für den Verkauf von Wohnmobilen. Sofortpreis-Ankauf, Online-Auktion oder Übergabe an einer Ankaufstation."
  );

  return (
    <PageLayout
      title="Wohnmobil verkaufen – Ankauf in 48h"
      description="Verkaufen Sie Ihr Wohnmobil schnell, sicher und zum besten Preis. Sofortpreis-Ankauf, Online-Auktion oder Übergabe an einer Ankaufstation - Sie haben die Wahl!"
      keywords="Wohnmobil verkaufen, Wohnmobil Ankauf, Camper verkaufen, Reisemobil verkaufen, Wohnmobil Ankaufstation"
      canonicalPath="/"
      structuredData={[organizationSchema, serviceSchema]}
    >
      <Hero />
      <MotorhomeShowcase />
      <HowItWorks />
      <Listings />
      <Suspense fallback={null}>
        <Benefits />
        <Process />
        <FAQ />
        <CTA />
      </Suspense>
    </PageLayout>
  );
};

export default Index;
