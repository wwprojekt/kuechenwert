/**
 * kw-unsubscribe — Abmeldung von Rundmails per signiertem Link, ohne Login.
 *
 * POST ?t=<token>  mit Body "List-Unsubscribe=One-Click" (RFC 8058, vom
 *                  Mailprogramm) oder JSON { token } von der Seite /abmelden.
 * GET ist bewusst nicht erlaubt: Link-Scanner in Mailsystemen würden sonst
 * Abmeldungen auslösen.
 *
 * Scope "werbung": Newsletter und Werbung aus; "hinweise": Plattform-Hinweise aus.
 * Die Änderung protokolliert der Trigger kw_log_email_consent (Quelle abmeldelink).
 */
import { enforceRateLimit, clientIp, HttpError, jsonResponse, serve, serviceClient } from "../_shared/kw-http.ts";
import { verifyUnsubscribeToken } from "../_shared/unsubscribe-token.ts";

serve(async (req) => {
  let token = new URL(req.url).searchParams.get("t") ?? "";
  if (!token && (req.headers.get("content-type") ?? "").includes("application/json")) {
    const body = await req.json().catch(() => null);
    if (body && typeof body.token === "string") token = body.token;
  }

  const sb = serviceClient();
  await enforceRateLimit(sb, `kw:unsubscribe:${clientIp(req)}`, 3600, 60);

  const parsed = await verifyUnsubscribeToken(token);
  if (!parsed) throw new HttpError(400, "Dieser Abmeldelink ist ungültig.", "invalid_token");

  const { data, error } = await sb.rpc("kw_email_unsubscribe", { p_user_id: parsed.userId, p_scope: parsed.scope });
  if (error) throw error;
  if (data?.ok === false) throw new HttpError(404, "Zu diesem Link gibt es kein Konto mehr.", "not_found");

  return jsonResponse(req, { ok: true, scope: parsed.scope });
});
