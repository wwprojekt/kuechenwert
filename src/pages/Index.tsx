import PageLayout from "@/components/PageLayout";
import Hero from "@/components/Hero";
import MotorhomeShowcase from "@/components/MotorhomeShowcase";
import HowItWorks from "@/components/HowItWorks";
import Listings from "@/components/Listings";
import Benefits from "@/components/Benefits";
import Process from "@/components/Process";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";

const Index = () => {
  return (
    <PageLayout
      title="Wohnmobil verkaufen – Ankauf in 48h"
      description="Verkaufen Sie Ihr Wohnmobil schnell, sicher und zum besten Preis. Sofortpreis-Ankauf, Online-Auktion oder Übergabe an einer Ankaufstation - Sie haben die Wahl!"
      keywords="Wohnmobil verkaufen, Wohnmobil Ankauf, Camper verkaufen, Reisemobil verkaufen, Wohnmobil Ankaufstation"
      canonicalPath="/"
    >
      <Hero />
      <MotorhomeShowcase />
      <HowItWorks />
      <Listings />
      <Benefits />
      <Process />
      <FAQ />
      <CTA />
    </PageLayout>
  );
};

export default Index;
