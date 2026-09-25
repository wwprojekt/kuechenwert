/**
 * kw-market-worker — verarbeitet die Marktplatz-Outbox (public.kw_outbox).
 *
 * Aufruf: pg_cron jede Minute (nur wenn Events offen sind) mit Header
 * x-kw-cron-secret, alternativ manuell mit Service-Role-Bearer.
 *
 * Pro Event gilt: die primäre Aktion (meist die Kunden-/Studio-Mail) wirft bei
 * Fehlern und wird mit Backoff wiederholt; nachgelagerte Benachrichtigungen
 * laufen best-effort, damit Wiederholungen keine Doppelmails erzeugen.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import {
  escapeHtml,
  formatEuro,
  randomToken,
  serviceClient,
  sha256Hex,
  timingSafeEqual,
} from "../_shared/kw-http.ts";
import {
  buildEmailLayout,
  button,
  detailRow,
  divider,
  greeting,
  infoBox,
  list,
  paragraph,
  type Settings,
} from "../_shared/email-builder.ts";
import { BRAND } from "../_shared/brand-config.ts";
import { describeLeadSummary } from "../_shared/funnel-a-catalog.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const CRON_SECRET = Deno.env.get("KW_CRON_SECRET") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FROM = `${BRAND.name} <${BRAND.noReplyEmail}>`;
const TIME_BUDGET_MS = 45_000;

type OutboxRow = { id: number; event_type: string; payload: Record<string, unknown>; attempts: number };
type Lead = {
  id: string;
  funnel_type: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  postal_code: string;
  city: string | null;
  budget_midpoint: number | null;
  kitchen_form: string | null;
  timeframe_months: number | null;
};
type Dealer = {
  id: string;
  email: string | null;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  company_street: string | null;
  company_zip: string | null;
  company_city: string | null;
  phone: string | null;
  website: string | null;
};

const FUNNEL_LABEL: Record<string, string> = {
  a: "Angebote einholen",
  b: "Studio-Angebot unterbieten",
  traumkueche: "Traumküche (KI-Planer)",
};

class Ctx {
  constructor(
    readonly sb: SupabaseClient,
    readonly settings: Settings & { lead_forward_email?: string | null },
  ) {}

  async lead(id: string): Promise<Lead> {
    const { data, error } = await this.sb
      .from("leads")
      .select("id, funnel_type, first_name, last_name, email, phone, postal_code, city, budget_midpoint, kitchen_form, timeframe_months")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as Lead;
  }

  async dealer(id: string): Promise<Dealer> {
    const { data, error } = await this.sb
      .from("profiles")
      .select("id, email, company_name, first_name, last_name, company_street, company_zip, company_city, phone, website")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as Dealer;
  }

  async tender(id: string) {
    const { data, error } = await this.sb
      .from("lead_auctions")
      .select("id, lead_id, status, ends_at, decision_deadline_at, estimate_min_eur, estimate_max_eur, reference_price_eur, public_summary")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as {
      id: string;
      lead_id: string;
      status: string;
      ends_at: string | null;
      decision_deadline_at: string | null;
      estimate_min_eur: number | null;
      estimate_max_eur: number | null;
      reference_price_eur: number | null;
      public_summary: Record<string, unknown>;
    };
  }

  async projectLink(leadId: string): Promise<string> {
    const token = randomToken();
    const { error } = await this.sb.rpc("kw_project_issue_token", { p_lead_id: leadId, p_token_hash: await sha256Hex(token) });
    if (error) throw error;
    return `${BRAND.baseUrl}/projekt/${token}`;
  }

  layout(title: string, content: string): string {
    return buildEmailLayout(this.settings, title, content);
  }

  async send(opts: { to: string; subject: string; html: string; type: string; recipientId?: string | null; recipientName?: string | null }) {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY fehlt");
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [opts.to], subject: opts.subject, html: opts.html, reply_to: BRAND.supportEmail }),
    });
    const text = await resp.text();
    if (!resp.ok) throw new Error(`Resend ${resp.status}: ${text.slice(0, 300)}`);
    let resendId: string | null = null;
    try {
      resendId = JSON.parse(text)?.id ?? null;
    } catch {
      /* Antwort ohne JSON-Body */
    }
    const { error } = await this.sb.from("admin_emails").insert({
      sender_email: BRAND.noReplyEmail,
      sender_name: BRAND.name,
      recipient_email: opts.to,
      recipient_name: opts.recipientName ?? null,
      recipient_id: opts.recipientId ?? null,
      subject: opts.subject,
      body_html: opts.html,
      body_text: "",
      email_type: opts.type,
      direction: "outbound",
      status: "sent",
      resend_id: resendId,
      is_read: true,
    });
    if (error) console.warn("[kw-worker] admin_emails log failed", error.message);
  }

  async notifyDealer(dealerId: string, type: string, title: string, message: string, auctionId: string) {
    const { error } = await this.sb.from("dealer_notifications").insert({
      user_id: dealerId,
      type,
      title,
      message,
      link: `/dashboard/projekte/${auctionId}`,
      lead_auction_id: auctionId,
    });
    if (error) console.warn("[kw-worker] dealer notification failed", error.message);
  }

  adminAddress(): string {
    return this.settings.lead_forward_email || this.settings.contact_email || BRAND.supportEmail;
  }

  async bestEffort(label: string, fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (err) {
      console.warn(`[kw-worker] ${label} failed`, err);
    }
  }
}

