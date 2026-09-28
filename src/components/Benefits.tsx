import { Link } from "react-router-dom";
import {
  Shield,
  TrendingDown,
  Users,
  MapPin,
  Lock,
  Heart,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import consultantImage from "@/assets/studio-consultant.webp";
import consultationImage from "@/assets/kitchen-consultation.webp";
import { useSettings } from "@/contexts/SettingsContext";
import { BRAND } from "@/lib/brand/config";

const benefits = [
  {
    icon: TrendingDown,
    title: "Angebote vergleichen",
    description:
      "Mehrere Küchenstudios erstellen ein Angebot für Ihr Projekt. Sie vergleichen Preis und Leistung in Ruhe – statt sich auf ein einziges Angebot verlassen zu müssen.",
  },
  {
    icon: Shield,
    title: "Geprüfte Küchenstudios",
    description:
      "Jedes Küchenstudio wird vor der Freischaltung von unserem Team manuell geprüft – erst dann sieht es Projekte.",
  },
  {
    icon: Users,
    title: "Persönlich erreichbar",
    description:
      "Fragen zu Ihrer Anfrage oder zu einem Angebot? Unser Team ist montags bis freitags per Telefon und E-Mail für Sie da.",
  },
  {
    icon: Heart,
    title: "Ohne Abnahmezwang",
    description:
      "Sie entscheiden frei. Wenn kein Angebot passt, lehnen Sie einfach ab — keine Kosten, keine Gebühren, keine Haken.",
  },
  {
    icon: MapPin,
    title: "Studios aus Ihrer Region",
    description:
      "Unser Studio-Netzwerk wächst regional. Bei Ihrer Anfrage prüfen wir, ob Studios in Ihrer Nähe teilnehmen – sonst melden wir uns persönlich.",
  },
  {
    icon: Lock,
    title: "Anonym starten",
    description:
      "Studios sehen zuerst nur PLZ-Bereich und Projekt. Ihre Kontaktdaten erhalten höchstens drei Studios für Rückfragen und das Studio, dessen Angebot Sie annehmen.",
  },
];

const Benefits = () => {
  const { settings } = useSettings();
  const siteName = settings?.site_name || BRAND.name;

  return (
    <section
      id="vorteile"
      className="py-12 sm:py-16 md:py-20 lg:py-28 bg-gradient-to-b from-background to-muted/30"
    >
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12 lg:mb-16 space-y-3 sm:space-y-4">
          <div className="inline-block animate-fade-in">
            <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-semibold text-primary">
              Ihre Vorteile
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-foreground tracking-tight animate-fade-in animate-delay-100">
            Warum <span className="text-primary">{siteName}</span>?
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed animate-fade-in animate-delay-200 px-4">
            Wir verbinden Sie mit den richtigen Küchenstudios — und sorgen durch
            echten Wettbewerb dafür, dass Sie fair planen und schlau sparen.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8 mb-12 sm:mb-16 lg:mb-20">
          {benefits.map((benefit, index) => {
            const IconComponent = benefit.icon;
            return (
              <div
                key={benefit.title}
                className="group animate-scale-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="bg-card border-2 hover:border-primary/30 rounded-lg p-5 sm:p-8 space-y-4 hover-lift h-full transition-smooth">
                  <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-smooth">
                    <IconComponent className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{benefit.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trust Section with Images */}
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 items-center mb-12 sm:mb-16 lg:mb-20">
          <div className="space-y-4 sm:space-y-6 order-2 lg:order-1">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground">
              Echter Wettbewerb unter{" "}
              <span className="text-primary">geprüften Studios</span>
            </h3>
            <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
              Küchenstudios aus Ihrer Region erstellen Angebote für Ihr Projekt.
              Sie vergleichen in Ruhe und entscheiden frei — ohne dass Sie jedes
              Studio einzeln anrufen müssen. Freigeschaltet wird ein Studio erst,
              nachdem unser Team es manuell geprüft hat.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 pt-2 sm:pt-4">
              <div className="space-y-1 sm:space-y-2">
                <div className="text-2xl sm:text-3xl font-bold text-primary">Manuell</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Geprüfte Küchenstudios</div>
              </div>
              <div className="space-y-1 sm:space-y-2">
                <div className="text-2xl sm:text-3xl font-bold text-primary">Mo–Fr</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Persönlicher Support</div>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <div className="relative rounded-lg overflow-hidden shadow-xl hover-lift">
              <img
                src={consultantImage}
                alt="Küchenberaterin in einem Küchenstudio"
                loading="lazy"
                decoding="async"
                width={1920}
                height={1088}
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>

        {/* Transparency Section */}
        <div className="bg-card border-2 border-primary/20 rounded-lg p-6 sm:p-8 md:p-10 lg:p-12 shadow-lg">
          <div className="grid md:grid-cols-2 gap-8 sm:gap-10 items-center">
            <div className="order-2 md:order-1">
              <div className="relative rounded-lg overflow-hidden shadow-lg">
                <img
                  src={consultationImage}
                  alt="Küchenplanung mit Grundriss und Materialmustern"
                  loading="lazy"
                  decoding="async"
                  width={1600}
                  height={896}
                  className="w-full h-auto"
                />
              </div>
            </div>
            <div className="space-y-4 sm:space-y-6 order-1 md:order-2">
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground">
                Für Sie kostenlos — <span className="text-primary">immer</span>
              </h3>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                Bei {siteName} gibt es für Privatkunden keine Gebühren. Wir
                finanzieren uns ausschließlich über die Küchenstudios — über
                Kontaktfreischaltungen und eine Provision, wenn Sie deren
                Angebot annehmen.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2">
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 sm:p-6 text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-primary mb-1 sm:mb-2">0 €</div>
                  <div className="text-xs sm:text-sm text-muted-foreground font-medium">
                    Anfrage & Vergleich
                  </div>
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 sm:p-6 text-center">
                  <div className="text-3xl sm:text-4xl font-bold text-primary mb-1 sm:mb-2">0 €</div>
                  <div className="text-xs sm:text-sm text-muted-foreground font-medium">
                    Versteckte Kosten
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section CTA */}
        <div className="text-center mt-12 sm:mt-16">
          <Button
            asChild
            size="lg"
            className="h-auto min-h-11 max-w-full whitespace-normal px-6 py-2.5 sm:px-8"
          >
            <Link to="/funnel/c">
              Traumküche kostenlos planen
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Benefits;
