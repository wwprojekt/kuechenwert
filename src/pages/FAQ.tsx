import PageLayout from "@/components/PageLayout";
import FAQ from "@/components/FAQ";
import PageHero from "@/components/PageHero";
import { useSettings } from "@/contexts/SettingsContext";

// FAQ data for structured data
const faqData = [
  {
    question: "Wie lange dauert der Verkaufsprozess?",
    answer: "Der gesamte Prozess kann in nur 24-48 Stunden abgeschlossen sein. Nach dem Hochladen Ihrer Fahrzeugdaten und Fotos erhalten Sie innerhalb von 24 Stunden erste Angebote. Nach Annahme eines Angebots erfolgt die Abwicklung und Auszahlung meist innerhalb von 1-2 Werktagen.",
  },
  {
    question: "Was kostet der Service?",
    answer: "Für Verkäufer ist der gesamte Service komplett kostenlos — von der Bewertung über das Einstellen bis zum Verkaufsabschluss. Es fallen keine Gebühren, Provisionen oder versteckte Kosten an. Die Vermittlungsprovision wird ausschließlich vom Händler/Käufer getragen und ist für diesen transparent auf der Auktionsseite einsehbar.",
  },
  {
    question: "Wie werden die Händler geprüft?",
    answer: "Alle Händler auf unserer Plattform durchlaufen einen strengen KYC/KYB-Prozess. Wir prüfen Gewerbeanmeldung, USt-ID, Handelsregisterauszug und Versicherungsschutz. Zusätzlich überwachen wir regelmäßig die Zahlungsmoral und Kundenzufriedenheit.",
  },
  {
    question: "Was passiert, wenn das Mindestgebot erreicht wird?",
    answer: "Wird Ihr festgelegtes Mindestgebot während der Auktion erreicht oder überschritten, kommt ein verbindlicher Kaufvertrag mit dem Höchstbietenden zustande. Der Verkauf ist dann für beide Seiten verpflichtend. Wird das Mindestgebot nicht erreicht, besteht keine Verkaufspflicht. Die Bewertung und das Einstellen Ihres Fahrzeugs bleiben selbstverständlich kostenlos.",
  },
  {
    question: "Sind Gebote und Sofortkäufe verbindlich?",
    answer: "Ja, jedes Gebot eines Händlers ist rechtlich verbindlich und kann nicht zurückgezogen werden. Ebenso ist die Nutzung der Sofortkauf-Option ein verbindlicher Kaufabschluss. Der Händler ist verpflichtet, das Fahrzeug zum gebotenen Preis bzw. Sofortkaufpreis zu erwerben. Diese Verbindlichkeit schützt Verkäufer und sorgt für einen seriösen Auktionsprozess.",
  },
  {
    question: "Welche Zahlungsmethoden gibt es?",
    answer: "Bei Übergabe an einer Ankaufstation können Sie zwischen Barzahlung oder SEPA Instant Transfer wählen. Bei Online-Verkäufen erfolgt die Zahlung per Banküberweisung. Alle Zahlungen sind versichert und werden erst nach erfolgreicher Fahrzeugübergabe freigegeben.",
  },
  {
    question: "Was passiert mit meinen Daten?",
    answer: "Ihre Daten werden nach DSGVO-Standards gespeichert und verarbeitet. Händler sehen Ihre Kontaktdaten erst, wenn ein Kaufvertrag zustande kommt. Sie können jederzeit eine Kopie Ihrer Daten anfordern oder die vollständige Löschung beantragen.",
  },
  {
    question: "Welche Dokumente benötige ich?",
    answer: "Für die Bewertung benötigen Sie zunächst nur grundlegende Fahrzeugdaten. Für den tatsächlichen Verkauf werden Fahrzeugbrief, Fahrzeugschein, HU-Bericht und ggf. Serviceheft benötigt. Eine detaillierte Checkliste erhalten Sie nach Angebotsannahme.",
  },
  {
    question: "Gibt es eine Mindest- oder Höchstsumme?",
    answer: "Nein, wir vermitteln Wohnmobile aller Preisklassen. Von älteren Campern ab 5.000€ bis zu Luxus-Wohnmobilen im sechsstelligen Bereich – unsere Händler sind an allen Fahrzeugen interessiert.",
  },
];

const FAQPage = () => {
  const { settings } = useSettings();
  const supportPhone = settings?.support_phone || '';
  const contactEmail = settings?.contact_email || '';
  
  // Generate FAQ structured data
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqData.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <PageLayout
      breadcrumbs={true}
      title="Häufig gestellte Fragen (FAQ)"
      description="Antworten auf häufig gestellte Fragen zum Verkauf und Kauf von Wohnmobilen auf CaravanWert. Erfahren Sie mehr über Bewertung, Abwicklung und Auktionen."
      keywords="Wohnmobil FAQ, Wohnmobil verkaufen Fragen, Wohnmobil Ankauf Ablauf, CaravanWert Hilfe"
      canonicalPath="/faq"
      structuredData={faqSchema}
    >
      {/* Hero Section */}
      <PageHero size="md">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Häufig gestellte Fragen
          </h1>
          <p className="text-lg text-muted-foreground">
            Finden Sie schnell Antworten auf die wichtigsten Fragen rund um den Verkauf und Kauf von Wohnmobilen auf unserer Plattform.
          </p>
        </div>
      </PageHero>

      {/* FAQ Component */}
      <FAQ hideHeader />

      {/* Additional Support Section */}
      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">
              Weitere Fragen?
            </h2>
            <p className="text-muted-foreground mb-8">
              Unser Support-Team steht Ihnen gerne zur Verfügung und beantwortet alle Ihre Fragen persönlich.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-card p-6 rounded-lg border shadow-sm">
                <h3 className="font-bold text-lg mb-2">Telefonische Beratung</h3>
                <p className="text-muted-foreground mb-4">
                  Mo-Fr von 8:00-18:00 Uhr
                </p>
                {supportPhone ? (
                  <a 
                    href={`tel:${supportPhone.replace(/\s/g, '')}`} 
                    className="text-primary hover:underline font-semibold"
                  >
                    {supportPhone}
                  </a>
                ) : (
                  <span className="text-muted-foreground">Siehe Kontaktseite</span>
                )}
              </div>
              <div className="bg-card p-6 rounded-lg border shadow-sm">
                <h3 className="font-bold text-lg mb-2">E-Mail Support</h3>
                <p className="text-muted-foreground mb-4">
                  Antwort innerhalb von 24 Stunden
                </p>
                {contactEmail ? (
                  <a 
                    href={`mailto:${contactEmail}`} 
                    className="text-primary hover:underline font-semibold"
                  >
                    {contactEmail}
                  </a>
                ) : (
                  <span className="text-muted-foreground">Siehe Kontaktseite</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default FAQPage;
