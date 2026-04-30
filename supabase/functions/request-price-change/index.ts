import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

/**
 * Edge Function: request-price-change
 *
 * Verkäufer reicht eine Preisanpassungs-Anfrage ein, wenn sein Inserat live
 * (active/kaufchance) ist und er die Preise nicht mehr selbst über die
 * RPC `update_listing_prices_in_draft` ändern kann.
 *
 * Flow:
 *   1. Bearer-Token validieren (USER_AUTH).
 *   2. Body validieren via Zod.
 *   3. Eigentum am Inserat prüfen, aktuelle Preise + Auktion lesen.
 *   4. Insert in price_change_requests (RLS lässt Owner zu, partial unique
 *      Index `uniq_pcr_kitchen_pending` blockiert doppelte pending Anfragen).
 *   5. Admin-E-Mail via Resend mit Direktlink ins Admin-Edit.
 *   6. Antwort an Client mit Request-ID und Status.
 *
 * Sicherheit: verify_jwt = false in config.toml (eigene Auth-Prüfung).
 */

const RequestSchema = z.object({
  kitchenId: z.string().uuid('Ungültige Inserat-ID'),
  requestedReserve: z
    .number()
    .positive('Mindestpreis muss positiv sein')
    .max(10_000_000, 'Mindestpreis zu hoch')
    .nullable()
    .optional(),
  requestedInstant: z
    .number()
    .positive('Sofortpreis muss positiv sein')
    .max(10_000_000, 'Sofortpreis zu hoch')
    .nullable()
    .optional(),
  reason: z
    .string()
    .min(5, 'Bitte geben Sie einen Grund (mind. 5 Zeichen) an')
    .max(1000, 'Maximal 1000 Zeichen'),
}).refine(
  (d) => (d.requestedReserve != null || d.requestedInstant != null),
  { message: 'Mindestens ein Preis (Mindest- oder Sofortpreis) ist erforderlich', path: ['requestedReserve'] },
);

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

