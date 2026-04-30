import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { buildEmailLayout, paragraph, button, detailRow, infoBox, greeting } from "../_shared/email-builder.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';
import { deferIfQuiet, isTransactional } from '../_shared/quiet-hours.ts';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }
  const corsHeaders = getCorsHeaders(req);

  const auth = await checkServiceRoleOrAdmin(req, corsHeaders);
  if (!auth.authorized) return auth.response;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { kitchen_id, auction_id, event_type, new_price, auction_title, is_festpreis } = await req.json();

    if (!kitchen_id || !event_type) {
      return new Response(JSON.stringify({ error: "kitchen_id and event_type required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load site settings for email branding
    const { data: settingsData } = await supabase
      .from("site_settings")
      .select("*")
      .single();

    const settings = settingsData || {
      site_name: "KuechenWert",
      site_description: "Deutschlands führende Wohnmobil-Handelsplattform",
      contact_email: "info@kuechenwert24.de",
      support_phone: "+49 511 51532476",
    };

    // Format price for display
    const formattedPrice = new_price
      ? Number(new_price).toLocaleString("de-DE", { style: "currency", currency: "EUR" })
      : "–";

    // Get all users who have this kitchen as favorite
    const { data: favorites, error: favError } = await supabase
      .from("user_favorites")
      .select("user_id")
      .eq("kitchen_id", kitchen_id);

    if (favError || !favorites?.length) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "No favorites found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user emails and notification preferences
    const userIds = favorites.map(f => f.user_id);
    const { data: users } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    
    const favoriteUsers = users?.users?.filter(u => 
      userIds.includes(u.id) && u.email
    ) || [];

    // Check notification preferences – Opt-out semantics:
    // Users without a row OR with email_price_alerts !== false get the mail (default behavior).
    // Only users who EXPLICITLY set email_price_alerts = false are skipped.
    // If the prefs query itself errors, we default to SEND to avoid accidental silent suppression.
    const { data: prefs, error: prefsError } = await supabase
      .from("user_notification_preferences")
      .select("user_id, email_price_alerts, quiet_hours_start, quiet_hours_end")
      .in("user_id", userIds);

    if (prefsError) {
      console.error("[send-favorite-notification] prefs query failed, defaulting to SEND:", prefsError);
    }

    const prefsMap = new Map(
      (prefs || []).map((p: { user_id: string; email_price_alerts: boolean | null; quiet_hours_start: string | null; quiet_hours_end: string | null }) => [p.user_id, p])
    );

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const user of favoriteUsers) {
      const userPref = prefsMap.get(user.id);
      if (userPref && userPref.email_price_alerts === false) {
        skipped++;
        continue;
      }

      // ─── ANTI-SPAM: Max 1 Favoriten-Email pro User pro 24h ───
      if (event_type === "price_change" && user.email) {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentEmail } = await supabase
          .from("admin_emails")
          .select("id")
          .eq("recipient_email", user.email)
          .eq("email_type", "favorite_price_change")
          .gt("created_at", oneDayAgo)
          .limit(1);

        if (recentEmail && recentEmail.length > 0) {
          skipped++;
          continue;
        }
      }

      // Check if user has bounced email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email_bounced, first_name")
        .eq("id", user.id)
        .single();

      if (profile?.email_bounced) continue;

      const firstName = profile?.first_name || "Nutzer";
      const vehicleName = auction_title || "Wohnmobil";
      let subject = "";
      let emailContent = "";

      if (event_type === "price_change") {
        subject = `Preisänderung bei Ihrem Favoriten – ${vehicleName}`;
        emailContent = [
          greeting(firstName),
          paragraph(is_festpreis
            ? `Bei einem Wohnmobil auf Ihrer Favoritenliste hat sich der Festpreis geändert:`
            : `Bei einem Wohnmobil auf Ihrer Favoritenliste gibt es ein neues Gebot:`),
          infoBox(is_festpreis ? "Neuer Festpreis" : "Neues Gebot", [
            detailRow("Fahrzeug", vehicleName),
            detailRow(is_festpreis ? "Neuer Festpreis" : "Neuer Preis", formattedPrice),
          ].join("")),
          paragraph(is_festpreis
            ? `Wenn Sie dieses Fahrzeug nicht verpassen möchten, sichern Sie es sich jetzt zum Festpreis.`
            : `Wenn Sie dieses Fahrzeug nicht verpassen möchten, geben Sie jetzt Ihr Gebot ab.`),
          button(is_festpreis ? "Jetzt ansehen" : "Jetzt Gebot abgeben", `https://kuechenwert24.de/auktion/${auction_id}`),
        ].join("");
      } else if (event_type === "auction_ending") {
        subject = is_festpreis ? `Ihr Favorit endet bald – ${vehicleName}` : `Ihr Favorit endet bald – ${vehicleName}`;
        emailContent = [
          greeting(firstName),
          paragraph(is_festpreis
            ? `Ein Festpreis-Inserat auf Ihrer Favoritenliste endet in Kürze:`
            : `Eine Auktion auf Ihrer Favoritenliste endet in Kürze:`),
          infoBox(is_festpreis ? "Inserat endet bald" : "Auktion endet bald", [
            detailRow("Fahrzeug", vehicleName),
            detailRow(is_festpreis ? "Festpreis" : "Aktueller Preis", formattedPrice),
          ].join(""), "warning"),
          paragraph(is_festpreis
            ? `Verpassen Sie nicht Ihre Chance – sichern Sie sich dieses Fahrzeug zum Festpreis, bevor das Inserat endet.`
            : `Verpassen Sie nicht Ihre Chance – geben Sie jetzt Ihr Gebot ab, bevor die Auktion endet.`),
          button(is_festpreis ? "Jetzt ansehen" : "Zur Auktion", `https://kuechenwert24.de/auktion/${auction_id}`),
        ].join("");
      } else if (event_type === "auction_ended") {
        subject = is_festpreis ? `Inserat beendet – ${vehicleName}` : `Auktion beendet – ${vehicleName}`;
        emailContent = [
          greeting(firstName),
          paragraph(is_festpreis
            ? `Ein Festpreis-Inserat auf Ihrer Favoritenliste wurde beendet:`
            : `Eine Auktion auf Ihrer Favoritenliste wurde beendet:`),
          infoBox(is_festpreis ? "Inserat beendet" : "Auktion beendet", [
            detailRow("Fahrzeug", vehicleName),
            detailRow(is_festpreis ? "Festpreis" : "Endpreis", formattedPrice),
          ].join(""), "info"),
          paragraph(`Entdecken Sie weitere spannende Angebote auf unserer Plattform.`),
          button("Weitere Angebote entdecken", `https://kuechenwert24.de/kaufen`),
        ].join("");
      } else {
        continue;
      }

      const html = buildEmailLayout(settings, subject, emailContent);

      // Quiet-Hours-Deferral: auction_ended ist "nachrichtlich" und waere evtl.
      // transactional-kandidat, aber fuer Konsistenz mit der Notification-UI
      // (Preisalarme-Opt-out) gelten Ruhezeiten hier fuer alle drei Events.
      // `isTransactional` macht die Entscheidung fuer uns ueber den email_type.
      const favEmailType = event_type === "price_change" ? "favorite_price_change" : "favorite_notification";
      if (userPref && !isTransactional(favEmailType)) {
        const deferUntil = deferIfQuiet(
          { quiet_hours_start: userPref.quiet_hours_start, quiet_hours_end: userPref.quiet_hours_end },
          favEmailType
        );
        if (deferUntil) {
          const { error: queueErr } = await supabase.from("admin_emails").insert({
            sender_email: "info@kuechenwert24.de",
            sender_name: "KuechenWert",
            recipient_email: user.email,
            recipient_id: user.id,
            subject,
            body_html: html,
            body_text: html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
            email_type: favEmailType,
            direction: "outbound",
            status: "queued",
            scheduled_at: deferUntil.toISOString(),
            is_read: true,
          });
          if (queueErr) {
            console.error(`[send-favorite-notification] quiet-hours queue insert failed for ${user.email}, falling back to immediate send:`, queueErr);
          } else {
            skipped++;
            continue;
          }
        }
      }

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "KuechenWert <info@kuechenwert24.de>",
            to: [user.email],
            subject,
            html,
          }),
        });

        if (res.ok) {
          sent++;
          // Per-user log for dedup (email_type: favorite_price_change for anti-spam check).
          // Store the FULL HTML so the Email Center preview is meaningful.
          supabase.from("admin_emails").insert({
            sender_email: "info@kuechenwert24.de",
            sender_name: "KuechenWert",
            recipient_email: user.email,
            recipient_id: user.id,
            subject,
            body_html: html,
            body_text: html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
            email_type: event_type === "price_change" ? "favorite_price_change" : "favorite_notification",
            direction: "outbound", status: "sent", is_read: true,
          }).then(({ error: logErr }) => { if (logErr) console.error('Per-user log error:', logErr); });
        } else {
          const errText = await res.text();
          errors.push(`${user.email}: ${errText}`);
        }
      } catch (e) {
        errors.push(`${user.email}: ${e.message}`);
      }
    }

    // Note: Per-user logging now happens inside the send loop (see below)
    // Aggregate log kept for admin overview
    if (sent > 0) {
      try {
        await supabase.from("admin_emails").insert({
          sender_email: "info@kuechenwert24.de",
          sender_name: "KuechenWert",
          recipient_email: `${sent} Favoriten-Nutzer`,
          subject: `[Auto] Favoriten-Benachrichtigung: ${event_type}`,
          body_html: `Automatische Favoriten-Benachrichtigung für ${auction_title || kitchen_id}. ${sent} gesendet, ${skipped} übersprungen (Anti-Spam).`,
          body_text: '',
          email_type: 'favorite_notification',
          direction: "outbound",
          status: errors.length > 0 ? "partial" : "sent",
          is_read: true,
        });
      } catch (logErr) {
        console.error('Failed to log email in admin_emails:', logErr);
      }
    }

    return new Response(JSON.stringify({ success: true, sent, skipped, errors: errors.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
