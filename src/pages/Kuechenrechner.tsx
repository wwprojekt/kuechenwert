import { useMemo, useState } from "react";
import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Calculator,
  Gauge,
  Layers,
  Refrigerator,
  MapPin,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Gavel,
  CheckCircle2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { clsx } from "clsx";
import { BRAND } from "@/lib/brand/config";
import {
  generateServiceSchema,
  generateBreadcrumbSchema,
  getBreadcrumbsFromPath,
} from "@/lib/seo";

/**
 * KuechenRechner (Funnel D — der "Zero-Friction Budget-Estimator")
 *
 * Ziel: Besucher, die noch keine konkrete Anfrage stellen wollen, bekommen
 * in ≤ 30 s eine realistische Preisspanne fuer eine neue Kueche. Keine
 * Kontaktdaten noetig. Ergebnis-Screen fuehrt in Funnel A (Angebote einholen)
 * bzw. Funnel B (Studio-Preis unterbieten) weiter.
 *
 * Preismodell (empirisch-konservativ, abgeleitet aus Marktdaten 2024/25):
 *   Basispreis = size.base × equipment.multiplier
 *   Geraete-Aufschlag = appliances.addMin/addMax
 *   Regional-Faktor  = region × 1.0 (lt. PLZ-Gruppe)
 *   Ergebnis = [low, high] in EUR
 *
 * Wir zeigen die Spanne (low–high), nicht einen Punktwert — so bleiben
 * seriös und vermeiden "du bekommst exakt X EUR"-Frust.
 */

type SizeSlug = "klein" | "mittel" | "gross" | "xl";
type EquipmentSlug = "basic" | "standard" | "premium" | "luxus";
type AppliancesSlug = "einsteiger" | "mittelklasse" | "premium" | "luxus";
type RegionSlug = "laendlich" | "standard" | "metropole";

interface SizeOption {
  slug: SizeSlug;
  label: string;
  description: string;
  baseMin: number;
  baseMax: number;
}

interface EquipmentOption {
  slug: EquipmentSlug;
  label: string;
  description: string;
  multiplier: number;
}

interface AppliancesOption {
  slug: AppliancesSlug;
  label: string;
  description: string;
  addMin: number;
  addMax: number;
}

interface RegionOption {
  slug: RegionSlug;
  label: string;
  description: string;
  factor: number;
}

const SIZE_OPTIONS: SizeOption[] = [
  {
    slug: "klein",
    label: "Bis 8 m²",
    description: "Küchenzeile, kleine L-Form",
    baseMin: 4_000,
    baseMax: 9_000,
  },
  {
    slug: "mittel",
    label: "8 – 15 m²",
    description: "Standard-Küche, Wohnung",
    baseMin: 8_000,
    baseMax: 16_000,
  },
  {
    slug: "gross",
    label: "15 – 25 m²",
    description: "U-Form, Kochinsel möglich",
    baseMin: 14_000,
    baseMax: 28_000,
  },
  {
    slug: "xl",
    label: "Über 25 m²",
    description: "Wohnküche / Großer offener Raum",
    baseMin: 22_000,
    baseMax: 50_000,
  },
];

const EQUIPMENT_OPTIONS: EquipmentOption[] = [
  {
    slug: "basic",
    label: "Einfach",
    description: "Kunststofffronten, Basis-Arbeitsplatte, einfache Schubladen",
    multiplier: 1.0,
  },
  {
    slug: "standard",
    label: "Standard",
    description: "Lackfronten o. Holzfurnier, Quarz/Keramik, Softclose",
    multiplier: 1.35,
  },
  {
    slug: "premium",
    label: "Premium",
    description: "Echtholz o. Matt-Lack, Naturstein, Beleuchtung, Komfort",
    multiplier: 1.75,
  },
  {
    slug: "luxus",
    label: "Luxus",
    description: "Designer-Marken (Bulthaup, SieMatic), Sonderanfertigungen",
    multiplier: 2.4,
  },
];

