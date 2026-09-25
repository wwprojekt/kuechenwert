import { ArrowRight, BadgeCheck, Gift, Server, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { STYLES } from "@/features/planner/core";

const STATS = [
  { icon: BadgeCheck, value: "Bundesweit", label: "Geprüfte Küchenstudios" },
  { icon: Sparkles, value: "Sofort", label: "Preisschätzung & KI-Vorschau" },
  { icon: Gift, value: "100 %", label: "Kostenlos & unverbindlich" },
  { icon: Server, value: "EU", label: "Daten auf Servern in der EU" },
];

/**
 * Stil-Galerie: jede Kachel startet den Konfigurator mit vorgewähltem Stil
 * (/funnel/c?stil=…). Bilder und Stile kommen aus demselben Katalog wie der
 * Planer, damit Startseite und Konfigurator nie auseinanderlaufen.
 */
const KitchenShowcase = () => {
  return (
    <section className="cv-auto overflow-hidden bg-gradient-to-b from-muted/30 via-muted/50 to-muted/30 py-12 lg:py-16">
      <div className="container px-4 sm:px-6 lg:px-8">
        <div className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-4 lg:gap-8">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center rounded-xl border bg-card p-4 text-center shadow-sm">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <stat.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <span className="text-2xl font-bold text-foreground lg:text-3xl">{stat.value}</span>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>

        <div className="mb-10 text-center">
          <h2 className="mb-3 text-2xl font-bold text-foreground sm:text-3xl lg:text-4xl">Welcher Küchen-Stil passt zu Ihnen?</h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Stil wählen und direkt im eigenen Raum ansehen – Fronten, Farben und Arbeitsplatte passen Sie im Konfigurator an.
          </p>
        </div>

        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3 lg:gap-6">
          {STYLES.map((style) => (
            <li key={style.id}>
              <Link
                to={`/funnel/c?stil=${style.id}`}
                className="group relative block aspect-[4/3] overflow-hidden rounded-2xl shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <img
                  src={`/images/planner/styles/${style.id}.webp`}
                  alt=""
                  width={800}
                  height={600}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" aria-hidden="true" />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
                  <span className="min-w-0">
                    <span className="block text-base font-bold sm:text-lg">{style.label}</span>
                    <span className="block text-sm text-white/80">{style.hint}</span>
                  </span>
                  <span
                    className="hidden flex-none items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-primary shadow sm:inline-flex"
                    aria-hidden="true"
                  >
                    Planen
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-10 space-y-3 text-center">
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">Noch unsicher?</span> Im Konfigurator können Sie jederzeit den Stil wechseln.
          </p>
          <Button asChild size="lg" className="mt-2">
            <Link to="/funnel/c">
              Traumküche planen
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default KitchenShowcase;
