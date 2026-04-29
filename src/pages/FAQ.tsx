import PageLayout from "@/components/PageLayout";
import FAQ from "@/components/FAQ";
import PageHero from "@/components/PageHero";
import { useSettings } from "@/contexts/SettingsContext";
import { BRAND } from "@/lib/brand/config";

// FAQ data for structured data. Muss inhaltlich mit src/components/FAQ.tsx
// uebereinstimmen, damit Schema.org FAQPage und sichtbarer UI-Text nicht
// auseinanderlaufen (Google straft das sonst ab).
const faqData = [
  {
    question: "Wie lange dauert der Verkaufsprozess?",
    answer:
      "Kostenlose Bewertung in 2 Minuten. Konkrete Angebote geprüfter Küchen-Händler erhalten Sie innerhalb von 24–48 Stunden. Nach Annahme eines Angebots werden Demontage und Abholung meist innerhalb von 1–2 Wochen organisiert.",
  },
  {
    question: "Was kostet der Service?",
    answer:
      "Für Sie als Verkäufer ist der gesamte Service komplett kostenlos — von der Bewertung über das Einstellen der Küche bis zum Verkaufsabschluss. Es fallen keine Gebühren, Provisionen oder versteckte Kosten an. Die Vermittlungsgebühr trägt ausschließlich der Küchen-Händler.",
  },
  {
    question: "Wie werden die Küchen-Händler geprüft?",
    answer:
      "Alle Händler auf unserer Plattform durchlaufen einen strengen KYC/KYB-Prozess. Wir prüfen Gewerbeanmeldung, USt-ID, Handelsregisterauszug und Versicherungsschutz. Zusätzlich überwachen wir laufend Zahlungsmoral, Reklamationsquote und Kundenzufriedenheit.",
  },
  {
    question: "Welche Küchen kann ich verkaufen?",
    answer:
      "Wir vermitteln Küchen aller gängigen Hersteller — Nobilia, Häcker, Nolte, SieMatic, Bulthaup, Poggenpohl, LEICHT, next125, Schüller und viele mehr. Ob L-Form, U-Form, Kochinsel oder Küchenzeile: Wir finden den passenden Käufer. Das Baujahr sollte idealerweise nicht älter als 15 Jahre sein.",
  },
  {
    question: "Sind Angebote der Händler verbindlich?",
    answer:
      "Ja. Jedes Angebot eines unserer geprüften Küchen-Händler ist rechtlich verbindlich und kann nicht ohne triftigen Grund (z.B. erhebliche Abweichungen von Ihren Angaben) zurückgezogen werden. Das schützt Sie als Verkäufer und sorgt für einen seriösen Vermittlungsprozess.",
  },
  {
    question: "Wer baut die Küche aus?",
    answer:
      "Der ausgewählte Küchen-Händler übernimmt die fachgerechte Demontage und den Abtransport — inklusive aller Elektrogeräte, Arbeitsplatte und ggf. Anschlüsse. Sie müssen sich um nichts kümmern. Termin für Abholung wird mit Ihnen abgestimmt.",
  },
  {
    question: "Welche Zahlungsmethoden gibt es?",
    answer:
      "Nach Annahme eines Angebots erfolgt die Auszahlung typisch am Tag der Abholung — per Banküberweisung, PayPal oder Barzahlung bei Übergabe. Alle Zahlungen werden dokumentiert und sind für beide Seiten rechtlich abgesichert.",
  },
  {
    question: "Was passiert mit meinen Daten?",
    answer:
      "Ihre Daten werden nach DSGVO-Standards in Deutschland gespeichert und verarbeitet. Küchen-Händler sehen Ihre Kontaktdaten erst dann, wenn Sie ein konkretes Angebot annehmen. Sie können jederzeit eine Auskunft, Korrektur oder vollständige Löschung Ihrer Daten beantragen.",
  },
  {
    question: "Welche Unterlagen/Fotos brauche ich?",
    answer:
      "Für eine präzise Bewertung sind 4–8 aussagekräftige Fotos hilfreich: Gesamtansicht, Arbeitsfläche, Fronten und Griffe, Elektrogeräte mit Typenschild. Kaufbeleg oder Originalplanung sind nicht zwingend nötig, helfen dem Händler aber bei der Einschätzung.",
  },
  {
    question: "Gibt es eine Mindest- oder Höchstsumme?",
    answer:
      "Nein. Wir vermitteln Küchen aller Preisklassen — von Einbauküchen ab 500 € bis zu hochwertigen Design-Küchen im fünfstelligen Bereich. Unsere Händler sind an Küchen aller Größen und Preisklassen interessiert.",
  },
];

const FAQPage = () => {
  const { settings } = useSettings();
  const supportPhone = settings?.support_phone || "";
  const contactEmail = settings?.contact_email || BRAND.supportEmail;

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqData.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <PageLayout
      breadcrumbs={true}
      title="Häufig gestellte Fragen (FAQ)"
      description={`Antworten auf häufig gestellte Fragen zum Verkauf und Kauf von Küchen auf ${BRAND.name}. Erfahren Sie mehr über Bewertung, Abwicklung und Händler.`}
      keywords="Küche verkaufen FAQ, Küchen-Ankauf Ablauf, gebrauchte Küche verkaufen Fragen, KüchenWert Hilfe"
      canonicalPath="/faq"
      structuredData={faqSchema}
    >
      {/* Hero Section */}
      <PageHero size="md">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Häufig gestellte Fragen</h1>
          <p className="text-lg text-muted-foreground">
            Finden Sie schnell Antworten auf die wichtigsten Fragen rund um den Verkauf und Kauf gebrauchter Küchen auf unserer Plattform.
          </p>
        </div>
      </PageHero>

      {/* FAQ Component */}
      <FAQ hideHeader />

      {/* Additional Support Section */}
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
                <p className="text-muted-foreground mb-4">Mo–Fr von 8:00–18:00 Uhr</p>
                {supportPhone ? (
                  <a
                    href={`tel:${supportPhone.replace(/\s/g, "")}`}
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
                <p className="text-muted-foreground mb-4">Antwort innerhalb von 24 Stunden</p>
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-primary hover:underline font-semibold"
                >
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
