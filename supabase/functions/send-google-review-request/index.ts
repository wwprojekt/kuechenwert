import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

/**
 * send-google-review-request
 * ---------------------------------------------------------------
 * Cron-driven outreach: sends a polite "please review us on Google"
 * email to a batch of past contacts. Designed to run daily at 11:00 UTC;
 * each email address ever receives this exactly once thanks to a UNIQUE
 * index on the queue table.
 *
 * Auth: service_role bearer (cron) or admin user JWT (manual trigger).
 *
 * Request body (all optional):
 *   {
 *     batch_size?: number,   // default 50, max 200
 *     top_up?: boolean,      // default true → run enqueue first
 *     min_age_days?: number, // default 14
 *     dry_run?: boolean      // default false
 *   }
 *
 * Self-contained: inlines email template + auth check so it can be
 * deployed standalone without _shared dependencies.
 */

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const FROM_ADDRESS = "info@caravanwert.de";
const SITE_NAME = "CaravanWert";
const LOGO_URL =
  "https://zcrwqxsyptjwkuxfacvq.supabase.co/storage/v1/object/public/branding/logo-email.png";
const PRIMARY = "#1f8aa2";
const PRIMARY_DARK = "#0f4f5c";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Inline CORS (admin UI calls this from the browser) ───────────────
const ALLOWED_ORIGINS = [
  "https://caravanwert.de",
  "https://www.caravanwert.de",
];
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(origin)) return true;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;
  return false;
}
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = isAllowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

interface BatchRow {
  id: string;
  email: string;
  recipient_name: string | null;
  unsubscribe_token: string;
}

// ─── Inline auth check ─────────────────────────────────────────
// Accept either:
//   1. Bearer == SUPABASE_SERVICE_ROLE_KEY (cron pattern)
//   2. JWT signed for this project with role=service_role (legacy)
//   3. Authenticated admin user (manual trigger from /admin UI)
async function isAuthorized(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  if (token === SUPABASE_SERVICE_ROLE_KEY) return true;

  try {
    const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
    const parts = token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(
        atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload?.role === "service_role" && payload?.ref === ref) return true;
    }
  } catch {
    // fall through
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return false;
    const { data: roles } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    return (roles ?? []).some((r: { role: string }) => r.role === "admin");
  } catch {
    return false;
  }
}

