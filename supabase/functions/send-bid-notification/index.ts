import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, detailRow, paragraph, customerBadge, auctionEmailCard, pickPrimaryPhotoUrl, button } from '../_shared/email-builder.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';
import { deferIfQuiet } from '../_shared/quiet-hours.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface BidNotificationRequest {
  bidderId: string;
  auctionId: string;
  bidAmount: number;
  isOutbid: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);
  const auth = await checkServiceRoleOrAdmin(req, corsHeaders);
  if (!auth.authorized) return auth.response;

  try {
    const { bidderId, auctionId, bidAmount, isOutbid }: BidNotificationRequest = await req.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ─── Notification-Preferences: Opt-out für Outbid-Mails ───
    // Strikte Opt-out-Semantik:
    // - Kein Pref-Row vorhanden → senden (Bestand-User-Schutz)
    // - prefs.email_outbid !== false → senden
    // - prefs.email_outbid === false → skip
    // Bei Query-Fehler defaulten wir auf SENDEN (Outage darf nicht still
    // unterdrücken). Nur der Outbid-Pfad wird gefiltert; "Gebot bestätigt"
    // bleibt unangetastet (transactional).
    let outbidDeferUntil: Date | null = null;

    if (isOutbid) {
      const { data: prefs, error: prefsError } = await supabase
        .from('user_notification_preferences')
        .select('email_outbid, quiet_hours_start, quiet_hours_end')
        .eq('user_id', bidderId)
        .maybeSingle();

      if (prefsError) {
        console.error('[send-bid-notification] prefs query failed, defaulting to SEND:', prefsError);
      } else if (prefs && prefs.email_outbid === false) {
        console.log(`[send-bid-notification] skipped outbid mail for ${bidderId} (opted out)`);
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'opted_out_email_outbid' }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
        );
      } else if (prefs) {
        // bid_outbid ist NICHT in der Transactional-Whitelist → Quiet Hours gelten.
        outbidDeferUntil = deferIfQuiet(
          { quiet_hours_start: prefs.quiet_hours_start, quiet_hours_end: prefs.quiet_hours_end },
          'bid_outbid'
        );
      }
    }

    // Fetch bidder profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, first_name, last_name, customer_number')
      .eq('id', bidderId)
      .single();

    if (!profile?.email) {
      throw new Error('Bidder email not found');
    }

    // Fetch auction details
    const { data: auction } = await supabase
      .from('auctions')
      .select(`
        *,
        kitchen:kitchens(
          manufacturer, model, year, mileage, city,
          photos:kitchen_photos(url, display_order)
        )
      `)
      .eq('id', auctionId)
      .single();

    if (!auction) {
      throw new Error('Auction not found');
    }

    const mhRaw = auction.kitchen as Record<string, unknown> | null | undefined;
    const mh = Array.isArray(mhRaw) ? mhRaw[0] : mhRaw;
    if (!mh || typeof mh !== 'object') {
      throw new Error('Kitchen not found');
    }

    // Fetch site settings
    const { data: settings } = await supabase
      .from('site_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    const settingsData = settings || {
      site_name: 'KuechenWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'info@kuechenwert.de',
      support_phone: '0511 / 51532476',
    };

    const m = mh as {
      manufacturer?: string | null;
      model?: string | null;
      year?: number | null;
      mileage?: number | null;
      city?: string | null;
      photos?: unknown;
    };
    const kitchenName = `${m.manufacturer || ''} ${m.model || ''}`.trim() || 'Fahrzeug';
    const vehicleTitle = `${m.manufacturer || '?'} ${m.model || ''} (${m.year ?? '–'})`.trim();
    const userName = profile.first_name || profile.email.split('@')[0];
    const auctionUrl = `https://kuechenwert24.de/auktion/${auctionId}`;
    const photoUrl = pickPrimaryPhotoUrl(m.photos);
    const highBid = auction.current_bid != null
      ? `€${Number(auction.current_bid).toLocaleString('de-DE')}`
      : '—';
    const endsAt = new Date(auction.end_time).toLocaleString('de-DE');
    const outbidDetails =
      `${detailRow('Ihr Gebot', `€${bidAmount.toLocaleString('de-DE')}`)}` +
      `${detailRow('Aktuelles Höchstgebot', highBid)}` +
      `${detailRow('Auktionsende', endsAt)}` +
      (m.mileage != null ? `${detailRow('Kilometerstand', `${Number(m.mileage).toLocaleString('de-DE')} km`)}` : '') +
      (m.city ? `${detailRow('Standort', String(m.city))}` : '');
    const confirmDetails =
      `${detailRow('Ihr Gebot', `€${bidAmount.toLocaleString('de-DE')}`)}` +
      `${detailRow('Status', 'Sie sind derzeit Höchstbietender')}` +
      `${detailRow('Auktionsende', endsAt)}` +
      (m.mileage != null ? `${detailRow('Kilometerstand', `${Number(m.mileage).toLocaleString('de-DE')} km`)}` : '') +
      (m.city ? `${detailRow('Standort', String(m.city))}` : '');

    // Build email content
    const content = isOutbid
      ? `
        ${paragraph(`Hallo ${userName},`)}
        ${customerBadge(profile.customer_number)}
        ${paragraph(`Sie wurden bei der Auktion für <strong>${kitchenName}</strong> überboten.`)}
        ${auctionEmailCard(auctionUrl, vehicleTitle, outbidDetails, photoUrl)}
        ${paragraph('Geben Sie ein höheres Gebot ab, um weiterhin im Rennen zu bleiben.')}
        ${button('Jetzt höher bieten', auctionUrl, settingsData)}
      `
      : `
        ${paragraph(`Hallo ${userName},`)}
        ${customerBadge(profile.customer_number)}
        ${paragraph(`Ihr Gebot für <strong>${kitchenName}</strong> wurde erfolgreich platziert!`)}
        ${auctionEmailCard(auctionUrl, vehicleTitle, confirmDetails, photoUrl)}
        ${paragraph('Behalten Sie die Auktion im Auge, um sicherzustellen, dass Sie Höchstbietender bleiben.')}
        ${button('Auktion ansehen', auctionUrl, settingsData)}
      `;

    const html = buildEmailLayout(
      settingsData,
      isOutbid ? 'Sie wurden überboten!' : 'Ihr Gebot wurde akzeptiert',
      content
    );
    const subject = isOutbid
      ? `Sie wurden überboten - ${kitchenName}`
      : `Gebot bestätigt - ${kitchenName}`;

    // Quiet-Hours-Deferral: nur Outbid-Mails werden verschoben. Bid-Confirmed
    // ist transactional (unmittelbare Bestaetigung der Aktion) und geht sofort.
    if (outbidDeferUntil) {
      const { error: queueErr } = await supabase.from('admin_emails').insert({
        sender_email: 'info@kuechenwert.de',
        sender_name: settingsData.site_name,
        recipient_email: profile.email,
        recipient_name: userName || null,
        subject,
        body_html: html,
        body_text: '',
        email_type: 'bid_outbid',
        direction: 'outbound',
        status: 'queued',
        scheduled_at: outbidDeferUntil.toISOString(),
        is_read: true,
      });
      if (queueErr) {
        console.error('[send-bid-notification] quiet-hours queue insert failed, falling back to immediate send:', queueErr);
      } else {
        return new Response(
          JSON.stringify({ success: true, queued: true, scheduled_at: outbidDeferUntil.toISOString() }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } }
        );
      }
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${settingsData.site_name} <info@kuechenwert.de>`,
        to: [profile.email],
        subject,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const result = await emailResponse.json();
    console.log(`Bid notification sent to ${profile.email}`);

    // Log in admin_emails for System tab
    try {
      await supabase.from('admin_emails').insert({
        sender_email: 'info@kuechenwert.de',
        sender_name: settingsData.site_name,
        recipient_email: profile.email,
        recipient_name: userName || null,
        subject,
        body_html: html,
        body_text: '',
        email_type: isOutbid ? 'bid_outbid' : 'bid_confirmed',
        direction: 'outbound',
        status: 'sent',
        resend_id: result?.id || null,
        is_read: true,
      });
    } catch (logErr) {
      console.error('Failed to log email in admin_emails:', logErr);
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  } catch (error: any) {
    console.error("Error in send-bid-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...getCorsHeaders(req) },
    });
  }
};

serve(handler);