const APPLIANCES_OPTIONS: AppliancesOption[] = [
  {
    slug: "einsteiger",
    label: "Einstieg",
    description: "Markenlos / Baumarkt — Standard-Kochfeld, Backofen",
    addMin: 0,
    addMax: 1_200,
  },
  {
    slug: "mittelklasse",
    label: "Mittelklasse",
    description: "Bosch, Siemens, AEG — gute Allrounder",
    addMin: 1_500,
    addMax: 4_500,
  },
  {
    slug: "premium",
    label: "Premium",
    description: "Miele, Neff, Liebherr — Komfort & Langlebigkeit",
    addMin: 4_000,
    addMax: 10_000,
  },
  {
    slug: "luxus",
    label: "Luxus",
    description: "Gaggenau, V-Zug, Wolf — Profiküchen-Niveau",
    addMin: 10_000,
    addMax: 25_000,
  },
];

const REGION_OPTIONS: RegionOption[] = [
  {
    slug: "laendlich",
    label: "Ländlich",
    description: "Dorf / Kleinstadt — günstiger als Stadt",
    factor: 0.92,
  },
  {
    slug: "standard",
    label: "Mittlere Stadt",
    description: "Stadt bis ~500 k Einwohner — bundesweiter Durchschnitt",
    factor: 1.0,
  },
  {
    slug: "metropole",
    label: "Metropolregion",
    description: "München, Hamburg, Berlin, Frankfurt, Stuttgart",
    factor: 1.12,
  },
];

const STEPS = [
  {
    title: "Wie groß ist Ihre Küche?",
    subtitle: "Ungefähre Raumgröße in Quadratmetern",
  },
  {
    title: "Welches Ausstattungsniveau?",
    subtitle: "Fronten, Arbeitsplatte, Griffe, Beleuchtung",
  },
  {
    title: "Welche Küchengeräte?",
    subtitle: "Kochfeld, Backofen, Kühlschrank, Spülmaschine",
  },
  {
    title: "Wo befindet sich Ihre Küche?",
    subtitle: "Regionale Preisunterschiede fließen ein",
  },
] as const;

type Selection = {
  size: SizeSlug | null;
  equipment: EquipmentSlug | null;
  appliances: AppliancesSlug | null;
  region: RegionSlug | null;
};

function computePriceRange(sel: Selection): { low: number; high: number } | null {
  if (!sel.size || !sel.equipment || !sel.appliances || !sel.region) return null;

  const size = SIZE_OPTIONS.find((s) => s.slug === sel.size)!;
  const equipment = EQUIPMENT_OPTIONS.find((e) => e.slug === sel.equipment)!;
  const appliances = APPLIANCES_OPTIONS.find((a) => a.slug === sel.appliances)!;
  const region = REGION_OPTIONS.find((r) => r.slug === sel.region)!;

  const lowBase = size.baseMin * equipment.multiplier + appliances.addMin;
  const highBase = size.baseMax * equipment.multiplier + appliances.addMax;

  return {
    low: Math.round((lowBase * region.factor) / 500) * 500,
    high: Math.round((highBase * region.factor) / 500) * 500,
  };
}

function formatEur(n: number): string {
  return n.toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €";
}

