import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import { FAQ_ITEMS } from "@/data/faq";

interface FAQProps {
  hideHeader?: boolean;
}

const FAQ = ({ hideHeader = false }: FAQProps) => {
  return (
    <section id="faq" className="gradient-subtle py-12 sm:py-16 md:py-24">
      <div className="container px-4 sm:px-6 lg:px-8">
        {!hideHeader && (
          <div className="mx-auto mb-10 max-w-3xl space-y-3 text-center sm:mb-12 sm:space-y-4 lg:mb-16">
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl md:text-4xl lg:text-5xl">Häufig gestellte Fragen</h2>
            <p className="text-base text-muted-foreground sm:text-lg">
              Antworten auf die wichtigsten Fragen rund um Ihre neue Küche und den KüchenWert-Service.
            </p>
          </div>
        )}

        <div className="mx-auto max-w-3xl">
          <Accordion type="single" collapsible className="space-y-4">
            {FAQ_ITEMS.map((faq) => (
              <AccordionItem
                key={faq.question}
                value={faq.question}
                className="transition-smooth rounded-xl border bg-card px-6 shadow-sm hover:shadow-md"
              >
                <AccordionTrigger className="py-5 text-left font-semibold text-foreground hover:text-primary hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-5 leading-relaxed text-muted-foreground">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-12 text-center">
            <p className="mb-4 text-muted-foreground">Haben Sie weitere Fragen?</p>
            <Link to="/kontakt" className="inline-flex items-center gap-2 font-semibold text-primary hover:underline">
              Kontaktieren Sie unseren Support →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
