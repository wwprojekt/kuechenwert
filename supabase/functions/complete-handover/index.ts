import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { edgeLogger, logEdgeError } from '../_shared/edgeLogger.ts';
import {
  buildEmailLayout,
  paragraph,
  greeting,
  infoBox,
  detailRow,
  button,
} from '../_shared/email-builder.ts';

/**
 * Edge Function: complete-handover
 *
 * Atomic handover finalization performed at the Ankaufstation by an admin.
 *
 * Order of operations:
 *   1. Auth: caller must be admin
 *   2. Load appointment with linked kitchen / station / buyer / seller
 *   3. Best-effort generate handover-PDF (continues even if it fails)
 *   4. Update appointment -> completed (idempotent: only if scheduled/verified)
 *   5. Mark kitchen as sold (preserve sale_type if already set via auction)
 *   6. Best-effort send confirmation emails to BUYER and SELLER (with PDF link)
 *   7. Audit log + persistent error_logs for any email failure
 *
 * Body (snake_case is the canonical contract; camelCase keys are accepted as
 * fallback for legacy callers):
 *   - appointment_id | appointmentId  (required)
 *   - payment_method  (default: "cash" — required for the audit trail)
 *   - payment_amount  (default: kitchen.instant_price; coerced to number)
 *   - protocol_data   (free-form notes object, persisted via PDF only)
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SITE_URL = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://kuechenwert24.de';

interface ProfileLite {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}

interface SettingsLike {
  site_name: string;
  site_description: string;
  contact_email: string;
  support_phone: string;
}

const fallbackSettings: SettingsLike = {
  site_name: 'KÃ¼chenWert',
  site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
  contact_email: 'info@kuechenwert24.de',
  support_phone: '+49 511 51532476',
};

function displayName(p: ProfileLite | null | undefined): string {
  if (!p) return '';
  return p.company_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || (p.email?.split('@')[0] ?? '');
}

function formatEur(value: number | null | undefined): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function paymentMethodLabel(m: string | null | undefined): string {
  switch ((m ?? '').toLowerCase()) {
    case 'cash': return 'Barzahlung';
    case 'transfer':
    case 'bank_transfer': return 'Überweisung';
    case 'financing': return 'Finanzierung';
    case 'card': return 'Kartenzahlung';
    default: return m ?? '—';
  }
}

async function sendMail(
  recipientEmail: string,
  subject: string,
  html: string,
  settings: SettingsLike,
): Promise<{ ok: boolean; error: string | null; resendId: string | null }> {
  if (!RESEND_API_KEY) {
    return { ok: false, error: 'RESEND_API_KEY not configured', resendId: null };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settings.site_name} <info@kuechenwert24.de>`,
        to: [recipientEmail],
        subject,
        html,
        reply_to: 'info@kuechenwert24.de',
      }),
    });
    if (!res.ok) {
      return {
        ok: false,
        error: `${res.status}: ${(await res.text()).slice(0, 200)}`,
        resendId: null,
      };
    }
    const json = await res.json();
    return { ok: true, error: null, resendId: json?.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), resendId: null };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflightRequest(req);
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' };

  // ─── Auth: admin only ──────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }
  const token = authHeader.replace('Bearer ', '').trim();
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }
  const { data: roles } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);
  if (!roles?.some((r: { role: string }) => r.role === 'admin')) {
    return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
      status: 403,
      headers,
    });
  }

  // ─── Parse + validate ──────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
  }

  const appointmentId =
    (body.appointment_id as string | undefined)?.trim?.() ||
    (body.appointmentId as string | undefined)?.trim?.() || '';
  const paymentMethod = (body.payment_method as string | undefined) ?? 'cash';
  const protocolData = (body.protocol_data as Record<string, unknown> | undefined) ?? {};

  if (!appointmentId) {
    return new Response(JSON.stringify({ error: 'appointment_id ist erforderlich' }), {
      status: 400,
      headers,
    });
  }

  // ─── Load appointment with related data ────────────────────────────────
  const { data: appointment, error: fetchError } = await supabaseAdmin
    .from('appointments')
    .select(`
      *,
      kitchens(*, seller:profiles!kitchens_seller_id_fkey(id, email, first_name, last_name, company_name)),
      purchase_stations(*),
      buyer:profiles!appointments_buyer_id_fkey(id, email, first_name, last_name, company_name)
    `)
    .eq('id', appointmentId)
    .single();

  if (fetchError || !appointment) {
    return new Response(
      JSON.stringify({ error: 'Termin nicht gefunden', details: fetchError?.message }),
      { status: 404, headers },
    );
  }

  const kitchen = appointment.kitchens ?? null;
  const seller: ProfileLite | null = kitchen?.seller ?? null;
  const buyer: ProfileLite | null = (appointment.buyer ?? null) as ProfileLite | null;
  const station = appointment.purchase_stations ?? null;

  let paymentAmount = Number(body.payment_amount ?? kitchen?.instant_price ?? 0);
  if (!paymentAmount || isNaN(paymentAmount) || paymentAmount <= 0) {
    return new Response(
      JSON.stringify({ error: 'payment_amount muss > 0 sein (oder kitchen.instant_price gesetzt sein)' }),
      { status: 400, headers },
    );
  }

  const vehicleTitle = kitchen
    ? `${kitchen.manufacturer ?? ''} ${kitchen.model ?? ''}`.trim() || 'Fahrzeug'
    : 'Fahrzeug';
  const yearSuffix = kitchen?.year ? ` (${kitchen.year})` : '';

  // ─── Best-effort generate PDF protocol ─────────────────────────────────
  let protocolUrl: string | null = null;
  try {
    const pdfResponse = await supabaseAdmin.functions.invoke('generate-handover-pdf', {
      body: { appointment_id: appointmentId },
    });
    if (!pdfResponse.error && pdfResponse.data?.protocol_url) {
      protocolUrl = pdfResponse.data.protocol_url;
    }
  } catch (pdfError) {
    edgeLogger.error('generate-handover-pdf failed', pdfError);
  }

  // ─── Step 1: update appointment (idempotent) ───────────────────────────
  const { data: updatedAppointment, error: updateError } = await supabaseAdmin
    .from('appointments')
    .update({
      status: 'completed',
      payment_method: paymentMethod,
      payment_amount: paymentAmount,
      payment_status: 'completed',
      handover_protocol_url: protocolUrl,
    })
    .eq('id', appointmentId)
    .in('status', ['scheduled', 'verified'])
    .select()
    .single();

  if (updateError) {
    if (updateError.code === 'PGRST116') {
      return new Response(
        JSON.stringify({
          error: 'Termin wurde bereits abgeschlossen oder ist nicht im erwarteten Status',
        }),
        { status: 409, headers },
      );
    }
    return new Response(
      JSON.stringify({ error: 'Termin konnte nicht aktualisiert werden', details: updateError.message }),
      { status: 500, headers },
    );
  }

  // ─── Step 2: mark kitchen as sold (preserve existing sale_type) ──────
  const existingSaleType = kitchen?.sale_type;
  const { error: kitchenError } = await supabaseAdmin
    .from('kitchens')
    .update({
      status: 'sold',
      sold_to: appointment.buyer_id || null,
      sold_at: new Date().toISOString(),
      sale_type: existingSaleType || 'handover',
    })
    .eq('id', appointment.kitchen_id);

  if (kitchenError) {
    edgeLogger.error('kitchen sold update failed', kitchenError);
  }

  // ─── Step 3: send buyer + seller confirmation emails ───────────────────
  let buyerMailSent = false;
  let buyerMailError: string | null = null;
  let sellerMailSent = false;
  let sellerMailError: string | null = null;
  const emailErrors: Array<{ recipient: string; error: string }> = [];

  const { data: settingsRow } = await supabaseAdmin.from('site_settings').select('*').single();
  const settings: SettingsLike = (settingsRow as SettingsLike | null) ?? fallbackSettings;

  const handoverDate = new Date(updatedAppointment?.appointment_date ?? Date.now());
  const handoverDateStr = handoverDate.toLocaleDateString('de-DE');
  const handoverTimeStr = updatedAppointment?.appointment_time ?? '';

  const commonDetails = `
    ${detailRow('Fahrzeug', `${vehicleTitle}${yearSuffix}`)}
    ${detailRow('Übergabedatum', `${handoverDateStr}${handoverTimeStr ? ` ${handoverTimeStr}` : ''}`)}
    ${detailRow('Station', station?.name ?? '—')}
    ${detailRow('Kaufpreis', formatEur(paymentAmount))}
    ${detailRow('Zahlungsart', paymentMethodLabel(paymentMethod))}
  `;

  // ── Buyer mail ─────────────────────────────────────────────────────────
  if (buyer?.email) {
    const subject = `Übergabe abgeschlossen – ${vehicleTitle}`;
    const content = `
      ${greeting(displayName(buyer))}
      ${paragraph(`die Übergabe Ihres Fahrzeugs <strong>${vehicleTitle}${yearSuffix}</strong> wurde an unserer Ankaufstation erfolgreich abgeschlossen. Ab sofort sind Sie Eigentümer des Fahrzeugs.`)}
      ${infoBox('Übergabedetails', commonDetails, 'success')}
      ${protocolUrl ? button('Übergabeprotokoll herunterladen', protocolUrl) : paragraph('Das Übergabeprotokoll erhalten Sie auf Wunsch von der Station ausgehändigt.')}
      ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settings.contact_email}" style="color:#1f8aa2;">${settings.contact_email}</a> oder telefonisch unter ${settings.support_phone}.`)}
      ${paragraph('Wir wünschen Ihnen allzeit gute Fahrt und viel Freude mit Ihrem Wohnmobil!')}
    `;
    const html = buildEmailLayout(settings, subject, content);
    const result = await sendMail(buyer.email, subject, html, settings);
    buyerMailSent = result.ok;
    buyerMailError = result.error;
    if (result.ok) {
      try {
        await supabaseAdmin.from('admin_emails').insert({
          sender_email: 'info@kuechenwert24.de',
          sender_name: settings.site_name,
          recipient_email: buyer.email,
          recipient_name: displayName(buyer),
          recipient_id: buyer.id,
          subject,
          body_html: html,
          body_text: html.replace(/<[^>]*>/g, ''),
          email_type: 'handover_completed_buyer',
          direction: 'outbound',
          status: 'sent',
          resend_id: result.resendId,
          sent_by: user.id,
          is_read: true,
        });
      } catch (e) {
        edgeLogger.error('admin_emails insert failed (buyer)', e);
      }
    } else {
      emailErrors.push({ recipient: `buyer:${buyer.email}`, error: result.error ?? 'unknown' });
    }
  }

  // ── Seller mail ────────────────────────────────────────────────────────
  if (seller?.email) {
    const subject = `Verkauf abgeschlossen – ${vehicleTitle}`;
    const content = `
      ${greeting(displayName(seller))}
      ${paragraph(`die Übergabe Ihres Fahrzeugs <strong>${vehicleTitle}${yearSuffix}</strong> wurde an unserer Ankaufstation erfolgreich abgeschlossen. Damit ist der Verkaufsprozess für Sie beendet.`)}
      ${infoBox('Übergabedetails', commonDetails, 'success')}
      ${protocolUrl ? button('Übergabeprotokoll herunterladen', protocolUrl) : ''}
      ${paragraph(`Die Auszahlung erfolgt gemäß der gewählten Zahlungsart (${paymentMethodLabel(paymentMethod)}). Sie erhalten in Kürze eine separate Bestätigung über die Abrechnung.`)}
      ${paragraph(`Vielen Dank für Ihr Vertrauen in <a href="${SITE_URL}" style="color:#1f8aa2;">${settings.site_name}</a>!`)}
    `;
    const html = buildEmailLayout(settings, subject, content);
    const result = await sendMail(seller.email, subject, html, settings);
    sellerMailSent = result.ok;
    sellerMailError = result.error;
    if (result.ok) {
      try {
        await supabaseAdmin.from('admin_emails').insert({
          sender_email: 'info@kuechenwert24.de',
          sender_name: settings.site_name,
          recipient_email: seller.email,
          recipient_name: displayName(seller),
          recipient_id: seller.id,
          subject,
          body_html: html,
          body_text: html.replace(/<[^>]*>/g, ''),
          email_type: 'handover_completed_seller',
          direction: 'outbound',
          status: 'sent',
          resend_id: result.resendId,
          sent_by: user.id,
          is_read: true,
        });
      } catch (e) {
        edgeLogger.error('admin_emails insert failed (seller)', e);
      }
    } else {
      emailErrors.push({ recipient: `seller:${seller.email}`, error: result.error ?? 'unknown' });
    }
  }

  if (emailErrors.length > 0) {
    await logEdgeError(supabaseAdmin, {
      component: 'complete-handover',
      message: `Handover completed but ${emailErrors.length} email(s) failed`,
      severity: 'high',
      category: 'email',
      userId: user.id,
      metadata: { appointmentId, vehicleTitle, emailErrors },
    });
  }

  // ─── Step 4: audit log ─────────────────────────────────────────────────
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'handover_completed',
      entity_type: 'appointment',
      entity_id: appointmentId,
      details: {
        vehicle_title: vehicleTitle,
        kitchen_id: appointment.kitchen_id,
        seller_id: kitchen?.seller_id ?? null,
        buyer_id: appointment.buyer_id ?? null,
        station_id: appointment.station_id ?? null,
        station_name: station?.name ?? null,
        payment_method: paymentMethod,
        payment_amount: paymentAmount,
        protocol_url: protocolUrl,
        notes: protocolData.notes ?? null,
        buyer_mail_sent: buyerMailSent,
        buyer_mail_error: buyerMailError,
        seller_mail_sent: sellerMailSent,
        seller_mail_error: sellerMailError,
      },
    });
  } catch (e) {
    edgeLogger.error('audit_logs insert failed', e);
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Übergabe erfolgreich abgeschlossen',
      protocol_url: protocolUrl,
      buyerMailSent,
      buyerMailError,
      sellerMailSent,
      sellerMailError,
      emailErrors,
    }),
    { status: 200, headers },
  );
});
