import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

/**
 * Server-Side Conversion Tracking Edge Function
 * 
 * Sends conversion events to:
 * 1. GA4 via Measurement Protocol (with Enhanced Conversions: hashed email, phone, name)
 * 2. Works independently of client-side cookie consent
 * 
 * Required Supabase Secrets:
 * - GA4_API_SECRET: Measurement Protocol API Secret
 * - GA4_MEASUREMENT_ID: GA4 Measurement ID (e.g., G-H4BCV8DS0B)
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
}

/**
 * SHA-256 hash a string value for Enhanced Conversions
 * Google requires lowercase, trimmed, SHA-256 hashed values
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
 * Normalize phone number: remove spaces, dashes, and ensure E.164-like format
 */
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-\(\)]/g, "");
  // If starts with 0, assume German number and prepend +49
  if (cleaned.startsWith("0")) {
    cleaned = "+49" + cleaned.substring(1);
  }
  // If doesn't start with +, assume it needs +
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
    } = data;

    console.log(`[track-conversion] Processing ${lead_type} conversion for: ${email || "unknown"}`);

    const results: Record<string, unknown> = {};

    // ─── GA4 Measurement Protocol ───────────────────────────────────
    if (GA4_API_SECRET) {
      try {
        // Build user_data with hashed PII for Enhanced Conversions
        const userData: Record<string, unknown> = {};

        if (email) {
          userData.sha256_email_address = [await sha256Hash(email)];
        }
        if (phone) {
          const normalizedPhone = normalizePhone(phone);
          userData.sha256_phone_number = [await sha256Hash(normalizedPhone)];
        }
        if (name) {
          // Split name into first and last
          const parts = name.trim().split(/\s+/);
          if (parts.length >= 2) {
            userData.sha256_first_name = await sha256Hash(parts[0]);
            userData.sha256_last_name = await sha256Hash(parts.slice(1).join(" "));
          } else if (parts.length === 1) {
            userData.sha256_first_name = await sha256Hash(parts[0]);
          }
        }

        // Build event parameters
        const eventParams: Record<string, unknown> = {
          lead_type,
          engagement_time_msec: "1",
        };

        if (manufacturer) eventParams.vehicle_manufacturer = manufacturer;
        if (model) eventParams.vehicle_model = model;
        if (estimated_min) eventParams.estimated_value_min = estimated_min;
        if (estimated_max) eventParams.estimated_value_max = estimated_max;
        if (estimated_min && estimated_max) {
          eventParams.value = Math.round((estimated_min + estimated_max) / 2);
          eventParams.currency = "EUR";
        }

        // Use provided client_id or generate a server-side one
        const ga4ClientId = client_id || `server.${Date.now()}.${Math.random().toString(36).substring(2, 9)}`;

        const ga4Payload = {
          client_id: ga4ClientId,
          user_data: userData,
          events: [
            {
              name: event_name,
              params: eventParams,
            },
          ],
        };

        const ga4Url = `https://www.google-analytics.com/mp/collect?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`;

        const ga4Response = await fetch(ga4Url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ga4Payload),
        });

        results.ga4 = {
          status: ga4Response.status,
          ok: ga4Response.ok,
        };

        console.log(`[track-conversion] GA4 Measurement Protocol: ${ga4Response.status}`);
      } catch (ga4Error) {
        console.error("[track-conversion] GA4 error:", ga4Error);
        results.ga4 = { error: String(ga4Error) };
      }
    } else {
      console.warn("[track-conversion] GA4_API_SECRET not set, skipping GA4 tracking");
      results.ga4 = { skipped: true, reason: "GA4_API_SECRET not configured" };
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