const fullName = (l: { first_name: string | null; last_name: string | null }) =>
  [l.first_name, l.last_name].filter(Boolean).join(" ").trim();

const dealerName = (d: Dealer) => d.company_name?.trim() || fullName(d) || "Küchenstudio";

/** Anfrage (A) und Unterbieten (B) beschreibt der Funnel-Katalog, den Konfigurator summary.labels. */
const isFunnelSummary = (summary: Record<string, unknown>) =>
  (summary.source === "a" || summary.source === "b") && !summary.labels;

function summaryRows(summary: Record<string, unknown>, estimate: { min: number | null; max: number | null }) {
  const range = estimate.min && estimate.max ? `${formatEuro(estimate.min)} – ${formatEuro(estimate.max)}` : null;
  if (isFunnelSummary(summary)) {
    const rows = describeLeadSummary(summary).flatMap((group) =>
      group.rows.map((row) => detailRow(escapeHtml(row.label), escapeHtml(row.value))),
    );
    if (range) rows.push(detailRow("Preisschätzung", range));
    return rows.join("");
  }
  const labels = (summary.labels ?? {}) as Record<string, unknown>;
  const room = (summary.room ?? {}) as Record<string, unknown>;
  const rows: string[] = [];
  if (room.description) rows.push(detailRow("Raum", escapeHtml(String(room.description))));
  if (labels.quality) rows.push(detailRow("Qualität", escapeHtml(String(labels.quality))));
  if (labels.style) rows.push(detailRow("Stil", escapeHtml(String(labels.style))));
  if (labels.front) rows.push(detailRow("Fronten", escapeHtml(String(labels.front))));
  if (labels.worktop) rows.push(detailRow("Arbeitsplatte", escapeHtml(String(labels.worktop))));
  if (range) rows.push(detailRow("KI-Preisschätzung", range));
  return rows.join("");
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function onProjectCreated(ctx: Ctx, p: Record<string, unknown>) {
  const lead = await ctx.lead(String(p.lead_id));
  const { data: tender } = await ctx.sb
    .from("lead_auctions")
    .select("id, status, ends_at, estimate_min_eur, estimate_max_eur, public_summary")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lead.email) {
    const link = await ctx.projectLink(lead.id);
    const active = tender?.status === "active";
    const content = [
      greeting(lead.first_name ?? undefined),
      paragraph(
        active
          ? "Ihr Küchenprojekt ist online. Geprüfte Küchenstudios in Ihrer Region sehen jetzt Ihre Planung – ohne Ihre Kontaktdaten – und können Ihnen verbindliche Angebote machen."
          : "Vielen Dank für Ihre Anfrage. Unser Küchen-Team prüft Ihre Angaben und meldet sich kurzfristig bei Ihnen. Danach geben geprüfte Studios ihre Angebote ab.",
      ),
      tender ? infoBox("Ihr Projekt", summaryRows(tender.public_summary ?? {}, { min: tender.estimate_min_eur, max: tender.estimate_max_eur })) : "",
      button("Mein Projekt & Angebote ansehen", link),
      list([
        "Alle Angebote sehen Sie übersichtlich auf Ihrer Projektseite – mit Preis, Lieferzeit und Leistungsumfang.",
        "Sie entscheiden frei, welches Studio den Auftrag bekommt. Kein Kaufzwang.",
        "Ihre Kontaktdaten erhalten nur das von Ihnen gewählte Studio und höchstens drei geprüfte Studios, die Sie persönlich beraten möchten – Sie werden jeweils informiert.",
      ]),
      paragraph("Bitte bewahren Sie diese E-Mail auf – der Link ist Ihr persönlicher Zugang zum Projekt."),
    ].join("");
    await ctx.send({
      to: lead.email,
      subject: "Ihr Küchenprojekt ist angelegt – Ihr persönlicher Projektlink",
      html: ctx.layout("Ihr Küchenprojekt ist angelegt", content),
      type: "project_link",
      recipientName: fullName(lead),
    });
  }

  await ctx.bestEffort("admin mail", async () => {
    const value = tender?.estimate_min_eur
      ? `${formatEuro(tender.estimate_min_eur)} – ${formatEuro(tender.estimate_max_eur)}`
      : lead.budget_midpoint
        ? `Budget ~${formatEuro(lead.budget_midpoint)}`
        : "–";
    const content = [
      paragraph(`Neues Projekt über <strong>${escapeHtml(FUNNEL_LABEL[lead.funnel_type] ?? lead.funnel_type)}</strong>.`),
      infoBox(
        "Kontakt",
        [
          detailRow("Name", escapeHtml(fullName(lead) || "–")),
          detailRow("E-Mail", escapeHtml(lead.email ?? "–")),
          detailRow("Telefon", escapeHtml(lead.phone ?? "–")),
          detailRow("PLZ / Ort", escapeHtml(`${lead.postal_code} ${lead.city ?? ""}`)),
          detailRow("Wert", value),
          detailRow("Ausschreibung", escapeHtml(tender?.status ?? "keine")),
        ].join(""),
      ),
      button("Im Admin öffnen", `${BRAND.baseUrl}/admin/leads`),
    ].join("");
    await ctx.send({
      to: ctx.adminAddress(),
      subject: `Neues Küchenprojekt · PLZ ${lead.postal_code} · ${value}`,
      html: ctx.layout("Neues Küchenprojekt", content),
      type: "project_admin_new",
    });
  });
}

