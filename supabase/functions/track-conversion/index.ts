import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, createRateLimitErrorResponse } from '../_shared/rate-limiter.ts';

const TRACK_CONVERSION_RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,      // max 20 conversion events per minute per client
};

// Default tracking config – used as fallback when neither the DB nor env vars
// provide a value. Mirrors site_settings.tracking_config defaults.
const DEFAULT_GA4_MEASUREMENT_ID = "G-H4BCV8DS0B";
const DEFAULT_OFFLINE_LEAD_ACTION_ID = "7576040066";
const DEFAULT_GADS_LOGIN_CUSTOMER_ID = "9746508145";

interface TrackingConfigShape {
  ga4?: { measurement_id?: string };
  google_ads?: {
    values?: Record<string, number>;
  };
  server_side?: {
    gads_offline_conversion_action_id?: string;
    gads_login_customer_id?: string;
  };
}

let trackingConfigCache: { value: TrackingConfigShape; loadedAt: number } | null = null;
const TRACKING_CONFIG_TTL_MS = 60_000; // 60s in-memory cache, avoids hammering DB on every event

async function loadTrackingConfig(): Promise<TrackingConfigShape> {
  const now = Date.now();
  if (trackingConfigCache && now - trackingConfigCache.loadedAt < TRACKING_CONFIG_TTL_MS) {
    return trackingConfigCache.value;
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      trackingConfigCache = { value: {}, loadedAt: now };
      return {};
    }
    const sb = createClient(supabaseUrl, serviceKey);
    const { data } = await sb
      .from("site_settings")
      .select("tracking_config")
      .eq("id", "00000000-0000-0000-0000-000000000000")
      .maybeSingle();
    const cfg = (data?.tracking_config ?? {}) as TrackingConfigShape;
    trackingConfigCache = { value: cfg, loadedAt: now };
    return cfg;
  } catch (err) {
    console.warn("[track-conversion] Failed to load tracking_config from DB:", err);
    trackingConfigCache = { value: {}, loadedAt: now };
    return {};
  }
}

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
 * - Client-Side Enhanced Conversions (wenn Cookies akzeptiert) -> Primär
 * - Server-Side GA4 Measurement Protocol (diese Funktion) -> Fallback/Ergänzung
 * - GCLID wird an GA4 gesendet -> GA4 leitet an Google Ads weiter (über Verknüpfung)
 * 
 * Konfiguration (Resolution-Order: ENV > DB site_settings.tracking_config > Default):
 * - GA4 Measurement ID: ENV GA4_MEASUREMENT_ID > tracking_config.ga4.measurement_id > G-H4BCV8DS0B
 * - Offline Conversion Action ID: ENV GADS_OFFLINE_LEAD_ACTION_ID > tracking_config.server_side.gads_offline_conversion_action_id > 7576040066
 * - Login Customer ID (MCC): ENV GADS_LOGIN_CUSTOMER_ID > tracking_config.server_side.gads_login_customer_id > 9746508145
 *
 * Conversion-Werte (€) werden ebenfalls aus tracking_config.google_ads.values gelesen.
 *
 * Erforderliche Supabase Secrets (sensitive Tokens, NICHT im Admin-Backend):
 * - GA4_API_SECRET: Measurement Protocol API Secret
 * - SUPABASE_SERVICE_ROLE_KEY: für DB-Zugriff auf tracking_config
 * - (optional) GADS_CUSTOMER_ID, GADS_DEVELOPER_TOKEN, GADS_OAUTH_*: für direkte Google Ads API Uploads
 */

const GA4_API_SECRET = Deno.env.get("GA4_API_SECRET");
// Resolution order: ENV override > site_settings.tracking_config.ga4.measurement_id > default
const GA4_MEASUREMENT_ID_ENV = Deno.env.get("GA4_MEASUREMENT_ID");

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
  /**
   * Microsoft Click ID (Bing Ads). Wird hier nur akzeptiert + geloggt.
   * Die tatsächliche Bing-Ads-Conversion-API-Integration ist Phase 2 und folgt,
   * sobald Microsoft Developer Token + OAuth-Refresh-Token vorhanden sind.
   * Aktuell verlassen wir uns für Bing auf das clientseitige UET-Pixel.
   */
  msclkid?: string;
  // Transaction ID für Deduplizierung über alle Tracking-Schichten
  transaction_id?: string;
  // Land des Nutzers für internationale Telefon-Normalisierung
  country_code?: string;
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
 * Unterstützt internationale Nummern:
 * - Nummern die bereits mit "+" beginnen werden beibehalten
 * - Nummern die mit "00" beginnen werden zu "+" konvertiert
 * - Nummern die mit "0" beginnen werden basierend auf dem countryCode normalisiert
 * - Fallback: +49 (Deutschland) wenn kein countryCode angegeben
 */
