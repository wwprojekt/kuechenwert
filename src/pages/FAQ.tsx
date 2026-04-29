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
    question: "Was kostet mich KüchenWert?",
    answer:
      "Für Sie als Privatkunde ist KüchenWert komplett kostenlos — von der Anfrage über die Angebotsvergleiche bis zur Beratung im Studio. Es fallen weder eine Anmeldegebühr noch eine Vermittlungsprovision an. Unsere Provision wird ausschließlich vom Küchenstudio gezahlt, und zwar nur wenn Sie tatsächlich einen Kauf abschließen.",
  },
  {
    question: "Was unterscheidet KüchenWert von Aroundhome oder küchenportal.de?",
    answer:
      "Drei Dinge: 1) Unsere Reverse-Auktion (Funnel B) — wenn Sie schon ein Studio-Angebot haben, können geprüfte Händler es 72 h lang unterbieten. 2) Der KI-Planer (Funnel C) — drei fotorealistische Entwürfe Ihrer Traumküche auf Knopfdruck. 3) Echter Experten-Check vor jeder Vermittlung, damit Sie keine unqualifizierten Anrufe bekommen.",
  },
  {
    question: "Wie funktioniert die Reverse-Auktion bei Funnel B?",
    answer:
      "Sie laden Ihr vorhandenes Studio-Angebot, Bild der geplanten Küche und den Angebotspreis hoch. Unser Team neutralisiert das Angebot (Studio-Name wird nicht mitgeschickt) und stellt es für 72 h in unser Händler-Netzwerk. Verifizierte Küchen-Händler bieten Ihnen einen günstigeren Preis für dieselbe oder eine vergleichbare Ausstattung an. Sie nehmen das beste Gebot verbindlich an — oder lehnen alle ab.",
  },
  {
    question: "Wie werden die Küchenstudios geprüft?",
    answer:
      "Jedes Partner-Studio durchläuft unser KYC/KYB-Verfahren: Gewerbeanmeldung, USt-ID, Handelsregisterauszug und Versicherungsschutz werden geprüft. Laufend überwachen wir Kundenzufriedenheit und Zahlungsmoral. Studios, die negativ auffallen, werden aus dem Netzwerk entfernt.",
  },
  {
    question: "Bin ich nach der Anfrage zu einem Kauf verpflichtet?",
    answer:
      "Nein. Weder die Anfrage selbst noch einzelne Angebote verpflichten Sie zu irgendetwas. Sie können alle Angebote ablehnen, sich nur für die Beratung interessieren oder mit dem Vorhaben später weitermachen. Bei Funnel B ist nur die Annahme eines Gegenangebots verbindlich — bis dahin sind Sie frei.",
  },
  {
    question: "Wie lange dauert es bis ich erste Angebote habe?",
    answer:
      "Nach dem Experten-Check (meist binnen 24 h nach Ihrer Anfrage) melden sich die ersten Studios in der Regel binnen 24–48 h. Für die Reverse-Auktion (Funnel B) läuft ein fester 72-h-Zeitraum, in dem die Händler ihre Gegenangebote abgeben.",
  },
  {
    question: "Welche Küchenstudios sind im Netzwerk?",
    answer:
      "Unsere Partner umfassen alle Größen: vom inhabergeführten Küchenstudio über regionale Küchenzentren bis zu großen Möbelhäusern und Direkthändlern. Je nach PLZ und Budget passen wir die Vermittlung an. Marken wie Nobilia, Häcker, Nolte, SieMatic, Schüller, Bulthaup u. v. a. sind über unsere Partner erhältlich.",
  },
  {
    question: "Was, wenn ich nur eine ungefähre Preisvorstellung haben will?",
    answer:
      "Dafür haben wir unseren KüchenRechner: beantworten Sie in 30 Sekunden 4–5 Fragen zu Größe, Stil und Ausstattung — wir zeigen Ihnen eine realistische Preisspanne, ohne dass Sie Kontaktdaten hinterlassen müssen. Den Rechner finden Sie oben im Menü oder direkt unter /kuechenrechner.",
  },
  {
    question: "Was passiert mit meinen Daten?",
    answer:
      "Ihre Daten werden nach DSGVO-Standards gespeichert und verarbeitet. Küchenstudios sehen Ihre Kontaktdaten erst, wenn Sie das Angebot aktiv freigeben bzw. einen Beratungstermin bestätigen. Sie können jederzeit eine Kopie Ihrer Daten anfordern oder die vollständige Löschung beantragen.",
  },
  {
    question: "Kann ich mehrere Funnel gleichzeitig nutzen?",
    answer:
      "Ja — viele Kundinnen und Kunden starten mit Funnel A (Angebote einholen), nutzen parallel den KüchenRechner für das eigene Budgetgefühl und ziehen Funnel B später zurate, sobald sie ein konkretes Studio-Angebot in der Hand haben. Alle Funnel sind kostenlos und beeinflussen einander nicht.",
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
      description={`Antworten auf häufig gestellte Fragen zu ${BRAND.name}: Angebote einholen, Reverse-Auktion, KI-Küchenplaner, Partnerstudios und Datenschutz.`}
      keywords="KüchenWert FAQ, Küche planen Fragen, Küchenangebot vergleichen, Reverse-Auktion Küche, Küchen-Hilfe"
      canonicalPath="/faq"
      structuredData={faqSchema}
    >
      {/* Hero Section */}
      <PageHero size="md">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Häufig gestellte Fragen</h1>
          <p className="text-lg text-muted-foreground">
            Antworten auf die wichtigsten Fragen zu unseren drei Wegen zur Traumküche — Angebote einholen, Studio-Preise unterbieten und KI-Planer.
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
