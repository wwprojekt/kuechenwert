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
  badge?: string;
  featured?: boolean;
}

const PATHS: Path[] = [
  {
    to: "/funnel/c",
    icon: Sparkles,
    title: "Traumküche planen & visualisieren",
    description: "KI-Vorschau im eigenen Raum und Preis in 3 Minuten",
    badge: "Neu · KI",
    featured: true,
  },
  {
    to: "/formular",
    icon: Inbox,
    title: "Kostenlos Angebote einholen",
    description: "Geprüfte Küchenstudios aus Ihrer Region",
  },
  {
    to: "/funnel/b",
    icon: TrendingDown,
    title: "Angebot unterbieten lassen",
    description: "Vorhandenes Studio-Angebot günstiger bekommen",
  },
];

const TRUST = [
  { icon: ShieldCheck, text: "Kostenlos & unverbindlich" },
  { icon: BadgeCheck, text: "Nur geprüfte Küchenstudios" },
  { icon: Lock, text: "Studios sehen zuerst nur Ihren PLZ-Bereich" },
];

const EXAMPLE_OFFERS = [
  { studio: "Studio A", price: "22.900 €" },
  { studio: "Studio B", price: "21.400 €" },
  { studio: "Studio C", price: "19.800 €", best: true },
];

/** Einstieg in einen Funnel: große Klickfläche mit Icon, Nutzen in einer Zeile und Pfeil. */
function PathButton({ path }: { path: Path }) {
  const Icon = path.icon;
  return (
    <Link
      to={path.to}
      className={cn(
        "group relative flex min-h-[4rem] items-center gap-3.5 overflow-hidden rounded-2xl border px-3.5 py-3 text-left transition-all duration-200 sm:min-h-[4.75rem] sm:gap-4 sm:px-5 short:lg:min-h-[4.25rem] short:lg:py-2.5",
        "hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:hover:translate-y-0",
        path.featured
          ? "border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25"
          : "border-border bg-card text-card-foreground shadow-sm hover:border-primary/60 hover:shadow-card-hover",
      )}
    >
      {path.featured && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl transition-transform duration-500 group-hover:scale-125"
        />
      )}
      <span
        aria-hidden="true"
        className={cn(
          "relative grid h-11 w-11 flex-none place-items-center rounded-xl sm:h-12 sm:w-12",
          path.featured ? "bg-white/15 text-primary-foreground ring-1 ring-white/25" : "gradient-hero text-primary-foreground shadow-sm",
        )}
      >
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </span>
      <span className="relative flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[15px] font-bold leading-tight sm:text-lg">{path.title}</span>
          {path.badge && (
            <span className="hidden rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary sm:inline">
              {path.badge}
            </span>
          )}
        </span>
        <span className={cn("mt-0.5 text-[13px] leading-snug sm:text-sm", path.featured ? "text-primary-foreground/90" : "text-muted-foreground")}>
          {path.description}
        </span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative grid h-9 w-9 flex-none place-items-center rounded-full transition-all duration-200 group-hover:translate-x-0.5",
          path.featured ? "bg-white text-primary" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
        )}
      >
        <ArrowRight className="h-4 w-4" />
      </span>
    </Link>
  );
}

/**
 * Startseiten-Hero: Kernversprechen plus die drei Einstiege, auf jedem Gerät
 * ohne Scrollen sichtbar. Der KI-Planer ist der empfohlene Weg; Angebote
 * einholen und Unterbieten bleiben gleichwertig erreichbar.
 */
const Hero = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/[0.07] via-background to-background">
      <div className="container px-4 pb-12 pt-5 sm:px-6 sm:pt-10 lg:px-8 lg:pb-16 lg:pt-12 short:lg:pt-8">
        <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
          <div className="min-w-0">
            <span className="hidden items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1.5 text-sm font-semibold text-primary sm:inline-flex short:lg:hidden">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Neu: KI-Visualisierung im eigenen Raum
            </span>
            <h1 className="text-balance text-[1.625rem] font-extrabold leading-[1.1] tracking-tight text-foreground sm:mt-5 sm:text-5xl lg:text-[3.25rem] short:lg:mt-0 short:lg:text-[2.5rem]">
              Ihre Traumküche – <span className="text-primary">im eigenen Raum</span> visualisiert.
            </h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted-foreground sm:mt-4 sm:text-lg short:lg:mt-2 short:lg:text-base">
              Planen, Preis sehen, Angebote vergleichen – <strong className="font-semibold text-foreground">kostenlos und unverbindlich.</strong>
            </p>

            <nav aria-label="Drei Wege zur neuen Küche" className="mt-4 grid gap-2.5 sm:mt-7 sm:gap-3 short:lg:mt-5">
              {PATHS.map((p) => (
                <PathButton key={p.to} path={p} />
              ))}
            </nav>

            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground sm:mt-6 sm:text-sm">
              {TRUST.map(({ icon: Icon, text }, i) => (
                <li key={text} className={cn("flex items-center gap-1.5", i === 2 && "hidden sm:flex")}>
                  <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
            <p className="mt-3 hidden text-sm text-muted-foreground sm:block">
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
              beforeSrcSet={BRAND_IMAGES.kitchenBeforeSrcSet}
              afterSrcSet={BRAND_IMAGES.kitchenAfterSrcSet}
              sizes="(min-width: 1024px) 624px, (min-width: 640px) 576px, calc(100vw - 2rem)"
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
