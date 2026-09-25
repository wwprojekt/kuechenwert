import { ArrowRight, BadgeCheck, Calculator, Inbox, Lock, ShieldCheck, Sparkles, TrendingDown, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { BeforeAfterSlider } from "@/features/planner/components/BeforeAfterSlider";
import { BRAND_IMAGES } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface Path {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  cta: string;
  featured?: boolean;
}

const PATHS: Path[] = [
  {
    to: "/funnel/c",
    icon: Sparkles,
    title: "Traumküche visualisieren",
    description: "Raumfoto & Maße hochladen, Küche gestalten – KI-Vorschau und Preisschätzung in wenigen Minuten.",
    cta: "Jetzt Küche planen",
    featured: true,
  },
  {
    to: "/funnel/a",
    icon: Inbox,
    title: "Angebote einholen",
    description: "Wünsche angeben – geprüfte Studios aus Ihrer Region schicken Angebote.",
    cta: "Angebote holen",
  },
  {
    to: "/funnel/b",
    icon: TrendingDown,
    title: "Angebot unterbieten lassen",
    description: "Vorhandenes Studio-Angebot hochladen – andere Studios bieten weniger.",
    cta: "Preis drücken",
  },
];

const TRUST = [
  { icon: ShieldCheck, text: "Kostenlos & unverbindlich" },
  { icon: BadgeCheck, text: "Nur geprüfte Küchenstudios" },
  { icon: Lock, text: "Kontaktdaten nur mit Ihrer Einwilligung" },
];

const EXAMPLE_OFFERS = [
  { studio: "Studio A", price: "22.900 €" },
  { studio: "Studio B", price: "21.400 €" },
  { studio: "Studio C", price: "19.800 €", best: true },
];

function PathCard({ path }: { path: Path }) {
  const Icon = path.icon;
  return (
    <Link
      to={path.to}
      className={cn(
        "group relative flex h-full gap-4 rounded-2xl border-2 p-4 shadow-sm transition-all duration-200 sm:p-5",
        "hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        path.featured
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/95"
          : "border-border bg-card text-card-foreground hover:border-primary",
      )}
    >
      <span
        className={cn(
          "grid h-11 w-11 flex-none place-items-center rounded-xl",
          path.featured ? "bg-white/15 text-primary-foreground" : "bg-primary/10 text-primary",
        )}
        aria-hidden="true"
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-base font-bold leading-tight sm:text-lg">{path.title}</span>
          {path.featured && (
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">Neu · KI</span>
          )}
        </span>
        <span className={cn("mt-1 text-sm leading-snug", path.featured ? "text-primary-foreground/85" : "text-muted-foreground")}>
          {path.description}
        </span>
        <span
          className={cn(
            "mt-3 inline-flex w-fit items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
            path.featured ? "bg-white text-primary" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
          )}
        >
          {path.cta}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}

/**
 * Startseiten-Hero: Kernversprechen (Traumküche im eigenen Raum visualisieren)
 * plus drei klar klickbare Einstiege. Der KI-Konfigurator ist der empfohlene
 * Weg; Angebote einholen und Unterbieten bleiben gleichwertig erreichbar.
 */
const Hero = () => {
  const [featured, ...others] = PATHS;
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/[0.07] via-background to-background">
      <div className="container px-4 pb-14 pt-8 sm:px-6 sm:pt-12 lg:px-8 lg:pb-20 lg:pt-16">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-sm font-semibold text-primary">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Neu: KI-Visualisierung im eigenen Raum
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.06] tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem]">
              Ihre Traumküche – <span className="text-primary">im eigenen Raum</span> visualisiert.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Foto hochladen, Küche konfigurieren, Preis sofort sehen. Geprüfte Küchenstudios aus Ihrer Region bieten um Ihr
              Projekt – <strong className="font-semibold text-foreground">Sie wählen das beste Angebot.</strong>
            </p>

            <nav aria-label="Drei Wege zur neuen Küche" className="mt-8 grid gap-3">
              <PathCard path={featured} />
              <div className="grid gap-3 sm:grid-cols-2">
                {others.map((p) => (
                  <PathCard key={p.to} path={p} />
                ))}
              </div>
            </nav>

            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {TRUST.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground">
              Erst mal nur das Budget prüfen?{" "}
              <Link to="/kuechenrechner" className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline">
                <Calculator className="h-4 w-4" aria-hidden="true" />
                KüchenRechner öffnen
              </Link>
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <BeforeAfterSlider
              before={BRAND_IMAGES.kitchenBefore}
              after={BRAND_IMAGES.kitchenAfter}
              beforeLabel="Ihr Raum heute"
              afterLabel="KI-Vorschau"
              initial={42}
              priority
              className="aspect-[4/3] shadow-2xl ring-1 ring-black/5"
            />

            <div className="pointer-events-none absolute -bottom-6 left-3 rounded-2xl border bg-card/95 px-4 py-3 shadow-xl backdrop-blur sm:left-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Preisschätzung · Beispiel</p>
              <p className="text-lg font-extrabold tabular-nums text-foreground">ca. 18.500 – 24.000 €</p>
              <p className="text-xs text-muted-foreground">inkl. Geräte, Lieferung & Montage</p>
            </div>

            <div className="pointer-events-none absolute -right-2 bottom-10 hidden w-56 rounded-2xl border bg-card/95 p-3 shadow-xl backdrop-blur sm:block lg:-right-6">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Studio-Angebote · Beispiel</p>
              <ul className="mt-1.5 space-y-1">
                {EXAMPLE_OFFERS.map((o) => (
                  <li
                    key={o.studio}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-2 py-1.5 text-sm",
                      o.best ? "bg-primary/10 font-bold text-primary" : "text-foreground",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      {o.best && <BadgeCheck className="h-4 w-4" aria-hidden="true" />}
                      {o.studio}
                    </span>
                    <span className="tabular-nums">{o.price}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
