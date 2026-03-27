import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web Push crypto utilities for Deno
async function generatePushPayload(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ endpoint: string; headers: Record<string, string>; body: Uint8Array }> {
  // For Deno, we use the web-push protocol directly
  // This is a simplified implementation using fetch to the push endpoint
  
  // JWT for VAPID
  const header = btoa(JSON.stringify({ typ: "JWT", alg: "ES256" }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  
  const audience = new URL(subscription.endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const claims = btoa(JSON.stringify({
    aud: audience,
    exp: now + 86400,
    sub: "mailto:info@caravanwert.de"
  })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return {
    endpoint: subscription.endpoint,
    headers: {
      "Content-Type": "application/json",
      "TTL": "86400",
    },
    body: new TextEncoder().encode(payload),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { userId, userIds, title, body, url, icon, tag, data } = await req.json();

    // Get target user IDs
    const targetUserIds = userIds || (userId ? [userId] : []);
    
    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "No target users specified" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get push subscriptions for target users
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds);

    if (subError) throw subError;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No push subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = JSON.stringify({
      title: title || "CaravanWert",
      body: body || "",
      icon: icon || "/logo.png",
      badge: "/favicon.png",
      url: url || "https://caravanwert.de",
      tag: tag || "default",
      data: data || {},
    });

    // Send push to each subscription
    let sent = 0;
    let failed = 0;
    const failedEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "TTL": "86400",
          },
          body: payload,
        });

        if (response.status === 201 || response.status === 200) {
          sent++;
        } else if (response.status === 404 || response.status === 410) {
          // Subscription expired or invalid - remove it
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
          failed++;
          failedEndpoints.push(sub.endpoint);
        } else {
          failed++;
        }
      } catch (err) {
        console.error(`Push failed for ${sub.endpoint}:`, err);
        failed++;
      }
    }

    // Log audit
    await supabase.from("audit_logs").insert({
      action: "push_notification_sent",
      entity_type: "push_notification",
      details: { title, body, sent, failed, targetUserCount: targetUserIds.length },
    });

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: subscriptions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Push notification error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