async function onProjectLink(ctx: Ctx, p: Record<string, unknown>) {
  const lead = await ctx.lead(String(p.lead_id));
  if (!lead.email) return;
  const link = await ctx.projectLink(lead.id);
  const content = [
    greeting(lead.first_name ?? undefined),
    paragraph("Sie haben einen neuen Zugang zu Ihrem Küchenprojekt angefordert. Über den folgenden Link sehen Sie Ihre Planung und alle Angebote."),
    button("Mein Projekt öffnen", link),
    paragraph("Falls Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren."),
  ].join("");
  await ctx.send({
    to: lead.email,
    subject: "Ihr Zugang zu Ihrem Küchenprojekt",
    html: ctx.layout("Ihr Projektlink", content),
    type: "project_link",
    recipientName: fullName(lead),
  });
}

async function onTenderPublished(ctx: Ctx, p: Record<string, unknown>) {
  const auctionId = String(p.auction_id);
  const tender = await ctx.tender(auctionId);
  const lead = await ctx.lead(tender.lead_id);
  const { data: recipients, error } = await ctx.sb.rpc("kw_tender_recipients", { p_auction_id: auctionId });
  if (error) throw error;
  const value =
    tender.estimate_min_eur && tender.estimate_max_eur
      ? `${formatEuro(tender.estimate_min_eur)} – ${formatEuro(tender.estimate_max_eur)}`
      : tender.reference_price_eur
        ? `ca. ${formatEuro(tender.reference_price_eur)}`
        : "auf Anfrage";
  const title = `Neues Küchenprojekt · PLZ ${lead.postal_code.slice(0, 3)}xx · ${value}`;

  for (const r of (recipients ?? []) as Array<{ dealer_id: string; email: string | null; company_name: string | null; distance_km: number | null; notify_email: boolean }>) {
    await ctx.notifyDealer(r.dealer_id, "project_new", title, "Jetzt ansehen und Angebot abgeben.", auctionId);
    if (!r.notify_email || !r.email) continue;
    await ctx.bestEffort(`dealer mail ${r.dealer_id}`, async () => {
      const content = [
        greeting(r.company_name ?? undefined),
        paragraph(
          `In Ihrem Einzugsgebiet${r.distance_km != null ? ` (ca. ${Math.round(r.distance_km)} km entfernt)` : ""} sucht ein Kunde ein Küchenstudio. Geben Sie ein Angebot ab oder schalten Sie den Kontakt direkt frei.`,
        ),
        infoBox("Projekt", summaryRows(tender.public_summary ?? {}, { min: tender.estimate_min_eur, max: tender.estimate_max_eur })),
        tender.ends_at ? paragraph(`Angebotsphase bis <strong>${new Date(tender.ends_at).toLocaleDateString("de-DE")}</strong>.`) : "",
        button("Projekt ansehen", `${BRAND.baseUrl}/dashboard/projekte/${auctionId}`),
      ].join("");
      await ctx.send({ to: r.email!, subject: title, html: ctx.layout("Neues Küchenprojekt in Ihrer Nähe", content), type: "project_new_dealer", recipientId: r.dealer_id });
    });
  }
}

