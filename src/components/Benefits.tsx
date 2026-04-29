import { Link } from "react-router-dom";
import {
  Shield,
  TrendingDown,
  Users,
  Award,
  Lock,
  Heart,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import dealerImage from "@/assets/dealer-professional.webp";
import handshakeImage from "@/assets/handshake-deal.webp";
import { useSettings } from "@/contexts/SettingsContext";
import { BRAND } from "@/lib/brand/config";

const benefits = [
  {
    icon: TrendingDown,
    title: "Bis zu 30 % sparen",
    description:
      "Durch unsere Reverse-Auktion unterbieten geprüfte Händler Ihr vorhandenes Studio-Angebot — faire Preise statt Listenpreis.",
  },
  {
    icon: Shield,
    title: "100 % geprüft",
    description:
      "Alle Partner-Studios durchlaufen unser KYC/KYB-Verfahren. Gewerbenachweis, USt-ID und Versicherung — lückenlos geprüft.",
  },
  {
    icon: Users,
    title: "Persönliche Beratung",
    description:
      "Vor jeder Auktion prüft unser Experten-Team Ihr Angebot kostenlos am Telefon. Keine Bots, keine Callcenter — echte Küchen-Profis.",
  },
  {
    icon: Heart,
    title: "Ohne Abnahmezwang",
    description:
      "Sie entscheiden frei. Wenn kein Angebot passt, lehnen Sie einfach ab — keine Kosten, keine Gebühren, keine Haken.",
  },
  {
    icon: Award,
    title: "Ganz Deutschland",
    description:
      "Küchenstudios und Fachhändler in allen Bundesländern. Ob Großstadt, Kleinstadt oder ländlich — wir finden Partner in Ihrer Nähe.",
  },
  {
    icon: Lock,
    title: "DSGVO-konform",
    description:
      "Ihre Daten bleiben bei uns. Händler sehen Ihre vollen Kontaktdaten erst, wenn Sie deren Angebot aktiv freigeben.",
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
              Unser Netzwerk umfasst Küchenstudios, Fachhändler und Möbelhäuser in
              ganz Deutschland. Sie sehen die besten Angebote, vergleichen in Ruhe
              und entscheiden frei — ohne dass Sie jedes Studio einzeln anrufen
              müssen.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 pt-2 sm:pt-4">
              <div className="space-y-1 sm:space-y-2">
                <div className="text-2xl sm:text-3xl font-bold text-primary">100 %</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Geprüfte Partner</div>
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
                src={dealerImage}
                alt="Küchenberater im Studio"
                loading="lazy"
                width={1920}
                height={1080}
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
                  src={handshakeImage}
                  alt="Zufriedene Kunden nach Küchenkauf"
                  loading="lazy"
                  width={1280}
                  height={720}
                  className="w-full h-auto"
                />
              </div>
            </div>
            <div className="space-y-4 sm:space-y-6 order-1 md:order-2">
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-foreground">
                Für Sie kostenlos — <span className="text-primary">immer</span>
              </h3>
              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                Bei {siteName} gibt es für Privatkunden keine Gebühren. Unsere
                Vermittlungsprovision wird ausschließlich vom Küchenstudio gezahlt
                — und zwar nur dann, wenn Sie am Ende tatsächlich kaufen.
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
          <Link to="/funnel/a">
            <Button size="lg" className="gradient-hero hover:gradient-hero-hover">
              Kostenlos Angebote einholen
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Benefits;
