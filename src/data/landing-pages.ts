import type { LandingPageConfig } from "./landing-page-types";
import { wohnmobilVerkaufen } from "./landing-page-wohnmobil-verkaufen";
import { wohnwagenVerkaufen } from "./landing-page-wohnwagen-verkaufen";
import { wohnmobilWert } from "./landing-page-wohnmobil-wert";
import { wohnmobilWertermittlungKostenlos } from "./landing-page-wertermittlung-kostenlos";
import { wirKaufenDeinWohnmobil } from "./landing-page-wir-kaufen";
import { wievielWohnmobilWert } from "./landing-page-wieviel-wert";
import { schwackeListeWohnmobil } from "./landing-page-schwacke-liste";

export type { LandingPageConfig, ContentSection } from "./landing-page-types";
export type { FAQItem } from "@/components/FAQSection";

export const landingPages: Record<string, LandingPageConfig> = {
  "wohnmobil-verkaufen": wohnmobilVerkaufen,
  "wohnwagen-verkaufen": wohnwagenVerkaufen,
  "was-ist-mein-wohnmobil-wert": wohnmobilWert,
  "wohnmobil-wertermittlung-kostenlos": wohnmobilWertermittlungKostenlos,
  "wir-kaufen-dein-wohnmobil": wirKaufenDeinWohnmobil,
  "wieviel-ist-mein-wohnmobil-wert": wievielWohnmobilWert,
  "schwacke-liste-wohnmobil": schwackeListeWohnmobil,
};

export {
  wohnmobilVerkaufen,
  wohnwagenVerkaufen,
  wohnmobilWert,
  wohnmobilWertermittlungKostenlos,
  wirKaufenDeinWohnmobil,
  wievielWohnmobilWert,
  schwackeListeWohnmobil,
};
