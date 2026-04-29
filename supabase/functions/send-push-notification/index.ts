import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkServiceRoleOrAdmin } from "../_shared/auth.ts";

// ─── Base64URL utilities ─────────────────────────────────────────────────────

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concat(...buffers: Uint8Array[]): Uint8Array {
  const total = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) { result.set(b, offset); offset += b.length; }
  return result;
}

// ─── HKDF primitives (RFC 5869) ──────────────────────────────────────────────

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const okm = new Uint8Array(await crypto.subtle.sign("HMAC", key, concat(info, new Uint8Array([1]))));
  return okm.slice(0, length);
}

// ─── VAPID JWT (ES256) ───────────────────────────────────────────────────────

async function createVapidAuth(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<string> {
  const pubBytes = b64urlDecode(vapidPublicKey);
  const x = b64urlEncode(pubBytes.slice(1, 33));
  const y = b64urlEncode(pubBytes.slice(33, 65));

  const privKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d: vapidPrivateKey },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const audience = new URL(endpoint).origin;
  const header = b64urlEncode(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 86400,
    sub: "mailto:info@kuechenwert.de",
  })));

  const sigInput = new TextEncoder().encode(`${header}.${payload}`);
  // Web Crypto returns IEEE P1363 format (raw r||s, 64 bytes) – exactly what JWT ES256 needs
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privKey, sigInput));

  return `vapid t=${header}.${payload}.${b64urlEncode(signature)}, k=${vapidPublicKey}`;
}

// ─── Payload encryption (RFC 8291 – aes128gcm) ──────────────────────────────

async function encryptPayload(
  payloadText: string,
  p256dhB64: string,
  authB64: string
): Promise<Uint8Array> {
  const clientPubBytes = b64urlDecode(p256dhB64);
  const authSecret = b64urlDecode(authB64);

  const clientPub = await crypto.subtle.importKey(
    "raw", clientPubBytes, { name: "ECDH", namedCurve: "P-256" }, false, []
  );

  const serverKeys = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]
  );
  const serverPubBytes = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: clientPub }, serverKeys.privateKey, 256)
  );

  // IKM derivation (RFC 8291 §3.4)
  const prkKey = await hkdfExtract(authSecret, sharedSecret);
  const keyInfo = concat(new TextEncoder().encode("WebPush: info\0"), clientPubBytes, serverPubBytes);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  // Content encryption (RFC 8188)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(prk, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(prk, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);

  // Pad + encrypt
  const plaintext = concat(new TextEncoder().encode(payloadText), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, plaintext));

  // aes128gcm body: salt(16) || rs(4) || idlen(1) || keyid(65) || ciphertext
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([serverPubBytes.length]), serverPubBytes, ciphertext);
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return handleCorsPreflightRequest(req);

  const auth = await checkServiceRoleOrAdmin(req, corsHeaders);
  if (!auth.authorized) return auth.response;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Read VAPID keys from vault via secure RPC (SECURITY DEFINER, service_role only)
    const { data: vapidKeys, error: vapidError } = await supabase.rpc("get_vapid_keys");
    if (vapidError || !vapidKeys?.public_key || !vapidKeys?.private_key) {
      console.error("VAPID keys not configured:", vapidError?.message ?? "keys missing in vault");
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const vapidPublicKey: string = vapidKeys.public_key;
    const vapidPrivateKey: string = vapidKeys.private_key;

    const { userId, userIds, title, body, url, icon, tag, data } = await req.json();

    const targetUserIds: string[] = userIds || (userId ? [userId] : []);
    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "No target users specified" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Notification-Preference-Check ────────────────────────────────
    // Strict opt-out:
    // - Fehlende Pref-Row oder Query-Fehler → senden (Default).
    // - `push_enabled === false` → gesamter User überspringt alle Push-Tags.
    // - Tag-spezifische Flags (push_new_bid / push_outbid / push_auction_ending):
    //   sobald sie explizit `false` sind, skippt dieser eine Tag-Event für den User.
    // Andere Tags (z. B. "default", "winner", custom) sind nicht tag-gated → senden.
    const { data: prefs, error: prefsError } = await supabase
      .from("user_notification_preferences")
      .select("user_id, push_enabled, push_new_bid, push_outbid, push_auction_ending")
      .in("user_id", targetUserIds);

    if (prefsError) {
      console.error("[send-push-notification] prefs query failed, defaulting to SEND:", prefsError);
    }

    const prefsByUser = new Map(
      (prefs || []).map((p: { user_id: string; push_enabled: boolean | null; push_new_bid: boolean | null; push_outbid: boolean | null; push_auction_ending: boolean | null }) => [p.user_id, p])
    );

    const tagKey: Record<string, "push_new_bid" | "push_outbid" | "push_auction_ending" | null> = {
      new_bid: "push_new_bid",
      outbid: "push_outbid",
      ending_soon: "push_auction_ending",
      auction_ending: "push_auction_ending",
    };
    const specificKey = tag ? tagKey[tag] ?? null : null;

    const allowedUserIds = targetUserIds.filter((uid) => {
      const p = prefsByUser.get(uid);
      if (!p) return true;
      if (p.push_enabled === false) return false;
      if (specificKey && p[specificKey] === false) return false;
      return true;
    });

    if (allowedUserIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, skipped: targetUserIds.length, message: "All target users opted out of push" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions").select("*").in("user_id", allowedUserIds);
    if (subError) throw subError;

    if (!subscriptions?.length) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No push subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = JSON.stringify({
      title: title || "KuechenWert",
      body: body || "",
      icon: icon || "/logo.png",
      badge: "/favicon.png",
      url: url || "https://kuechenwert24.de",
      tag: tag || "default",
      data: data || {},
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        const authorization = await createVapidAuth(sub.endpoint, vapidPublicKey, vapidPrivateKey);
        const encryptedBody = await encryptPayload(payload, sub.p256dh, sub.auth);

        const response = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            Authorization: authorization,
            "Content-Encoding": "aes128gcm",
            "Content-Type": "application/octet-stream",
            TTL: "86400",
            Urgency: tag === "outbid" ? "high" : "normal",
          },
          body: encryptedBody,
        });

        if (response.status === 201 || response.status === 200) {
          sent++;
        } else if (response.status === 404 || response.status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          console.log(`Removed expired subscription ${sub.id}`);
          failed++;
        } else {
          const errText = await response.text().catch(() => "");
          console.error(`Push ${response.status}: ${errText.slice(0, 200)}`);
          failed++;
        }
      } catch (err) {
        console.error(`Push error for sub ${sub.id}:`, err);
        failed++;
      }
    }

    try {
      await supabase.from("audit_logs").insert({
        action: "push_notification_sent",
        entity_type: "notification",
        details: { title, sent, failed, targets: targetUserIds.length },
      });
    } catch { /* non-critical */ }

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