async function onOfferPlaced(ctx: Ctx, p: Record<string, unknown>) {
  const auctionId = String(p.auction_id);
  const tender = await ctx.tender(auctionId);
  const placingDealer = String(p.dealer_id);

  if (p.is_update !== true) {
    const lead = await ctx.lead(tender.lead_id);
    const dealer = await ctx.dealer(placingDealer);
    if (lead.email) {
      const link = await ctx.projectLink(lead.id);
      const content = [
        greeting(lead.first_name ?? undefined),
        paragraph(`<strong>${escapeHtml(dealerName(dealer))}</strong>${dealer.company_city ? ` aus ${escapeHtml(dealer.company_city)}` : ""} hat Ihnen ein Angebot für Ihre Küche gemacht.`),
        infoBox("Angebot", [detailRow("Preis", formatEuro(Number(p.price_eur))), tender.estimate_min_eur ? detailRow(isFunnelSummary(tender.public_summary ?? {}) ? "Preisschätzung" : "KI-Schätzung", `${formatEuro(tender.estimate_min_eur)} – ${formatEuro(tender.estimate_max_eur)}`) : ""].join(""), "success"),
        button("Angebote vergleichen", link),
        paragraph("Sie müssen nicht sofort entscheiden – weitere Studios können noch bieten."),
      ].join("");
      await ctx.send({ to: lead.email, subject: `Neues Angebot für Ihre Küche: ${formatEuro(Number(p.price_eur))}`, html: ctx.layout("Neues Angebot eingegangen", content), type: "project_new_offer", recipientName: fullName(lead) });
    }
  }

  if (p.undercut_previous_lowest === true) {
    const { data: others } = await ctx.sb
      .from("lead_bids")
      .select("dealer_id")
      .eq("auction_id", auctionId)
      .eq("status", "active")
      .neq("dealer_id", placingDealer);
    for (const o of others ?? []) {
      await ctx.notifyDealer(o.dealer_id, "project_underbid", "Ihr Angebot wurde unterboten", `Neues niedrigstes Angebot: ${formatEuro(Number(p.price_eur))}.`, auctionId);
    }
  }
}

