import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

/**
 * unsubscribe-google-review
 * ---------------------------------------------------------------
 * Two endpoints rolled into one (kept together because both share
 * the same token table and rendering helpers).
 *
 *   GET  ?action=click&token=...        → record click, 302 to Google
 *   GET  ?action=unsubscribe&token=...  → render confirm page (HTML)
 *   POST ?action=unsubscribe&token=...  → one-click unsubscribe
 *                                         (List-Unsubscribe-Post header)
 *
 * Public, NO auth: required for List-Unsubscribe / opt-out-from-mail
 * to function across all email clients (Gmail, Outlook, Apple Mail).
 *
 * Security notes:
 *   - Token is a random 24-byte hex string per row → unguessable.
 *   - Click endpoint is idempotent on click_count++ but never causes
 *     write amplification because the row count is bounded.
 *   - All writes go through SECURITY DEFINER RPCs so RLS is irrelevant.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_REVIEW_URL = "https://share.google/eu7uLZRpBLgeQkqhH";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const action = (url.searchParams.get("action") ?? "unsubscribe").toLowerCase();
  const token = url.searchParams.get("token") ?? "";

  if (!token || token.length < 16) {
    return htmlError("Ungültiger Link", "Dieser Link ist leider nicht gültig oder bereits abgelaufen.");
  }

  if (action === "click") {
    // Best-effort click tracking; never block the redirect on failure.
    try {
      await supabase.rpc("track_google_review_click", { p_token: token });
    } catch (err) {
      console.error("[google-review] track_click failed:", err);
    }
    return Response.redirect(GOOGLE_REVIEW_URL, 302);
  }

  if (action === "unsubscribe") {
    // POST = one-click unsubscribe per RFC 8058. GET = show confirmation.
    if (req.method === "POST") {
      const { error } = await supabase.rpc("process_google_review_unsubscribe", {
        p_token: token,
      });
      if (error) {
        return jsonResponse({ error: error.message }, 400);
      }
      return jsonResponse({ success: true });
    }

    // GET → human-readable HTML page that performs the actual unsubscribe.
    // Some mail clients only fire GET on the link, so we still process the
    // opt-out server-side here, then render success.
    const { data, error } = await supabase.rpc(
      "process_google_review_unsubscribe",
      { p_token: token },
    );
    if (error) {
      const msg = error.message?.includes("token_not_found")
        ? "Dieser Abmelde-Link ist nicht mehr gültig oder wurde bereits verwendet."
        : "Beim Abmelden ist ein Fehler aufgetreten. Bitte schreiben Sie uns kurz an info@caravanwert.de.";
      return htmlError("Abmeldung", msg);
    }

    const email =
      (data as { email?: string } | null)?.email ?? "Ihre E-Mail-Adresse";
    return htmlSuccess(email);
  }

  return htmlError("Unbekannte Aktion", "Diese Aktion ist nicht bekannt.");
};

// ─── Renderers ─────────────────────────────────────────────────

function htmlSuccess(email: string): Response {
  const safeEmail = escapeHtml(email);
  const html = page(
    "Erfolgreich abgemeldet",
    `
    <h1 style="margin:0 0 16px;font-size:24px;color:#0f4f5c;">Sie sind abgemeldet</h1>
    <p style="font-size:16px;color:#374151;line-height:1.6;">
      Wir haben <strong>${safeEmail}</strong> aus unserer Bewertungs-Mailliste entfernt.
    </p>
    <p style="font-size:16px;color:#374151;line-height:1.6;">
      Sie erhalten von uns keine weitere Erinnerung in dieser Sache. Falls Sie noch ein aktives Konto bei CaravanWert haben, sind alle dort eingestellten Benachrichtigungen davon nicht betroffen.
    </p>
    <p style="margin-top:32px;">
      <a href="https://caravanwert.de" style="display:inline-block;background:#1f8aa2;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:500;">Zur Startseite</a>
    </p>
    <p style="margin-top:32px;font-size:13px;color:#6b7280;">
      Falls Sie versehentlich abgemeldet wurden, schreiben Sie uns kurz an
      <a href="mailto:info@caravanwert.de" style="color:#1f8aa2;">info@caravanwert.de</a>.
    </p>
    `,
  );
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function htmlError(title: string, message: string): Response {
  const html = page(
    title,
    `
    <h1 style="margin:0 0 16px;font-size:24px;color:#991b1b;">${escapeHtml(title)}</h1>
    <p style="font-size:16px;color:#374151;line-height:1.6;">${escapeHtml(message)}</p>
    <p style="margin-top:32px;">
      <a href="https://caravanwert.de" style="display:inline-block;background:#1f8aa2;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:500;">Zur Startseite</a>
    </p>
    `,
  );
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function page(title: string, inner: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<title>${escapeHtml(title)} – CaravanWert</title>
<style>
  body { margin:0; padding:32px 16px; background:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  .card { max-width:560px; margin:48px auto; background:#fff; border-radius:12px; box-shadow:0 4px 24px rgba(15,79,92,0.08); padding:40px 32px; }
  .brand { text-align:center; font-weight:700; color:#0f4f5c; font-size:18px; margin-bottom:24px; letter-spacing:0.02em; }
  a:focus, a:hover { opacity:0.92; }
</style>
</head>
<body>
  <div class="card">
    <div class="brand">CARAVAN<span style="color:#1f8aa2;">WERT</span></div>
    ${inner}
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

serve(handler);
