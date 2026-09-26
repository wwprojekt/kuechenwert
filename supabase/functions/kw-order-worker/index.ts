/**
 * kw-order-worker — verarbeitet den Outbox-Kanal 'order' (Auftragsverlauf nach
 * dem Zuschlag). Ereignisse entstehen in kw_dealer_order_update,
 * kw_project_order_confirm, kw_project_order_report und kw_order_tick.
 *
 * Aufruf: pg_cron jede Minute (nur wenn Order-Events offen sind) mit Header
 * x-kw-cron-secret, alternativ manuell mit Service-Role-Bearer.
 *
 * Die erste Mail eines Events wirft bei Fehlern (Retry mit Backoff), alle
 * weiteren laufen best-effort, damit Wiederholungen keine Doppelmails erzeugen.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { escapeHtml, formatEuro, randomToken, serviceClient, sha256Hex, timingSafeEqual } from "../_shared/kw-http.ts";
import { buildEmailLayout, button, detailRow, greeting, infoBox, paragraph, type Settings } from "../_shared/email-builder.ts";
import { BRAND } from "../_shared/brand-config.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const CRON_SECRET = Deno.env.get("KW_CRON_SECRET") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const FROM = `${BRAND.name} <${BRAND.noReplyEmail}>`;
const TIME_BUDGET_MS = 45_000;
/** Ab dieser Abweichung zwischen Angebot und Kaufvertrag prüft das Admin-Team die Provisionsrechnung. */
const CONTRACT_DEVIATION_ALERT = 0.1;

const CANCEL_REASON_LABEL: Record<string, string> = {
  customer_withdrew: "Kund:in hat sich anders entschieden",
  price_after_measurement: "Preis nach dem Aufmaß nicht passend",
  not_reachable: "Kund:in nicht erreichbar",
  studio_declined: "Studio kann den Auftrag nicht übernehmen",
  other: "Sonstiger Grund",
};

type OutboxRow = { id: number; event_type: string; payload: Record<string, unknown> };
type Order = {
  id: string;
  lead_id: string;
  auction_id: string;
  dealer_id: string;
  status: string;
  offer_price_eur: number;
  contract_value_eur: number | null;
  measurement_at: string | null;
  installation_at: string | null;
  cancel_reason: string | null;
  cancel_note: string | null;
  created_at: string;
};
type Person = { first_name: string | null; last_name: string | null; email: string | null; phone: string | null };
type Lead = Person & { postal_code: string; city: string | null };
type Dealer = Person & { id: string; company_name: string | null; company_city: string | null };

const fullName = (p: Person) => [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
const dealerName = (d: Dealer) => d.company_name?.trim() || fullName(d) || "Ihr Küchenstudio";

/** Termine in deutscher Zeit; Mitternacht gilt als reines Datum (Montagetag). */
function formatWhen(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  const time = d.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
  const day = d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  return time === "00:00" ? day : `${day}, ${time} Uhr`;
}

class Ctx {
  constructor(
    readonly sb: SupabaseClient,
    readonly settings: Settings & { lead_forward_email?: string | null },
  ) {}

  async order(id: string): Promise<Order> {
    const { data, error } = await this.sb
      .from("kw_orders")
      .select("id, lead_id, auction_id, dealer_id, status, offer_price_eur, contract_value_eur, measurement_at, installation_at, cancel_reason, cancel_note, created_at")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as Order;
  }

  async lead(id: string): Promise<Lead> {
    const { data, error } = await this.sb
      .from("leads")
      .select("first_name, last_name, email, phone, postal_code, city")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as Lead;
  }

  async dealer(id: string): Promise<Dealer> {
    const { data, error } = await this.sb
      .from("profiles")
      .select("id, first_name, last_name, email, phone, company_name, company_city")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as Dealer;
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

  adminAddress(): string {
    return this.settings.lead_forward_email || this.settings.contact_email || BRAND.supportEmail;
  }

  async send(opts: { to: string; subject: string; title: string; content: string; type: string; recipientId?: string | null; recipientName?: string | null }) {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY fehlt");
    const html = this.layout(opts.title, opts.content);
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [opts.to], subject: opts.subject, html, reply_to: BRAND.supportEmail }),
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
      body_html: html,
      body_text: "",
      email_type: opts.type,
      direction: "outbound",
      status: "sent",
      resend_id: resendId,
      is_read: true,
    });
    if (error) console.warn("[kw-order-worker] admin_emails log failed", error.message);
  }

  async notifyDealer(order: Order, type: "order_reminder" | "order_update", title: string, message: string) {
    const { error } = await this.sb.from("dealer_notifications").insert({
      user_id: order.dealer_id,
      type,
      title,
      message,
      link: `/dashboard/projekte/${order.auction_id}`,
      lead_auction_id: order.auction_id,
    });
    if (error) console.warn("[kw-order-worker] dealer notification failed", error.message);
  }

  async bestEffort(label: string, fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (err) {
      console.warn(`[kw-order-worker] ${label} failed`, err);
    }
  }
}

