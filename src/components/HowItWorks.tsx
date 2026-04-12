import { Card, CardContent } from "@/components/ui/card";
import { Zap, Gavel, MapPin, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const channels = [
  {
    iconComponent: Zap,
    title: "Sofortpreis-Ankauf",
    description: "Erhalten Sie innerhalb von 24 Stunden ein verbindliches Kaufangebot von professionellen Händlern.",
    benefits: [
      "Schnelle Bewertung",
      "Verbindliches Angebot",
      "Keine Auktion nötig",
    ],
  },
  {
    iconComponent: Gavel,
    title: "Online-Auktion",
    description: "Lassen Sie geprüfte Händler um Ihr Wohnmobil bieten und erzielen Sie einen fairen Preis.",
    benefits: [
      "Maximaler Verkaufspreis",
      "Transparente Gebote",
      "72h Auktionsdauer",
    ],
  },
  {
    iconComponent: MapPin,
    title: "Ankaufstation",
    description: "Übergeben Sie Ihr Wohnmobil persönlich an einer unserer Partnerstationen und erhalten Sie Barzahlung.",
    benefits: [
      "Persönliche Übergabe",
      "Sofort Barzahlung",
      "Deutschlandweit verfügbar",
    ],
  },
];

const HowItWorks = () => {
  return (
    <section id="wie-es-funktioniert" className="py-12 sm:py-16 md:py-20 lg:py-28 bg-background cv-auto">
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12 lg:mb-16 space-y-3 sm:space-y-4">
          <div className="inline-block animate-fade-in">
            <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-semibold text-primary">
              Flexibel & Transparent
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-foreground tracking-tight animate-fade-in animate-delay-100">
            Drei Wege, Ihr Wohnmobil zu verkaufen
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed animate-fade-in animate-delay-200">
            Wählen Sie den Verkaufsweg, der am besten zu Ihnen passt. Alle drei Optionen sind sicher, transparent und führen zu fairen Preisen.
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
                <CardContent className="relative pt-10 pb-10 px-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="h-16 w-16 rounded-lg gradient-hero flex items-center justify-center shadow-lg group-hover:shadow-glow transition-smooth">
                      <IconComponent className="h-8 w-8 text-white" />
                    </div>
                    <div className="h-10 w-10 bg-secondary rounded-full flex items-center justify-center text-white text-lg font-bold shadow-md">
                      {index + 1}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-2xl font-bold text-foreground">
                      {channel.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {channel.description}
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-4 border-t border-border/50">
                    {channel.benefits.map((benefit) => (
                      <div key={benefit} className="flex items-center gap-3">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary"></div>
                        <span className="text-sm text-foreground font-medium">{benefit}</span>
                      </div>
                    ))}
                  </div>

                  <a href={index === 0 ? "/verkaufen" : index === 1 ? "/verkaufen" : "/ankaufstationen"} className="w-full">
                    <Button 
                      variant="outline" 
                      className="w-full mt-4 group/btn hover:border-primary hover:text-primary"
                    >
                      Mehr erfahren
                      <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-smooth" />
                    </Button>
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 sm:mt-10 lg:mt-12 text-center bg-muted/50 rounded-lg p-6 sm:p-8 max-w-2xl mx-auto">
          <p className="text-muted-foreground text-base sm:text-lg mb-4 sm:mb-6">
            Nicht sicher, welcher Weg der richtige ist?
          </p>
          <a href="/kontakt">
            <Button size="lg" className="h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base font-semibold w-full sm:w-auto">
              Kostenlose Beratung anfordern
              <ArrowRight className="ml-2 h-4 sm:h-5 w-4 sm:w-5" />
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
