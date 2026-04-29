import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "react-router-dom";

const faqs = [
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

interface FAQProps {
  hideHeader?: boolean;
}

const FAQ = ({ hideHeader = false }: FAQProps) => {
  return (
    <section id="faq" className="py-12 sm:py-16 md:py-24 gradient-subtle">
      <div className="container px-4 sm:px-6 lg:px-8">
        {!hideHeader && (
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12 lg:mb-16 space-y-3 sm:space-y-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
              Häufig gestellte Fragen
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Antworten auf die wichtigsten Fragen rund um Ihre neue Küche und den
              KüchenWert-Service.
            </p>
          </div>
        )}

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card border rounded-xl px-6 shadow-sm hover:shadow-md transition-smooth"
              >
                <AccordionTrigger className="text-left font-semibold text-foreground hover:text-primary hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12 text-center">
            <p className="text-muted-foreground mb-4">Haben Sie weitere Fragen?</p>
            <Link
              to="/kontakt"
              className="text-primary font-semibold hover:underline inline-flex items-center gap-2"
            >
              Kontaktieren Sie unseren Support →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
