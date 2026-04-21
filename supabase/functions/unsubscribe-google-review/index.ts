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
 *                                         (does NOT actually unsubscribe!)
 *   POST ?action=unsubscribe&token=...  → actually unsubscribe
 *                                         (RFC 8058 one-click + form POST)
 *
 * Public, NO auth: required for List-Unsubscribe / opt-out-from-mail
 * to function across all email clients (Gmail, Outlook, Apple Mail).
 *
 * IMPORTANT — why GET does NOT auto-unsubscribe:
 *   Corporate mail security scanners (Outlook ATP SafeLinks, Gmail link
 *   prefetch, Mimecast, Barracuda, Proofpoint URL Defense, etc.) fetch
 *   every URL in incoming mail with a HEAD/GET request to scan for
 *   malware. If GET auto-processed the unsubscribe, every single
 *   corporate recipient would be opted out before they even see the
 *   mail. This is a well-documented industry bug; the only safe
 *   pattern is: GET → HTML confirm page with POST button.
 *   See: https://www.list-unsubscribe.com/list-unsubscribe-best-practices
 *
 * Click endpoint is intentionally idempotent (UPDATE … SET click_count++)
 * even though prefetchers will inflate the counter. We accept that — the
 * worst case is over-counted clicks; the user is never sent to Google
 * without their action because the redirect happens server-side and the
 * prefetcher does not follow it.
 *
 * Security notes:
 *   - Token is a random 24-byte hex string per row → unguessable.
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
    return htmlError(
      "Ungültiger Link",
      "Dieser Link ist leider nicht gültig oder bereits abgelaufen.",
    );
  }

  // ─── Click tracking (best-effort, never blocks redirect) ────────
  if (action === "click") {
    try {
      await supabase.rpc("track_google_review_click", { p_token: token });
    } catch (err) {
      console.error("[google-review] track_click failed:", err);
    }
    return Response.redirect(GOOGLE_REVIEW_URL, 302);
  }

  if (action === "unsubscribe") {
    // POST = actually unsubscribe (RFC 8058 one-click and form submit).
    if (req.method === "POST") {
      const { data, error } = await supabase.rpc(
        "process_google_review_unsubscribe",
        { p_token: token },
      );
      if (error) {
        // 200 with confirmation page so List-Unsubscribe-Post stays clean.
        const friendly =
          error.message?.includes("token_not_found") ||
            error.message?.includes("invalid_token")
            ? "Dieser Abmelde-Link ist nicht mehr gültig oder wurde bereits verwendet."
            : "Beim Abmelden ist ein Fehler aufgetreten. Bitte schreiben Sie uns kurz an info@caravanwert.de.";
        // Distinguish API vs browser POST: form POST sends Accept: text/html
        const wantsHtml =
          (req.headers.get("accept") ?? "").includes("text/html");
        if (wantsHtml) return htmlError("Abmeldung", friendly);
        return jsonResponse({ error: friendly }, 400);
      }
      const email =
        (data as { email?: string } | null)?.email ?? "Ihre E-Mail-Adresse";
      const wantsHtml =
        (req.headers.get("accept") ?? "").includes("text/html");
      if (wantsHtml) return htmlSuccess(email);
      return jsonResponse({ success: true, email });
    }

    // GET = show confirmation page with POST button.
    // CRITICAL: do NOT process the unsubscribe here. Corporate mail
    // scanners fetch every URL on inbound mail; auto-processing would
    // unsubscribe everyone behind such filters before they even see
    // the mail. Force an explicit user click on the POST button.
    return htmlConfirm(token);
  }

  return htmlError("Unbekannte Aktion", "Diese Aktion ist nicht bekannt.");
};

// ─── Renderers ─────────────────────────────────────────────────

function htmlConfirm(token: string): Response {
  const safeToken = escapeHtml(token);
  // Self-submitting form posts to same URL. JavaScript fallback for nicer UX.
  const html = page(
    "Bewertungs-Mails abbestellen",
    `
    <h1 style="margin:0 0 16px;font-size:24px;color:#0f4f5c;">Bewertungs-Mails abbestellen?</h1>
    <p style="font-size:16px;color:#374151;line-height:1.6;">
      Möchten Sie keine weiteren Erinnerungen erhalten, dass Sie CaravanWert auf Google bewerten könnten?
    </p>
    <form id="unsub-form" method="POST" action="?action=unsubscribe&amp;token=${safeToken}" style="margin-top:24px;">
      <button type="submit" style="display:inline-block;background:#1f8aa2;color:#fff;border:0;text-decoration:none;padding:14px 28px;border-radius:6px;font-weight:600;font-size:16px;cursor:pointer;">
        Ja, jetzt abmelden
      </button>
    </form>
    <p style="margin-top:24px;font-size:14px;color:#6b7280;">
      Falls Sie sich nicht abmelden möchten, können Sie diese Seite einfach schließen — es passiert nichts.
    </p>
    <p style="margin-top:32px;font-size:13px;color:#6b7280;">
      Hinweis: Andere Benachrichtigungen aus Ihrem CaravanWert-Konto (z. B. Auktions-Updates) sind davon nicht betroffen.
    </p>
    `,
  );
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // No-cache so prefetchers + scanners don't pollute browser cache
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

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
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function htmlError(title: string, message: string): Response {
  const html = page(
    title,
    `
    <h1 style="margin:0 0 16px;font-size:24px;color:#991b1b;">${
      escapeHtml(title)
    }</h1>
    <p style="font-size:16px;color:#374151;line-height:1.6;">${
      escapeHtml(message)
    }</p>
    <p style="margin-top:32px;">
      <a href="https://caravanwert.de" style="display:inline-block;background:#1f8aa2;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:500;">Zur Startseite</a>
    </p>
    `,
  );
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Robots-Tag": "noindex, nofollow",
    },
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
  button:focus, button:hover { opacity:0.92; }
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
