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
  greeting,
  infoBox,
  list,
  paragraph,
  type Settings,
} from "../_shared/email-builder.ts";
import { BRAND } from "../_shared/brand-config.ts";
import { describeLeadSummary } from "../_shared/funnel-a-catalog.ts";
import { describeLeadDetails, hasDetails } from "../_shared/lead-details.ts";
import { ISSUER_SETTINGS_COLUMNS, issuerProfile, missingIssuerFields } from "../_shared/issuer-profile.ts";

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
    readonly autoIssueInvoices = true,
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
      // Projektlinks sind Zugangsschlüssel und gehören nicht ins Mail-Protokoll.
      body_html: redactProjectLinks(opts.html),
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

function redactProjectLinks(html: string): string {
  return html.replace(/\/projekt\/[A-Za-z0-9_-]{16,}/g, "/projekt/[Zugangslink entfernt]");
}

async function studiosCovering(ctx: Ctx, postalCode: string): Promise<number | null> {
  const { data, error } = await ctx.sb.rpc("kw_studios_covering", { p_postal_code: postalCode });
  if (error) {
    console.warn("[kw-worker] coverage check failed", error.message);
    return null;
  }
  return typeof data === "number" ? data : null;
}

const dealerName = (d: Dealer) => d.company_name?.trim() || fullName(d) || "Küchenstudio";

/** Anfrage (A) und Unterbieten (B) beschreibt der Funnel-Katalog, den Konfigurator summary.labels. */
const isFunnelSummary = (summary: Record<string, unknown>) =>
  (summary.source === "a" || summary.source === "b") && !summary.labels;

const CHOICE_NOTE: Record<string, string> = { default: " (Standard)", partial: " (teils Standard)" };
const DIMENSIONS_NOTE: Record<string, string> = { example: " (Beispielmaße)", partial: " (teils Beispielmaße)" };

