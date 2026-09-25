import { ArrowRight, CheckCircle2, ClipboardList, Handshake, Scale, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import coupleImage from "@/assets/couple-kitchen.webp";
import showroomImage from "@/assets/kitchen-showroom.webp";

const STEPS = [
  {
    icon: ClipboardList,
    title: "Projekt anlegen",
    description: "Raumfoto und Maße im Konfigurator, kurzer Fragebogen oder Ihr vorhandenes Studio-Angebot – ganz wie Sie möchten.",
    duration: "2–5 Min",
  },
  {
    icon: Sparkles,
    title: "Preis & Vorschau",
    description: "Sie sehen sofort eine realistische Preisspanne – im Konfigurator zusätzlich die KI-Vorschau Ihrer Küche im eigenen Raum.",
    duration: "Sofort",
  },
  {
    icon: Scale,
    title: "Studios bieten",
    description: "Geprüfte Studios aus Ihrer Region sehen Ihr Projekt anonymisiert und geben Angebote ab. Ein Angebot kann nur gesenkt werden.",
    duration: "bis 7 Tage",
  },
  {
    icon: Handshake,
    title: "Sie wählen",
    description: "Sie vergleichen alle Angebote auf Ihrer Projektseite und nehmen das beste an – dann meldet sich das Studio für Aufmaß und Feinplanung.",
    duration: "Sie bestimmen",
  },
];

const Process = () => {
  return (
    <section className="bg-background py-12 sm:py-16 md:py-20 lg:py-28">
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-3xl space-y-3 text-center sm:mb-12 sm:space-y-4 lg:mb-16">
          <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
            Ihr Weg zur Traumküche
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl md:text-4xl lg:text-5xl">
            In 4 Schritten zu Ihrer neuen Küche
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
            Ohne Telefon-Marathon und ohne Druck: Die Studios kommen mit ihren Angeboten zu Ihnen – und Sie entscheiden frei.
          </p>
        </div>

        <ol className="mx-auto mb-12 grid max-w-5xl gap-6 sm:mb-16 sm:gap-8 md:grid-cols-2 lg:mb-20 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex flex-col items-center space-y-4 text-center">
              <div className="relative">
                <div className="gradient-hero flex h-20 w-20 items-center justify-center rounded-lg shadow-lg">
                  <step.icon className="h-10 w-10 text-white" aria-hidden="true" />
                </div>
                <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-bold text-white shadow-lg" aria-hidden="true">
                  {index + 1}
                </div>
              </div>
              <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{step.duration}</span>
              <h3 className="text-xl font-bold text-foreground">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>

        <div className="mb-10 grid gap-8 sm:mb-12 sm:gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="flex flex-col justify-center space-y-4 sm:space-y-6">
            <h3 className="text-2xl font-extrabold text-foreground sm:text-3xl">
              Echte Angebote von <span className="text-primary">geprüften Küchenstudios</span>
            </h3>
            <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
              Ihr Projekt geht nur an Studios, deren Einzugsgebiet Ihre Region abdeckt. Die Studios sehen Maße, Wünsche und
              Visualisierung – aber nicht, wer Sie sind. So bekommen Sie vergleichbare Angebote statt einer Flut von Anrufen.
            </p>
            <ul className="space-y-3">
              {["Nur Studios aus Ihrer Region", "Angebote können nur sinken", "Kontaktdaten nur mit Ihrer Einwilligung"].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                  </span>
                  <span className="font-medium text-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="overflow-hidden rounded-lg shadow-xl">
            <img
              src={showroomImage}
              alt="Moderne Küche mit Kochinsel im Studio-Showroom"
              loading="lazy"
              decoding="async"
              width={1600}
              height={896}
              className="h-auto w-full"
            />
          </div>
        </div>

        <div className="mb-10 grid gap-8 sm:mb-12 sm:gap-10 lg:mb-16 lg:grid-cols-2 lg:gap-12">
          <div className="order-2 overflow-hidden rounded-lg shadow-xl lg:order-1">
            <img
              src={coupleImage}
              alt="Paar kocht gemeinsam in der neuen Küche"
              loading="lazy"
              decoding="async"
              width={1600}
              height={896}
              className="h-auto w-full"
            />
          </div>
          <div className="order-1 flex flex-col justify-center space-y-4 sm:space-y-6 lg:order-2">
            <h3 className="text-2xl font-extrabold text-foreground sm:text-3xl">
              Persönlicher <span className="text-primary">Service für Sie</span>
            </h3>
            <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
              Unser Küchen-Team hilft bei Fachbegriffen, prüft vorhandene Angebote und ist bei Fragen zu Ihrem Projekt für Sie da –
              von der ersten Idee bis zur Montage.
            </p>
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {[
                { value: "Persönlich", label: "Betreuung" },
                { value: "Mo–Fr", label: "10–18 Uhr erreichbar" },
                { value: "100 %", label: "Kostenlos" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-muted/50 p-3 text-center sm:p-4">
                  <div className="text-lg font-bold text-primary sm:text-2xl">{s.value}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center">
          <Button asChild size="lg" className="gradient-hero h-12 px-8 text-base font-semibold hover:shadow-glow sm:h-14 sm:px-10 sm:text-lg">
            <Link to="/funnel/c">
              Jetzt Traumküche planen
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">Kein Login nötig • Unverbindlich • Keine Abnahmepflicht</p>
        </div>
      </div>
    </section>
  );
};

export default Process;
