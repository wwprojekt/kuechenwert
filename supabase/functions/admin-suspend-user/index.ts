import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import {
  buildEmailLayout,
  paragraph,
  greeting,
  infoBox,
  warningBox,
} from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { edgeLogger, logEdgeError } from '../_shared/edgeLogger.ts';

/**
 * Edge Function: admin-suspend-user
 *
 * Atomic admin action that suspends or unsuspends a user account
 * (works for both regular users and dealers). Replaces the previous
 * client-side flows in
 *   - AdminUsers.toggleSuspendMutation
 *   - AdminDealers.suspendMutation
 *   - AdminDealerDetail.suspendMutation
 *   - UserEditDialog (suspend toggle inside save)
 * which all updated profiles.is_suspended without informing the user.
 *
 * Body:
 *   { userId: string,
 *     suspend: boolean,
 *     reason?: string,
 *     sendEmail?: boolean }
 *
 * On success returns mailSent + mailError so the caller can surface failures.
 */

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SITE_URL = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://kuechenwert24.de';

interface RequestBody {
  userId: string;
  suspend: boolean;
  reason?: string | null;
  sendEmail?: boolean;
}

interface ProfileLite {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  is_suspended: boolean | null;
}

interface SettingsLike {
  site_name: string;
  site_description: string;
  contact_email: string;
  support_phone: string;
}

const fallbackSettings: SettingsLike = {
  site_name: 'KuechenWert',
  site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
  contact_email: 'info@kuechenwert.de',
  support_phone: '+49 511 51532476',
};

