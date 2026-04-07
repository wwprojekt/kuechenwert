import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, paragraph, greeting, button, infoBox, detailRow, list } from '../_shared/email-builder.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Inaktivitäts-E-Mail – wird per Cron-Job wöchentlich aufgerufen.
 * Sendet Händlern, die 30+ Tage nicht geboten haben, eine Erinnerung
 * mit aktuellen Auktionen.
 */

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    });
  }

  // ─── Auth check: must be service_role (cron/internal) or authenticated admin ───
  const authResult = await checkServiceRoleOrAdmin(req, { 'Content-Type': 'application/json' });
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find approved dealers
    const { data: dealers, error: dealerError } = await supabase
      .from('dealer_applications')
      .select('user_id, company_name')
      .eq('status', 'approved');

    if (dealerError) throw new Error(`Dealer fetch error: ${dealerError.message}`);
    if (!dealers || dealers.length === 0) {
      return new Response(JSON.stringify({ message: "No dealers found", count: 0 }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get active auctions for recommendations
    const { data: activeAuctions } = await supabase
      .from('auctions')
      .select(`
        id, current_bid, end_time,
        motorhomes (manufacturer, model, year)
      `)
      .eq('status', 'active')
      .order('end_time', { ascending: true })
      .limit(5);

    // Fetch site settings
    const { data: settings } = await supabase.from('site_settings').select('*').single();
    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'kontakt@caravanwert.de',
      support_phone: '+49 511 51532476',
    };

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const dealer of dealers) {
      try {
        if (!dealer.user_id) continue;

        // Check if dealer has bid in the last 30 days
        const { data: recentBids } = await supabase
          .from('bids')
          .select('id')
          .eq('bidder_id', dealer.user_id)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .limit(1);

        if (recentBids && recentBids.length > 0) {
          skipped++;
          continue; // Dealer is active, skip
        }

        // Check if we already sent an inactivity email in the last 30 days
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', dealer.user_id)
          .single();

        if (!profile?.email) continue;

        const { data: recentReminder } = await supabase
          .from('admin_emails')
          .select('id')
          .eq('recipient_email', profile.email)
          .eq('email_type', 'inactivity')
          .gte('created_at', thirtyDaysAgo.toISOString())
          .limit(1);

        if (recentReminder && recentReminder.length > 0) {
          skipped++;
          continue; // Already reminded recently
        }

        // Check broadcast opt-out
        const { data: prefs } = await supabase
          .from('profiles')
          .select('broadcast_emails_enabled')
          .eq('id', dealer.user_id)
          .single();

        if (prefs && prefs.broadcast_emails_enabled === false) {
          skipped++;
          continue;
        }

        const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');

        // Build auction recommendations
        let auctionList = '';
        if (activeAuctions && activeAuctions.length > 0) {
          const items = activeAuctions.map((a: any) => {
            const m = a.motorhomes;
            const price = typeof a.current_bid === 'number'
              ? a.current_bid.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
              : `${a.current_bid || 0} €`;
            return `<strong>${m.manufacturer} ${m.model} (${m.year})</strong> &ndash; aktuell ${price}`;
          });
          auctionList = list(items);
        }

        const subject = `Wir vermissen Sie! Aktuelle Auktionen bei ${settingsData.site_name}`;
        const emailContent = `
          ${greeting(name || undefined)}
          ${paragraph(`Es ist eine Weile her, seit Sie zuletzt bei <strong>${settingsData.site_name}</strong> aktiv waren. Wir m&ouml;chten Sie auf einige interessante Auktionen aufmerksam machen:`)}
          ${activeAuctions && activeAuctions.length > 0 ? infoBox('Aktuelle Auktionen', auctionList, 'info', settingsData) : ''}
          ${paragraph('Verpassen Sie nicht die Chance auf attraktive Fahrzeuge zu g&uuml;nstigen Preisen!')}
          ${button('Auktionen entdecken', 'https://caravanwert.de/auktionen', settingsData)}
          ${paragraph('<span style="font-size: 12px; color: #6b7280;">Sie erhalten diese E-Mail, weil Sie als H&auml;ndler bei ${settingsData.site_name} registriert sind. <a href="https://caravanwert.de/unsubscribe" style="color: #1f8aa2;">Abmelden</a></span>')}
        `;

        const html = buildEmailLayout(settingsData, subject, emailContent);

        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: `${settingsData.site_name} <info@caravanwert.de>`,
            to: [profile.email],
            subject,
            html,
            reply_to: 'info@caravanwert.de',
            headers: {
              'List-Unsubscribe': '<https://caravanwert.de/unsubscribe>',
            },
          }),
        });

        if (!emailResponse.ok) {
          const error = await emailResponse.text();
          throw new Error(error);
        }

        const resendResult = await emailResponse.json();

        // Log in admin_emails
        await supabase.from('admin_emails').insert({
          sender_email: 'info@caravanwert.de',
          sender_name: settingsData.site_name,
          recipient_email: profile.email,
          recipient_name: name || null,
          recipient_id: dealer.user_id,
          subject,
          body_html: emailContent,
          email_type: 'inactivity',
          direction: 'outbound',
          status: 'sent',
          resend_id: resendResult.id,
          is_read: true,
        });

        sent++;
      } catch (err: any) {
        console.error(`Failed to send inactivity email to dealer ${dealer.user_id}:`, err.message);
        failed++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Inactivity emails: sent=${sent}, failed=${failed}, skipped=${skipped}`,
      sent,
      failed,
      skipped,
    }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in inactivity email:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

serve(handler);