async function onContactUnlocked(ctx: Ctx, p: Record<string, unknown>) {
  const auctionId = String(p.auction_id);
  const lead = await ctx.lead(String(p.lead_id));
  const dealer = await ctx.dealer(String(p.dealer_id));
  await ctx.notifyDealer(dealer.id, "contact_unlocked", "Kontakt freigeschaltet", `Sie können ${fullName(lead) || "den Kunden"} jetzt kontaktieren.`, auctionId);
  if (!lead.email) return;
  const content = [
    greeting(lead.first_name ?? undefined),
    paragraph(`Das Küchenstudio <strong>${escapeHtml(dealerName(dealer))}</strong>${dealer.company_city ? ` aus ${escapeHtml(dealer.company_city)}` : ""} hat Ihre Kontaktdaten erhalten und meldet sich in Kürze persönlich bei Ihnen, um Ihre Küche zu besprechen.`),
    paragraph("Alle Angebote zu Ihrem Projekt sehen Sie weiterhin auf Ihrer Projektseite."),
    button("Mein Projekt öffnen", await ctx.projectLink(lead.id)),
  ].join("");
  await ctx.send({ to: lead.email, subject: `${dealerName(dealer)} meldet sich zu Ihrer Küche`, html: ctx.layout("Ein Küchenstudio meldet sich bei Ihnen", content), type: "project_contact_unlocked", recipientName: fullName(lead) });
}

