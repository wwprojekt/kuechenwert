import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, paragraph, greeting, button, infoBox, detailRow, list } from '../_shared/email-builder.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Inaktivitäts-E-Mail – wird per Cron-Job wöchentlich aufgerufen.
 *
 * ZWEI Stufen:
 * 1. "Erste-Schritte" Nudge: 3 Tage nach Genehmigung, wenn noch kein Gebot (email_type: 'dealer_first_nudge')
 * 2. Langzeit-Inaktivität: 30+ Tage ohne Gebot (email_type: 'inactivity') – wie bisher
 *
 * Anti-Spam: Jede Stufe wird max. 1x gesendet. Opt-out wird respektiert.
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
      .select('user_id, company_name, created_at, status_changed_at')
      .eq('status', 'approved');

    if (dealerError) throw new Error(`Dealer fetch error: ${dealerError.message}`);
    if (!dealers || dealers.length === 0) {
      return new Response(JSON.stringify({ message: "No dealers found", count: 0 }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

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

    // Get bid counts for auction display
    const auctionBidCounts: Record<string, number> = {};
    if (activeAuctions) {
      for (const a of activeAuctions) {
        const { count } = await supabase
          .from('bids')
          .select('id', { count: 'exact', head: true })
          .eq('auction_id', a.id);
        auctionBidCounts[a.id] = count || 0;
      }
    }

    // Fetch site settings
    const { data: settings } = await supabase.from('site_settings').select('*').single();
    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'info@caravanwert.de',
      support_phone: '+49 511 51532476',
    };

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    let firstNudgeSent = 0;

    for (const dealer of dealers) {
      try {
        if (!dealer.user_id) continue;

        // Get profile + opt-out check
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, email, broadcast_emails_enabled')
          .eq('id', dealer.user_id)
          .single();

        if (!profile?.email) continue;
        if (profile.broadcast_emails_enabled === false) {
          skipped++;
          continue;
        }

        // Check if dealer has EVER bid
        const { data: anyBids } = await supabase
          .from('bids')
          .select('id')
          .eq('bidder_id', dealer.user_id)
          .limit(1);

        const hasEverBid = anyBids && anyBids.length > 0;
        const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');

        // ── STUFE 1: First-Nudge (3 Tage nach Approval, nie geboten) ────
        if (!hasEverBid) {
          const approvedAt = new Date(dealer.status_changed_at || dealer.created_at);
          const daysSinceApproval = (Date.now() - approvedAt.getTime()) / (1000 * 60 * 60 * 24);

          if (daysSinceApproval >= 3 && daysSinceApproval < 30) {
            // Check if first nudge was already sent
            const { data: existingNudge } = await supabase
              .from('admin_emails')
              .select('id')
              .eq('recipient_email', profile.email)
              .eq('email_type', 'dealer_first_nudge')
              .limit(1);

            if (!existingNudge || existingNudge.length === 0) {
              // Build first nudge email
              let auctionPreview = '';
              if (activeAuctions && activeAuctions.length > 0) {
                const items = activeAuctions.slice(0, 3).map((a: any) => {
                  const m = a.motorhomes;
                  const price = typeof a.current_bid === 'number'
                    ? a.current_bid.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })
                    : `${a.current_bid || 0} €`;
                  const bids = auctionBidCounts[a.id] || 0;
                  return `<strong>${m.manufacturer} ${m.model} (${m.year})</strong> &ndash; ${price} &middot; ${bids} Gebote`;
                });
                auctionPreview = list(items);
              }

              const nudgeSubject = `${settingsData.site_name}: ${activeAuctions?.length || 0} Auktionen warten auf Ihr erstes Gebot`;
              const nudgeContent = `
                ${greeting(name || dealer.company_name || undefined)}
                ${paragraph(`Sie sind seit ein paar Tagen als H&auml;ndler bei <strong>${settingsData.site_name}</strong> freigeschaltet &ndash; wunderbar!`)}
                ${paragraph(`Aktuell laufen <strong>${activeAuctions?.length || 0} Auktionen</strong> auf unserer Plattform. Hier sind einige Highlights:`)}
                ${activeAuctions && activeAuctions.length > 0 ? infoBox('Aktuelle Top-Auktionen', auctionPreview, 'info', settingsData) : ''}
                ${infoBox('So einfach geht\u0027s', `
                  ${list([
                    '<strong>Einloggen</strong> unter <a href="https://caravanwert.de/login" style="color: #1f8aa2;">caravanwert.de/login</a>',
                    '<strong>Auktion ausw&auml;hlen</strong> &ndash; Klicken Sie auf ein Fahrzeug das Sie interessiert',
                    '<strong>Gebot abgeben</strong> &ndash; Geben Sie Ihren Wunschpreis ein und klicken Sie auf &quot;Bieten&quot;',
                    '<strong>Fertig!</strong> Sie werden per E-Mail informiert wenn sich etwas &auml;ndert',
                  ])}
                `, 'default', settingsData)}
                ${button('Jetzt erstes Gebot abgeben', 'https://caravanwert.de/kaufen', settingsData)}
                ${paragraph(`<strong>Tipp:</strong> Sie k&ouml;nnen auch ein <strong>Auto-Bid</strong> setzen &ndash; dann bietet das System automatisch f&uuml;r Sie mit bis zu Ihrem H&ouml;chstbetrag.`)}
                ${paragraph('<span style="font-size: 12px; color: #6b7280;">Sie erhalten diese einmalige E-Mail als frisch freigeschalteter H&auml;ndler. <a href="https://caravanwert.de/dashboard/profile" style="color: #1f8aa2;">Benachrichtigungen anpassen</a></span>')}
              `;

              const nudgeHtml = buildEmailLayout(settingsData, nudgeSubject, nudgeContent);

              const emailResponse = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                  from: `${settingsData.site_name} <info@caravanwert.de>`,
                  to: [profile.email],
                  subject: nudgeSubject,
                  html: nudgeHtml,
                  reply_to: 'info@caravanwert.de',
                  headers: { 'List-Unsubscribe': '<https://caravanwert.de/dashboard/profile>' },
                }),
              });

              if (emailResponse.ok) {
                const resendResult = await emailResponse.json();
                await supabase.from('admin_emails').insert({
                  sender_email: 'info@caravanwert.de',
                  sender_name: settingsData.site_name,
                  recipient_email: profile.email,
                  recipient_name: name || null,
                  recipient_id: dealer.user_id,
                  subject: nudgeSubject,
                  body_html: nudgeContent,
                  email_type: 'dealer_first_nudge',
                  direction: 'outbound',
                  status: 'sent',
                  resend_id: resendResult.id,
                  is_read: true,
                });
                firstNudgeSent++;
              } else {
                const errText = await emailResponse.text();
                console.error(`First nudge email failed for ${profile.email}:`, errText);
                failed++;
              }
              continue; // Don't also send inactivity email
            }
          }
        }

        // ── STUFE 2: Langzeit-Inaktivität (30+ Tage) ───────────────────
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

        const subject = `${activeAuctions?.length || 0} aktuelle Auktionen bei ${settingsData.site_name}`;
        const emailContent = `
          ${greeting(name || undefined)}
          ${paragraph(`Es ist eine Weile her, seit Sie zuletzt bei <strong>${settingsData.site_name}</strong> aktiv waren. Aktuell laufen <strong>${activeAuctions?.length || 0} Auktionen</strong> &ndash; hier ein &Uuml;berblick:`)}
          ${activeAuctions && activeAuctions.length > 0 ? infoBox('Aktuelle Auktionen', auctionList, 'info', settingsData) : ''}
          ${paragraph('Die Konkurrenz ist gering &ndash; Ihre Chancen auf ein Schn&auml;ppchen stehen gut!')}
          ${button('Auktionen entdecken', 'https://caravanwert.de/kaufen', settingsData)}
          ${paragraph('<span style="font-size: 12px; color: #6b7280;">Sie erhalten diese E-Mail, weil Sie als H&auml;ndler bei ' + settingsData.site_name + ' registriert sind. <a href="https://caravanwert.de/dashboard/profile" style="color: #1f8aa2;">Abmelden</a></span>')}
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
              'List-Unsubscribe': '<https://caravanwert.de/dashboard/profile>',
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
      message: `Inactivity emails: sent=${sent}, firstNudge=${firstNudgeSent}, failed=${failed}, skipped=${skipped}`,
      sent,
      firstNudgeSent,
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
