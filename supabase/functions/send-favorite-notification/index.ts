import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { buildEmail, heading, paragraph, button, infoBox, amountDisplay } from "../_shared/email-builder.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
    const errors: string[] = [];

    for (const user of favoriteUsers) {
      // Check if user wants notifications (default: yes)
      const userPref = prefsMap.get(user.id);
      if (userPref && userPref.bid_notifications === false) continue;

      // Check if user has bounced email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email_bounced, first_name")
        .eq("id", user.id)
        .single();

      if (profile?.email_bounced) continue;

      const firstName = profile?.first_name || "Nutzer";
      let subject = "";
      let body = "";

      if (event_type === "price_change") {
        subject = `Preisänderung bei Ihrem Favoriten – ${auction_title || "Wohnmobil"}`;
        body = [
          heading(`Neues Gebot auf Ihren Favoriten`),
          paragraph(`Hallo ${firstName},`),
          paragraph(`Bei einem Wohnmobil auf Ihrer Favoritenliste gibt es ein neues Gebot:`),
          infoBox([
            { label: "Fahrzeug", value: auction_title || "Wohnmobil" },
            { label: "Neuer Preis", value: amountDisplay(new_price) },
          ]),
          paragraph(`Wenn Sie dieses Fahrzeug nicht verpassen möchten, geben Sie jetzt Ihr Gebot ab.`),
          button("Jetzt Gebot abgeben", `https://caravanwert.de/auktion/${auction_id}`),
        ].join("");
      } else if (event_type === "auction_ending") {
        subject = `Ihr Favorit endet bald – ${auction_title || "Wohnmobil"}`;
        body = [
          heading(`Auktion endet bald!`),
          paragraph(`Hallo ${firstName},`),
          paragraph(`Eine Auktion auf Ihrer Favoritenliste endet in Kürze:`),
          infoBox([
            { label: "Fahrzeug", value: auction_title || "Wohnmobil" },
            { label: "Aktueller Preis", value: amountDisplay(new_price) },
          ]),
          paragraph(`Verpassen Sie nicht Ihre Chance – geben Sie jetzt Ihr Gebot ab, bevor die Auktion endet.`),
          button("Zur Auktion", `https://caravanwert.de/auktion/${auction_id}`),
        ].join("");
      } else if (event_type === "auction_ended") {
        subject = `Auktion beendet – ${auction_title || "Wohnmobil"}`;
        body = [
          heading(`Auktion beendet`),
          paragraph(`Hallo ${firstName},`),
          paragraph(`Eine Auktion auf Ihrer Favoritenliste wurde beendet:`),
          infoBox([
            { label: "Fahrzeug", value: auction_title || "Wohnmobil" },
            { label: "Endpreis", value: amountDisplay(new_price) },
          ]),
          paragraph(`Entdecken Sie weitere spannende Auktionen auf unserer Plattform.`),
          button("Weitere Auktionen entdecken", `https://caravanwert.de/kaufen`),
        ].join("");
      } else {
        continue;
      }

      const html = buildEmail(body);

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
        } else {
          const errText = await res.text();
          errors.push(`${user.email}: ${errText}`);
        }
      } catch (e) {
        errors.push(`${user.email}: ${e.message}`);
      }
    }

    // Log to admin_emails
    try {
      await supabase.from("admin_emails").insert({
        sender_email: "info@caravanwert.de",
        sender_name: "CaravanWert",
        recipient_email: `${sent} Favoriten-Nutzer`,
        subject: `[Auto] Favoriten-Benachrichtigung: ${event_type}`,
        body_html: `Automatische Favoriten-Benachrichtigung für ${auction_title || motorhome_id}. ${sent} E-Mails gesendet.`,
        body_text: '',
        email_type: 'favorite_notification',
        direction: "outbound",
        status: errors.length > 0 ? "partial" : "sent",
        is_read: true,
      });
    } catch (logErr) {
      console.error('Failed to log email in admin_emails:', logErr);
    }

    return new Response(JSON.stringify({ success: true, sent, errors: errors.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
