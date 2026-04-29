import { Button } from "@/components/ui/button";
import { ClipboardList, MessageSquare, Scale, Handshake, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import interiorImage from "@/assets/kitchen-interior.webp";
import familyImage from "@/assets/happy-family.webp";

const steps = [
  {
    icon: ClipboardList,
    title: "Wünsche angeben",
    description:
      "Sie beantworten 17 kurze Fragen zu Ihrer Traumküche: Anlass, Form, Stil, Budget, PLZ. Alles optional bis auf Kontakt & Zeitrahmen.",
    duration: "2 Min",
  },
  {
    icon: MessageSquare,
    title: "Experten-Check",
    description:
      "Unser Küchen-Team prüft Ihre Anfrage und klärt offene Punkte in einem kurzen Rückruf. Keine Studios hören bis dahin mit.",
    duration: "1 Werktag",
  },
  {
    icon: Scale,
    title: "Angebote vergleichen",
    description:
      "Geprüfte Küchenstudios in Ihrer Region senden Ihnen bis zu 3 Angebote. Sie vergleichen bequem in Ihrem persönlichen Dashboard.",
    duration: "24–48 h",
  },
  {
    icon: Handshake,
    title: "Angebot wählen",
    description:
      "Sie entscheiden, mit welchem Studio Sie weitergehen — inklusive Beratungstermin, Aufmaß und finalem Angebot direkt vor Ort.",
    duration: "Sie bestimmen",
  },
];

const Process = () => {
  return (
    <section className="py-12 sm:py-16 md:py-20 lg:py-28 bg-background">
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12 lg:mb-16 space-y-3 sm:space-y-4">
          <div className="inline-block">
            <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-semibold text-primary">
              Ihr Weg zur Traumküche
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-foreground tracking-tight">
            In 4 Schritten zu Ihrer neuen Küche
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed">
            Unser Prozess ist so gebaut, dass Sie ohne Druck und ohne Telefon-Marathon
            die besten Angebote bekommen — und am Ende frei entscheiden.
          </p>
        </div>

        <div className="max-w-5xl mx-auto mb-12 sm:mb-16 lg:mb-20">
          <div className="relative">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
              {steps.map((step, index) => {
                const IconComponent = step.icon;
                return (
                  <div key={step.title} className="relative">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="relative z-10">
                        <div className="h-20 w-20 rounded-lg gradient-hero flex items-center justify-center shadow-lg hover-lift">
                          <IconComponent className="h-10 w-10 text-white" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 h-8 w-8 bg-secondary rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                          {index + 1}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="inline-block px-3 py-1 bg-primary/10 rounded-full">
                          <span className="text-xs font-semibold text-primary">
                            {step.duration}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-foreground">{step.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Image Sections */}
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 mb-10 sm:mb-12">
          <div className="space-y-4 sm:space-y-6 flex flex-col justify-center">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground">
              Individuelle Angebote von{" "}
              <span className="text-primary">geprüften Küchenstudios</span>
            </h3>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              Ihre Anfrage geht nur an Partner, die wirklich zu Ihrer Region und
              Ihrem Budget passen. So bekommen Sie Angebote, die Sie vergleichen
              können — statt einer Flut unbrauchbarer Anrufe.
            </p>
            <ul className="space-y-3">
              {[
                "Regional passende Studios",
                "Bis zu 3 Vergleichsangebote",
                "Beratungstermine nach Ihrem Zeitplan",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-foreground font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg overflow-hidden shadow-xl hover-lift">
            <img
              src={interiorImage}
              alt="Moderne Küche — geplant mit KüchenWert"
              loading="lazy"
              width={1280}
              height={720}
              className="w-full h-auto"
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 mb-10 sm:mb-12 lg:mb-16">
          <div className="rounded-lg overflow-hidden shadow-xl hover-lift order-2 lg:order-1">
            <img
              src={familyImage}
              alt="Zufriedene Familie in neuer Traumküche"
              loading="lazy"
              width={1280}
              height={720}
              className="w-full h-auto"
            />
          </div>
          <div className="space-y-4 sm:space-y-6 flex flex-col justify-center order-1 lg:order-2">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground">
              Persönlicher <span className="text-primary">Service für Sie</span>
            </h3>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              Wir begleiten Sie vom ersten Klick bis zur Montage. Unser Küchen-Team
              hilft bei Fachbegriffen, vergleicht Angebote mit Ihnen und ist nach
              dem Kauf weiter Ansprechpartner — auf Augenhöhe.
            </p>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <div className="text-center p-3 sm:p-4 bg-muted/50 rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-primary">Persönlich</div>
                <div className="text-xs text-muted-foreground mt-1">Betreuung</div>
              </div>
              <div className="text-center p-3 sm:p-4 bg-muted/50 rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-primary">24 h</div>
                <div className="text-xs text-muted-foreground mt-1">Ø Antwortzeit</div>
              </div>
              <div className="text-center p-3 sm:p-4 bg-muted/50 rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-primary">100 %</div>
                <div className="text-xs text-muted-foreground mt-1">Kostenlos</div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link to="/funnel/a">
            <Button
              size="lg"
              className="gradient-hero hover:shadow-glow text-base sm:text-lg h-12 sm:h-14 px-8 sm:px-10 font-semibold"
            >
              Jetzt kostenlos starten
            </Button>
          </Link>
          <p className="mt-4 text-sm text-muted-foreground">
            Kein Login zum Starten nötig • Unverbindlich • Keine Abnahmepflicht
          </p>
        </div>
      </div>
    </section>
  );
};

export default Process;
