import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { buildEmailLayout, paragraph, button, detailRow, infoBox, greeting } from "../_shared/email-builder.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }
  const corsHeaders = getCorsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { motorhome_id, auction_id, event_type, new_price, auction_title } = await req.json();

    if (!motorhome_id || !event_type) {
      return new Response(JSON.stringify({ error: "motorhome_id and event_type required" }), {
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
      site_name: "CaravanWert",
      site_description: "Deutschlands führende Wohnmobil-Handelsplattform",
      contact_email: "kontakt@caravanwert.de",
      support_phone: "+49 511 51532476",
    };

    // Format price for display
    const formattedPrice = new_price
      ? Number(new_price).toLocaleString("de-DE", { style: "currency", currency: "EUR" })
      : "–";

    // Get all users who have this motorhome as favorite
    const { data: favorites, error: favError } = await supabase
      .from("user_favorites")
      .select("user_id")
      .eq("motorhome_id", motorhome_id);

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

    // Check notification preferences - only send to users who opted in
    const { data: prefs } = await supabase
      .from("user_notification_preferences")
      .select("user_id, bid_notifications")
      .in("user_id", userIds);

    const prefsMap = new Map(prefs?.map(p => [p.user_id, p]) || []);

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const user of favoriteUsers) {
      // Check if user wants notifications (default: yes)
      const userPref = prefsMap.get(user.id);
      if (userPref && userPref.bid_notifications === false) continue;

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
          paragraph(`Bei einem Wohnmobil auf Ihrer Favoritenliste gibt es ein neues Gebot:`),
          infoBox("Neues Gebot", [
            detailRow("Fahrzeug", vehicleName),
            detailRow("Neuer Preis", formattedPrice),
          ].join("")),
          paragraph(`Wenn Sie dieses Fahrzeug nicht verpassen möchten, geben Sie jetzt Ihr Gebot ab.`),
          button("Jetzt Gebot abgeben", `https://caravanwert.de/auktion/${auction_id}`),
        ].join("");
      } else if (event_type === "auction_ending") {
        subject = `Ihr Favorit endet bald – ${vehicleName}`;
        emailContent = [
          greeting(firstName),
          paragraph(`Eine Auktion auf Ihrer Favoritenliste endet in Kürze:`),
          infoBox("Auktion endet bald", [
            detailRow("Fahrzeug", vehicleName),
            detailRow("Aktueller Preis", formattedPrice),
          ].join(""), "warning"),
          paragraph(`Verpassen Sie nicht Ihre Chance – geben Sie jetzt Ihr Gebot ab, bevor die Auktion endet.`),
          button("Zur Auktion", `https://caravanwert.de/auktion/${auction_id}`),
        ].join("");
      } else if (event_type === "auction_ended") {
        subject = `Auktion beendet – ${vehicleName}`;
        emailContent = [
          greeting(firstName),
          paragraph(`Eine Auktion auf Ihrer Favoritenliste wurde beendet:`),
          infoBox("Auktion beendet", [
            detailRow("Fahrzeug", vehicleName),
            detailRow("Endpreis", formattedPrice),
          ].join(""), "info"),
          paragraph(`Entdecken Sie weitere spannende Auktionen auf unserer Plattform.`),
          button("Weitere Auktionen entdecken", `https://caravanwert.de/kaufen`),
        ].join("");
      } else {
        continue;
      }

      const html = buildEmailLayout(settings, subject, emailContent);

      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "CaravanWert <info@caravanwert.de>",
            to: [user.email],
            subject,
            html,
          }),
        });

        if (res.ok) {
          sent++;
          // Per-user log for dedup (email_type: favorite_price_change for anti-spam check)
          supabase.from("admin_emails").insert({
            sender_email: "info@caravanwert.de",
            sender_name: "CaravanWert",
            recipient_email: user.email,
            recipient_id: user.id,
            subject,
            body_html: '', body_text: '',
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
          sender_email: "info@caravanwert.de",
          sender_name: "CaravanWert",
          recipient_email: `${sent} Favoriten-Nutzer`,
          subject: `[Auto] Favoriten-Benachrichtigung: ${event_type}`,
          body_html: `Automatische Favoriten-Benachrichtigung für ${auction_title || motorhome_id}. ${sent} gesendet, ${skipped} übersprungen (Anti-Spam).`,
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
