import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { buildEmailLayout, paragraph, greeting, button, infoBox, detailRow, auctionEmailCard, pickPrimaryPhotoUrl } from '../_shared/email-builder.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';
import { deferIfQuiet } from '../_shared/quiet-hours.ts';

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Dealer Auction Digest – Cron-Job, täglich um 8:00 Uhr.
 *
 * Sendet genehmigten Händlern eine E-Mail mit:
 * - Neuen Auktionen (seit letztem Digest / letzte 24h)
 * - Bald endenden Auktionen (nächste 24h)
 * - Personalisierte Empfehlungen basierend auf Gebots-Historie
 *
 * Anti-Spam-Schutz:
 * - Maximal 1 Digest pro Tag pro Händler
 * - Nur wenn es tatsächlich neue/endende Auktionen gibt
 * - Opt-out via broadcast_emails_enabled = false
 * - Erstmaliger Versand 24h nach Genehmigung (nicht sofort, Approval-Email reicht)
 */

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    });
  }

  const authResult = await checkServiceRoleOrAdmin(req, { 'Content-Type': 'application/json' });
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch site settings
    const { data: settings } = await supabase.from('site_settings').select('*').single();
    const settingsData = settings || {
      site_name: 'CaravanWert',
      site_description: 'Deutschlands führende Wohnmobil-Handelsplattform',
      contact_email: 'info@caravanwert.de',
      support_phone: '+49 511 51532476',
    };

    // ── Fetch active auctions with details ─────────────────────────────
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: allActiveAuctions, error: auctionsError } = await supabase
      .from('auctions')
      .select(`
        id, current_bid, starting_bid, end_time, created_at,
        motorhomes!left (
          id, manufacturer, model, year, body_type, mileage, city, seller_id, sale_channel, instant_price,
          photos:motorhome_photos(url, display_order)
        )
      `)
      .eq('status', 'active')
      .order('end_time', { ascending: true });

    if (auctionsError) throw new Error(`Auctions fetch: ${auctionsError.message}`);
    if (!allActiveAuctions || allActiveAuctions.length === 0) {
      return new Response(JSON.stringify({ message: "No active auctions", sent: 0 }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // Categorize auctions
    const newAuctions = allActiveAuctions.filter(
      a => new Date(a.created_at) >= twentyFourHoursAgo
    );
    const endingSoonAuctions = allActiveAuctions.filter(
      a => new Date(a.end_time) <= twentyFourHoursFromNow && new Date(a.end_time) > now
    );

    // If nothing new and nothing ending soon, skip entirely
    if (newAuctions.length === 0 && endingSoonAuctions.length === 0) {
      return new Response(JSON.stringify({
        message: "No new or ending auctions, skipping digest",
        sent: 0,
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // ── Fetch approved dealers ──────────────────────────────────────────
    const { data: dealers, error: dealerError } = await supabase
      .from('dealer_applications')
      .select('user_id, company_name, created_at, status_changed_at')
      .eq('status', 'approved');

    if (dealerError) throw new Error(`Dealer fetch: ${dealerError.message}`);
    if (!dealers || dealers.length === 0) {
      return new Response(JSON.stringify({ message: "No approved dealers", sent: 0 }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    // Get bid counts per auction (for "X Gebote" display)
    const bidCounts: Record<string, number> = {};
    for (const auction of allActiveAuctions) {
      const { count } = await supabase
        .from('bids')
        .select('id', { count: 'exact', head: true })
        .eq('auction_id', auction.id);
      bidCounts[auction.id] = count || 0;
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const dealer of dealers) {
      try {
        if (!dealer.user_id) continue;

        // Skip dealers approved less than 24h ago (they just got the approval email)
        const approvedAt = dealer.status_changed_at || dealer.created_at;
        if (approvedAt && new Date(approvedAt) >= twentyFourHoursAgo) {
          skipped++;
          continue;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', dealer.user_id)
          .single();

        if (!profile?.email) continue;

        // Check opt-out via user_notification_preferences (inkl. Quiet Hours)
        const { data: prefs } = await supabase
          .from('user_notification_preferences')
          .select('broadcast_emails_enabled, quiet_hours_start, quiet_hours_end')
          .eq('user_id', dealer.user_id)
          .maybeSingle();

        if (prefs?.broadcast_emails_enabled === false) {
          skipped++;
          continue;
        }

        // Check: already sent digest today?
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { data: alreadySent } = await supabase
          .from('admin_emails')
          .select('id')
          .eq('recipient_email', profile.email)
          .eq('email_type', 'dealer_auction_digest')
          .gte('created_at', todayStart.toISOString())
          .limit(1);

        if (alreadySent && alreadySent.length > 0) {
          skipped++;
          continue;
        }

        // Get dealer's bid history for personalized recommendations
        const { data: dealerBids } = await supabase
          .from('bids')
          .select('auction_id')
          .eq('bidder_id', dealer.user_id);

        const bidAuctionIds = new Set((dealerBids || []).map(b => b.auction_id));

        // Exclude dealer's OWN auctions (where they are the seller)
        const isNotOwnAuction = (a: any) => !a.motorhomes?.seller_id || a.motorhomes.seller_id !== dealer.user_id;

        // Filter: auctions the dealer hasn't bid on yet (prioritize these)
        const unbidNewAuctions = newAuctions.filter(a => isNotOwnAuction(a) && !bidAuctionIds.has(a.id));
        const unbidEndingSoon = endingSoonAuctions.filter(a => isNotOwnAuction(a) && !bidAuctionIds.has(a.id));
        const biddedEndingSoon = endingSoonAuctions.filter(a => isNotOwnAuction(a) && bidAuctionIds.has(a.id));

        // Skip if nothing relevant for this dealer
        if (unbidNewAuctions.length === 0 && unbidEndingSoon.length === 0 && biddedEndingSoon.length === 0) {
          skipped++;
          continue;
        }

        const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ');

        // ── Build email content ─────────────────────────────────────────
        let emailContent = greeting(name || dealer.company_name || undefined);

        // Section 1: Auctions dealer is bidding on that end soon (URGENT)
        if (biddedEndingSoon.length > 0) {
          emailContent += infoBox(
            `⏰ ${biddedEndingSoon.length} Ihrer Auktionen ${biddedEndingSoon.length === 1 ? 'endet' : 'enden'} bald!`,
            (() => {
              const endingCards = biddedEndingSoon.slice(0, 3).map((a: any) => {
                const m = a.motorhomes;
                if (!m) return '';
                const auctionUrl = `https://caravanwert.de/auktion/${a.id}`;
                const title = `${m.manufacturer || '?'} ${m.model || ''} (${m.year ?? '–'})`.trim();
                const isFestpreis = m.sale_channel === 'instant_price';
                const price = isFestpreis ? formatPrice(m.instant_price) : formatPrice(a.current_bid || a.starting_bid);
                const timeLeft = getTimeRemaining(a.end_time);
                const bids = bidCounts[a.id] || 0;
                const details = isFestpreis
                  ? `${detailRow('Festpreis', `<strong style="color: #d97706;">${price}</strong>`)}` +
                    `${detailRow('Restzeit', `<strong style="color: #dc2626;">${timeLeft}</strong>`)}`
                  : `${detailRow('Aktuelles Gebot', `<strong style="color: #1f8aa2;">${price}</strong>`)}` +
                    `${detailRow('Gebote', `${bids}`)}` +
                    `${detailRow('Restzeit', `<strong style="color: #dc2626;">${timeLeft}</strong>`)}`;
                return auctionEmailCard(auctionUrl, title, details, pickPrimaryPhotoUrl(m.photos));
              }).join('');
              return endingCards;
            })(),
            'warning',
            settingsData
          );
          emailContent += button('Meine Gebote prüfen', 'https://caravanwert.de/dashboard', settingsData);
        }

        // Section 2: New auctions
        if (unbidNewAuctions.length > 0) {
          const displayAuctions = unbidNewAuctions.slice(0, 5);
          emailContent += paragraph(`<strong>🆕 ${unbidNewAuctions.length} neue Inserat${unbidNewAuctions.length > 1 ? 'e' : ''} seit gestern:</strong>`);

          for (const auction of displayAuctions) {
            const m = auction.motorhomes as any;
            if (!m) continue;
            const auctionUrl = `https://caravanwert.de/auktion/${auction.id}`;
            const title = `${m.manufacturer || '?'} ${m.model || ''} (${m.year ?? '–'})`.trim();
            const isFestpreis = m.sale_channel === 'instant_price';
            const price = isFestpreis ? formatPrice(m.instant_price) : formatPrice(auction.current_bid || auction.starting_bid);
            const timeLeft = getTimeRemaining(auction.end_time);
            const bids = bidCounts[auction.id] || 0;

            let details = isFestpreis
              ? `${detailRow('Festpreis', `<strong style="color: #d97706;">${price}</strong>`)}`
              : `${detailRow('Aktuelles Gebot', `<strong style="color: #1f8aa2;">${price}</strong>`)}`;
            if (!isFestpreis) details += `${detailRow('Gebote', `${bids}`)}`;
            details += `${detailRow('Endet in', timeLeft)}`;
            if (m.mileage) details += `${detailRow('Kilometerstand', `${Number(m.mileage).toLocaleString('de-DE')} km`)}`;
            if (m.city) details += `${detailRow('Standort', m.city)}`;

            emailContent += auctionEmailCard(auctionUrl, title, details, pickPrimaryPhotoUrl(m.photos));
          }

          if (unbidNewAuctions.length > 5) {
            emailContent += paragraph(`<em>...und ${unbidNewAuctions.length - 5} weitere neue Auktionen</em>`);
          }
          emailContent += button('Alle Auktionen ansehen', 'https://caravanwert.de/kaufen', settingsData);
        }

        // Section 3: Ending soon (not bid on)
        if (unbidEndingSoon.length > 0 && biddedEndingSoon.length === 0) {
          emailContent += paragraph(`<strong>⏳ ${unbidEndingSoon.length} Inserat${unbidEndingSoon.length > 1 ? 'e enden' : ' endet'} in den nächsten 24 Stunden:</strong>`);
          for (const auction of unbidEndingSoon.slice(0, 3)) {
            const m = auction.motorhomes as any;
            if (!m) continue;
            const auctionUrl = `https://caravanwert.de/auktion/${auction.id}`;
            const title = `${m.manufacturer || '?'} ${m.model || ''} (${m.year ?? '–'})`.trim();
            const isFestpreis = m.sale_channel === 'instant_price';
            const price = isFestpreis ? formatPrice(m.instant_price) : formatPrice(auction.current_bid || auction.starting_bid);
            const timeLeft = getTimeRemaining(auction.end_time);
            const bids = bidCounts[auction.id] || 0;
            const details = isFestpreis
              ? `${detailRow('Festpreis', `<strong style="color: #d97706;">${price}</strong>`)}` +
                `${detailRow('Endet in', `<strong style="color: #dc2626;">${timeLeft}</strong>`)}`
              : `${detailRow('Aktuelles Gebot', `<strong>${price}</strong>`)}` +
                `${detailRow('Gebote', `${bids}`)}` +
                `${detailRow('Endet in', `<strong style="color: #dc2626;">${timeLeft}</strong>`)}`;
            emailContent += auctionEmailCard(auctionUrl, title, details, pickPrimaryPhotoUrl(m.photos));
          }
          emailContent += button('Jetzt ansehen', 'https://caravanwert.de/kaufen', settingsData);
        }

        // Summary line
        emailContent += paragraph(
          `<strong>Gesamt:</strong> ${allActiveAuctions.length} aktive Auktionen auf ${settingsData.site_name}`
        );

        // Unsubscribe notice
        emailContent += paragraph(
          '<span style="font-size: 12px; color: #6b7280;">Sie erhalten diese E-Mail täglich als registrierter Händler. ' +
          '<a href="https://caravanwert.de/dashboard/profile" style="color: #1f8aa2;">Benachrichtigungen anpassen</a></span>'
        );

        // ── Build subject line ──────────────────────────────────────────
        const subjectParts: string[] = [];
        if (unbidNewAuctions.length > 0) {
          subjectParts.push(`${unbidNewAuctions.length} neue Auktion${unbidNewAuctions.length > 1 ? 'en' : ''}`);
        }
        if (biddedEndingSoon.length > 0) {
          subjectParts.push(`${biddedEndingSoon.length} Ihrer Auktionen ${biddedEndingSoon.length === 1 ? 'endet' : 'enden'} bald`);
        } else if (unbidEndingSoon.length > 0) {
          subjectParts.push(`${unbidEndingSoon.length} ${unbidEndingSoon.length === 1 ? 'endet' : 'enden'} bald`);
        }
        const subject = subjectParts.length > 0
          ? `${settingsData.site_name}: ${subjectParts.join(' · ')}`
          : `${settingsData.site_name}: ${allActiveAuctions.length} aktive Auktionen`;

        const html = buildEmailLayout(settingsData, subject, emailContent);

        // Quiet-Hours-Deferral: der Digest ist explizit nicht-transaktional.
        // Wenn der Haendler noch in seiner Ruhezeit ist, queuen wir die Mail
        // und process-scheduled-emails schickt sie aus, sobald die Ruhezeit
        // endet. Der Dedup-Check oben ("already sent today") bleibt wirksam,
        // weil die gequeute Row mit created_at=NOW() gespeichert wird.
        const deferUntil = prefs
          ? deferIfQuiet(
              { quiet_hours_start: prefs.quiet_hours_start, quiet_hours_end: prefs.quiet_hours_end },
              'dealer_auction_digest'
            )
          : null;

        if (deferUntil) {
          const { error: queueErr } = await supabase.from('admin_emails').insert({
            sender_email: 'info@caravanwert.de',
            sender_name: settingsData.site_name,
            recipient_email: profile.email,
            recipient_name: name || null,
            recipient_id: dealer.user_id,
            subject,
            body_html: html,
            body_text: '',
            email_type: 'dealer_auction_digest',
            direction: 'outbound',
            status: 'queued',
            scheduled_at: deferUntil.toISOString(),
            is_read: true,
          });
          if (queueErr) {
            console.error(`[send-dealer-auction-digest] quiet-hours queue insert failed for ${profile.email}:`, queueErr.message);
          } else {
            skipped++;
            continue;
          }
        }

        // ── Send email ──────────────────────────────────────────────────
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

        // Log
        await supabase.from('admin_emails').insert({
          sender_email: 'info@caravanwert.de',
          sender_name: settingsData.site_name,
          recipient_email: profile.email,
          recipient_name: name || null,
          recipient_id: dealer.user_id,
          subject,
          body_html: emailContent,
          email_type: 'dealer_auction_digest',
          direction: 'outbound',
          status: 'sent',
          resend_id: resendResult.id,
          is_read: true,
        });

        sent++;
      } catch (err: any) {
        console.error(`Failed to send digest to dealer ${dealer.user_id}:`, err.message);
        failed++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Dealer auction digest: sent=${sent}, skipped=${skipped}, failed=${failed}`,
      sent, skipped, failed,
      activeAuctions: allActiveAuctions.length,
      newAuctions: newAuctions.length,
      endingSoon: endingSoonAuctions.length,
    }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Error in dealer auction digest:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
};

function formatPrice(amount: number | null): string {
  if (!amount) return '0 €';
  return amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function getTimeRemaining(endTime: string): string {
  const diff = new Date(endTime).getTime() - Date.now();
  if (diff <= 0) return 'Beendet';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 48) return `${Math.floor(hours / 24)} Tage`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} Minuten`;
}

serve(handler);
