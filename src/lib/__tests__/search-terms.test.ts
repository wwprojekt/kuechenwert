import { describe, expect, it } from "vitest";
import { analyzeSearchTerms, type SearchTermRow } from "../../../supabase/functions/_shared/search-terms.ts";

const row = (term: string, campaign: string, clicks: number, costEur: number, conversions = 0, status = "NONE"): SearchTermRow => ({
  term,
  status,
  campaign,
  impressions: clicks * 10,
  clicks,
  costEur,
  conversions,
});

describe("analyzeSearchTerms", () => {
  it("fasst einen Suchbegriff über Kampagnen und Anzeigengruppen zusammen", () => {
    const report = analyzeSearchTerms([
      row("Küche Kaufen ", "Küchenangebote", 2, 4.5),
      row("küche kaufen", "Küchenplaner", 1, 2.25, 1),
      row("küche kaufen", "Küchenangebote", 1, 1),
    ]);
    expect(report.totals).toEqual({ terms: 1, impressions: 40, clicks: 4, costEur: 7.75, conversions: 1, cpaEur: 7.75 });
    expect(report.top[0]).toMatchObject({ term: "küche kaufen", campaigns: ["Küchenangebote", "Küchenplaner"], clicks: 4 });
  });

  it("schlägt teure Begriffe ohne Conversion als Ausschluss vor, aber keine Keywords oder Ausgeschlossenes", () => {
    const report = analyzeSearchTerms([
      row("ikea küche gebraucht", "Küchenangebote", 3, 6),
      row("küchenmonteur gehalt", "Küchenkosten", 1, 12),
      row("küche selber bauen", "Küchenplaner", 2, 4),
      row("küchenangebote vergleichen", "Küchenangebote", 5, 15, 0, "ADDED"),
      row("küchen outlet", "Küchenangebote", 4, 9, 0, "EXCLUDED"),
    ]);
    expect(report.negativeCandidates.map((t) => t.term)).toEqual(["küchenmonteur gehalt", "ikea küche gebraucht"]);
  });

  it("schlägt konvertierende Begriffe, die noch kein Keyword sind, als Keyword vor", () => {
    const report = analyzeSearchTerms([
      row("küchenplaner mit preis online", "Küchenplaner", 4, 8, 2),
      row("küchenplaner online", "Küchenplaner", 9, 20, 3, "ADDED"),
      row("neue küche angebot", "Küchenangebote", 2, 5, 1),
    ]);
    expect(report.keywordCandidates.map((t) => t.term)).toEqual(["küchenplaner mit preis online", "neue küche angebot"]);
    expect(report.totals.cpaEur).toBe(5.5);
  });

  it("liefert ohne Daten leere Listen und keinen CPA", () => {
    expect(analyzeSearchTerms([])).toEqual({
      totals: { terms: 0, impressions: 0, clicks: 0, costEur: 0, conversions: 0, cpaEur: null },
      top: [],
      negativeCandidates: [],
      keywordCandidates: [],
    });
  });
});