async function onOfferAccepted(ctx: Ctx, p: Record<string, unknown>) {
  const auctionId = String(p.auction_id);
  const lead = await ctx.lead(String(p.lead_id));
  const dealer = await ctx.dealer(String(p.dealer_id));
  const { data: bid } = await ctx.sb.from("lead_bids").select("price_eur, delivery_weeks").eq("id", String(p.bid_id)).single();
  const price = formatEuro(Number(bid?.price_eur));

  if (dealer.email) {
    const content = [
      greeting(dealerName(dealer)),
      paragraph(`Glückwunsch! ${escapeHtml(fullName(lead) || "Der Kunde")} hat sich für Ihr Angebot über <strong>${price}</strong> entschieden. Bitte nehmen Sie zeitnah Kontakt auf, um Aufmaß und Beratungstermin zu vereinbaren.`),
      infoBox("Kundenkontakt", [
        detailRow("Name", escapeHtml(fullName(lead) || "–")),
        detailRow("Telefon", escapeHtml(lead.phone ?? "–")),
        detailRow("E-Mail", escapeHtml(lead.email ?? "–")),
        detailRow("PLZ / Ort", escapeHtml(`${lead.postal_code} ${lead.city ?? ""}`)),
      ].join(""), "success"),
      button("Projekt im Studio-Portal", `${BRAND.baseUrl}/dashboard/projekte/${auctionId}`),
      paragraph("Die Vermittlungsprovision stellen wir Ihnen gemäß unseren AGB separat in Rechnung."),
    ].join("");
    await ctx.send({ to: dealer.email, subject: `Zuschlag erhalten: Küchenprojekt ${lead.postal_code}`, html: ctx.layout("Sie haben den Zuschlag erhalten", content), type: "project_awarded_dealer", recipientId: dealer.id });
  }
  await ctx.notifyDealer(dealer.id, "project_awarded", "Zuschlag erhalten", `Der Kunde hat Ihr Angebot über ${price} angenommen.`, auctionId);

  await ctx.bestEffort("consumer confirmation", async () => {
    if (!lead.email) return;
    const address = [dealer.company_street, [dealer.company_zip, dealer.company_city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    const content = [
      greeting(lead.first_name ?? undefined),
      paragraph(`Sie haben das Angebot von <strong>${escapeHtml(dealerName(dealer))}</strong> über <strong>${price}</strong> angenommen. Das Studio hat Ihre Kontaktdaten erhalten und meldet sich für Aufmaß und Detailplanung.`),
      infoBox("Ihr Küchenstudio", [
        detailRow("Studio", escapeHtml(dealerName(dealer))),
        address ? detailRow("Adresse", escapeHtml(address)) : "",
        dealer.phone ? detailRow("Telefon", escapeHtml(dealer.phone)) : "",
        dealer.email ? detailRow("E-Mail", escapeHtml(dealer.email)) : "",
        dealer.website ? detailRow("Website", escapeHtml(dealer.website)) : "",
      ].join(""), "success"),
      paragraph("Tipp: Der endgültige Preis wird nach dem Aufmaß vor Ort bestätigt. Vergleichen Sie das finale Angebot mit dem Angebot auf Ihrer Projektseite."),
      button("Mein Projekt öffnen", await ctx.projectLink(lead.id)),
    ].join("");
    await ctx.send({ to: lead.email, subject: `Ihre Entscheidung: ${dealerName(dealer)}`, html: ctx.layout("Gute Wahl – so geht es weiter", content), type: "project_awarded_consumer", recipientName: fullName(lead) });
  });

  const { data: declined } = await ctx.sb.from("lead_bids").select("dealer_id").eq("auction_id", auctionId).eq("status", "declined");
  for (const d of declined ?? []) {
    await ctx.notifyDealer(d.dealer_id, "project_not_awarded", "Projekt vergeben", "Der Kunde hat sich für ein anderes Angebot entschieden.", auctionId);
    await ctx.bestEffort(`not-awarded mail ${d.dealer_id}`, async () => {
      const other = await ctx.dealer(d.dealer_id);
      if (!other.email) return;
      const content = [
        greeting(dealerName(other)),
        paragraph(`Der Kunde des Küchenprojekts ${escapeHtml(lead.postal_code.slice(0, 3))}xx hat sich für ein anderes Angebot entschieden. Vielen Dank für Ihr Angebot – neue Projekte in Ihrer Region finden Sie in der Projekt-Börse.`),
        button("Zur Projekt-Börse", `${BRAND.baseUrl}/dashboard/projekte`),
      ].join("");
      await ctx.send({ to: other.email, subject: "Projekt vergeben", html: ctx.layout("Projekt vergeben", content), type: "project_not_awarded_dealer", recipientId: other.id });
    });
  }

  await ctx.bestEffort("admin mail", () =>
    ctx.send({
      to: ctx.adminAddress(),
      subject: `Zuschlag: ${dealerName(dealer)} · ${price} · PLZ ${lead.postal_code}`,
      html: ctx.layout("Zuschlag erteilt", paragraph(`Provisions-Rechnungsentwurf wurde angelegt. Bitte prüfen und versenden.`) + button("Rechnungen", `${BRAND.baseUrl}/admin/financials`)),
      type: "project_admin_new",
    }),
  );
}

async function onTenderEnded(ctx: Ctx, p: Record<string, unknown>) {
  const auctionId = String(p.auction_id);
  const lead = await ctx.lead(String(p.lead_id));
  const { count } = await ctx.sb
    .from("lead_bids")
    .select("id", { count: "exact", head: true })
    .eq("auction_id", auctionId)
    .eq("status", "active");
  const offers = count ?? 0;

  if (lead.email) {
    const link = await ctx.projectLink(lead.id);
    const content =
      offers > 0
        ? [
            greeting(lead.first_name ?? undefined),
            paragraph(`Die Angebotsphase für Ihre Küche ist beendet. Sie haben <strong>${offers} ${offers === 1 ? "Angebot" : "Angebote"}</strong> erhalten.`),
            paragraph("Vergleichen Sie Preis, Lieferzeit und Leistungsumfang und wählen Sie das Studio, das am besten zu Ihnen passt."),
            button("Angebote vergleichen & wählen", link),
          ].join("")
        : [
            greeting(lead.first_name ?? undefined),
            paragraph("Die Angebotsphase für Ihre Küche ist beendet. Leider hat bisher kein Studio ein Angebot abgegeben. Unser Team meldet sich persönlich bei Ihnen und sucht passende Studios in Ihrer Region."),
            button("Mein Projekt öffnen", link),
          ].join("");
    await ctx.send({ to: lead.email, subject: offers > 0 ? "Ihre Küchen-Angebote sind da – jetzt vergleichen" : "Update zu Ihrem Küchenprojekt", html: ctx.layout(offers > 0 ? "Jetzt vergleichen und wählen" : "Update zu Ihrem Projekt", content), type: "project_tender_ended", recipientName: fullName(lead) });
  }

  const { data: bidders } = await ctx.sb.from("lead_bids").select("dealer_id").eq("auction_id", auctionId);
  for (const b of bidders ?? []) {
    await ctx.notifyDealer(b.dealer_id, "project_ended", "Angebotsphase beendet", "Der Kunde vergleicht jetzt die Angebote.", auctionId);
  }
  if (offers === 0) {
    await ctx.bestEffort("admin mail", () =>
      ctx.send({ to: ctx.adminAddress(), subject: `Ohne Angebot beendet · PLZ ${lead.postal_code}`, html: ctx.layout("Ausschreibung ohne Angebot", paragraph(`Bitte Kunde ${escapeHtml(fullName(lead))} (${escapeHtml(lead.phone ?? "")}) kontaktieren.`)), type: "project_admin_new" }),
    );
  }
}

async function onProjectCancelled(ctx: Ctx, p: Record<string, unknown>) {
  const auctionId = String(p.auction_id);
  const { data: bidders } = await ctx.sb.from("lead_bids").select("dealer_id").eq("auction_id", auctionId);
  for (const b of bidders ?? []) {
    await ctx.notifyDealer(b.dealer_id, "project_cancelled", "Projekt beendet", "Der Kunde hat das Projekt beendet.", auctionId);
  }
}

const HANDLERS: Record<string, (ctx: Ctx, payload: Record<string, unknown>) => Promise<void>> = {
  project_created: onProjectCreated,
  project_link: onProjectLink,
  tender_published: onTenderPublished,
  offer_placed: onOfferPlaced,
  contact_unlocked: onContactUnlocked,
  offer_accepted: onOfferAccepted,
  tender_ended: onTenderEnded,
  project_cancelled: onProjectCancelled,
};

function authorized(req: Request): boolean {
  const secret = req.headers.get("x-kw-cron-secret") ?? "";
  if (CRON_SECRET && secret && timingSafeEqual(secret, CRON_SECRET)) return true;
  const bearer = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return !!SERVICE_ROLE_KEY && !!bearer && timingSafeEqual(bearer, SERVICE_ROLE_KEY);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });

  const started = Date.now();
  const sb = serviceClient();
  const { data: settings } = await sb
    .from("site_settings")
    .select("site_name, site_description, contact_email, support_phone, lead_forward_email")
    .limit(1)
    .maybeSingle();
  const ctx = new Ctx(sb, {
    site_name: settings?.site_name ?? BRAND.name,
    site_description: settings?.site_description ?? BRAND.tagline,
    contact_email: settings?.contact_email ?? BRAND.supportEmail,
    support_phone: settings?.support_phone ?? "",
    lead_forward_email: settings?.lead_forward_email ?? null,
  });

  const results: Array<{ id: number; type: string; ok: boolean; error?: string }> = [];
  while (Date.now() - started < TIME_BUDGET_MS) {
    const { data: batch, error } = await sb.rpc("kw_outbox_claim", { p_limit: 10 });
    if (error) {
      console.error("[kw-worker] claim failed", error.message);
      break;
    }
    const rows = (batch ?? []) as OutboxRow[];
    if (rows.length === 0) break;
    for (const row of rows) {
      const handler = HANDLERS[row.event_type];
      try {
        if (!handler) throw new Error(`Unbekannter Event-Typ ${row.event_type}`);
        await handler(ctx, row.payload ?? {});
        await sb.rpc("kw_outbox_finish", { p_id: row.id, p_error: null });
        results.push({ id: row.id, type: row.event_type, ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[kw-worker] event ${row.id} (${row.event_type}) failed`, message);
        await sb.rpc("kw_outbox_finish", { p_id: row.id, p_error: message });
        results.push({ id: row.id, type: row.event_type, ok: false, error: message });
      }
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
