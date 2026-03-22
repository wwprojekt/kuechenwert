import { Button } from "@/components/ui/button";
import { FileText, Camera, CheckCircle2, Banknote } from "lucide-react";
import interiorImage from "@/assets/motorhome-interior.jpg";
import familyImage from "@/assets/happy-family.jpg";
import { useSettings } from "@/contexts/SettingsContext";

const steps = [
  {
    icon: FileText,
    title: "Details eingeben",
    description: "Füllen Sie unser einfaches Formular mit den wichtigsten Informationen zu Ihrem Wohnmobil aus.",
    duration: "2-3 Min",
  },
  {
    icon: Camera,
    title: "Fotos hochladen",
    description: "Laden Sie mindestens 4 Bilder Ihres Wohnmobils hoch für eine präzise Bewertung.",
    duration: "5 Min",
  },
  {
    icon: CheckCircle2,
    title: "Gebote erhalten",
    description: "Erhalten Sie Gebote von interessierten Käufern in unserer Auktion.",
    duration: "24h",
  },
  {
    icon: Banknote,
    title: "Verkaufen & Geld erhalten",
    description: "Akzeptieren Sie das beste Angebot und erhalten Sie Ihr Geld sicher und schnell.",
    duration: "1-2 Tage",
  },
];

const Process = () => {
  const { settings } = useSettings();
  const siteName = settings?.site_name || 'CaravanWert';
  
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="container">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-block">
            <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-4 py-1.5 text-sm font-semibold text-primary">
              Einfach & Schnell
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground tracking-tight">
            In 4 einfachen Schritten zum Verkauf
          </h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Unser optimierter Prozess macht den Verkauf Ihres Wohnmobils so einfach und stressfrei wie möglich.
          </p>
        </div>

        <div className="max-w-5xl mx-auto mb-20">
          <div className="relative">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
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
                        <h3 className="text-xl font-bold text-foreground">
                          {step.title}
                        </h3>
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
        <div className="grid lg:grid-cols-2 gap-12 mb-12">
          <div className="space-y-6 flex flex-col justify-center">
            <h3 className="text-3xl font-extrabold text-foreground">
              Professionelle Gebote <span className="text-primary">garantiert</span>
            </h3>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Käufer bieten fair und transparent auf Ihr Wohnmobil. Durch hochwertige Fotos und detaillierte Angaben erhalten Sie die besten Gebote.
            </p>
            <ul className="space-y-3">
              {[
                "Kostenlose Auktion",
                "Mehrere Gebote vergleichen",
                "Keine Verpflichtung zum Verkauf"
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
              alt="Wohnmobil Innenraum"
              className="w-full h-auto"
            />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 mb-16">
          <div className="rounded-lg overflow-hidden shadow-xl hover-lift order-2 lg:order-1">
            <img
              src={familyImage}
              alt="Zufriedene Kunden"
              className="w-full h-auto"
            />
          </div>
          <div className="space-y-6 flex flex-col justify-center order-1 lg:order-2">
            <h3 className="text-3xl font-extrabold text-foreground">
              Tausende <span className="text-primary">zufriedene Kunden</span>
            </h3>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Über 1.500 Wohnmobilbesitzer haben bereits erfolgreich über {siteName} verkauft und profitieren von unserem einzigartigen Service.
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">98%</div>
                <div className="text-xs text-muted-foreground mt-1">Zufriedenheit</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">24h</div>
                <div className="text-xs text-muted-foreground mt-1">Ø Antwortzeit</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold text-primary">4.8★</div>
                <div className="text-xs text-muted-foreground mt-1">Bewertung</div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center">
          <a href="/verkaufen/wizard">
            <Button size="lg" className="gradient-hero hover:shadow-glow text-lg h-14 px-10 font-semibold">
              Jetzt kostenlos starten
            </Button>
          </a>
          <p className="mt-4 text-sm text-muted-foreground">
            Keine Anmeldung erforderlich • Unverbindlich • Kostenlos
          </p>
        </div>
      </div>
    </section>
  );
};

export default Process;
