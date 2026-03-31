import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, createRateLimitErrorResponse } from '../_shared/rate-limiter.ts';

const TRACK_CONVERSION_RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,      // max 20 conversion events per minute per client
};

/**
 * Server-Side Conversion Tracking Edge Function
 * 
 * Sendet Conversion-Events an GA4 via Measurement Protocol mit:
 * 1. Enhanced Conversions (gehashte Email, Telefon, Name)
 * 2. Google Ads Click-IDs (GCLID, GBRAID, WBRAID) für direkte Attribution
 * 3. GA4 Client-ID für Session-Zuordnung
 * 
 * Diese Funktion arbeitet unabhängig vom Client-Side Cookie-Consent und
 * stellt sicher, dass 100% der Conversions erfasst werden.
 * 
 * Architektur:
 * - Client-Side Enhanced Conversions (wenn Cookies akzeptiert) → Primär
 * - Server-Side GA4 Measurement Protocol (diese Funktion) → Fallback/Ergänzung
 * - GCLID wird an GA4 gesendet → GA4 leitet an Google Ads weiter (über Verknüpfung)
 * 
 * Erforderliche Supabase Secrets:
 * - GA4_API_SECRET: Measurement Protocol API Secret
 * - GA4_MEASUREMENT_ID: GA4 Measurement ID (z.B. G-H4BCV8DS0B)
 */

const GA4_API_SECRET = Deno.env.get("GA4_API_SECRET");
const GA4_MEASUREMENT_ID = Deno.env.get("GA4_MEASUREMENT_ID") || "G-H4BCV8DS0B";

interface ConversionRequest {
  event_name: string;
  lead_type: string;
  name?: string;
  email?: string;
  phone?: string;
  manufacturer?: string;
  model?: string;
  estimated_min?: number;
  estimated_max?: number;
  client_id?: string;
  // Google Ads Click-IDs für direkte Attribution
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  // Transaction ID für Deduplizierung über alle Tracking-Schichten
  transaction_id?: string;
}

/**
 * SHA-256 Hash einer Zeichenkette für Enhanced Conversions.
 * Google erwartet lowercase, getrimmte, SHA-256 gehashte Werte.
 */
