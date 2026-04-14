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
              Hier finden Sie Antworten auf die wichtigsten Fragen rund um den Verkauf Ihres Wohnmobils.
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