const handler = async (req: Request): Promise<Response> => {
  // CORS preflight (admin UI in the browser sends an OPTIONS request first)
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  if (!(await isAuthorized(req))) {
    return jsonResponse(
      req,
      { error: "Nicht autorisiert: Ungültiger oder fehlender Token" },
      401,
    );
  }

  if (!RESEND_API_KEY) {
    return jsonResponse(req, { error: "RESEND_API_KEY not configured" }, 500);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const batchSize = Math.min(
    Math.max(typeof body.batch_size === "number" ? body.batch_size : 50, 1),
    200,
  );
  const topUp = body.top_up !== false;
  const minAgeDays =
    typeof body.min_age_days === "number" ? body.min_age_days : 14;
  const dryRun = body.dry_run === true;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ─── 1) Top up queue ─────────────────────────────────────────
  let enqueued = 0;
  if (topUp) {
    const { data: enqueueRes, error: enqueueErr } = await supabase.rpc(
      "enqueue_google_review_candidates",
      { p_min_age_days: minAgeDays, p_max_inserts: batchSize * 4 },
    );
    if (enqueueErr) {
      console.error("[google-review] enqueue failed:", enqueueErr);
    } else if (
      enqueueRes && typeof enqueueRes === "object" && "inserted" in enqueueRes
    ) {
      enqueued = Number((enqueueRes as { inserted?: number }).inserted ?? 0);
    }
  }

  // ─── 2) Dry-run short-circuit ────────────────────────────────
  if (dryRun) {
    const { data: peek } = await supabase
      .from("google_review_requests")
      .select("id, email, recipient_name")
      .eq("delivery_status", "queued")
      .order("scheduled_for", { ascending: true })
      .limit(batchSize);
    return jsonResponse(req, {
      dry_run: true,
      enqueued,
      would_send: peek?.length ?? 0,
      preview: peek ?? [],
    });
  }

  // ─── 3) Atomically claim batch ───────────────────────────────
  const { data: batchData, error: claimErr } = await supabase.rpc(
    "claim_google_review_batch",
    { p_limit: batchSize },
  );
  if (claimErr) {
    return jsonResponse(
      req,
      { error: "claim_failed", details: claimErr.message },
      500,
    );
  }
  const batch = (batchData ?? []) as BatchRow[];
  if (batch.length === 0) {
    return jsonResponse(req, { enqueued, sent: 0, failed: 0, batch: 0 });
  }

  // ─── 4) Send each, with minimum spacing for Resend rate limit
  let sent = 0;
  let failed = 0;
  const failures: Array<{ email: string; error: string }> = [];

  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    try {
      // Race-condition guard: admin may have suppressed between claim+send.
      // Use .eq on the lowercased email — suppressions are always stored in
      // lowercase, and .ilike would mis-treat `_` / `%` in addresses as
      // SQL LIKE wildcards (e.g. john_doe@x.com would match johnXdoe@x.com).
      const { data: suppressed } = await supabase
        .from("email_suppressions")
        .select("id")
        .eq("email", row.email.toLowerCase())
        .maybeSingle();
      if (suppressed) {
        await supabase.rpc("mark_google_review_failed", {
          p_id: row.id,
          p_error: "suppressed_after_claim",
          p_status: "suppressed",
        });
        failed++;
        continue;
      }

      const html = buildHtml(row);
      const text = htmlToText(html);
      const subject = "Würden Sie uns auf Google bewerten?";

      const unsubUrl = `${SUPABASE_URL}/functions/v1/unsubscribe-google-review?action=unsubscribe&token=${row.unsubscribe_token}`;

      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `${SITE_NAME} <${FROM_ADDRESS}>`,
          to: [row.email],
          subject,
          html,
          text,
          reply_to: FROM_ADDRESS,
          headers: {
            "List-Unsubscribe":
              `<${unsubUrl}>, <mailto:${FROM_ADDRESS}?subject=Unsubscribe>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            "X-Entity-Ref-ID": row.id,
          },
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        await supabase.rpc("mark_google_review_failed", {
          p_id: row.id,
          p_error: `resend_${resp.status}: ${errText.slice(0, 500)}`,
          p_status: "failed",
        });
        failures.push({ email: row.email, error: `resend ${resp.status}` });
        failed++;
      } else {
        const result = await resp.json();
        await supabase
          .from("google_review_requests")
          .update({ resend_message_id: result.id })
          .eq("id", row.id);

        await supabase.from("admin_emails").insert({
          sender_email: FROM_ADDRESS,
          sender_name: SITE_NAME,
          recipient_email: row.email,
          recipient_name: row.recipient_name ?? null,
          subject,
          body_html: html,
          body_text: text,
          email_type: "google_review_request",
          direction: "outbound",
          status: "sent",
          resend_id: result.id,
          is_read: true,
        });
        sent++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabase.rpc("mark_google_review_failed", {
        p_id: row.id,
        p_error: msg.slice(0, 500),
        p_status: "failed",
      });
      failures.push({ email: row.email, error: msg });
      failed++;
    }

    // 10 req/s safe spacing between sends
    if (i < batch.length - 1) await sleep(150);
  }

  return jsonResponse(req, {
    enqueued,
    sent,
    failed,
    batch: batch.length,
    failures,
  });
};

// ─── Inline branded email template ──────────────────────────────
// Mini CaravanWert design (header, content, signature, footer with
// unsubscribe). Self-contained on purpose: this Edge Function should
// keep working even if _shared/email-builder.ts changes.

function buildHtml(row: BatchRow): string {
  const firstName = row.recipient_name
    ? String(row.recipient_name).trim().split(/\s+/)[0]
    : null;
  const cleanName =
    firstName && /^[A-Za-zÄÖÜäöüß\-]{2,}$/.test(firstName) ? firstName : null;
  const greeting = cleanName ? `Guten Tag ${cleanName},` : "Guten Tag,";

  const unsubUrl =
    `${SUPABASE_URL}/functions/v1/unsubscribe-google-review?action=unsubscribe&token=${row.unsubscribe_token}`;
  const reviewUrl =
    `${SUPABASE_URL}/functions/v1/unsubscribe-google-review?action=click&token=${row.unsubscribe_token}`;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Würden Sie uns bewerten?</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#eef2f7;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#eef2f7;">
    <tr><td align="center" style="padding:30px 15px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.07);">
        <tr><td style="background:linear-gradient(135deg,${PRIMARY_DARK} 0%,${PRIMARY} 50%,#239cb8 100%);padding:32px 40px;text-align:center;">
          <a href="https://caravanwert.de" style="text-decoration:none;display:inline-block;">
            <img src="${LOGO_URL}" alt="${SITE_NAME}" width="220" style="display:block;margin:0 auto;max-width:220px;height:auto;" />
          </a>
        </td></tr>
        <tr><td style="padding:40px 40px 10px;">
          <h1 style="margin:0 0 20px;font-size:24px;font-weight:700;color:#111827;line-height:1.3;">Würden Sie uns bewerten?</h1>
          <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 16px;">${greeting}</p>
          <p style="color:#374151;font-size:15px;line-height:1.7;margin:16px 0;">vielen Dank, dass Sie ${SITE_NAME} kennen &ndash; ob als Kunde, Interessent oder weil Sie unseren Wertrechner genutzt haben.</p>
          <p style="color:#374151;font-size:15px;line-height:1.7;margin:16px 0;">Wir bauen <strong>${SITE_NAME}</strong> als faire, transparente Plattform f&uuml;r den Wohnmobil-Markt. Damit andere Verk&auml;ufer und K&auml;ufer uns finden und vertrauen, w&uuml;rden wir uns sehr &uuml;ber Ihre <strong>kurze Bewertung auf Google</strong> freuen.</p>
          <p style="color:#374151;font-size:15px;line-height:1.7;margin:16px 0;">Es dauert nur etwa <strong>30 Sekunden</strong> und hilft uns enorm.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:30px 0;">
            <tr><td align="center">
              <a href="${reviewUrl}" style="background-color:${PRIMARY};color:#ffffff;padding:15px 36px;text-decoration:none;border-radius:8px;font-size:16px;font-weight:700;display:inline-block;letter-spacing:0.3px;box-shadow:0 2px 4px rgba(31,138,162,0.3);">Jetzt auf Google bewerten</a>
            </td></tr>
          </table>
          <p style="color:#374151;font-size:15px;line-height:1.7;margin:16px 0;">Falls Sie eine andere R&uuml;ckmeldung an uns haben &ndash; ob Lob oder Kritik &ndash; antworten Sie einfach auf diese E-Mail. Wir lesen jede Nachricht pers&ouml;nlich.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 0;">
            <tr><td style="background-color:#f1f5f9;border-left:3px solid ${PRIMARY};border-radius:0 6px 6px 0;padding:14px 18px;">
              <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">Diese E-Mail wird einmalig pro Adresse versendet &ndash; Sie werden zu diesem Thema nicht erneut kontaktiert. <a href="${unsubUrl}" style="color:${PRIMARY_DARK};">Hier abmelden</a>, falls Sie keine weiteren Mails von ${SITE_NAME} m&ouml;chten.</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:10px 40px 35px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td style="border-top:1px solid #e2e8f0;padding-top:25px;">
              <p style="margin:0 0 4px;font-size:15px;color:#374151;font-weight:600;">Mit freundlichen Gr&uuml;&szlig;en</p>
              <p style="margin:0 0 4px;font-size:15px;color:${PRIMARY};font-weight:700;">Ihr ${SITE_NAME} Team</p>
              <p style="margin:0;font-size:13px;color:#6b7280;">Deutschlands Wohnmobil-Handelsplattform</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background-color:${PRIMARY_DARK};padding:30px 40px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr><td align="center" style="padding-bottom:16px;">
              <p style="margin:0 0 6px;font-size:13px;color:#67e8f9;font-weight:600;">${SITE_NAME}</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                <a href="mailto:${FROM_ADDRESS}" style="color:#94a3b8;text-decoration:none;">${FROM_ADDRESS}</a>
                &nbsp;&bull;&nbsp;
                <a href="tel:+4951151532476" style="color:#94a3b8;text-decoration:none;">+49 511 51532476</a>
              </p>
            </td></tr>
            <tr><td align="center" style="padding-bottom:16px;">
              <p style="margin:0;font-size:12px;">
                <a href="https://caravanwert.de" style="color:#67e8f9;text-decoration:none;font-weight:500;">Website</a>
                &nbsp;&nbsp;&bull;&nbsp;&nbsp;
                <a href="https://caravanwert.de/datenschutz" style="color:#67e8f9;text-decoration:none;font-weight:500;">Datenschutz</a>
                &nbsp;&nbsp;&bull;&nbsp;&nbsp;
                <a href="https://caravanwert.de/impressum" style="color:#67e8f9;text-decoration:none;font-weight:500;">Impressum</a>
                &nbsp;&nbsp;&bull;&nbsp;&nbsp;
                <a href="${unsubUrl}" style="color:#67e8f9;text-decoration:none;font-weight:500;">Abmelden</a>
              </p>
            </td></tr>
            <tr><td align="center">
              <p style="margin:0;font-size:11px;color:rgba(148,163,184,0.7);">&copy; ${year} ${SITE_NAME}. Alle Rechte vorbehalten.</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&uuml;/g, "ü")
    .replace(/&ouml;/g, "ö")
    .replace(/&auml;/g, "ä")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&Auml;/g, "Ä")
    .replace(/&szlig;/g, "ß")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/\s+/g, " ")
    .trim();
}

function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
    },
  });
}

serve(handler);
