import { ArrowRight, Calculator, FileCheck, Gavel, Sparkles, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Channel {
  icon: LucideIcon;
  badge: string;
  title: string;
  subtitle: string;
  description: string;
  benefits: string[];
  to: string;
  ctaLabel: string;
  featured?: boolean;
}

const CHANNELS: Channel[] = [
  {
    icon: Sparkles,
    badge: "Neu · mit KI",
    title: "Traumküche visualisieren",
    subtitle: "Ihr Raum, Ihre Küche – fotorealistisch",
    description:
      "Foto Ihres Raums hochladen, Maße angeben und Fronten, Arbeitsplatte und Geräte wählen. Die KI zeigt Ihre neue Küche in Ihrem Raum – mit Preisschätzung. Auf Wunsch bieten geprüfte Studios um Ihr Projekt.",
    benefits: ["KI-Vorschau im eigenen Raum", "Preisschätzung mit Einzelpositionen", "Studios bieten – Sie wählen"],
    to: "/funnel/c",
    ctaLabel: "Küche planen",
    featured: true,
  },
  {
    icon: FileCheck,
    badge: "Am schnellsten",
    title: "Angebote einholen",
    subtitle: "Von geprüften Studios aus Ihrer Region",
    description:
      "Beschreiben Sie in 2 Minuten Ihre Wunschküche – Stil, Form, Budget, PLZ. Passende Küchenstudios aus Ihrer Region schicken Ihnen Angebote, die Sie auf Ihrer Projektseite vergleichen.",
    benefits: ["In 2 Minuten ausgefüllt", "Erste Angebote meist in 48 h", "Keine Abnahmepflicht"],
    to: "/formular",
    ctaLabel: "Angebote holen",
  },
  {
    icon: Gavel,
    badge: "Am meisten sparen",
    title: "Studio-Preis unterbieten",
    subtitle: "Reverse-Auktion auf Ihr vorhandenes Angebot",
    description:
      "Sie haben schon ein Angebot vom Küchenstudio? Laden Sie es hoch – nach unserem kurzen Experten-Check bieten andere geprüfte Studios 72 Stunden lang für dieselbe oder eine vergleichbare Küche.",
    benefits: ["72-h-Auktion mit Studio-Geboten", "Experten-Check inklusive", "Studio-Name bleibt anonym"],
    to: "/funnel/b",
    ctaLabel: "Angebot unterbieten lassen",
  },
];

const HowItWorks = () => {
  return (
    <section id="wie-es-funktioniert" className="cv-auto bg-background py-12 sm:py-16 md:py-20 lg:py-28">
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-3xl space-y-3 text-center sm:mb-12 sm:space-y-4 lg:mb-16">
          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
            So funktioniert KüchenWert
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl md:text-4xl lg:text-5xl">
            Drei Wege zu Ihrer neuen Küche
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
            Ob Ideenphase, konkrete Wünsche oder schon ein Angebot in der Hand – alle Wege sind kostenlos, unverbindlich und
            enden auf Ihrer persönlichen Projektseite mit allen Angeboten.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8">
          {CHANNELS.map((channel, index) => (
            <Card
              key={channel.title}
              className={
                channel.featured
                  ? "relative overflow-hidden border-2 border-primary shadow-lg"
                  : "relative overflow-hidden border-2 transition-colors hover:border-primary/40"
              }
            >
              <CardContent className="flex h-full flex-col space-y-5 px-5 pb-8 pt-8 sm:px-8 sm:pt-10">
                <div className="flex items-center justify-between">
                  <div className="gradient-hero flex h-16 w-16 items-center justify-center rounded-lg shadow-lg">
                    <channel.icon className="h-8 w-8 text-white" aria-hidden="true" />
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-lg font-bold text-white shadow-md" aria-hidden="true">
                    {index + 1}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    {channel.badge}
                  </span>
                  <h3 className="text-xl font-bold text-foreground sm:text-2xl">{channel.title}</h3>
                  <p className="text-sm font-semibold text-primary">{channel.subtitle}</p>
                  <p className="pt-2 leading-relaxed text-muted-foreground">{channel.description}</p>
                </div>

                <ul className="space-y-2.5 border-t border-border/50 pt-4">
                  {channel.benefits.map((benefit) => (
                    <li key={benefit} className="flex items-center gap-3">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                      <span className="text-sm font-medium text-foreground">{benefit}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-2">
                  <Button asChild variant={channel.featured ? "default" : "outline"} className="group/btn w-full">
                    <Link to={channel.to}>
                      {channel.ctaLabel}
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-2xl space-y-4 rounded-lg bg-muted/50 p-6 text-center sm:p-8">
          <p className="text-base text-muted-foreground sm:text-lg">Nicht sicher, welcher Weg der richtige ist?</p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" variant="outline" className="h-11 px-6 font-semibold sm:h-12 sm:px-8">
              <Link to="/kuechenrechner">
                <Calculator className="mr-2 h-4 w-4" />
                Budget in 30 s checken
              </Link>
            </Button>
            <Button asChild size="lg" className="h-11 px-6 font-semibold sm:h-12 sm:px-8">
              <Link to="/kontakt">
                Kostenlose Beratung
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
