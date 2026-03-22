import { useState } from "react";
import PageLayout from "@/components/PageLayout";
import Hero from "@/components/Hero";
import MotorhomeShowcase from "@/components/MotorhomeShowcase";
import HowItWorks from "@/components/HowItWorks";
import Listings from "@/components/Listings";
import Benefits from "@/components/Benefits";
import Process from "@/components/Process";
import FAQ from "@/components/FAQ";
import CTA from "@/components/CTA";
import { ContactDataModal } from "@/components/ContactDataModal";

const Index = () => {
  const [showContactModal, setShowContactModal] = useState(false);

  const handleStartWizard = () => setShowContactModal(true);
  
  return (
    <PageLayout
      title="Deutschlands modernste Wohnmobil-Ankaufsplattform"
      description="Verkaufen Sie Ihr Wohnmobil schnell, sicher und zum besten Preis. Sofortpreis-Ankauf, Online-Auktion oder Übergabe an einer Ankaufstation - Sie haben die Wahl!"
      keywords="Wohnmobil verkaufen, Wohnmobil Ankauf, Camper verkaufen, Reisemobil verkaufen, Wohnmobil Ankaufstation"
      canonicalPath="/"
    >
      {/* Kontaktdaten-Modal */}
      <ContactDataModal
        open={showContactModal}
        onOpenChange={setShowContactModal}
        source="startseite"
      />

      <Hero onStartWizard={handleStartWizard} />
      <MotorhomeShowcase />
      <HowItWorks />
      <Listings />
      <Benefits />
      <Process onStartWizard={handleStartWizard} />
      <FAQ />
      <CTA onStartWizard={handleStartWizard} />
    </PageLayout>
  );
};

export default Index;