/** Studios sehen zusätzlich, welche Planer-Angaben Standardwerte statt Kundenwahl sind. */
function summaryRows(
  summary: Record<string, unknown>,
  estimate: { min: number | null; max: number | null },
  audience: "customer" | "studio" = "customer",
) {
  const range = estimate.min && estimate.max ? `${formatEuro(estimate.min)} – ${formatEuro(estimate.max)}` : null;
  const catalogRows = () =>
    describeLeadSummary(summary).flatMap((group) => group.rows.map((row) => detailRow(escapeHtml(row.label), escapeHtml(row.value))));
  if (isFunnelSummary(summary)) {
    const rows = catalogRows();
    if (range) rows.push(detailRow("Preisschätzung", range));
    return rows.join("");
  }
  const labels = (summary.labels ?? {}) as Record<string, unknown>;
  const room = (summary.room ?? {}) as Record<string, unknown>;
  const defaults = (audience === "studio" ? (summary.defaults ?? {}) : {}) as Record<string, unknown>;
  const labelRow = (key: string, title: string) =>
    labels[key] ? detailRow(title, escapeHtml(String(labels[key])) + (CHOICE_NOTE[String(defaults[key])] ?? "")) : "";
  const dimensions = audience === "studio" ? (DIMENSIONS_NOTE[String(room.dimensions_source)] ?? "") : "";
  const rows = [
    room.description ? detailRow("Raum", escapeHtml(String(room.description)) + dimensions) : "",
    labelRow("quality", "Qualität"),
    labelRow("style", "Stil"),
    labelRow("front", "Fronten"),
    labelRow("worktop", "Arbeitsplatte"),
    ...catalogRows(),
  ];
  if (range) rows.push(detailRow("KI-Preisschätzung", range));
  return rows.join("");
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/** Ergänzungen aus Experten-Check und Projektseite als Mail-Kästen; ohne Ergänzungen leer. */
async function detailsBoxes(ctx: Ctx, leadId: string, kitchenForm: string | null): Promise<string> {
  const { data, error } = await ctx.sb
    .from("kw_lead_details")
    .select("customer, customer_updated_at, expert, expert_updated_at")
    .eq("lead_id", leadId)
    .maybeSingle();
  if (error) throw error;
  return describeLeadDetails(data, kitchenForm)
    .map((group) => infoBox(escapeHtml(group.title), group.rows.map((row) => detailRow(escapeHtml(row.label), escapeHtml(row.value))).join("")))
    .join("");
}

const UPDATE_NOTICE: Record<string, string> = {
  customer: "Der Kunde hat Angaben zu Raum, Technik oder Beratung ergänzt.",
  expert: "KüchenWert hat Ergebnisse aus dem Experten-Check ergänzt.",
  files: "Neue Unterlagen des Kunden sind für Sie freigegeben.",
};
/** Mehrere Änderungen kurz hintereinander ergeben eine Nachricht je Studio und Projekt. */
const UPDATE_NOTICE_GAP_MS = 6 * 3600 * 1000;

/**
 * Ergänzte Angaben oder freigegebene Unterlagen (Trigger auf kw_lead_details
 * und lead_files): Studios mit Angebot oder gekauftem Kontakt erfahren es.
 * Andere Studios sehen den neuen Stand, sobald sie das Projekt öffnen.
 */
async function onProjectUpdated(ctx: Ctx, p: Record<string, unknown>) {
  const leadId = String(p.lead_id);
  const source = String(p.source);
  const notice = UPDATE_NOTICE[source] ?? UPDATE_NOTICE.customer!;
  if (source === "customer" || source === "expert") {
    const { data: details, error: detailsError } = await ctx.sb
      .from("kw_lead_details")
      .select("customer, expert")
      .eq("lead_id", leadId)
      .maybeSingle();
    if (detailsError) throw detailsError;
    // Gelöschte Angaben sind keine Ergänzung.
    if (!hasDetails(details?.[source] as object | null | undefined)) return;
  }
  const { data: tender, error } = await ctx.sb
    .from("lead_auctions")
    .select("id")
    .eq("lead_id", leadId)
    .in("status", ["active", "completed", "awarded"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!tender) return;

  const [bids, unlocks] = await Promise.all([
    ctx.sb.from("lead_bids").select("dealer_id").eq("auction_id", tender.id).in("status", ["active", "accepted"]),
    ctx.sb.from("lead_match_candidates").select("dealer_id").eq("lead_id", leadId).eq("is_purchased", true),
  ]);
  if (bids.error) throw bids.error;
  if (unlocks.error) throw unlocks.error;
  const dealerIds = [...new Set([...(bids.data ?? []), ...(unlocks.data ?? [])].map((row) => row.dealer_id as string))];
  if (dealerIds.length === 0) return;

  const lead = await ctx.lead(leadId);
  const region = `PLZ ${lead.postal_code.slice(0, 3)}xx`;
  const since = new Date(Date.now() - UPDATE_NOTICE_GAP_MS).toISOString();
  for (const dealerId of dealerIds) {
    const { data: recent } = await ctx.sb
      .from("dealer_notifications")
      .select("id")
      .eq("user_id", dealerId)
      .eq("lead_auction_id", tender.id)
      .eq("type", "project_updated")
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();
    if (recent) continue;
    await ctx.notifyDealer(dealerId, "project_updated", `Projekt ergänzt · ${region}`, notice, tender.id);
    await ctx.bestEffort(`dealer update mail ${dealerId}`, async () => {
      const dealer = await ctx.dealer(dealerId);
      if (!dealer.email) return;
      const content = [
        greeting(dealerName(dealer)),
        paragraph(`${escapeHtml(notice)} Es geht um Ihr Küchenprojekt aus ${escapeHtml(region)}.`),
        button("Projekt ansehen", `${BRAND.baseUrl}/dashboard/projekte/${tender.id}`),
      ].join("");
      await ctx.send({
        to: dealer.email,
        subject: `Projekt ergänzt · ${region}`,
        html: ctx.layout("Ein Projekt wurde ergänzt", content),
        type: "project_updated_dealer",
        recipientId: dealerId,
      });
    });
  }
}

/** Preisschätzung eines Funnel-C-Leads ohne Ausschreibung (aus dem Abschluss der Planung). */
async function plannerEstimate(ctx: Ctx, leadId: string): Promise<{ min: number; max: number } | null> {
  const { data } = await ctx.sb.from("leads").select("funnel_answers").eq("id", leadId).maybeSingle();
  const estimate = (data?.funnel_answers as { estimate?: { min?: unknown; max?: unknown } } | null)?.estimate;
  return typeof estimate?.min === "number" && typeof estimate?.max === "number" ? { min: estimate.min, max: estimate.max } : null;
}

/** Jüngste Weitergabe-Einwilligung ausdrücklich abgelehnt (Funnel C „Nein, nur Küche & Preis“ oder widerrufen). */
async function shareRefused(ctx: Ctx, leadId: string): Promise<boolean> {
  const { data } = await ctx.sb.rpc("kw_lead_share_consent", { p_lead_id: leadId });
  return data === false;
}

async function onProjectCreated(ctx: Ctx, p: Record<string, unknown>) {
  const lead = await ctx.lead(String(p.lead_id));
  const { data: tender } = await ctx.sb
    .from("lead_auctions")
    .select("id, status, ends_at, estimate_min_eur, estimate_max_eur, public_summary")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const covering = await studiosCovering(ctx, lead.postal_code);
  // Funnel C „Nein, nur Visualisierung“: Lead ohne Ausschreibung, Studios sehen nichts.
  // Ein „Ja“ ohne Ausschreibung (Anlegen gescheitert) ist keine Visualisierung, sondern ein Fall fürs Team.
  const visualOnly = !tender && lead.funnel_type === "traumkueche" && (await shareRefused(ctx, lead.id));

  if (lead.email && visualOnly) {
    const link = await ctx.projectLink(lead.id);
    const estimate = await plannerEstimate(ctx, lead.id);
    const content = [
      greeting(lead.first_name ?? undefined),
      paragraph(
        "Ihre Küchenplanung ist gespeichert. Auf Ihrer persönlichen Projektseite finden Sie Ihre KI-Visualisierung und die Preisschätzung – jederzeit wieder abrufbar.",
      ),
      estimate ? infoBox("Ihre Preisschätzung", detailRow("Marktpreis", `${formatEuro(estimate.min)} – ${formatEuro(estimate.max)}`)) : "",
      button("Meine Küche ansehen", link),
      paragraph(
        "Wissen Sie schon, was geprüfte Küchenstudios aus Ihrer Region für diese Küche verlangen? Auf Ihrer Projektseite holen Sie mit einem Klick kostenlose und unverbindliche Angebote ein – Ihre Kontaktdaten sehen die Studios erst, wenn Sie es möchten.",
      ),
      paragraph("Bitte bewahren Sie diese E-Mail auf – der Link ist Ihr persönlicher Zugang zu Ihrer Planung."),
    ].join("");
    await ctx.send({
      to: lead.email,
      subject: "Ihre Küchenvisualisierung & Preisschätzung",
      html: ctx.layout("Ihre Küche ist fertig geplant", content),
      type: "project_link",
      recipientName: fullName(lead),
    });
  } else if (lead.email) {
    const link = await ctx.projectLink(lead.id);
    const active = tender?.status === "active";
    const planned = lead.funnel_type === "traumkueche";
    const intro = !active
      ? "Vielen Dank für Ihre Anfrage. Unser Küchen-Team sieht sich Ihre Angaben an und gibt Ihr Projekt danach für die Küchenstudios frei. Bei Rückfragen melden wir uns."
      : covering === 0
        ? "Vielen Dank für Ihre Anfrage. Ihr Projekt ist angelegt. In Ihrer Region nimmt aktuell noch kein Partnerstudio teil – unser Team meldet sich deshalb persönlich bei Ihnen und sucht passende Studios."
        : "Ihr Küchenprojekt ist online. Küchenstudios in Ihrer Region sehen jetzt Ihre Planung – ohne Ihre Kontaktdaten – und können Ihnen kostenlose, unverbindliche Angebote machen.";
    const content = [
      greeting(lead.first_name ?? undefined),
      planned ? paragraph("Ihre Küche ist geplant: Visualisierung und Preisschätzung finden Sie jederzeit auf Ihrer Projektseite.") : "",
      paragraph(intro),
      tender ? infoBox("Ihr Projekt", summaryRows(tender.public_summary ?? {}, { min: tender.estimate_min_eur, max: tender.estimate_max_eur })) : "",
      button(planned ? "Meine Küche & Angebote ansehen" : "Mein Projekt & Angebote ansehen", link),
      list([
        "Alle Angebote sehen Sie übersichtlich auf Ihrer Projektseite – mit Preis, Lieferzeit und Leistungsumfang.",
        "Sie entscheiden frei, welches Studio den Auftrag bekommt. Kein Kaufzwang.",
        "Ihre Kontaktdaten mit Telefonnummer erhalten nur das von Ihnen gewählte Studio und höchstens drei Studios für Rückfragen zu Ihrem Angebot – Sie werden jeweils informiert. Anrufe können Sie auf Ihrer Projektseite ausschalten.",
      ]),
      paragraph("Bitte bewahren Sie diese E-Mail auf – der Link ist Ihr persönlicher Zugang zum Projekt."),
    ].join("");
    await ctx.send({
      to: lead.email,
      subject: planned ? "Ihre Küche ist geplant – Ihre Angebote folgen" : "Ihr Küchenprojekt ist angelegt – Ihr persönlicher Projektlink",
      html: ctx.layout(planned ? "Ihre Küche ist geplant" : "Ihr Küchenprojekt ist angelegt", content),
      type: "project_link",
      recipientName: fullName(lead),
    });
  }

  await ctx.bestEffort("admin mail", async () => {
    const planned = visualOnly ? await plannerEstimate(ctx, lead.id) : null;
    const value = tender?.estimate_min_eur
      ? `${formatEuro(tender.estimate_min_eur)} – ${formatEuro(tender.estimate_max_eur)}`
      : planned
        ? `${formatEuro(planned.min)} – ${formatEuro(planned.max)}`
        : lead.budget_midpoint
          ? `Budget ~${formatEuro(lead.budget_midpoint)}`
          : "–";
    const content = [
      paragraph(`Neues Projekt über <strong>${escapeHtml(FUNNEL_LABEL[lead.funnel_type] ?? lead.funnel_type)}</strong>.`),
      visualOnly
        ? paragraph(
            "<strong>Nur Visualisierung:</strong> Der Kunde hat (noch) keine Angebote angefordert. Ohne seine Einwilligung keine Ausschreibung anlegen; er kann Angebote jederzeit selbst auf seiner Projektseite anfordern.",
          )
        : "",
      infoBox(
        "Kontakt",
        [
          detailRow("Name", escapeHtml(fullName(lead) || "–")),
          detailRow("E-Mail", escapeHtml(lead.email ?? "–")),
          detailRow("Telefon", escapeHtml(lead.phone ?? "–")),
          detailRow("PLZ / Ort", escapeHtml(`${lead.postal_code} ${lead.city ?? ""}`)),
          detailRow("Wert", value),
          detailRow("Ausschreibung", escapeHtml(tender?.status ?? "keine")),
          detailRow("Studios im Umkreis", covering === null ? "unbekannt" : String(covering)),
        ].join(""),
      ),
      !tender && !visualOnly
        ? paragraph("<strong>Ausschreibung fehlt:</strong> Das automatische Anlegen hat nicht geklappt. Bitte im Admin unter Leads „Ausschreibung anlegen“.")
        : "",
      covering === 0 && !visualOnly
        ? paragraph("<strong>Kein aktives Studio deckt diese PLZ ab.</strong> Bitte den Kunden persönlich kontaktieren und Studios in der Region gewinnen oder das Projekt vermitteln.")
        : "",
      button("Im Admin öffnen", `${BRAND.baseUrl}/admin/leads`),
    ].join("");
    await ctx.send({
      to: ctx.adminAddress(),
      subject: `${visualOnly ? "Neuer Lead (nur Visualisierung)" : `${covering === 0 ? "⚠ Keine Studios · " : ""}Neues Küchenprojekt`} · PLZ ${lead.postal_code} · ${value}`,
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
  const additions = await detailsBoxes(ctx, lead.id, lead.kitchen_form);

  for (const r of (recipients ?? []) as Array<{ dealer_id: string; email: string | null; company_name: string | null; distance_km: number | null; notify_email: boolean }>) {
    await ctx.notifyDealer(r.dealer_id, "project_new", title, "Jetzt ansehen und Angebot abgeben.", auctionId);
    if (!r.notify_email || !r.email) continue;
    await ctx.bestEffort(`dealer mail ${r.dealer_id}`, async () => {
      const content = [
        greeting(r.company_name ?? undefined),
        paragraph(
          `In Ihrem Einzugsgebiet${r.distance_km != null ? ` (ca. ${Math.round(r.distance_km)} km entfernt)` : ""} sucht ein Kunde ein Küchenstudio. Geben Sie ein Angebot ab oder schalten Sie den Kontakt direkt frei.`,
        ),
        infoBox("Projekt", summaryRows(tender.public_summary ?? {}, { min: tender.estimate_min_eur, max: tender.estimate_max_eur }, "studio")),
        additions,
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
      paragraph(`Die Vermittlungsprovision stellen wir Ihnen gemäß unseren <a href="${BRAND.baseUrl}/konditionen">Konditionen für Küchenstudios</a> mit separater Rechnung in Rechnung. Kommt der Auftrag nachweislich nicht zustande, melden Sie das bitte im Studio-Portal.`),
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
      html: ctx.layout("Zuschlag erteilt", paragraph(`Die Provisionsrechnung wurde angelegt${ctx.autoIssueInvoices ? " und wird automatisch versendet" : " und wartet als Entwurf auf Ihre Prüfung"}.`) + button("Rechnungen", `${BRAND.baseUrl}/admin/financials`)),
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

async function callInternalFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`${name} ${resp.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text) as T;
}

/**
 * Rechnung ausstellen: Rechnungs- und Fälligkeitsdatum auf heute setzen, PDF
 * erzeugen und per E-Mail senden (send-invoice-email setzt status = sent).
 * Bei Fehlern wiederholt die Outbox; bereits versendete Rechnungen bleiben
 * unverändert. Fehlen Pflichtangaben des Ausstellers, bleibt die Rechnung
 * Entwurf und das Admin-Postfach erhält einen Hinweis.
 */
async function onInvoiceIssue(ctx: Ctx, p: Record<string, unknown>) {
  if (!ctx.autoIssueInvoices) return;
  const invoiceId = String(p.invoice_id);
  const { data: invoice, error } = await ctx.sb
    .from("invoices")
    .select("id, invoice_number, status, payment_terms_days, gross_amount")
    .eq("id", invoiceId)
    .maybeSingle();
  if (error) throw error;
  if (!invoice || invoice.status !== "draft") return;

  const { data: issuerSettings, error: settingsErr } = await ctx.sb
    .from("site_settings")
    .select(ISSUER_SETTINGS_COLUMNS)
    .limit(1)
    .maybeSingle();
  if (settingsErr) throw settingsErr;
  const missing = missingIssuerFields(issuerProfile(issuerSettings as Record<string, unknown> | null));
  if (missing.length > 0) {
    const amount = Number(invoice.gross_amount).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
    await ctx.send({
      to: ctx.adminAddress(),
      subject: `Rechnung ${invoice.invoice_number} nicht versendet: Angaben fehlen`,
      html: ctx.layout(
        "Rechnung wartet als Entwurf",
        paragraph(`Die Rechnung ${escapeHtml(invoice.invoice_number)} über ${amount} wurde nicht automatisch versendet, weil in den Rechnungseinstellungen ${escapeHtml(missing.join(" und "))} fehlt.`) +
          paragraph("Bitte die Angaben unter Einstellungen → Rechnungen ergänzen und die Rechnung danach unter Finanzen versenden.") +
          button("Einstellungen öffnen", `${BRAND.baseUrl}/admin/settings`),
      ),
      type: "invoice_issue_blocked",
    });
    return;
  }

  const invoiceDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
  const due = new Date(`${invoiceDate}T00:00:00Z`);
  due.setUTCDate(due.getUTCDate() + (invoice.payment_terms_days ?? 14));
  const { error: dateErr } = await ctx.sb
    .from("invoices")
    .update({ invoice_date: invoiceDate, due_date: due.toISOString().slice(0, 10) })
    .eq("id", invoiceId)
    .eq("status", "draft");
  if (dateErr) throw dateErr;

  const pdf = await callInternalFunction<{ pdfBase64?: string }>("generate-invoice-pdf", { invoiceId });
  await callInternalFunction("send-invoice-email", { invoiceId, pdfBase64: pdf.pdfBase64 });
}

async function onProjectCancelled(ctx: Ctx, p: Record<string, unknown>) {
  const auctionId = String(p.auction_id);
  const message = p.by === "admin" ? `${BRAND.name} hat die Ausschreibung beendet.` : "Der Kunde hat das Projekt beendet.";
  const { data: bidders } = await ctx.sb.from("lead_bids").select("dealer_id").eq("auction_id", auctionId);
  for (const b of bidders ?? []) {
    await ctx.notifyDealer(b.dealer_id, "project_cancelled", "Projekt beendet", message, auctionId);
  }
}

const COMPLAINT_REASONS: Record<string, string> = {
  nicht_erreichbar: "Kunde nicht erreichbar",
  falsche_kontaktdaten: "Kontaktdaten falsch",
  kein_kuechenprojekt: "Kein echtes Küchenprojekt",
  doppelt: "Kontakt doppelt gekauft",
  sonstiges: "Sonstiges",
};

type Complaint = {
  id: string;
  auction_id: string;
  lead_id: string;
  dealer_id: string;
  reason: string;
  note: string | null;
  status: "offen" | "anerkannt" | "abgelehnt";
  decision_note: string | null;
};

async function loadComplaint(ctx: Ctx, id: string): Promise<Complaint> {
  const { data, error } = await ctx.sb
    .from("kw_contact_complaints")
    .select("id, auction_id, lead_id, dealer_id, reason, note, status, decision_note")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Complaint;
}

async function onComplaintFiled(ctx: Ctx, p: Record<string, unknown>) {
  const complaint = await loadComplaint(ctx, String(p.complaint_id));
  const dealer = await ctx.dealer(complaint.dealer_id);
  const lead = await ctx.lead(complaint.lead_id);
  const details =
    detailRow("Grund", escapeHtml(COMPLAINT_REASONS[complaint.reason] ?? complaint.reason)) +
    (complaint.note ? detailRow("Beschreibung", escapeHtml(complaint.note)) : "");
  await ctx.send({
    to: ctx.adminAddress(),
    subject: `Reklamation: ${dealerName(dealer)} · PLZ ${lead.postal_code}`,
    html: ctx.layout(
      "Neue Reklamation",
      paragraph(`${escapeHtml(dealerName(dealer))} reklamiert den gekauften Kontakt zum Küchenprojekt in PLZ ${escapeHtml(lead.postal_code)}.`) +
        infoBox("Reklamation", details, "warning") +
        paragraph("Bitte innerhalb von 5 Werktagen im Admin unter Anfragen → Ausschreibung entscheiden. Bei Anerkennung wird die Rechnung storniert.") +
        button("Anfragen öffnen", `${BRAND.baseUrl}/admin/leads`),
    ),
    type: "complaint_admin",
  });
  await ctx.bestEffort("complaint dealer notification", () =>
    ctx.notifyDealer(dealer.id, "complaint_filed", "Reklamation eingegangen", "Wir prüfen Ihre Reklamation und melden uns innerhalb von 5 Werktagen.", complaint.auction_id),
  );
}

async function onComplaintDecided(ctx: Ctx, p: Record<string, unknown>) {
  const complaint = await loadComplaint(ctx, String(p.complaint_id));
  if (complaint.status === "offen") return;
  const dealer = await ctx.dealer(complaint.dealer_id);
  const accepted = complaint.status === "anerkannt";
  if (dealer.email) {
    const content = [
      greeting(dealerName(dealer)),
      paragraph(
        accepted
          ? "wir haben Ihre Reklamation geprüft und erkennen sie an. Die Rechnung für diese Kontaktfreischaltung wird storniert; bereits gezahlte Beträge erstatten wir Ihnen."
          : "wir haben Ihre Reklamation geprüft, können sie aber leider nicht anerkennen.",
      ),
      complaint.decision_note ? infoBox(accepted ? "Hinweis" : "Begründung", paragraph(escapeHtml(complaint.decision_note))) : "",
      button("Projekt im Studio-Portal", `${BRAND.baseUrl}/dashboard/projekte/${complaint.auction_id}`),
    ].join("");
    await ctx.send({
      to: dealer.email,
      subject: accepted ? "Reklamation anerkannt" : "Ihre Reklamation wurde geprüft",
      html: ctx.layout(accepted ? "Reklamation anerkannt" : "Ihre Reklamation", content),
      type: "complaint_decided",
      recipientId: dealer.id,
    });
  }
  await ctx.bestEffort("complaint decision notification", () =>
    ctx.notifyDealer(
      dealer.id,
      "complaint_decided",
      accepted ? "Reklamation anerkannt" : "Reklamation abgelehnt",
      accepted ? "Die Rechnung für den Kontakt wird storniert." : "Die Begründung finden Sie in der E-Mail.",
      complaint.auction_id,
    ),
  );
}

async function onLeadFilesAdded(ctx: Ctx, p: Record<string, unknown>) {
  const lead = await ctx.lead(String(p.lead_id));
  const count = Math.max(1, Number(p.count) || 1);
  await ctx.send({
    to: ctx.adminAddress(),
    subject: `Unterlagen nachgereicht · PLZ ${lead.postal_code}`,
    html: ctx.layout(
      "Unterlagen nachgereicht",
      paragraph(
        `Zur Anfrage aus PLZ ${escapeHtml(lead.postal_code)} ${count === 1 ? "wurde eine Datei" : `wurden ${count} Dateien`} über den Projektlink hochgeladen.`,
      ) +
        paragraph(
          "Bitte im Admin unter Anfragen → Ausschreibung prüfen. Für Küchenstudios freigeben, sobald keine Namen oder Kontaktdaten mehr zu sehen sind – bei Bedarf als geschwärzte Fassung.",
        ) +
        button("Anfragen öffnen", `${BRAND.baseUrl}/admin/leads`),
    ),
    type: "lead_files_admin",
  });
}

const HANDLERS: Record<string, (ctx: Ctx, payload: Record<string, unknown>) => Promise<void>> = {
  lead_files_added: onLeadFilesAdded,
  project_updated: onProjectUpdated,
  project_created: onProjectCreated,
  project_link: onProjectLink,
  tender_published: onTenderPublished,
  offer_placed: onOfferPlaced,
  contact_unlocked: onContactUnlocked,
  offer_accepted: onOfferAccepted,
  tender_ended: onTenderEnded,
  project_cancelled: onProjectCancelled,
  invoice_issue: onInvoiceIssue,
  complaint_filed: onComplaintFiled,
  complaint_decided: onComplaintDecided,
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
  const { data: market } = await sb.from("kw_marketplace_settings").select("auto_issue_invoices").limit(1).maybeSingle();
  const ctx = new Ctx(
    sb,
    {
      site_name: settings?.site_name ?? BRAND.name,
      site_description: settings?.site_description ?? BRAND.tagline,
      contact_email: settings?.contact_email ?? BRAND.supportEmail,
      support_phone: settings?.support_phone ?? "",
      lead_forward_email: settings?.lead_forward_email ?? null,
    },
    market?.auto_issue_invoices !== false,
  );

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
