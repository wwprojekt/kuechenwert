/**
 * Landing-Page-Registry.
 *
 * Zuvor lagen hier 16 Caravanwert-SEO-Landing-Pages (wohnmobil-verkaufen,
 * schwacke-liste, wertermittlung-kostenlos, etc.). Die sind beim KuechenWert-
 * Umbau alle entfernt worden, weil sie inhaltlich auf Wohnmobil-Verkauf
 * ausgerichtet waren und fuer KuechenWert voellig neu geschrieben werden
 * muessten (inklusive Marken-Keywords wie Nobilia, Haecker, SieMatic …).
 *
 * Registry bleibt bestehen, damit `LandingPageTemplate` + `landing-page-types`
 * weiterhin einen stabilen Anker haben; sobald Kuechen-Landing-Pages
 * geschrieben werden, werden sie hier registriert (z.B. "kueche-planen-nobilia",
 * "kueche-guenstig-kaufen-2026", "kueche-kosten-vergleich" …).
 */

import type { LandingPageConfig } from "./landing-page-types";

export type { LandingPageConfig, ContentSection } from "./landing-page-types";
export type { FAQItem } from "@/components/FAQSection";

export const landingPages: Record<string, LandingPageConfig> = {
  // Bewusst leer — keine aktiven Caravan-Landing-Pages mehr.
  // Beim Auffuellen mit Kuechen-Landing-Pages hier Einträge ergaenzen.
};