async function sha256Hash(value: string): Promise<string> {
  const normalized = value.trim().toLowerCase();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Normalisiert eine Telefonnummer ins E.164-Format.
 * Deutsche Nummern (beginnend mit 0) werden mit +49 versehen.
 */
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "+49" + cleaned.substring(1);
  }
  if (!cleaned.startsWith("+")) {
    cleaned = "+" + cleaned;
  }
  return cleaned;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);

  // Rate limiting
  const rateLimitResult = await checkRateLimit(req, TRACK_CONVERSION_RATE_LIMIT);
  if (!rateLimitResult.allowed) {
    return createRateLimitErrorResponse(rateLimitResult, corsHeaders);
  }

  try {
    const data: ConversionRequest = await req.json();
    const {
      event_name = "generate_lead",
      lead_type,
      name,
      email,
      phone,
      manufacturer,
      model,
      estimated_min,
      estimated_max,
      client_id,
      gclid,
      gbraid,
      wbraid,
      transaction_id,
    } = data;

    console.log(`[track-conversion] Processing ${lead_type} conversion for: ${email || "unknown"} (txId: ${transaction_id || 'none'})`);
    if (gclid) console.log(`[track-conversion] GCLID vorhanden: ${gclid.substring(0, 15)}...`);
    if (gbraid) console.log(`[track-conversion] GBRAID vorhanden`);
    if (wbraid) console.log(`[track-conversion] WBRAID vorhanden`);

    const results: Record<string, unknown> = {};

    // ─── GA4 Measurement Protocol ───────────────────────────────────
    if (GA4_API_SECRET) {
      try {
        // Enhanced Conversions: Gehashte Nutzerdaten für bessere Attribution
        const userData: Record<string, unknown> = {};

        if (email) {
          userData.sha256_email_address = [await sha256Hash(email)];
        }
        if (phone) {
          const normalizedPhone = normalizePhone(phone);
          userData.sha256_phone_number = [await sha256Hash(normalizedPhone)];
        }
        if (name) {
          const parts = name.trim().split(/\s+/);
          if (parts.length >= 2) {
            userData.sha256_first_name = await sha256Hash(parts[0]);
            userData.sha256_last_name = await sha256Hash(parts.slice(1).join(" "));
          } else if (parts.length === 1) {
            userData.sha256_first_name = await sha256Hash(parts[0]);
          }
        }

        // Event-Parameter
        const eventParams: Record<string, unknown> = {
          lead_type,
          engagement_time_msec: "1",
        };

        // Transaction ID für Deduplizierung (Google Ads erkennt doppelte Conversions anhand dieser ID)
        if (transaction_id) {
          eventParams.transaction_id = transaction_id;
        }

        if (manufacturer) eventParams.vehicle_manufacturer = manufacturer;
        if (model) eventParams.vehicle_model = model;
        if (estimated_min) eventParams.estimated_value_min = estimated_min;
        if (estimated_max) eventParams.estimated_value_max = estimated_max;
        // Fester Conversion Value: 5 EUR pro Lead
        eventParams.value = 5.0;
        eventParams.currency = "EUR";

        // GA4 Client-ID: Vom Client übernommen oder serverseitig generiert
        const ga4ClientId = client_id || `server.${Date.now()}.${Math.random().toString(36).substring(2, 9)}`;

        // GA4 Measurement Protocol Payload
        const ga4Payload: Record<string, unknown> = {
          client_id: ga4ClientId,
          user_data: userData,
          events: [
            {
              name: event_name,
              params: eventParams,
            },
          ],
        };

        // GCLID/GBRAID/WBRAID an GA4 senden für direkte Google Ads Attribution
        // Wenn GA4 mit Google Ads verknüpft ist, wird die Conversion automatisch
        // dem richtigen Google Ads Klick zugeordnet
        if (gclid) {
          // GCLID wird als session-Parameter gesendet, damit GA4 die Session
          // dem Google Ads Klick zuordnen kann
          (ga4Payload.events as Array<Record<string, unknown>>)[0].params = {
            ...eventParams,
            gclid,
          };
        }
        if (gbraid) {
          (ga4Payload.events as Array<Record<string, unknown>>)[0].params = {
            ...eventParams,
            gbraid,
          };
        }
        if (wbraid) {
          (ga4Payload.events as Array<Record<string, unknown>>)[0].params = {
            ...eventParams,
            wbraid,
          };
        }

        const ga4Url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`;

        const ga4Response = await fetch(ga4Url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ga4Payload),
        });

        results.ga4 = {
          status: ga4Response.status,
          ok: ga4Response.ok,
          hasGclid: !!gclid,
          hasUserData: Object.keys(userData).length > 0,
          clientIdSource: client_id ? "browser" : "server",
        };

        console.log(`[track-conversion] GA4 Measurement Protocol: ${ga4Response.status} (GCLID: ${!!gclid}, UserData: ${Object.keys(userData).length} Felder, ClientID: ${client_id ? "browser" : "server"})`);
      } catch (ga4Error) {
        console.error("[track-conversion] GA4 error:", ga4Error);
        results.ga4 = { error: String(ga4Error) };
      }
    } else {
      console.warn("[track-conversion] GA4_API_SECRET not set, skipping GA4 tracking");
      results.ga4 = { skipped: true, reason: "GA4_API_SECRET not configured" };
    }

    // ─── Google Ads Offline Conversion Upload (wenn konfiguriert) ────
    // Diese Sektion wird aktiviert sobald die Google Ads API Credentials
    // als Supabase Secrets konfiguriert sind (GADS_CUSTOMER_ID, GADS_DEVELOPER_TOKEN,
    // GADS_OAUTH_CLIENT_ID, GADS_OAUTH_CLIENT_SECRET, GADS_OAUTH_REFRESH_TOKEN)
    const GADS_CUSTOMER_ID = Deno.env.get("GADS_CUSTOMER_ID");
    const GADS_DEVELOPER_TOKEN = Deno.env.get("GADS_DEVELOPER_TOKEN");
    const GADS_OAUTH_REFRESH_TOKEN = Deno.env.get("GADS_OAUTH_REFRESH_TOKEN");
    const GADS_OAUTH_CLIENT_ID = Deno.env.get("GADS_OAUTH_CLIENT_ID");
    const GADS_OAUTH_CLIENT_SECRET = Deno.env.get("GADS_OAUTH_CLIENT_SECRET");

    if (GADS_CUSTOMER_ID && GADS_DEVELOPER_TOKEN && GADS_OAUTH_REFRESH_TOKEN && GADS_OAUTH_CLIENT_ID && GADS_OAUTH_CLIENT_SECRET) {
      try {
        console.log("[track-conversion] Google Ads API Credentials vorhanden, sende direkte Conversion...");

        // 1. OAuth Access Token holen via Refresh Token
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            client_id: GADS_OAUTH_CLIENT_ID,
            client_secret: GADS_OAUTH_CLIENT_SECRET,
            refresh_token: GADS_OAUTH_REFRESH_TOKEN,
          }),
        });

        if (!tokenResponse.ok) {
          const tokenError = await tokenResponse.text();
          throw new Error(`OAuth Token-Fehler: ${tokenResponse.status} - ${tokenError}`);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // 2. Conversion-Daten vorbereiten
        const conversionDateTime = new Date().toISOString().replace("T", " ").replace("Z", "+00:00");
        // Fester Conversion Value: 5 EUR pro Lead
        const conversionValue = 5.0;

        // Conversion Action ID basierend auf Lead-Typ auswählen
        const conversionActionMap: Record<string, string> = {
          'bewertung_abgeschlossen': '7544183183',
          'landing_page_lead': '7545833199',
          'kontaktformular_gesendet': '7545833202',
          'contact_form': '7545833202',
          'wertermittlung_lead': '7545833205',
          'wertrechner_lead': '7545833208',
          'wizard_abgeschlossen': '7545833211',
          'wizard_completed': '7545833211',
          'terminbuchung': '7545833214',
          'wizard_gestartet': '7545833217',
          'wizard_started': '7545833217',
          'wizard_fahrzeugdaten': '7545833220',
          'wizard_vehicle_data': '7545833220',
          'dealer_register': '7545833199',
        };
        const conversionActionId = conversionActionMap[lead_type] || '7545833208'; // Fallback: Wertrechner Lead
        const customerId = GADS_CUSTOMER_ID.replace(/-/g, "");

        // 3. Conversion-Payload erstellen
        interface ConversionPayload {
          conversions: Array<{
            conversionAction: string;
            conversionDateTime: string;
            conversionValue: number;
            currencyCode: string;
            userIdentifiers: Array<Record<string, unknown>>;
            gclid?: string;
            gbraid?: string;
            wbraid?: string;
          }>;
          partialFailure: boolean;
        }

        const conversion: ConversionPayload["conversions"][0] = {
          conversionAction: `customers/${customerId}/conversionActions/${conversionActionId}`,
          conversionDateTime,
          conversionValue,
          currencyCode: "EUR",
          userIdentifiers: [],
        };

        // Click-IDs für Attribution
        if (gclid) conversion.gclid = gclid;
        if (gbraid) conversion.gbraid = gbraid;
        if (wbraid) conversion.wbraid = wbraid;

        // Transaction ID (orderId) für Deduplizierung
        if (transaction_id) {
          (conversion as any).orderId = transaction_id;
        }

        // Enhanced Conversions: Gehashte Nutzerdaten
        if (email) {
          conversion.userIdentifiers.push({
            hashedEmail: await sha256Hash(email),
          });
        }
        if (phone) {
          conversion.userIdentifiers.push({
            hashedPhoneNumber: await sha256Hash(normalizePhone(phone)),
          });
        }
        if (name) {
          const parts = name.trim().split(/\s+/);
          if (parts.length >= 2) {
            conversion.userIdentifiers.push({
              addressInfo: {
                hashedFirstName: await sha256Hash(parts[0]),
                hashedLastName: await sha256Hash(parts.slice(1).join(" ")),
                countryCode: "DE",
              },
            });
          }
        }

        const gadsPayload: ConversionPayload = {
          conversions: [conversion],
          partialFailure: true,
        };

        // 4. An Google Ads API senden
        const gadsUrl = `https://googleads.googleapis.com/v23/customers/${customerId}:uploadClickConversions`;

        const gadsResponse = await fetch(gadsUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
            "developer-token": GADS_DEVELOPER_TOKEN,
            "login-customer-id": "9746508145", // MCC WohnWert Verwaltungskonto
          },
          body: JSON.stringify(gadsPayload),
        });

        const gadsResult = await gadsResponse.json();

        results.gads = {
          status: gadsResponse.status,
          ok: gadsResponse.ok,
          hasGclid: !!gclid,
          result: gadsResult,
        };

        console.log(`[track-conversion] Google Ads API: ${gadsResponse.status} (GCLID: ${!!gclid})`);
        if (!gadsResponse.ok) {
          console.error("[track-conversion] Google Ads API Fehler:", JSON.stringify(gadsResult));
        }
      } catch (gadsError) {
        console.error("[track-conversion] Google Ads API error:", gadsError);
        results.gads = { error: String(gadsError) };
      }
    } else {
      // Google Ads API nicht konfiguriert – das ist OK, GA4 Measurement Protocol
      // leitet Conversions über die GA4↔Google Ads Verknüpfung weiter
      results.gads = {
        skipped: true,
        reason: "Google Ads API Credentials nicht konfiguriert. Conversions werden über GA4→Google Ads Verknüpfung weitergeleitet.",
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[track-conversion] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
