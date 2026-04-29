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
    "Küchen-Vergleich & Vermittlung",
    "Deutschlands Vergleichsportal für neue Küchen: Angebote von geprüften Studios einholen, vorhandene Studio-Preise per Reverse-Auktion unterbieten lassen oder die Traumküche mit KI visualisieren."
  );

  return (
    <PageLayout
      title="Neue Küche günstig kaufen — Angebote vergleichen & Preis unterbieten"
      description="Drei Wege zu Ihrer Traumküche: Kostenlose Angebote von geprüften Küchenstudios einholen, vorhandene Studio-Preise unterbieten lassen oder mit KI visualisieren. Bis zu 30 % sparen, unverbindlich, deutschlandweit."
      keywords="Küche kaufen, neue Küche, Küche planen, Küchenstudio, Küche vergleichen, Küchenangebot, Reverse-Auktion Küche, KI Küchenplaner, Nobilia, Häcker, Nolte, SieMatic, günstig Küche, Budget Küche"
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
