/**
 * Keyword-Recherche über den Keyword-Planer, nur lesend (Deutschland,
 * Deutsch, Google-Suche):
 *   keyword-ideas   { seeds: string[], url?: string, limit?: number }
 *   keyword-metrics { keywords: string[] }
 * Zeilen: Keyword, Ø-Suchanfragen/Monat, Wettbewerb, Top-of-Page-Gebot
 * niedrig/hoch in Euro.
 */

import { BRAND } from "../_shared/brand-config.ts";
import type { GoogleAdsClient } from "../_shared/google-ads.ts";
import { HttpError } from "../_shared/kw-http.ts";

export const GEO_GERMANY = "geoTargetConstants/2276";
export const LANGUAGE_GERMAN = "languageConstants/1001";

/** keywordSeed akzeptiert höchstens 20 Seeds. */
const MAX_SEEDS = 20;
const MAX_KEYWORDS = 1000;
const MAX_IDEAS = 2000;

interface KeywordMetrics {
  avgMonthlySearches?: string;
  competition?: string;
  lowTopOfPageBidMicros?: string;
  highTopOfPageBidMicros?: string;
}

export interface KeywordRow {
  text: string;
  searches: number;
  competition: string;
  lowBid: number | null;
  highBid: number | null;
}

const euro = (micros?: string) => (micros ? Math.round(Number(micros) / 10_000) / 100 : null);

function toRow(text: string, m: KeywordMetrics | undefined): KeywordRow {
  return {
    text,
    searches: Number(m?.avgMonthlySearches ?? 0),
    competition: m?.competition ?? "UNSPECIFIED",
    lowBid: euro(m?.lowTopOfPageBidMicros),
    highBid: euro(m?.highTopOfPageBidMicros),
  };
}

function keywordList(value: unknown, max: number, field: string): string[] {
  if (!Array.isArray(value)) throw new HttpError(400, `${field} muss eine Liste sein.`, "invalid_input");
  const list = [
    ...new Set(
      value
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (list.length === 0 || list.length > max) throw new HttpError(400, `${field}: 1 bis ${max} Einträge.`, "invalid_input");
  return list;
}

export async function keywordIdeas(client: GoogleAdsClient, body: Record<string, unknown>) {
  const seeds = keywordList(body.seeds, MAX_SEEDS, "seeds");
  const limit = Math.min(MAX_IDEAS, Math.max(1, Number(body.limit ?? 500) || 500));
  const url = typeof body.url === "string" && body.url.startsWith(`${BRAND.baseUrl}/`) ? body.url : undefined;
  const data = await client.callCustomer("generateKeywordIdeas", {
    language: LANGUAGE_GERMAN,
    geoTargetConstants: [GEO_GERMANY],
    keywordPlanNetwork: "GOOGLE_SEARCH",
    includeAdultKeywords: false,
    pageSize: limit,
    ...(url ? { keywordAndUrlSeed: { keywords: seeds, url } } : { keywordSeed: { keywords: seeds } }),
  });
  const results = (data.results ?? []) as Array<{ text?: string; keywordIdeaMetrics?: KeywordMetrics }>;
  const rows = results
    .map((r) => toRow(String(r.text ?? ""), r.keywordIdeaMetrics))
    .sort((a, b) => b.searches - a.searches)
    .slice(0, limit);
  return { ok: true, count: rows.length, rows };
}

export async function keywordMetrics(client: GoogleAdsClient, body: Record<string, unknown>) {
  const keywords = keywordList(body.keywords, MAX_KEYWORDS, "keywords");
  const data = await client.callCustomer("generateKeywordHistoricalMetrics", {
    keywords,
    language: LANGUAGE_GERMAN,
    geoTargetConstants: [GEO_GERMANY],
    keywordPlanNetwork: "GOOGLE_SEARCH",
  });
  const results = (data.results ?? []) as Array<{ text?: string; closeVariants?: string[]; keywordMetrics?: KeywordMetrics }>;
  return {
    ok: true,
    rows: results.map((r) => ({ ...toRow(String(r.text ?? ""), r.keywordMetrics), closeVariants: r.closeVariants ?? [] })),
  };
}
