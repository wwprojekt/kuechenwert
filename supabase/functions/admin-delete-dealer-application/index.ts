import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import {
  buildEmailLayout,
  paragraph,
  greeting,
  infoBox,
  detailRow,
} from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { edgeLogger, logEdgeError } from '../_shared/edgeLogger.ts';

/**
 * Edge Function: admin-delete-dealer-application
 *
 * Atomic admin action that deletes a dealer application AND informs the
 * applicant by email. Replaces `deleteDealerApplication` (lib/dealerApplications.ts)
 * which silently dropped the row.
 *
 * Body:
 *   { applicationId: string,
 *     reason?: string,
 *     sendEmail?: boolean }
 *
 * Behavior:
 *   - Loads application + applicant profile
 *   - Composes a polite withdrawal/deletion notice (incl. optional reason)
 *   - Deletes the row from dealer_applications
 *   - Sends the email + writes admin_emails entry
 *   - Audit log + persistent error_logs on email failure
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

interface RequestBody {
  applicationId: string;
  reason?: string | null;
  sendEmail?: boolean;
}

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

function displayName(p: ProfileLite | null | undefined, fallback?: string): string {
  if (!p) return fallback ?? '';
  return p.company_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || (p.email?.split('@')[0] ?? '') || fallback || '';
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
      return { ok: false, error: `${res.status}: ${(await res.text()).slice(0, 200)}`, resendId: null };
    }
    const json = await res.json();
    return { ok: true, error: null, resendId: json?.id ?? null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), resendId: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflightRequest(req);
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }

  // ─── Auth: admin only ──────────────────────────────────────────────────
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers });
  }
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  }
  const { data: roles } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);
  if (!roles?.some((r: { role: string }) => r.role === 'admin')) {
    return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), { status: 403, headers });
  }

  // ─── Parse + validate ──────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
  }
  const applicationId = body.applicationId?.trim();
  const reason = body.reason?.trim() || null;
  const sendEmail = body.sendEmail !== false;

  if (!applicationId) {
    return new Response(JSON.stringify({ error: 'applicationId ist erforderlich' }), { status: 400, headers });
  }

  // ─── Load application + applicant ──────────────────────────────────────
  const { data: application, error: appErr } = await supabaseAdmin
    .from('dealer_applications')
    .select('*')
    .eq('id', applicationId)
    .single();
  if (appErr || !application) {
    return new Response(
      JSON.stringify({ error: 'Bewerbung nicht gefunden', details: appErr?.message }),
      { status: 404, headers },
    );
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, email, first_name, last_name, company_name')
    .eq('id', application.user_id)
    .maybeSingle();

  const recipientName = displayName(profile, application.contact_person_name || application.company_name);

  // ─── Step 1: delete the application row ────────────────────────────────
  const { error: delErr } = await supabaseAdmin
    .from('dealer_applications')
    .delete()
    .eq('id', applicationId);
  if (delErr) {
    edgeLogger.error('dealer application delete failed', delErr);
    return new Response(
      JSON.stringify({ error: 'Bewerbung konnte nicht gelöscht werden', details: delErr.message }),
      { status: 500, headers },
    );
  }

  // ─── Step 2: send notification email ───────────────────────────────────
  let mailSent = false;
  let mailError: string | null = null;
  const recipientEmail = profile?.email ?? null;

  if (sendEmail && recipientEmail) {
    const { data: settingsRow } = await supabaseAdmin.from('site_settings').select('*').single();
    const settings: SettingsLike = (settingsRow as SettingsLike | null) ?? fallbackSettings;

    const subject = `Ihre Händlerbewerbung wurde zurückgezogen – ${application.company_name ?? settings.site_name}`;
    const content = `
      ${greeting(recipientName)}
      ${paragraph(`wir möchten Sie informieren, dass Ihre Händlerbewerbung bei <strong>${settings.site_name}</strong> aus unserem System entfernt wurde.`)}
      ${infoBox('Ihre Bewerbung', `
        ${detailRow('Firma', application.company_name ?? '—')}
        ${detailRow('Status zum Zeitpunkt der Löschung', application.status === 'pending' ? 'In Prüfung' : application.status === 'approved' ? 'Genehmigt' : application.status === 'rejected' ? 'Abgelehnt' : application.status ?? '—')}
        ${application.submitted_at ? detailRow('Eingereicht am', new Date(application.submitted_at).toLocaleDateString('de-DE')) : ''}
      `, 'warning')}
      ${reason ? infoBox('Grund', paragraph(reason), 'info') : ''}
      ${paragraph(`Falls Sie weiterhin Interesse an einem Händlerkonto bei ${settings.site_name} haben, können Sie jederzeit eine neue Bewerbung einreichen.`)}
      ${paragraph(`Bei Fragen erreichen Sie uns unter <a href="mailto:${settings.contact_email}" style="color:#1f8aa2;">${settings.contact_email}</a> oder telefonisch unter ${settings.support_phone}.`)}
    `;

    const html = buildEmailLayout(settings, subject, content);
    const result = await sendMail(recipientEmail, subject, html, settings);
    mailSent = result.ok;
    mailError = result.error;

    if (result.ok) {
      try {
        await supabaseAdmin.from('admin_emails').insert({
          sender_email: 'info@kuechenwert24.de',
          sender_name: settings.site_name,
          recipient_email: recipientEmail,
          recipient_name: recipientName,
          recipient_id: profile?.id ?? null,
          subject,
          body_html: html,
          body_text: html.replace(/<[^>]*>/g, ''),
          email_type: 'dealer_application_deleted',
          direction: 'outbound',
          status: 'sent',
          resend_id: result.resendId,
          sent_by: user.id,
          is_read: true,
        });
      } catch (e) {
        edgeLogger.error('admin_emails insert failed', e);
      }
    } else {
      await logEdgeError(supabaseAdmin, {
        component: 'admin-delete-dealer-application',
        message: `Application deleted but email failed: ${result.error}`,
        severity: 'high',
        category: 'email',
        userId: user.id,
        metadata: { applicationId, recipientEmail, error: result.error },
      });
    }
  }

  // ─── Step 3: audit log ─────────────────────────────────────────────────
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'dealer_application_deleted',
      entity_type: 'dealer_application',
      entity_id: applicationId,
      details: {
        company_name: application.company_name,
        applicant_user_id: application.user_id,
        applicant_email: recipientEmail,
        previous_status: application.status,
        reason,
        mail_sent: mailSent,
        mail_error: mailError,
        send_email_requested: sendEmail,
      },
    });
  } catch (e) {
    edgeLogger.error('audit_logs insert failed', e);
  }

  return new Response(
    JSON.stringify({
      success: true,
      applicationId,
      companyName: application.company_name,
      mailSent,
      mailError,
      message: 'Händlerbewerbung wurde gelöscht',
    }),
    { status: 200, headers },
  );
});
