import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "react-router-dom";

const faqs = [
  {
    question: "Wie lange dauert der Verkaufsprozess?",
    answer: "Der gesamte Prozess kann in nur 24-48 Stunden abgeschlossen sein. Nach dem Hochladen Ihrer Fahrzeugdaten und Fotos erhalten Sie innerhalb von 24 Stunden erste Angebote. Nach Annahme eines Angebots erfolgt die Abwicklung und Auszahlung meist innerhalb von 1-2 Werktagen.",
  },
  {
    question: "Was kostet der Service?",
    answer: "Das Einstellen Ihres Wohnmobils zur Auktion ist völlig kostenlos. Erst wenn Sie ein Angebot annehmen und der Verkauf zustande kommt, erheben wir eine transparente Vermittlungsgebühr von 2,9% des Verkaufspreises. Diese wird automatisch vom Kaufpreis abgezogen.",
  },
  {
    question: "Wie werden die Händler geprüft?",
    answer: "Alle Händler auf unserer Plattform durchlaufen einen strengen KYC/KYB-Prozess. Wir prüfen Gewerbeanmeldung, USt-ID, Handelsregisterauszug und Versicherungsschutz. Zusätzlich überwachen wir regelmäßig die Zahlungsmoral und Kundenzufriedenheit.",
  },
  {
    question: "Kann ich mein Angebot ablehnen?",
    answer: "Ja, absolut! Alle Angebote sind unverbindlich. Sie entscheiden, ob und welches Angebot Sie annehmen möchten. Es gibt keine Verpflichtung zum Verkauf, auch nachdem Sie Ihr Wohnmobil zur Auktion eingestellt haben.",
  },
  {
    question: "Welche Zahlungsmethoden gibt es?",
    answer: "Bei Übergabe an einer Ankaufstation können Sie zwischen Barzahlung oder SEPA Instant Transfer wählen. Bei Online-Verkäufen erfolgt die Zahlung per Banküberweisung. Alle Zahlungen sind versichert und werden erst nach erfolgreicher Fahrzeugübergabe freigegeben.",
  },
  {
    question: "Was passiert mit meinen Daten?",
    answer: "Ihre Daten werden nach DSGVO-Standards gespeichert und verarbeitet. Händler sehen erst dann Ihre Kontaktdaten, wenn Sie ein Angebot annehmen. Sie können jederzeit eine Kopie Ihrer Daten anfordern oder die vollständige Löschung beantragen.",
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

const FAQ = () => {
  return (
    <section id="faq" className="py-16 md:py-24 gradient-subtle">
      <div className="container">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
            Häufig gestellte Fragen
          </h2>
          <p className="text-lg text-muted-foreground">
            Hier finden Sie Antworten auf die wichtigsten Fragen rund um den Verkauf Ihres Wohnmobils.
          </p>
        </div>

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
            <p className="text-muted-foreground mb-4">
              Haben Sie weitere Fragen?
            </p>
            <Link to="/kontakt" className="text-primary font-semibold hover:underline inline-flex items-center gap-2">
              Kontaktieren Sie unseren Support →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
