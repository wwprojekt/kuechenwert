import PageLayout from "@/components/PageLayout";
import Hero from "@/components/Hero";
import KitchenShowcase from "@/components/KitchenShowcase";
import HowItWorks from "@/components/HowItWorks";
import Benefits from "@/components/Benefits";
import Process from "@/components/Process";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";
import { generateOrganizationSchema, generateServiceSchema } from "@/lib/seo";
import { useSettings } from "@/contexts/SettingsContext";

const Index = () => {
  const { settings } = useSettings();
  const organizationSchema = generateOrganizationSchema(settings);
  const serviceSchema = generateServiceSchema(
    "Küchen-Ankauf & Vermittlung",
    "Ihre Plattform für den Verkauf gebrauchter Küchen. Kostenlose Bewertung, geprüfte Küchen-Händler, Reverse-Auktion für den besten Preis."
  );

  return (
    <PageLayout
      title="Küche verkaufen — Kostenlose Bewertung in 2 Minuten"
      description="Verkaufen Sie Ihre gebrauchte Küche schnell und zum besten Preis. Kostenlose Bewertung, geprüfte Küchen-Händler, transparenter Prozess. Nobilia, Häcker, Nolte & alle Marken."
      keywords="Küche verkaufen, Küche kaufen, gebrauchte Küche, Küchenbewertung, Nobilia verkaufen, Häcker verkaufen, Nolte verkaufen, Küchenwert"
      canonicalPath="/"
      structuredData={[organizationSchema, serviceSchema]}
    >
      <Hero />
      <KitchenShowcase />
      <HowItWorks />
      <Benefits />
      <Process />
      <FAQ />
      <CTA />
    </PageLayout>
  );
};

export default Index;
