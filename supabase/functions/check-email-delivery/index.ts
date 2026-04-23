/**
 * check-email-delivery
 *
 * One-shot admin diagnostic endpoint that takes a list of Resend email IDs
 * and queries Resend's GET /emails/{id} API for the actual delivery status
 * (last_event), recipient, subject, and timestamps.
 *
 * Useful when our `inbound-webhook` is broken or rate-limited and the
 * `admin_emails.status` column is therefore stuck on `sent` (Resend never
 * pushes the `delivered`/`bounced`/`complained` follow-up to us).
 *
 * Body: { "ids": ["abc-123", ...], "limit"?: 50 }
 *
 * Auth: service_role token OR admin user JWT (checkServiceRoleOrAdmin).
 */

import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const auth = await checkServiceRoleOrAdmin(req, corsHeaders);
  if (!auth.authorized) return auth.response;

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!RESEND_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'RESEND_API_KEY missing' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  let payload: { ids?: unknown; limit?: number } = {};
  try {
    payload = await req.json();
  } catch { /* ignored — validated below */ }

  const rawIds = Array.isArray(payload.ids) ? payload.ids : [];
  const ids = rawIds
    .filter((x): x is string => typeof x === 'string' && x.length > 0)
    .slice(0, Math.min(payload.limit ?? 50, 50));

  if (ids.length === 0) {
    return new Response(
      JSON.stringify({ error: 'ids must be a non-empty string array' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const results: Array<Record<string, unknown>> = [];
  for (const id of ids) {
    try {
      const r = await fetch(`https://api.resend.com/emails/${id}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` },
      });
      const text = await r.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch { /* keep text */ }

      if (!r.ok) {
        results.push({
          id,
          ok: false,
          status: r.status,
          error: json?.message ?? text.slice(0, 300),
        });
        continue;
      }

      results.push({
        id,
        ok: true,
        last_event: json?.last_event ?? null,
        to: json?.to ?? null,
        from: json?.from ?? null,
        subject: json?.subject ?? null,
        created_at: json?.created_at ?? null,
      });
    } catch (e: any) {
      results.push({ id, ok: false, error: e?.message ?? String(e) });
    }

    // Resend rate-limit safety: 5 req/s. 220ms between calls keeps us safely
    // under that threshold even if the API is slow.
    await new Promise((res) => setTimeout(res, 220));
  }

  // Group by last_event to make the result skim-friendly.
  const byEvent: Record<string, number> = {};
  for (const r of results) {
    if (r.ok) {
      const ev = (r.last_event as string) || 'unknown';
      byEvent[ev] = (byEvent[ev] ?? 0) + 1;
    } else {
      byEvent['lookup_error'] = (byEvent['lookup_error'] ?? 0) + 1;
    }
  }

  return new Response(
    JSON.stringify({ count: results.length, summary: byEvent, results }, null, 2),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
