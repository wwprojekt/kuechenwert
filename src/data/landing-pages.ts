import type { LandingPageConfig } from "./landing-page-types";
import { wohnmobilVerkaufen } from "./landing-page-wohnmobil-verkaufen";
import { wohnwagenVerkaufen } from "./landing-page-wohnwagen-verkaufen";
import { wohnmobilWert } from "./landing-page-wohnmobil-wert";
import { wohnmobilWertermittlungKostenlos } from "./landing-page-wertermittlung-kostenlos";
import { wirKaufenDeinWohnmobil } from "./landing-page-wir-kaufen";
import { wievielWohnmobilWert } from "./landing-page-wieviel-wert";
import { schwackeListeWohnmobil } from "./landing-page-schwacke-liste";
import { wohnmobilVerkaufspreis } from "./landing-page-verkaufspreis";
import { wannWohnmobilVerkaufen } from "./landing-page-wann-verkaufen";
import { wohnmobilpreise2026 } from "./landing-page-preise-2026";
import { wohnmobilAnkaufRatgeber } from "./landing-page-ankauf-ratgeber";
import { finanziertesWohnmobilVerkaufen } from "./landing-page-finanziertes";
import { wohnwagenVerkaufspreis } from "./landing-page-wohnwagen-verkaufspreis";
import { wannWohnwagenVerkaufen } from "./landing-page-wann-wohnwagen-verkaufen";
import { wohnwagenpreise2026 } from "./landing-page-wohnwagenpreise-2026";
import { finanziertenWohnwagenVerkaufen } from "./landing-page-finanzierten-wohnwagen";

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
  "wohnmobil-verkaufspreis": wohnmobilVerkaufspreis,
  "wann-wohnmobil-verkaufen": wannWohnmobilVerkaufen,
  "wohnmobilpreise-2026": wohnmobilpreise2026,
  "wohnmobil-ankauf-ratgeber": wohnmobilAnkaufRatgeber,
  "finanziertes-wohnmobil-verkaufen": finanziertesWohnmobilVerkaufen,
  "wohnwagen-verkaufspreis": wohnwagenVerkaufspreis,
  "wann-wohnwagen-verkaufen": wannWohnwagenVerkaufen,
  "wohnwagenpreise-2026": wohnwagenpreise2026,
  "finanzierten-wohnwagen-verkaufen": finanziertenWohnwagenVerkaufen,
};

export {
  wohnmobilVerkaufen,
  wohnwagenVerkaufen,
  wohnmobilWert,
  wohnmobilWertermittlungKostenlos,
  wirKaufenDeinWohnmobil,
  wievielWohnmobilWert,
  schwackeListeWohnmobil,
  wohnmobilVerkaufspreis,
  wannWohnmobilVerkaufen,
  wohnmobilpreise2026,
  wohnmobilAnkaufRatgeber,
  finanziertesWohnmobilVerkaufen,
  wohnwagenVerkaufspreis,
  wannWohnwagenVerkaufen,
  wohnwagenpreise2026,
  finanziertenWohnwagenVerkaufen,
};
