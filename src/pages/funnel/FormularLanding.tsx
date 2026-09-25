import { ArrowUp, BadgeCheck, Lock, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { FormPicker } from "@/features/funnel-a/landing/FormPicker";
import { HowItWorksSteps } from "@/features/funnel-a/landing/HowItWorksSteps";
import { LandingFaq } from "@/features/funnel-a/landing/LandingFaq";
import { captureUtmParams } from "@/lib/utm";

const TRUST = [
  { icon: ShieldCheck, text: "Kostenlos & unverbindlich" },
  { icon: BadgeCheck, text: "Nur geprüfte Küchenstudios" },
  { icon: Lock, text: "Kontaktdaten nur mit Ihrer Einwilligung" },
];

const QUESTION_ID = "formular-frage";

/**
 * /formular – Einstieg in Funnel A („Küchenangebote einholen“): Die erste
 * Frage steht direkt unter dem Hero, ein Klick auf eine Küchenform startet
 * den Funnel bei Schritt 2.
 */
export default function FormularLanding() {
  const { search } = useLocation();
  const cardRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    captureUtmParams();
  }, []);

  const backToForm = () => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    cardRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    questionRef.current?.focus({ preventScroll: true });
  };

  return (
    <PageLayout
      title="Küchenangebote vergleichen – kostenlos & unverbindlich"
      description="Beschreiben Sie Ihre Wunschküche in 2 Minuten: Geprüfte Küchenstudios aus Ihrer Region schicken Ihnen Angebote. Kostenlos und unverbindlich vergleichen."
      keywords="Küchenangebote vergleichen, Küche Angebote einholen, Küchenstudio Angebot, neue Küche Angebot, Küchenplanung kostenlos"
      canonicalPath="/formular"
    >
      <section className="bg-gradient-to-b from-primary/[0.07] via-background to-background">
        <div className="container max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Küchenangebote aus Ihrer Region – <span className="text-primary">kostenlos vergleichen</span>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Beschreiben Sie Ihre Wunschküche in 2 Minuten. Geprüfte Küchenstudios aus Ihrer Region schicken Ihnen Angebote – Sie
              vergleichen und entscheiden.
            </p>
            <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {TRUST.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div ref={cardRef} className="mt-8 scroll-mt-24 rounded-2xl border bg-card p-4 shadow-lg sm:mt-10 sm:p-6 lg:p-8">
            <p className="text-sm font-semibold text-primary">Frage 1 · insgesamt ca. 2 Minuten</p>
            <h2 id={QUESTION_ID} ref={questionRef} tabIndex={-1} className="mt-1 text-xl font-bold text-foreground outline-none sm:text-2xl">
              Welche Form soll Ihre Küche haben?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Wählen Sie die Form, die Ihrem Raum am nächsten kommt – danach geht es direkt weiter.
            </p>
            <div className="mt-5">
              <FormPicker search={search} labelledBy={QUESTION_ID} />
            </div>
          </div>
        </div>
      </section>

      <HowItWorksSteps />
      <LandingFaq />

      <section aria-labelledby="formular-cta" className="container max-w-5xl px-4 pb-16 sm:px-6">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-6 py-10 text-center sm:px-10">
          <h2 id="formular-cta" className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Bereit für Ihre Küchenangebote?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            Wählen Sie die Form Ihrer Küche – den Rest beantworten Sie in rund 2 Minuten.
          </p>
          <Button size="lg" className="mt-6" onClick={backToForm}>
            <ArrowUp aria-hidden="true" />
            Jetzt Küchenform wählen
          </Button>
        </div>
      </section>
    </PageLayout>
  );
}
