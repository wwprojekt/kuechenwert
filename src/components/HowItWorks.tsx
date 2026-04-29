import { Card, CardContent } from "@/components/ui/card";
import { FileCheck, Gavel, Sparkles, ArrowRight, Clock, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

type Channel = {
  iconComponent: typeof FileCheck;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  benefits: string[];
  cta: string;
  ctaLabel: string;
  soon?: boolean;
};

const channels: Channel[] = [
  {
    iconComponent: FileCheck,
    badge: "Weg A · am einfachsten",
    title: "Angebote einholen",
    subtitle: "Von geprüften Küchenstudios in Ihrer Region",
    description:
      "Sie beschreiben in 2 Minuten Ihre Wunsch-Küche — Stil, Form, Budget, PLZ. Wir leiten Ihre Anfrage an passende Küchenstudios weiter. Die melden sich bei Ihnen mit individuellen Angeboten und Beratungsterminen.",
    benefits: [
      "In 2 Minuten ausgefüllt",
      "Angebote binnen 48 h",
      "Keine Abnahmepflicht",
    ],
    cta: "/funnel/a",
    ctaLabel: "Angebote holen",
  },
  {
    iconComponent: Gavel,
    badge: "Weg B · am meisten sparen",
    title: "Studio-Preis unterbieten",
    subtitle: "Reverse-Auktion auf Ihr vorhandenes Angebot",
    description:
      "Sie haben bereits ein Angebot von einem Küchenstudio? Laden Sie Angebot, Bild der geplanten Küche und Preis hoch — geprüfte Händler unterbieten in den nächsten 72 Stunden den Preis. Sie nehmen das beste Gegen-Angebot an.",
    benefits: [
      "Bis zu 30 % Ersparnis",
      "72 h verbindliche Auktion",
      "Experten-Check inklusive",
    ],
    cta: "/funnel/b",
    ctaLabel: "Angebot unterbieten lassen",
  },
  {
    iconComponent: Sparkles,
    badge: "Weg C · für Inspiration",
    title: "Traumküche visualisieren",
    subtitle: "KI-Planer: 3 Varianten in wenigen Minuten",
    description:
      "Sie sind noch in der Ideenphase? Unser KI-Planer entwirft auf Basis Ihres Grundrisses und Ihrer Wünsche bis zu 3 fotorealistische Küchen-Varianten. Anschließend vermitteln wir den passenden Fachhändler.",
    benefits: [
      "3 KI-Entwürfe gratis",
      "Fotorealistische Visualisierung",
      "Passender Fachhändler",
    ],
    cta: "/funnel/c",
    ctaLabel: "KI-Planer starten",
    soon: false,
  },
];

const HowItWorks = () => {
  return (
    <section
      id="wie-es-funktioniert"
      className="py-12 sm:py-16 md:py-20 lg:py-28 bg-background cv-auto"
    >
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12 lg:mb-16 space-y-3 sm:space-y-4">
          <div className="inline-block animate-fade-in">
            <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-semibold text-primary">
              So funktioniert KüchenWert
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-foreground tracking-tight animate-fade-in animate-delay-100">
            Drei Wege zu Ihrer neuen Küche
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed animate-fade-in animate-delay-200">
            Ob Sie frisch planen, bereits ein Angebot vom Studio haben oder mit KI
            inspirieren lassen wollen — alle drei Wege sind kostenlos, unverbindlich
            und lassen sich sogar kombinieren.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8 mb-12 sm:mb-14 lg:mb-16">
          {channels.map((channel, index) => {
            const IconComponent = channel.iconComponent;
            return (
              <Card
                key={channel.title}
                className="relative overflow-hidden hover-lift border-2 hover:border-primary/30 transition-smooth group animate-scale-in bg-card"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <CardContent className="relative pt-8 pb-8 px-5 sm:pt-10 sm:pb-10 sm:px-8 space-y-5 sm:space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="h-16 w-16 rounded-lg gradient-hero flex items-center justify-center shadow-lg group-hover:shadow-glow transition-smooth">
                      <IconComponent className="h-8 w-8 text-white" />
                    </div>
                    <div className="h-10 w-10 bg-secondary rounded-full flex items-center justify-center text-white text-lg font-bold shadow-md">
                      {index + 1}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="inline-flex items-center rounded-full bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1">
                      {channel.badge}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold text-foreground">
                      {channel.title}
                      {channel.soon && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase px-2 py-0.5 align-middle">
                          <Clock className="h-3 w-3 mr-1" />
                          Bald
                        </span>
                      )}
                    </h3>
                    <p className="text-sm font-semibold text-primary">
                      {channel.subtitle}
                    </p>
                    <p className="text-muted-foreground leading-relaxed pt-2">
                      {channel.description}
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-4 border-t border-border/50">
                    {channel.benefits.map((benefit) => (
                      <div key={benefit} className="flex items-center gap-3">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <span className="text-sm text-foreground font-medium">{benefit}</span>
                      </div>
                    ))}
                  </div>

                  <Link to={channel.cta} className="w-full">
                    <Button
                      variant="outline"
                      className="w-full mt-4 group/btn hover:border-primary hover:text-primary"
                    >
                      {channel.ctaLabel}
                      <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-smooth" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 sm:mt-10 lg:mt-12 text-center bg-muted/50 rounded-lg p-6 sm:p-8 max-w-2xl mx-auto space-y-4">
          <p className="text-muted-foreground text-base sm:text-lg">
            Nicht sicher, welcher Weg für Sie der richtige ist?
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/kuechenrechner">
              <Button
                size="lg"
                variant="outline"
                className="h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base font-semibold w-full sm:w-auto"
              >
                <Calculator className="mr-2 h-4 w-4" />
                Budget in 30 s checken
              </Button>
            </Link>
            <Link to="/kontakt">
              <Button
                size="lg"
                className="h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base font-semibold w-full sm:w-auto"
              >
                Kostenlose Beratung
                <ArrowRight className="ml-2 h-4 sm:h-5 w-4 sm:w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