const Kuechenrechner = () => {
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState<Selection>({
    size: null,
    equipment: null,
    appliances: null,
    region: null,
  });

  const showResult = step === STEPS.length;
  const result = useMemo(() => computePriceRange(sel), [sel]);

  const schemas = [
    generateServiceSchema(
      "KüchenRechner — Preis-Check für neue Küchen",
      `Kostenloser ${BRAND.name}-KüchenRechner: Realistische Preisspanne für eine neue Küche anhand Größe, Ausstattung, Geräte-Level und Region. In 30 Sekunden, ohne Kontaktdaten.`,
    ),
    generateBreadcrumbSchema(getBreadcrumbsFromPath("/kuechenrechner")),
  ];

  function choose<K extends keyof Selection>(key: K, val: Selection[K]) {
    setSel((prev) => ({ ...prev, [key]: val }));
    // Auto-advance nach kurzem Delay (wie in Funnel A).
    setTimeout(() => setStep((s) => Math.min(STEPS.length, s + 1)), 250);
  }

  function reset() {
    setSel({ size: null, equipment: null, appliances: null, region: null });
    setStep(0);
  }

  return (
    <PageLayout
      breadcrumbs
      title={`KüchenRechner — Was kostet meine Traumküche? | ${BRAND.name}`}
      description="Kostenloser KüchenRechner: Beantworten Sie 4 Fragen zu Größe, Ausstattung, Geräten und Region — wir zeigen Ihnen in 30 Sekunden eine realistische Preisspanne für Ihre neue Küche. Ohne Kontaktdaten."
      keywords="küchenrechner, küchen preis, küche kosten, was kostet küche, küchen budget, preisvergleich küche, küchenplaner preis"
      canonicalPath="/kuechenrechner"
      structuredData={schemas}
    >
      <PageHero
        badge={
          <>
            <Calculator className="w-4 h-4 mr-2 text-primary" />
            <span>KüchenRechner · kostenlos · ohne Kontaktdaten</span>
          </>
        }
        title="Was kostet meine neue Küche?"
        subtitle="4 Fragen, 30 Sekunden, realistische Preisspanne — ohne dass Sie Ihre Daten hinterlassen müssen."
      />

      <section className="py-10 md:py-16">
        <div className="container max-w-4xl px-4 sm:px-6 lg:px-8">
          {/* Progress */}
          {!showResult && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2 text-sm text-muted-foreground">
                <span>
                  Schritt {step + 1} von {STEPS.length}
                </span>
                <span>{Math.round(((step + 1) / STEPS.length) * 100)} %</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {!showResult && (
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-xl md:text-2xl">
                  {STEPS[step].title}
                </CardTitle>
                <p className="text-muted-foreground">{STEPS[step].subtitle}</p>
              </CardHeader>
              <CardContent>
                {step === 0 && (
                  <OptionGrid
                    icon={<Gauge className="h-6 w-6" />}
                    options={SIZE_OPTIONS.map((o) => ({
                      slug: o.slug,
                      label: o.label,
                      description: o.description,
                    }))}
                    value={sel.size}
                    onChange={(v) => choose("size", v as SizeSlug)}
                  />
                )}
                {step === 1 && (
                  <OptionGrid
                    icon={<Layers className="h-6 w-6" />}
                    options={EQUIPMENT_OPTIONS.map((o) => ({
                      slug: o.slug,
                      label: o.label,
                      description: o.description,
                    }))}
                    value={sel.equipment}
                    onChange={(v) => choose("equipment", v as EquipmentSlug)}
                  />
                )}
                {step === 2 && (
                  <OptionGrid
                    icon={<Refrigerator className="h-6 w-6" />}
                    options={APPLIANCES_OPTIONS.map((o) => ({
                      slug: o.slug,
                      label: o.label,
                      description: o.description,
                    }))}
                    value={sel.appliances}
                    onChange={(v) => choose("appliances", v as AppliancesSlug)}
                  />
                )}
                {step === 3 && (
                  <OptionGrid
                    icon={<MapPin className="h-6 w-6" />}
                    options={REGION_OPTIONS.map((o) => ({
                      slug: o.slug,
                      label: o.label,
                      description: o.description,
                    }))}
                    value={sel.region}
                    onChange={(v) => choose("region", v as RegionSlug)}
                  />
                )}

                {step > 0 && (
                  <div className="mt-6 flex justify-start">
                    <Button
                      variant="ghost"
                      onClick={() => setStep((s) => Math.max(0, s - 1))}
                      className="gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Zurück
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {showResult && result && (
            <Card className="border-2 border-primary/30 shadow-xl">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl md:text-3xl">
                  Ihre realistische Preisspanne
                </CardTitle>
                <p className="text-muted-foreground mt-2 max-w-xl mx-auto">
                  Basierend auf Ihren Angaben und aktuellen Marktdaten aus unserem
                  Küchenstudio-Netzwerk (Stand 2026).
                </p>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl bg-gradient-to-br from-primary/5 via-transparent to-primary/10 border border-primary/20 p-8 sm:p-10 text-center mb-6">
                  <div className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">
                    {formatEur(result.low)} – {formatEur(result.high)}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Brutto inkl. MwSt., typische Preise für eine komplette Küche
                    mit Planung, Lieferung und Montage.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 mb-6 text-sm">
                  <SummaryRow
                    label="Größe"
                    value={SIZE_OPTIONS.find((s) => s.slug === sel.size)?.label ?? ""}
                  />
                  <SummaryRow
                    label="Ausstattung"
                    value={
                      EQUIPMENT_OPTIONS.find((e) => e.slug === sel.equipment)?.label ?? ""
                    }
                  />
                  <SummaryRow
                    label="Geräte"
                    value={
                      APPLIANCES_OPTIONS.find((a) => a.slug === sel.appliances)?.label ?? ""
                    }
                  />
                  <SummaryRow
                    label="Region"
                    value={REGION_OPTIONS.find((r) => r.slug === sel.region)?.label ?? ""}
                  />
                </div>

                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mb-6 text-sm text-amber-900">
                  <strong>Hinweis:</strong> Preisspannen sind Richtwerte. Der finale
                  Preis hängt von Grundriss, Sonderwünschen und Konditionen Ihres
                  Küchenstudios ab. Nutzen Sie unsere Funnel A/B, um konkrete
                  Angebote einzuholen oder Studio-Preise zu unterbieten.
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Link to="/funnel/a">
                    <Button size="lg" className="gradient-hero w-full h-14 font-semibold group">
                      Konkrete Angebote erhalten
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-smooth" />
                    </Button>
                  </Link>
                  <Link to="/funnel/b">
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full h-14 font-semibold border-2"
                    >
                      <Gavel className="mr-2 h-4 w-4" />
                      Vorhandenes Angebot unterbieten
                    </Button>
                  </Link>
                </div>

                <div className="mt-6 text-center">
                  <Button variant="ghost" onClick={reset} className="text-sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Neu berechnen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trust-Block unter dem Rechner */}
          <div className="mt-10 grid sm:grid-cols-3 gap-4 text-sm">
            {[
              "Keine Kontaktdaten nötig",
              "Basierend auf echten Marktdaten",
              "In 30 Sekunden fertig",
            ].map((t) => (
              <div
                key={t}
                className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3"
              >
                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-foreground">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

/* ---------------------------------------------------------------- */

interface OptionItem {
  slug: string;
  label: string;
  description: string;
}

function OptionGrid({
  icon,
  options,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  options: OptionItem[];
  value: string | null;
  onChange: (slug: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((o) => {
        const active = value === o.slug;
        return (
          <button
            key={o.slug}
            type="button"
            onClick={() => onChange(o.slug)}
            aria-pressed={active}
            className={clsx(
              "group flex items-start gap-4 rounded-2xl border-2 p-4 sm:p-5 text-left transition-all",
              active
                ? "border-primary bg-primary/5 shadow-lg ring-4 ring-primary/15"
                : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
            )}
          >
            <div
              className={clsx(
                "grid h-12 w-12 flex-none place-items-center rounded-full transition",
                active
                  ? "bg-primary text-white"
                  : "bg-primary/10 text-primary group-hover:bg-primary/20",
              )}
            >
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground">{o.label}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{o.description}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export default Kuechenrechner;
