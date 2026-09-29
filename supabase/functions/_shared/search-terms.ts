/**
 * Wochenbericht der Google-Ads-Suchbegriffe (kw-google-ads action
 * "search-terms-report"): fasst search_term_view je Suchbegriff über alle
 * Anzeigengruppen zusammen und schlägt Ausschlüsse und Keywords vor. Nichts
 * wird automatisch übernommen: Änderungen laufen über google-ads-plan.ts.
 */

export interface SearchTermRow {
  term: string;
  /** search_term_view.status: ADDED (Keyword), EXCLUDED, ADDED_EXCLUDED oder NONE */
  status: string;
  campaign: string;
  impressions: number;
  clicks: number;
  costEur: number;
  conversions: number;
}

export interface TermSummary {
  term: string;
  campaigns: string[];
  /** ADDED, sobald der Begriff in einer Anzeigengruppe schon Keyword ist. */
  status: string;
  impressions: number;
  clicks: number;
  costEur: number;
  conversions: number;
}

export interface SearchTermReport {
  totals: { terms: number; impressions: number; clicks: number; costEur: number; conversions: number; cpaEur: number | null };
  top: TermSummary[];
  negativeCandidates: TermSummary[];
  keywordCandidates: TermSummary[];
}

/** Ohne Conversion ab so vielen Klicks oder Euro ein Ausschluss-Kandidat. */
export const NEGATIVE_MIN_CLICKS = 3;
export const NEGATIVE_MIN_COST_EUR = 10;
const TOP_LIMIT = 15;
const CANDIDATE_LIMIT = 20;

const STATUS_RANK: Record<string, number> = { NONE: 0, ADDED: 1, EXCLUDED: 2, ADDED_EXCLUDED: 3 };
const round2 = (n: number) => Math.round(n * 100) / 100;

export function analyzeSearchTerms(rows: SearchTermRow[]): SearchTermReport {
  const byTerm = new Map<string, TermSummary>();
  for (const r of rows) {
    const term = r.term.trim().toLowerCase();
    if (!term) continue;
    const s = byTerm.get(term) ?? { term, campaigns: [], status: "NONE", impressions: 0, clicks: 0, costEur: 0, conversions: 0 };
    if (!s.campaigns.includes(r.campaign)) s.campaigns.push(r.campaign);
    if ((STATUS_RANK[r.status] ?? 0) > (STATUS_RANK[s.status] ?? 0)) s.status = r.status;
    s.impressions += r.impressions;
    s.clicks += r.clicks;
    s.costEur += r.costEur;
    s.conversions += r.conversions;
    byTerm.set(term, s);
  }
  const terms = [...byTerm.values()].map((s) => ({ ...s, costEur: round2(s.costEur), conversions: round2(s.conversions) }));
  const byCost = (a: TermSummary, b: TermSummary) => b.costEur - a.costEur || b.clicks - a.clicks || a.term.localeCompare(b.term);

  const costEur = round2(terms.reduce((n, t) => n + t.costEur, 0));
  const conversions = round2(terms.reduce((n, t) => n + t.conversions, 0));
  return {
    totals: {
      terms: terms.length,
      impressions: terms.reduce((n, t) => n + t.impressions, 0),
      clicks: terms.reduce((n, t) => n + t.clicks, 0),
      costEur,
      conversions,
      cpaEur: conversions > 0 ? round2(costEur / conversions) : null,
    },
    top: terms.filter((t) => t.clicks > 0).sort(byCost).slice(0, TOP_LIMIT),
    negativeCandidates: terms
      .filter((t) => t.status === "NONE" && t.conversions === 0)
      .filter((t) => t.clicks >= NEGATIVE_MIN_CLICKS || t.costEur >= NEGATIVE_MIN_COST_EUR)
      .sort(byCost)
      .slice(0, CANDIDATE_LIMIT),
    keywordCandidates: terms
      .filter((t) => t.status === "NONE" && t.conversions > 0)
      .sort((a, b) => b.conversions - a.conversions || byCost(a, b))
      .slice(0, CANDIDATE_LIMIT),
  };
}