function normalizePhone(phone: string, countryCode?: string): string {
  // Entferne Leerzeichen, Bindestriche, Klammern
  let cleaned = phone.replace(/[\s\-\(\)\/]/g, "");

  // Nummer beginnt bereits mit "+" -> internationales Format, beibehalten
  if (cleaned.startsWith("+")) {
    return cleaned;
  }

  // Nummer beginnt mit "00" -> internationales Format ohne "+"
  if (cleaned.startsWith("00")) {
    return "+" + cleaned.substring(2);
  }

  // Nummer beginnt mit "0" -> nationale Nummer, Ländervorwahl hinzufügen
  if (cleaned.startsWith("0")) {
    // Mapping von ISO-Ländercodes zu Telefonvorwahlen
    const countryPhonePrefix: Record<string, string> = {
      "DE": "49", "AT": "43", "CH": "41", "NL": "31", "BE": "32",
      "FR": "33", "IT": "39", "ES": "34", "PT": "351", "PL": "48",
      "CZ": "420", "SK": "421", "HU": "36", "RO": "40", "BG": "359",
      "HR": "385", "SI": "386", "GR": "30", "DK": "45", "SE": "46",
      "FI": "358", "IE": "353", "LU": "352", "EE": "372", "LV": "371",
      "LT": "370", "MT": "356", "CY": "357",
    };

    const prefix = countryPhonePrefix[countryCode?.toUpperCase() || "DE"] || "49";
    return "+" + prefix + cleaned.substring(1);
  }

  // Keine führende 0 und kein "+" -> "+" voranstellen als Fallback
  return "+" + cleaned;
}

/**
 * Validiert eine GCLID auf grundlegende Korrektheit.
 * Ungültige GCLIDs werden abgelehnt, bevor sie an Google gesendet werden.
 * 
 * Gültige GCLIDs:
 * - Bestehen aus alphanumerischen Zeichen, Bindestrichen und Unterstrichen
 * - Sind mindestens 30 Zeichen lang
 * - Sind maximal 200 Zeichen lang
 */
function isValidGclid(gclid: string): boolean {
  if (!gclid || typeof gclid !== "string") return false;
  const trimmed = gclid.trim();
  if (trimmed.length < 30 || trimmed.length > 200) return false;
  // GCLIDs bestehen aus Base64-ähnlichen Zeichen
  if (!/^[a-zA-Z0-9_\-]+$/.test(trimmed)) return false;
  return true;
}

/**
 * Ermittelt den ISO-Ländercode basierend auf der Telefonnummer.
 * Wird als Fallback verwendet, wenn kein country_code mitgesendet wird.
 */
function detectCountryFromPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)\/]/g, "");
  if (cleaned.startsWith("+49") || cleaned.startsWith("0049")) return "DE";
  if (cleaned.startsWith("+43") || cleaned.startsWith("0043")) return "AT";
  if (cleaned.startsWith("+41") || cleaned.startsWith("0041")) return "CH";
  if (cleaned.startsWith("+31") || cleaned.startsWith("0031")) return "NL";
  if (cleaned.startsWith("+32") || cleaned.startsWith("0032")) return "BE";
  if (cleaned.startsWith("+33") || cleaned.startsWith("0033")) return "FR";
  if (cleaned.startsWith("+39") || cleaned.startsWith("0039")) return "IT";
  if (cleaned.startsWith("+34") || cleaned.startsWith("0034")) return "ES";
  if (cleaned.startsWith("+351")) return "PT";
  if (cleaned.startsWith("+48") || cleaned.startsWith("0048")) return "PL";
  if (cleaned.startsWith("+45")) return "DK";
  if (cleaned.startsWith("+46")) return "SE";
  if (cleaned.startsWith("+358")) return "FI";
  if (cleaned.startsWith("+353")) return "IE";
  if (cleaned.startsWith("+352")) return "LU";
  // Fallback: Deutschland
  return "DE";
}

/**
 * Differenzierte Conversion-Werte nach Lead-Qualität.
 * Basiert auf echten Datenbank-Auswertungen:
 *   - Wizard: 41% konvertieren zu Auktionen → 9€
 *   - Wertrechner: 2% konvertieren → 2.50€
 *
 * MUSS synchron mit CONVERSION_VALUES in gadsConversionService.ts bleiben!
 */
