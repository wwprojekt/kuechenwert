import PageLayout from "@/components/PageLayout";
import FAQ from "@/components/FAQ";
import PageHero from "@/components/PageHero";
import { useSettings } from "@/contexts/SettingsContext";
import { FAQ_ITEMS } from "@/data/faq";
import { BRAND } from "@/lib/brand/config";

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

const FAQPage = () => {
  const { settings } = useSettings();
  const supportPhone = settings?.support_phone || "";
  const contactEmail = settings?.contact_email || BRAND.supportEmail;

  return (
    <PageLayout
      breadcrumbs={true}
      title="Häufig gestellte Fragen (FAQ)"
      description={`Antworten auf häufige Fragen zu ${BRAND.name}: KI-Küchenplaner, Preisschätzung, Studio-Angebote, Unterbieten, Partnerstudios und Datenschutz.`}
      keywords="KüchenWert FAQ, KI Küchenplaner, Küche visualisieren, Küchenangebot vergleichen, Küchenstudio Angebote, Reverse-Auktion Küche"
      canonicalPath="/faq"
      structuredData={faqSchema}
    >
      <PageHero size="md">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Häufig gestellte Fragen</h1>
          <p className="text-lg text-muted-foreground">
            Alles zur KI-Visualisierung, zur Preisschätzung und dazu, wie Studios um Ihr Projekt bieten.
          </p>
        </div>
      </PageHero>

      <FAQ hideHeader />

      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4">Weitere Fragen?</h2>
            <p className="text-muted-foreground mb-8">
              Unser Support-Team steht Ihnen gerne zur Verfügung und beantwortet alle Ihre Fragen persönlich.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-card p-6 rounded-lg border shadow-sm">
                <h3 className="font-bold text-lg mb-2">Telefonische Beratung</h3>
                <p className="text-muted-foreground mb-4">Mo–Fr von 10:00–18:00 Uhr</p>
                {supportPhone ? (
                  <a href={`tel:${supportPhone.replace(/\s/g, "")}`} className="text-primary hover:underline font-semibold">
                    {supportPhone}
                  </a>
                ) : (
                  <span className="text-muted-foreground">Siehe Kontaktseite</span>
                )}
              </div>
              <div className="bg-card p-6 rounded-lg border shadow-sm">
                <h3 className="font-bold text-lg mb-2">E-Mail Support</h3>
                <p className="text-muted-foreground mb-4">Antwort innerhalb von 24 Stunden</p>
                <a href={`mailto:${contactEmail}`} className="text-primary hover:underline font-semibold">
                  {contactEmail}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default FAQPage;