function jsonResponse(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function fmtPrice(value: number | null | undefined): string {
  if (value == null) return '–';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}

Deno.serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, corsHeaders);
  }

  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return jsonResponse({ error: 'Nicht authentifiziert' }, 401, corsHeaders);
    }
    const token = authHeader.slice(7).trim();

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userData, error: userErr } = await adminClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return jsonResponse({ error: 'Nicht authentifiziert' }, 401, corsHeaders);
    }
    const user = userData.user;

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return jsonResponse({ error: 'Ungültiger JSON-Body' }, 400, corsHeaders);
    }
    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonResponse(
        { error: 'Validierungsfehler', issues: parsed.error.issues },
        400,
        corsHeaders,
      );
    }
    const { kitchenId, requestedReserve, requestedInstant, reason } = parsed.data;

    const { data: kitchen, error: mhErr } = await adminClient
      .from('kitchens')
      .select('id, seller_id, manufacturer, model, year, sale_channel, reserve_price, instant_price')
      .eq('id', kitchenId)
      .maybeSingle();
    if (mhErr || !kitchen) {
      return jsonResponse({ error: 'Inserat nicht gefunden' }, 404, corsHeaders);
    }
    if (kitchen.seller_id !== user.id) {
      return jsonResponse({ error: 'Keine Berechtigung für dieses Inserat' }, 403, corsHeaders);
    }

    const { data: auction } = await adminClient
      .from('auctions')
      .select('id, status, reserve_price, current_bid, end_time')
      .eq('kitchen_id', kitchenId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Regel: Verkaeufer duerfen den Mindestpreis/Sofortpreis nur SENKEN,
    // niemals erhoehen. Bei laufender Auktion ist der Vergleichswert fuer
    // den Mindestpreis das potenziell bereits durch Dynamic Pricing
    // reduzierte auctions.reserve_price; fuer den Sofortpreis das unver-
    // aenderte kitchens.instant_price (wird vom Cron nicht reduziert).
    const currentReserveForCompare =
      (auction?.reserve_price as number | null | undefined) ??
      (kitchen.reserve_price as number | null | undefined) ??
      null;
    const currentInstantForCompare =
      (kitchen.instant_price as number | null | undefined) ?? null;

    if (
      requestedReserve != null &&
      currentReserveForCompare != null &&
      Number(requestedReserve) > Number(currentReserveForCompare)
    ) {
      return jsonResponse(
        {
          error: `Der Mindestpreis kann nur gesenkt, nicht erhoeht werden (aktuell: ${fmtPrice(currentReserveForCompare)}, gewuenscht: ${fmtPrice(requestedReserve)}). Fuer Erhoehungen wenden Sie sich an info@kuechenwert24.de.`,
          code: 'PRICE_RAISE_NOT_ALLOWED',
        },
        400,
        corsHeaders,
      );
    }
    if (
      requestedInstant != null &&
      currentInstantForCompare != null &&
      Number(requestedInstant) > Number(currentInstantForCompare)
    ) {
      return jsonResponse(
        {
          error: `Der Sofortpreis kann nur gesenkt, nicht erhoeht werden (aktuell: ${fmtPrice(currentInstantForCompare)}, gewuenscht: ${fmtPrice(requestedInstant)}). Fuer Erhoehungen wenden Sie sich an info@kuechenwert24.de.`,
          code: 'PRICE_RAISE_NOT_ALLOWED',
        },
        400,
        corsHeaders,
      );
    }

    const { data: existing } = await adminClient
      .from('price_change_requests')
      .select('id, created_at')
      .eq('kitchen_id', kitchenId)
      .eq('status', 'pending')
      .maybeSingle();
    if (existing) {
      return jsonResponse(
        {
          error: 'Es gibt bereits eine offene Preisänderungs-Anfrage für dieses Inserat. Bitte warten Sie auf die Bearbeitung oder kontaktieren Sie info@kuechenwert24.de.',
          code: 'PENDING_REQUEST_EXISTS',
          existingRequestId: existing.id,
        },
        409,
        corsHeaders,
      );
    }

    const insertPayload = {
      seller_id: user.id,
      kitchen_id: kitchenId,
      auction_id: auction?.id ?? null,
      current_reserve: kitchen.reserve_price ?? null,
      current_instant: kitchen.instant_price ?? null,
      requested_reserve: requestedReserve ?? null,
      requested_instant: requestedInstant ?? null,
      reason: reason.trim(),
      status: 'pending' as const,
    };

    const { data: inserted, error: insertErr } = await adminClient
      .from('price_change_requests')
      .insert(insertPayload)
      .select('id, created_at')
      .single();
    if (insertErr || !inserted) {
      console.error('request-price-change insert failed:', insertErr);
      if (insertErr?.code === '23505') {
        return jsonResponse(
          { error: 'Es existiert bereits eine offene Anfrage für dieses Inserat.', code: 'PENDING_REQUEST_EXISTS' },
          409,
          corsHeaders,
        );
      }
      return jsonResponse({ error: 'Anfrage konnte nicht gespeichert werden' }, 500, corsHeaders);
    }

    if (RESEND_API_KEY) {
      try {
        const sellerEmail = user.email ?? 'unbekannt';
        const vehicle = `${kitchen.manufacturer ?? ''} ${kitchen.model ?? ''} (${kitchen.year ?? '?'})`.trim();
        const subject = `📝 Preisänderungs-Anfrage: ${vehicle}`;

        const html = `<!doctype html>
<html lang="de">
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;margin:0;padding:24px;color:#374151;">
  <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    <div style="border-bottom:3px solid #1f8aa2;padding-bottom:16px;margin-bottom:24px;">
      <h1 style="margin:0;color:#1f8aa2;font-size:22px;">KuechenWert · Admin-Aufgabe</h1>
    </div>
    <h2 style="color:#1f8aa2;margin-top:0;font-size:20px;">Preisänderungs-Anfrage vom Verkäufer</h2>
    <p style="font-size:15px;line-height:1.6;">Ein Verkäufer hat eine Preisanpassung beantragt. Bitte prüfen und entweder annehmen (Preis im Admin-Inserat ändern und Status auf <code>applied</code>) oder ablehnen (<code>admin_note</code> setzen, Status <code>rejected</code>).</p>

    <table style="border-collapse:collapse;width:100%;font-size:14px;margin-top:16px;">
      <tbody>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb;font-weight:600;">Fahrzeug</td><td style="padding:8px;border:1px solid #ddd;">${vehicle}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb;font-weight:600;">Verkaufskanal</td><td style="padding:8px;border:1px solid #ddd;">${kitchen.sale_channel ?? '–'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb;font-weight:600;">Verkäufer</td><td style="padding:8px;border:1px solid #ddd;">${sellerEmail}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb;font-weight:600;">Auktion-Status</td><td style="padding:8px;border:1px solid #ddd;">${auction?.status ?? 'keine Auktion'}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb;font-weight:600;">Aktueller Mindestpreis</td><td style="padding:8px;border:1px solid #ddd;">${fmtPrice(kitchen.reserve_price as number | null)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb;font-weight:600;">Aktueller Sofortpreis</td><td style="padding:8px;border:1px solid #ddd;">${fmtPrice(kitchen.instant_price as number | null)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#fef3c7;font-weight:600;">Gewünschter Mindestpreis</td><td style="padding:8px;border:1px solid #ddd;background:#fef3c7;">${fmtPrice(requestedReserve ?? null)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#fef3c7;font-weight:600;">Gewünschter Sofortpreis</td><td style="padding:8px;border:1px solid #ddd;background:#fef3c7;">${fmtPrice(requestedInstant ?? null)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;background:#f9fafb;font-weight:600;">Aktuelles Höchstgebot</td><td style="padding:8px;border:1px solid #ddd;">${fmtPrice(auction?.current_bid as number | null)}</td></tr>
      </tbody>
    </table>

    <h3 style="margin-top:24px;font-size:15px;color:#1f8aa2;">Begründung des Verkäufers</h3>
    <blockquote style="border-left:3px solid #1f8aa2;padding:8px 16px;background:#f9fafb;margin:8px 0;font-style:italic;color:#374151;">${(reason || '').replace(/[<>]/g, '')}</blockquote>

    <p style="margin-top:24px;">
      <a href="https://kuechenwert24.de/admin/kitchens/${kitchenId}" style="display:inline-block;background:#1f8aa2;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;font-size:14px;">Inserat im Admin öffnen →</a>
    </p>

    <p style="margin-top:16px;font-size:12px;color:#9ca3af;">Anfrage-ID: <code>${inserted.id}</code> · Eingang: ${new Date(inserted.created_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}</p>

    <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb;">
    <p style="font-size:12px;color:#9ca3af;text-align:center;">KuechenWert · Automatische Admin-Aufgabe</p>
  </div>
</body>
</html>`;

        const resendResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'KuechenWert <info@kuechenwert24.de>',
            to: ['info@kuechenwert24.de'],
            subject,
            html,
            reply_to: sellerEmail !== 'unbekannt' ? sellerEmail : 'info@kuechenwert24.de',
          }),
        });

        if (!resendResp.ok) {
          const errText = await resendResp.text();
          console.error('Resend admin email failed:', resendResp.status, errText);
        } else {
          const resendResult = await resendResp.json();
          await adminClient.from('admin_emails').insert({
            sender_email: 'info@kuechenwert24.de',
            sender_name: 'KuechenWert',
            recipient_email: 'info@kuechenwert24.de',
            subject,
            body_html: html,
            body_text: html.replace(/<[^>]+>/g, ''),
            email_type: 'single',
            direction: 'outbound',
            status: 'sent',
            resend_id: resendResult.id,
            is_read: false,
          });
        }
      } catch (mailErr) {
        console.error('Admin email dispatch failed (non-fatal):', mailErr);
      }
    }

    return jsonResponse(
      {
        ok: true,
        requestId: inserted.id,
        status: 'pending',
        createdAt: inserted.created_at,
      },
      200,
      corsHeaders,
    );
  } catch (err) {
    console.error('request-price-change unhandled error:', err);
    return jsonResponse({ error: 'Interner Fehler' }, 500, corsHeaders);
  }
});