const CONVERSION_VALUE_MAP: Record<string, number> = {
  // Primäre Conversions
  wizard: 9.0,
  wizard_abgeschlossen: 9.0,
  wizard_completed: 9.0,
  terminbuchung: 9.0,
  kontakt: 1.0,
  kontaktformular_gesendet: 1.0,
  contact_form: 1.0,
  wertermittlung: 2.5,
  wertermittlung_lead: 2.5,
  wertrechner: 2.5,
  wertrechner_lead: 2.5,
  // Sekundäre Conversions
  landing_page_lead: 1.0,
  wizard_gestartet: 1.0,
  wizard_started: 1.0,
  wizard_fahrzeugdaten: 1.0,
  wizard_vehicle_data: 1.0,
  dealer_register: 1.0,
};

function getConversionValue(leadType: string, cfg?: TrackingConfigShape): number {
  // 1) prefer admin-managed value from tracking_config (mapped lead_type -> conversion key)
  const dbValues = cfg?.google_ads?.values ?? {};
  const leadTypeToKey: Record<string, string> = {
    wizard: "WIZARD_ABGESCHLOSSEN",
    wizard_abgeschlossen: "WIZARD_ABGESCHLOSSEN",
    wizard_completed: "WIZARD_ABGESCHLOSSEN",
    terminbuchung: "TERMINBUCHUNG",
    kontakt: "KONTAKTFORMULAR_GESENDET",
    kontaktformular_gesendet: "KONTAKTFORMULAR_GESENDET",
    contact_form: "KONTAKTFORMULAR_GESENDET",
    wertermittlung: "WERTERMITTLUNG_LEAD",
    wertermittlung_lead: "WERTERMITTLUNG_LEAD",
    wertrechner: "WERTRECHNER_LEAD",
    wertrechner_lead: "WERTRECHNER_LEAD",
    landing_page_lead: "LANDING_PAGE_LEAD",
    wizard_gestartet: "WIZARD_GESTARTET",
    wizard_started: "WIZARD_GESTARTET",
    wizard_fahrzeugdaten: "WIZARD_FAHRZEUGDATEN",
    wizard_vehicle_data: "WIZARD_FAHRZEUGDATEN",
  };
  const key = leadTypeToKey[leadType];
  if (key && typeof dbValues[key] === "number") return dbValues[key];
  // 2) fallback to in-file map for unmapped lead_types (e.g. dealer_register)
  return CONVERSION_VALUE_MAP[leadType] ?? 5.0;
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
    // Load admin-managed tracking config (60s in-memory cache).
    // Resolution order for each value: ENV override > DB config > hardcoded default.
    const trackingCfg = await loadTrackingConfig();
    const ga4MeasurementId =
      GA4_MEASUREMENT_ID_ENV?.trim() ||
      (trackingCfg.ga4?.measurement_id?.trim() ?? "") ||
      DEFAULT_GA4_MEASUREMENT_ID;
    const offlineLeadActionId =
      Deno.env.get("GADS_OFFLINE_LEAD_ACTION_ID")?.trim() ||
      (trackingCfg.server_side?.gads_offline_conversion_action_id?.trim() ?? "") ||
      DEFAULT_OFFLINE_LEAD_ACTION_ID;
    const gadsLoginCustomerId =
      Deno.env.get("GADS_LOGIN_CUSTOMER_ID")?.trim() ||
      (trackingCfg.server_side?.gads_login_customer_id?.trim() ?? "") ||
      DEFAULT_GADS_LOGIN_CUSTOMER_ID;

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
      gclid: rawGclid,
      gbraid,
      wbraid,
      msclkid,
      transaction_id,
      country_code,
    } = data;

    // GCLID-Validierung: Nur gültige GCLIDs verwenden
    const gclid = rawGclid && isValidGclid(rawGclid) ? rawGclid.trim() : undefined;
    if (rawGclid && !gclid) {
      console.warn(`[track-conversion] Ungültige GCLID verworfen: "${rawGclid?.substring(0, 20)}..." (Länge: ${rawGclid?.length})`);
    }

    // Ländercode ermitteln: Explizit mitgesendet > aus Telefonnummer abgeleitet > Fallback DE
    const resolvedCountryCode = country_code || (phone ? detectCountryFromPhone(phone) : "DE");

    console.log(`[track-conversion] Processing ${lead_type} conversion for: ${email || "unknown"} (txId: ${transaction_id || 'none'}, country: ${resolvedCountryCode})`);
    if (gclid) console.log(`[track-conversion] GCLID vorhanden: ${gclid.substring(0, 15)}...`);
    if (gbraid) console.log(`[track-conversion] GBRAID vorhanden`);
    if (wbraid) console.log(`[track-conversion] WBRAID vorhanden`);
    if (msclkid) console.log(`[track-conversion] MSCLKID vorhanden: ${msclkid.substring(0, 15)}... (wird in Phase 2 an Bing Ads API gesendet)`);

    const results: Record<string, unknown> = {};

    // --- GA4 Measurement Protocol ---
    if (GA4_API_SECRET) {
      try {
        // Enhanced Conversions: Gehashte Nutzerdaten für bessere Attribution
        const userData: Record<string, unknown> = {};

        if (email) {
          userData.sha256_email_address = [await sha256Hash(email)];
        }
        if (phone) {
          const normalizedPhone = normalizePhone(phone, resolvedCountryCode);
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
        // Differenzierter Conversion Value nach Lead-Qualität
        eventParams.value = getConversionValue(lead_type, trackingCfg);
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
        // Alle Click-IDs zusammen in einem Merge (vorher: jede überschrieb die vorherige!)
        const clickIdParams: Record<string, string> = {};
        if (gclid) clickIdParams.gclid = gclid;
        if (gbraid) clickIdParams.gbraid = gbraid;
        if (wbraid) clickIdParams.wbraid = wbraid;
        if (Object.keys(clickIdParams).length > 0) {
          (ga4Payload.events as Array<Record<string, unknown>>)[0].params = {
            ...eventParams,
            ...clickIdParams,
          };
        }

        const ga4Url = `https://www.google-analytics.com/mp/collect?measurement_id=${ga4MeasurementId}&api_secret=${GA4_API_SECRET}`;

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

    // --- Google Ads Offline Conversion Upload (wenn konfiguriert) ---
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
        // Differenzierter Conversion Value nach Lead-Qualität
        const conversionValue = getConversionValue(lead_type, trackingCfg);

        // Offline-Lead Conversion Action ID: editierbar im Admin-Backend
        // (site_settings.tracking_config.server_side.gads_offline_conversion_action_id)
        // mit Env-Variable GADS_OFFLINE_LEAD_ACTION_ID als Override.
        const OFFLINE_LEAD_CONVERSION_ACTION_ID = offlineLeadActionId;

        {
          const customerId = GADS_CUSTOMER_ID.replace(/-/g, "");

          // 3. Conversion-Payload aufbauen
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
            conversionAction: `customers/${customerId}/conversionActions/${OFFLINE_LEAD_CONVERSION_ACTION_ID}`,
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
              hashedPhoneNumber: await sha256Hash(normalizePhone(phone, resolvedCountryCode)),
            });
          }
          if (name) {
            const parts = name.trim().split(/\s+/);
            if (parts.length >= 2) {
              conversion.userIdentifiers.push({
                addressInfo: {
                  hashedFirstName: await sha256Hash(parts[0]),
                  hashedLastName: await sha256Hash(parts.slice(1).join(" ")),
                  countryCode: resolvedCountryCode,
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
              "login-customer-id": gadsLoginCustomerId, // editierbar im Admin-Backend
            },
            body: JSON.stringify(gadsPayload),
          });

          const gadsResult = await gadsResponse.json();

          results.gads = {
            status: gadsResponse.status,
            ok: gadsResponse.ok,
            hasGclid: !!gclid,
            conversionActionId: OFFLINE_LEAD_CONVERSION_ACTION_ID,
            leadType: lead_type,
            result: gadsResult,
          };

          console.log(`[track-conversion] Google Ads API: ${gadsResponse.status} (lead_type: ${lead_type}, actionId: ${OFFLINE_LEAD_CONVERSION_ACTION_ID}, GCLID: ${!!gclid})`);
          if (!gadsResponse.ok) {
            console.error("[track-conversion] Google Ads API Fehler:", JSON.stringify(gadsResult));
          }
        }
      } catch (gadsError) {
        console.error("[track-conversion] Google Ads API error:", gadsError);
        results.gads = { error: String(gadsError) };
      }
    } else {
      // Google Ads API nicht konfiguriert - das ist OK, GA4 Measurement Protocol
      // leitet Conversions über die GA4<->Google Ads Verknüpfung weiter
      results.gads = {
        skipped: true,
        reason: "Google Ads API Credentials nicht konfiguriert. Conversions werden über GA4->Google Ads Verknüpfung weitergeleitet.",
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
