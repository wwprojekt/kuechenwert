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
    answer: "Der gesamte Prozess läuft meist in 3–5 Tagen ab. Nach der 2-Minuten-Bewertung erhalten Sie innerhalb von 24–48 Stunden konkrete Angebote von geprüften Küchen-Händlern. Nach Annahme erfolgt die Abholung und Bezahlung in der Regel binnen einer Woche.",
  },
  {
    question: "Was kostet der Service?",
    answer: "Für Verkäufer ist der gesamte Service komplett kostenlos — von der Bewertung über die Angebots-Vermittlung bis zum Verkaufsabschluss. Es fallen keine Gebühren, Provisionen oder versteckte Kosten an. Unsere Vermittlungsprovision wird ausschließlich vom Küchen-Händler getragen.",
  },
  {
    question: "Wie werden die Küchen-Händler geprüft?",
    answer: "Alle Händler durchlaufen einen strengen KYC/KYB-Prozess. Wir prüfen Gewerbeanmeldung, USt-ID, Handelsregisterauszug und Versicherungsschutz. Zusätzlich überwachen wir Zahlungsmoral und Kundenzufriedenheit laufend — Händler mit schlechten Bewertungen werden entfernt.",
  },
  {
    question: "Welche Küchen kann ich verkaufen?",
    answer: "Grundsätzlich alle Küchen — ob Einbauküche, modulare Küche oder Kochinsel. Marken wie Nobilia, Häcker, Nolte, SieMatic, Leicht, Bulthaup, Poggenpohl, Schüller oder auch Baumarkt-Küchen. Alter, Stil und Zustand beeinflussen nur den Preis, nicht die Verkaufbarkeit.",
  },
  {
    question: "Sind Angebote der Händler verbindlich?",
    answer: "Ja, jedes Angebot ist nach Annahme durch Sie rechtlich verbindlich. Der Händler verpflichtet sich, Ihre Küche zum angebotenen Preis zu erwerben, abzubauen (falls gewünscht) und abzuholen. Sie haben 48 Stunden Entscheidungszeit, ohne Druck.",
  },
  {
    question: "Wer baut die Küche aus?",
    answer: "Das hängt vom Angebot ab. Viele Händler bieten kostenlosen Abbau und Abtransport an — das ist einer der Vorteile, die Sie beim Angebots-Vergleich sehen. Alternativ können Sie die Küche selbst abbauen und übergeben, was meist einen höheren Verkaufspreis bedeutet.",
  },
  {
    question: "Welche Zahlungsmethoden gibt es?",
    answer: "Bei Abholung erfolgt die Zahlung per SEPA Instant Transfer oder Barzahlung — erst NACH erfolgreicher Begutachtung und Übernahme. Bei Online-Verkäufen gibt's eine treuhänderische Abwicklung über unsere Plattform. Alle Zahlungen sind abgesichert.",
  },
  {
    question: "Was passiert mit meinen Daten?",
    answer: "Ihre Daten werden nach DSGVO-Standards gespeichert und verarbeitet. Händler sehen Ihre vollen Kontaktdaten erst, wenn Sie deren Angebot annehmen. Sie können jederzeit eine Kopie Ihrer Daten anfordern oder die vollständige Löschung beantragen.",
  },
  {
    question: "Welche Unterlagen/Fotos brauche ich?",
    answer: "Für die Bewertung benötigen Sie nur Grundangaben: Marke, Alter, Ausstattung, Zustand — plus 4–8 Fotos (Front, Arbeitsfläche, Geräte, Sonderteile). Keine Rechnungen, keine Beleglisten. Eine detaillierte Foto-Checkliste finden Sie im Bewertungs-Funnel.",
  },
  {
    question: "Gibt es eine Mindest- oder Höchstsumme?",
    answer: "Nein, wir vermitteln Küchen aller Preisklassen. Von günstigen Einsteiger-Küchen ab ca. 500 € bis zu Luxus-Küchen im fünf- oder sechsstelligen Bereich. Unsere Händler sind an allen Arten interessiert.",
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
              Hier finden Sie Antworten auf die wichtigsten Fragen rund um den Verkauf Ihrer Küche.
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
