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
    "KI-Küchenplanung & Studio-Angebote",
    "Traumküche im eigenen Raum mit KI visualisieren, Preis schätzen und Angebote geprüfter Küchenstudios vergleichen – oder ein vorhandenes Studio-Angebot unterbieten lassen."
  );

  return (
    <PageLayout
      title="Traumküche mit KI planen, Preis sehen & Studio-Angebote vergleichen"
      description="Foto Ihres Raums hochladen, Küche konfigurieren und sofort sehen, wie sie aussieht und was sie ungefähr kostet. Geprüfte Küchenstudios bieten um Ihr Projekt – Sie wählen. Kostenlos & unverbindlich."
      keywords="Küche planen, Küchenplaner online, Küche visualisieren, KI Küchenplaner, Küche Preis berechnen, Küchenstudio Angebote vergleichen, neue Küche kaufen, Küchen Preisvergleich, Nobilia, Häcker, Nolte"
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
