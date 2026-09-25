import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { landingFaqItems } from "./faq";

/** Kein FAQPage-Markup: Die Fragen sind auf /faq ausgezeichnet, Google erwartet jede Frage nur einmal pro Website. */
export function LandingFaq() {
  return (
    <section aria-labelledby="formular-faq" className="container max-w-3xl px-4 pb-12 sm:px-6 sm:pb-16">
      <h2 id="formular-faq" className="text-center text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Häufige Fragen
      </h2>
      <Accordion type="single" collapsible className="mt-8 space-y-3">
        {landingFaqItems().map((faq) => (
          <AccordionItem key={faq.question} value={faq.question} className="rounded-xl border bg-card px-5 shadow-sm sm:px-6">
            <AccordionTrigger className="py-4 text-left font-semibold text-foreground hover:text-primary hover:no-underline">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="pb-4 leading-relaxed text-muted-foreground">{faq.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <p className="mt-6 text-center text-sm">
        <Link to="/faq" className="font-semibold text-primary underline-offset-4 hover:underline">
          Alle Fragen und Antworten
        </Link>
      </p>
    </section>
  );
}
