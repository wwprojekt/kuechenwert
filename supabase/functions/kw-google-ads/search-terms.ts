/**
 * Wochenbericht der Suchbegriffe per Mail:
 *   { action: "search-terms-report", dryRun?: true, force?: true }
 *
 * Cron kw-gads-search-terms-report (montags). Liest search_term_view der
 * letzten 7 Tage, fasst je Suchbegriff zusammen (_shared/search-terms.ts) und
 * schickt Vorschläge an die Betreiber-Adresse. Übernommen wird nichts
 * automatisch: Ausschlüsse und Keywords gehören in google-ads-plan.ts.
 * dryRun liefert nur den Bericht, force übergeht die Sperre gegen doppelte
 * Mails (20 Stunden).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { sendAdminEmail, sentRecently } from "../_shared/admin-mail.ts";
import { infoBox, list, paragraph } from "../_shared/email-builder.ts";
import type { GadsRow, GoogleAdsClient } from "../_shared/google-ads.ts";
import { escapeHtml } from "../_shared/kw-http.ts";
import {
  NEGATIVE_MIN_CLICKS,
  NEGATIVE_MIN_COST_EUR,
  analyzeSearchTerms,
  type SearchTermReport,
  type SearchTermRow,
  type TermSummary,
} from "../_shared/search-terms.ts";

const EMAIL_TYPE = "gads_search_terms_report";
/** Fängt doppelte Aufrufe desselben Laufs ab, ohne den nächsten Wochenbericht zu blockieren. */
const REPEAT_BLOCK_HOURS = 20;
const TOP_IN_MAIL = 10;

const QUERY = `SELECT search_term_view.search_term, search_term_view.status, campaign.name,
  metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
  FROM search_term_view WHERE segments.date DURING LAST_7_DAYS AND metrics.impressions > 0`;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown) => (typeof v === "string" ? v : "");

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
const num = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const shortCampaign = (name: string) => name.replace(/^Search \| /, "").replace(/ \| DE$/, "");

function toRow(r: GadsRow): SearchTermRow {
  const view = obj(r.searchTermView);
  const m = obj(r.metrics);
  return {
    term: str(view.searchTerm),
    status: str(view.status) || "NONE",
    campaign: str(obj(r.campaign).name),
    impressions: Number(m.impressions ?? 0),
    clicks: Number(m.clicks ?? 0),
    costEur: Number(m.costMicros ?? 0) / 1_000_000,
    conversions: Number(m.conversions ?? 0),
  };
}

const termLine = (t: TermSummary) =>
  `„${escapeHtml(t.term)}“ – ${t.clicks} Klicks, ${eur.format(t.costEur)}, ${num.format(t.conversions)} Conversions ` +
  `(${escapeHtml(t.campaigns.map(shortCampaign).join(", "))})`;

const section = (items: TermSummary[], empty: string) => (items.length ? list(items.map(termLine)) : paragraph(empty));

export function reportHtml(report: SearchTermReport): string {
  const t = report.totals;
  const summary =
    `Letzte 7 Tage: ${t.clicks} Klicks, ${eur.format(t.costEur)}, ${num.format(t.conversions)} Conversions` +
    `${t.cpaEur !== null ? ` (${eur.format(t.cpaEur)} pro Conversion)` : ""} aus ${t.terms} Suchbegriffen.`;
  return (
    paragraph(summary) +
    (t.clicks === 0 ? paragraph("Keine Klicks: Laufen die Kampagnen, und sind die Anzeigen freigegeben?") : "") +
    infoBox(
      "Mögliche Ausschlüsse",
      section(
        report.negativeCandidates,
        `Keine. Vorgeschlagen wird ein Suchbegriff ohne Conversion ab ${NEGATIVE_MIN_CLICKS} Klicks oder ${eur.format(NEGATIVE_MIN_COST_EUR)}.`,
      ),
      "warning",
    ) +
    infoBox("Mögliche neue Keywords", section(report.keywordCandidates, "Keine. Vorgeschlagen wird ein Suchbegriff mit Conversion, der noch kein Keyword ist."), "success") +
    infoBox("Teuerste Suchbegriffe", section(report.top.slice(0, TOP_IN_MAIL), "Keine Klicks."), "default") +
    paragraph(
      "Übernommen wird nichts automatisch. Ausschlüsse und Keywords gehören in supabase/functions/_shared/google-ads-plan.ts " +
        "(Test, Deploy, dann campaigns validate und apply).",
    )
  );
}

export async function runSearchTermsReport(client: GoogleAdsClient, sb: SupabaseClient, opts: { dryRun: boolean; force: boolean }) {
  const report = analyzeSearchTerms((await client.search(QUERY)).map(toRow));
  if (opts.dryRun) return { ok: true, dryRun: true, report };
  if (!opts.force && (await sentRecently(sb, EMAIL_TYPE, REPEAT_BLOCK_HOURS))) {
    return { ok: true, sent: false, reason: "Bericht wurde in den letzten 20 Stunden schon verschickt.", totals: report.totals };
  }
  await sendAdminEmail(sb, {
    emailType: EMAIL_TYPE,
    subject: (site) => `Google Ads: Suchbegriffe der Woche – ${site}`,
    title: "Suchbegriffe der Woche",
    contentHtml: reportHtml(report),
  });
  return {
    ok: true,
    sent: true,
    totals: report.totals,
    negativeCandidates: report.negativeCandidates.length,
    keywordCandidates: report.keywordCandidates.length,
  };
}
