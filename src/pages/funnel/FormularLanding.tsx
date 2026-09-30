import { ArrowUp, BadgeCheck, Lock, ShieldCheck } from "lucide-react";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import PageLayout from "@/components/PageLayout";
import { FunnelFooter } from "@/components/funnel/funnel-footer";
import { FunnelHeader } from "@/components/funnel/funnel-header";
import { FunnelProgress } from "@/components/funnel/funnel-progress";
import { Button } from "@/components/ui/button";
import { FormPicker } from "@/features/funnel-a/landing/FormPicker";
import { HowItWorksSteps } from "@/features/funnel-a/landing/HowItWorksSteps";
import { LandingFaq } from "@/features/funnel-a/landing/LandingFaq";
import { FUNNEL_A_FIRST_SLUG, FUNNEL_A_SLUGS, findStep } from "@/features/funnel-a/steps";
import { useFunnelTelemetry } from "@/hooks/useFunnelTelemetry";
import { cn } from "@/lib/utils";
import { captureUtmParams } from "@/lib/utm";

const TRUST = [
  { icon: ShieldCheck, text: "Kostenlos & unverbindlich" },
  { icon: BadgeCheck, text: "Nur geprüfte Küchenstudios" },
  { icon: Lock, text: "Studios sehen zuerst nur Ihren PLZ-Bereich" },
];

const QUESTION_ID = "formular-frage";

/**
 * /formular – Einstieg in Funnel A („Küchenangebote einholen“): Die erste
 * Frage steht direkt unter dem Hero, ein Klick auf eine Küchenform startet
 * den Funnel bei Schritt 2. Schon hier gilt der Fokusmodus der Funnels.
 */
export default function FormularLanding() {
  const { search } = useLocation();
  const cardRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const telemetry = useFunnelTelemetry({
    funnel: "a",
    step: FUNNEL_A_FIRST_SLUG,
    stepIndex: 0,
    stepLabel: findStep(FUNNEL_A_FIRST_SLUG).eyebrow,
    totalSteps: FUNNEL_A_SLUGS.length,
  });

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
      description="Beschreiben Sie Ihre Wunschküche in ca. 3 Minuten: Geprüfte Küchenstudios aus Ihrer Region schicken Ihnen Angebote. Kostenlos und unverbindlich vergleichen."
      keywords="Küchenangebote vergleichen, Küche Angebote einholen, Küchenstudio Angebot, neue Küche Angebot, Küchenplanung kostenlos"
      canonicalPath="/formular"
      header={<FunnelHeader containerClassName="container max-w-5xl px-4 sm:px-6" />}
      footer={<FunnelFooter className="border-t border-border" />}
    >
      <section className="bg-gradient-to-b from-primary/[0.07] via-background to-background">
        <div className="container max-w-5xl px-4 pt-4 sm:px-6 sm:pt-12 short:sm:pt-6">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-[1.375rem] font-extrabold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl short:sm:text-4xl">
              Küchenangebote aus Ihrer Region – <span className="text-primary">kostenlos vergleichen</span>
            </h1>
            <p className="mx-auto mt-4 hidden max-w-2xl text-base leading-relaxed text-muted-foreground sm:block sm:text-lg short:sm:mt-2">
              Beschreiben Sie Ihre Wunschküche in ca. 3 Minuten. Geprüfte Küchenstudios aus Ihrer Region schicken Ihnen Angebote – Sie
              vergleichen und entscheiden.
            </p>
            <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground sm:mt-5 sm:gap-x-5 sm:text-sm short:sm:mt-3">
              {TRUST.map(({ icon: Icon, text }, i) => (
                <li key={text} className={cn("flex items-center gap-1.5", i === 2 && "hidden sm:flex")}>
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div
            ref={cardRef}
            data-funnel-telemetry=""
            className="mt-4 scroll-mt-24 rounded-2xl sm:mt-10 sm:border sm:bg-card sm:p-6 sm:shadow-lg lg:p-8 short:sm:mt-5"
          >
            <FunnelProgress current={0} total={FUNNEL_A_SLUGS.length} className="mb-3 sm:mb-4" />
            <h2 id={QUESTION_ID} ref={questionRef} tabIndex={-1} className="text-lg font-bold leading-tight text-foreground outline-none sm:text-2xl">
              Welche Form soll Ihre Küche haben?
            </h2>
            <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
              Wählen Sie die Form, die Ihrem Raum am nächsten kommt – danach geht es direkt weiter.
            </p>
            <div className="mt-3 sm:mt-5">
              <FormPicker search={search} labelledBy={QUESTION_ID} onPick={telemetry.next} />
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
            Wählen Sie die Form Ihrer Küche – den Rest beantworten Sie in rund 3 Minuten.
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