function contactRows(lead: Lead, dealer: Dealer): string {
  return [
    detailRow("Kund:in", escapeHtml(fullName(lead) || "–")),
    detailRow("Kontakt Kund:in", escapeHtml([lead.phone, lead.email].filter(Boolean).join(" · ") || "–")),
    detailRow("PLZ / Ort", escapeHtml(`${lead.postal_code} ${lead.city ?? ""}`)),
    detailRow("Studio", escapeHtml(dealerName(dealer))),
    detailRow("Kontakt Studio", escapeHtml([dealer.phone, dealer.email].filter(Boolean).join(" · ") || "–")),
  ].join("");
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function onMilestone(ctx: Ctx, p: Record<string, unknown>) {
  const order = await ctx.order(String(p.order_id));
  const step = String(p.step);
  const lead = await ctx.lead(order.lead_id);
  const dealer = await ctx.dealer(order.dealer_id);
  const studio = escapeHtml(dealerName(dealer));

  const mail: Record<string, { subject: string; title: string; text: string }> = {
    measurement: {
      subject: `Aufmaß-Termin für Ihre Küche: ${formatWhen(order.measurement_at)}`,
      title: "Ihr Aufmaß-Termin",
      text: `${studio} hat den Termin für das Aufmaß bei Ihnen eingetragen: <strong>${escapeHtml(formatWhen(order.measurement_at))}</strong>. Dabei werden die Maße vor Ort geprüft und die Planung verfeinert.`,
    },
    contract: {
      subject: "Ihr Kaufvertrag ist erfasst",
      title: "Kaufvertrag erfasst",
      text: `${studio} hat den Kaufvertrag für Ihre Küche erfasst${order.contract_value_eur ? ` – Auftragswert <strong>${formatEuro(order.contract_value_eur)}</strong>` : ""}. Als Nächstes stimmt das Studio mit Ihnen den Liefer- und Montagetermin ab.`,
    },
    installation: {
      subject: `Montagetermin für Ihre Küche: ${formatWhen(order.installation_at)}`,
      title: "Ihr Montagetermin",
      text: `${studio} hat den Montagetermin eingetragen: <strong>${escapeHtml(formatWhen(order.installation_at))}</strong>.`,
    },
    completed: {
      subject: "Ist Ihre Küche fertig? Bitte kurz bestätigen",
      title: "Montage abgeschlossen?",
      text: `${studio} hat die Montage Ihrer Küche als abgeschlossen gemeldet. Bitte bestätigen Sie auf Ihrer Projektseite, dass alles in Ordnung ist – oder melden Sie uns, falls noch etwas fehlt.`,
    },
  };
  const m = mail[step];
  if (!m) throw new Error(`Unbekannte Etappe ${step}`);

  if (lead.email) {
    const content = [
      greeting(lead.first_name ?? undefined),
      paragraph(m.text),
      button("Mein Projekt öffnen", await ctx.projectLink(order.lead_id)),
      paragraph("Fragen zum Termin klären Sie bitte direkt mit dem Studio. Bei Problemen sind wir für Sie da – antworten Sie einfach auf diese E-Mail."),
    ].join("");
    await ctx.send({ to: lead.email, subject: m.subject, title: m.title, content, type: "order_update_consumer", recipientName: fullName(lead) });
  }

  if (step === "contract" && order.contract_value_eur) {
    const deviation = (order.contract_value_eur - order.offer_price_eur) / order.offer_price_eur;
    if (Math.abs(deviation) > CONTRACT_DEVIATION_ALERT) {
      await ctx.bestEffort("admin deviation mail", () =>
        ctx.send({
          to: ctx.adminAddress(),
          subject: `Auftragswert weicht ab (${deviation > 0 ? "+" : ""}${Math.round(deviation * 100)} %) · ${dealerName(dealer)}`,
          title: "Auftragswert weicht vom Angebot ab",
          content: [
            paragraph("Beim Kaufvertrag weicht der Auftragswert deutlich vom angenommenen Angebot ab. Bitte die Provisionsrechnung prüfen."),
            infoBox("Auftrag", [
              detailRow("Angenommenes Angebot", formatEuro(order.offer_price_eur)),
              detailRow("Kaufvertrag", formatEuro(order.contract_value_eur)),
              contactRows(lead, dealer),
            ].join(""), "warning"),
            button("Rechnungen", `${BRAND.baseUrl}/admin/financials`),
          ].join(""),
          type: "order_admin",
        }),
      );
    }
  }
}

async function onCancelled(ctx: Ctx, p: Record<string, unknown>) {
  const order = await ctx.order(String(p.order_id));
  const lead = await ctx.lead(order.lead_id);
  const dealer = await ctx.dealer(order.dealer_id);
  const reason = CANCEL_REASON_LABEL[order.cancel_reason ?? ""] ?? "ohne Angabe";

  await ctx.send({
    to: ctx.adminAddress(),
    subject: `Auftrag nicht zustande gekommen · ${dealerName(dealer)} · PLZ ${lead.postal_code}`,
    title: "Auftrag nicht zustande gekommen",
    content: [
      paragraph("Das Studio hat gemeldet, dass der Auftrag nicht zustande kommt. Bitte Kund:in kontaktieren und die Provisionsrechnung gemäß AGB prüfen."),
      infoBox("Meldung", [
        detailRow("Grund", escapeHtml(reason)),
        order.cancel_note ? detailRow("Notiz des Studios", escapeHtml(order.cancel_note)) : "",
        detailRow("Angebot", formatEuro(order.offer_price_eur)),
        contactRows(lead, dealer),
      ].join(""), "warning"),
      button("Rechnungen", `${BRAND.baseUrl}/admin/financials`),
    ].join(""),
    type: "order_admin",
  });

  await ctx.bestEffort("consumer cancel mail", async () => {
    if (!lead.email) return;
    const content = [
      greeting(lead.first_name ?? undefined),
      paragraph(`${escapeHtml(dealerName(dealer))} hat uns mitgeteilt, dass der Auftrag für Ihre Küche nicht zustande kommt.`),
      paragraph("Stimmt das nicht, oder möchten Sie Hilfe bei der Suche nach einem anderen Studio? Antworten Sie einfach auf diese E-Mail – wir melden uns persönlich bei Ihnen."),
      button("Mein Projekt öffnen", await ctx.projectLink(order.lead_id)),
    ].join("");
    await ctx.send({ to: lead.email, subject: "Update zu Ihrem Küchenauftrag", title: "Update zu Ihrem Auftrag", content, type: "order_update_consumer", recipientName: fullName(lead) });
  });
}

async function onContactReminder(ctx: Ctx, p: Record<string, unknown>) {
  const order = await ctx.order(String(p.order_id));
  if (order.status !== "awarded") return;
  const lead = await ctx.lead(order.lead_id);
  const dealer = await ctx.dealer(order.dealer_id);
  await ctx.notifyDealer(order, "order_reminder", "Bitte Kontakt aufnehmen", `${fullName(lead) || "Ihre Kundin bzw. Ihr Kunde"} wartet auf Ihre Rückmeldung.`);
  if (!dealer.email) return;
  const content = [
    greeting(dealerName(dealer)),
    paragraph(`vor zwei Tagen hat ${escapeHtml(fullName(lead) || "Ihre Kundin bzw. Ihr Kunde")} Ihr Angebot über <strong>${formatEuro(order.offer_price_eur)}</strong> angenommen. Bisher ist keine Kontaktaufnahme eingetragen.`),
    infoBox("Kundenkontakt", [
      detailRow("Name", escapeHtml(fullName(lead) || "–")),
      detailRow("Telefon", escapeHtml(lead.phone ?? "–")),
      detailRow("E-Mail", escapeHtml(lead.email ?? "–")),
      detailRow("PLZ / Ort", escapeHtml(`${lead.postal_code} ${lead.city ?? ""}`)),
    ].join(""), "warning"),
    paragraph("Bitte melden Sie sich zeitnah und tragen Sie den Kontakt oder den Aufmaß-Termin im Studio-Portal ein."),
    button("Auftrag im Studio-Portal", `${BRAND.baseUrl}/dashboard/projekte/${order.auction_id}`),
  ].join("");
  await ctx.send({ to: dealer.email, subject: `Erinnerung: Kund:in wartet auf Ihre Rückmeldung (PLZ ${lead.postal_code})`, title: "Bitte Kontakt aufnehmen", content, type: "order_update_dealer", recipientId: dealer.id });
}

async function onEscalation(ctx: Ctx, p: Record<string, unknown>) {
  const order = await ctx.order(String(p.order_id));
  if (order.status !== "awarded") return;
  const lead = await ctx.lead(order.lead_id);
  const dealer = await ctx.dealer(order.dealer_id);
  await ctx.send({
    to: ctx.adminAddress(),
    subject: `Keine Kontaktaufnahme seit 4 Tagen · ${dealerName(dealer)} · PLZ ${lead.postal_code}`,
    title: "Studio hat sich nicht gemeldet",
    content: [
      paragraph("Das Studio hat vier Tage nach dem Zuschlag keine Kontaktaufnahme eingetragen. Bitte bei Studio und Kund:in nachfassen."),
      infoBox("Auftrag", [detailRow("Angebot", formatEuro(order.offer_price_eur)), contactRows(lead, dealer)].join(""), "warning"),
    ].join(""),
    type: "order_admin",
  });
  await ctx.bestEffort("consumer escalation mail", async () => {
    if (!lead.email) return;
    const content = [
      greeting(lead.first_name ?? undefined),
      paragraph(`hat sich ${escapeHtml(dealerName(dealer))} schon bei Ihnen gemeldet? Falls nicht, antworten Sie einfach auf diese E-Mail – wir haken beim Studio nach und helfen Ihnen weiter.`),
      button("Mein Projekt öffnen", await ctx.projectLink(order.lead_id)),
    ].join("");
    await ctx.send({ to: lead.email, subject: "Hat sich Ihr Küchenstudio gemeldet?", title: "Kurze Nachfrage", content, type: "order_update_consumer", recipientName: fullName(lead) });
  });
}

async function onConfirmed(ctx: Ctx, p: Record<string, unknown>) {
  const order = await ctx.order(String(p.order_id));
  const lead = await ctx.lead(order.lead_id);
  const dealer = await ctx.dealer(order.dealer_id);
  await ctx.notifyDealer(order, "order_update", "Montage bestätigt", `${fullName(lead) || "Die Kundin bzw. der Kunde"} hat die fertige Küche bestätigt.`);
  if (dealer.email) {
    const content = [
      greeting(dealerName(dealer)),
      paragraph(`${escapeHtml(fullName(lead) || "Ihre Kundin bzw. Ihr Kunde")} hat bestätigt, dass die Küche fertig montiert ist. Vielen Dank für die gute Zusammenarbeit!`),
      button("Zur Projekt-Börse", `${BRAND.baseUrl}/dashboard/projekte`),
    ].join("");
    await ctx.send({ to: dealer.email, subject: `Montage bestätigt · PLZ ${lead.postal_code}`, title: "Küche fertig – vielen Dank", content, type: "order_update_dealer", recipientId: dealer.id });
  }
  await ctx.bestEffort("admin confirmed mail", () =>
    ctx.send({
      to: ctx.adminAddress(),
      subject: `Auftrag abgeschlossen · ${dealerName(dealer)} · ${formatEuro(order.contract_value_eur ?? order.offer_price_eur)}`,
      title: "Auftrag abgeschlossen",
      content: infoBox("Auftrag", [
        detailRow("Angebot", formatEuro(order.offer_price_eur)),
        detailRow("Kaufvertrag", order.contract_value_eur ? formatEuro(order.contract_value_eur) : "nicht erfasst"),
        contactRows(lead, dealer),
      ].join(""), "success"),
      type: "order_admin",
    }),
  );
}

async function onProblem(ctx: Ctx, p: Record<string, unknown>) {
  const order = await ctx.order(String(p.order_id));
  const lead = await ctx.lead(order.lead_id);
  const dealer = await ctx.dealer(order.dealer_id);
  const { data: event } = await ctx.sb
    .from("kw_order_events")
    .select("note, created_at")
    .eq("order_id", order.id)
    .eq("event", "problem_reported")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  await ctx.send({
    to: ctx.adminAddress(),
    subject: `Kund:in meldet ein Problem · ${dealerName(dealer)} · PLZ ${lead.postal_code}`,
    title: "Problem zum Auftrag gemeldet",
    content: [
      paragraph("Die Kundin bzw. der Kunde hat auf der Projektseite ein Anliegen gemeldet. Bitte zeitnah melden – die Nachricht ist für das Studio nicht sichtbar."),
      infoBox("Nachricht", paragraph(escapeHtml(event?.note ?? "–")), "warning"),
      infoBox("Auftrag", [detailRow("Status", escapeHtml(order.status)), contactRows(lead, dealer)].join("")),
    ].join(""),
    type: "order_admin",
  });
}

async function onCompletionCheck(ctx: Ctx, p: Record<string, unknown>) {
  const order = await ctx.order(String(p.order_id));
  const lead = await ctx.lead(order.lead_id);
  if (!lead.email) return;
  const dealer = await ctx.dealer(order.dealer_id);
  const content = [
    greeting(lead.first_name ?? undefined),
    paragraph(`ist Ihre neue Küche von ${escapeHtml(dealerName(dealer))} fertig montiert? Bestätigen Sie es mit einem Klick auf Ihrer Projektseite – oder melden Sie uns dort, falls noch etwas fehlt.`),
    button("Montage bestätigen", await ctx.projectLink(order.lead_id)),
  ].join("");
  await ctx.send({ to: lead.email, subject: "Ist Ihre Küche fertig montiert?", title: "Kurze Rückfrage zur Montage", content, type: "order_update_consumer", recipientName: fullName(lead) });
}

const HANDLERS: Record<string, (ctx: Ctx, payload: Record<string, unknown>) => Promise<void>> = {
  order_milestone: onMilestone,
  order_cancelled: onCancelled,
  order_contact_reminder: onContactReminder,
  order_escalation: onEscalation,
  order_confirmed: onConfirmed,
  order_problem: onProblem,
  order_completion_check: onCompletionCheck,
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
    const { data: batch, error } = await sb.rpc("kw_order_outbox_claim", { p_limit: 10 });
    if (error) {
      console.error("[kw-order-worker] claim failed", error.message);
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
        console.error(`[kw-order-worker] event ${row.id} (${row.event_type}) failed`, message);
        await sb.rpc("kw_outbox_finish", { p_id: row.id, p_error: message });
        results.push({ id: row.id, type: row.event_type, ok: false, error: message });
      }
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