function displayName(p: ProfileLite | null | undefined): string {
  if (!p) return '';
  return p.company_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || (p.email?.split('@')[0] ?? '');
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
        from: `${settings.site_name} <info@kuechenwert.de>`,
        to: [recipientEmail],
        subject,
        html,
        reply_to: 'info@kuechenwert.de',
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
  const targetUserId = body.userId?.trim();
  const suspend = !!body.suspend;
  const reason = body.reason?.trim() || (suspend ? 'Vom Administrator gesperrt' : null);
  const sendEmail = body.sendEmail !== false;

  if (!targetUserId) {
    return new Response(JSON.stringify({ error: 'userId ist erforderlich' }), { status: 400, headers });
  }

  // ─── Load target profile + roles (for messaging) ───────────────────────
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, email, first_name, last_name, company_name, is_suspended')
    .eq('id', targetUserId)
    .single();
  if (profileErr || !profile) {
    return new Response(
      JSON.stringify({ error: 'Profil nicht gefunden', details: profileErr?.message }),
      { status: 404, headers },
    );
  }

  // No-op early return if status already matches
  if (!!profile.is_suspended === suspend) {
    return new Response(
      JSON.stringify({
        success: true,
        userId: targetUserId,
        suspend,
        noChange: true,
        mailSent: false,
        mailError: null,
        message: suspend ? 'Konto war bereits gesperrt' : 'Konto war bereits aktiv',
      }),
      { status: 200, headers },
    );
  }

  const { data: targetRoles } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', targetUserId);
  const isDealer = !!targetRoles?.some((r: { role: string }) => r.role === 'dealer');

  // ─── Step 1: update profile ────────────────────────────────────────────
  const { error: updateErr } = await supabaseAdmin
    .from('profiles')
    .update({
      is_suspended: suspend,
      suspended_at: suspend ? new Date().toISOString() : null,
      suspended_reason: suspend ? reason : null,
      suspended_by: suspend ? user.id : null,
    })
    .eq('id', targetUserId);

  if (updateErr) {
    edgeLogger.error('profile suspend update failed', updateErr);
    return new Response(
      JSON.stringify({ error: 'Status konnte nicht geändert werden', details: updateErr.message }),
      { status: 500, headers },
    );
  }

  // ─── Step 2: send notification email ───────────────────────────────────
  let mailSent = false;
  let mailError: string | null = null;

  if (sendEmail && profile.email) {
    const { data: settingsRow } = await supabaseAdmin.from('site_settings').select('*').single();
    const settings: SettingsLike = (settingsRow as SettingsLike | null) ?? fallbackSettings;
    const subject = suspend
      ? (isDealer ? 'Ihr Händlerkonto wurde gesperrt' : 'Ihr Konto wurde gesperrt')
      : (isDealer ? 'Ihr Händlerkonto wurde wieder freigegeben' : 'Ihr Konto wurde wieder freigegeben');

    const accountLabel = isDealer ? 'Händlerkonto' : 'Konto';
    const content = suspend
      ? `
        ${greeting(displayName(profile))}
        ${paragraph(`wir möchten Sie darüber informieren, dass Ihr <strong>${accountLabel}</strong> bei ${settings.site_name} mit sofortiger Wirkung gesperrt wurde.`)}
        ${warningBox('Ein Login ist aktuell nicht möglich. Bestehende laufende Auktionen, Gebote oder Verkäufe sind während der Sperrung nicht zugänglich.')}
        ${reason ? infoBox('Grund der Sperrung', paragraph(reason), 'warning') : ''}
        ${paragraph(`Sollten Sie Fragen zur Sperrung haben oder eine Aufhebung beantragen wollen, kontaktieren Sie bitte unseren Support unter <a href="mailto:${settings.contact_email}" style="color:#1f8aa2;">${settings.contact_email}</a> oder telefonisch unter ${settings.support_phone}.`)}
      `
      : `
        ${greeting(displayName(profile))}
        ${paragraph(`gute Nachrichten: Ihr <strong>${accountLabel}</strong> bei ${settings.site_name} wurde wieder freigegeben. Sie können sich ab sofort wieder anmelden und alle Funktionen nutzen.`)}
        ${infoBox('Status', paragraph('<strong>Aktiv</strong> – Sperrung aufgehoben'), 'success')}
        ${paragraph(`Bei Rückfragen erreichen Sie uns unter <a href="mailto:${settings.contact_email}" style="color:#1f8aa2;">${settings.contact_email}</a>.`)}
        ${paragraph(`<a href="${SITE_URL}/login" style="color:#1f8aa2;">Jetzt einloggen →</a>`)}
      `;

    const html = buildEmailLayout(settings, subject, content);
    const result = await sendMail(profile.email, subject, html, settings);
    mailSent = result.ok;
    mailError = result.error;

    if (result.ok) {
      try {
        await supabaseAdmin.from('admin_emails').insert({
          sender_email: 'info@kuechenwert.de',
          sender_name: settings.site_name,
          recipient_email: profile.email,
          recipient_name: displayName(profile),
          recipient_id: profile.id,
          subject,
          body_html: html,
          body_text: html.replace(/<[^>]*>/g, ''),
          email_type: suspend ? 'account_suspended' : 'account_unsuspended',
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
        component: 'admin-suspend-user',
        message: `Suspend (${suspend}) succeeded but email failed: ${result.error}`,
        severity: 'high',
        category: 'email',
        userId: user.id,
        metadata: { targetUserId, suspend, recipientEmail: profile.email, error: result.error },
      });
    }
  }

  // ─── Step 3: audit log ─────────────────────────────────────────────────
  try {
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: suspend ? 'user_suspended' : 'user_unsuspended',
      entity_type: isDealer ? 'dealer' : 'user',
      entity_id: targetUserId,
      details: {
        target_user_id: targetUserId,
        target_email: profile.email,
        is_dealer: isDealer,
        previous_state: profile.is_suspended,
        new_state: suspend,
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
      userId: targetUserId,
      suspend,
      isDealer,
      mailSent,
      mailError,
      message: suspend ? 'Konto wurde gesperrt' : 'Konto wurde wieder freigegeben',
    }),
    { status: 200, headers },
  );
});
