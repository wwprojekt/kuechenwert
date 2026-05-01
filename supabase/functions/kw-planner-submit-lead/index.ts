/**
 * KuechenWert Funnel C — Lead-Capture nach AI-Generierung
 *
 * Nimmt eine existierende planner_session + Kontaktdaten und erzeugt einen
 * leads-Eintrag (funnel_type = 'traumkueche'). Danach wird die Session
 * geschlossen (status = 'completed', contact_captured_at).
 */

// @ts-ignore Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// deno-lint-ignore no-explicit-any
declare const Deno: any;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type SubmitBody = {
  session_token: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  postal_code: string;
  timeframe_months?: number;
  consent_call?: boolean;
  consent_marketing?: boolean;
};

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function pickClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return handleCorsPreflightRequest(req);

  const cors = getCorsHeaders(req);
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (
    !body.session_token ||
    !body.first_name ||
    !body.last_name ||
    !body.email ||
    !body.postal_code
  ) {
    return json({ error: "session_token, Vor-/Nachname, Email und PLZ sind Pflicht." }, 400);
  }
  if (!isEmail(body.email)) {
    return json({ error: "Ungueltige E-Mail-Adresse." }, 400);
  }
  if (!/^\d{5}$/.test(body.postal_code)) {
    return json({ error: "PLZ muss 5 Ziffern haben." }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Auth-Header auslesen: wenn der Client einen gueltigen JWT mitschickt,
  // koennen wir den Lead mit dem User verknuepfen und er sieht ihn im
  // Dashboard unter "Meine Anfragen". Guest-Submits bleiben funktional.
  let userId: string | null = null;
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length);
    const { data: authUser } = await supabase.auth.getUser(token);
    userId = authUser?.user?.id ?? null;
  }

  const { data: session, error: sErr } = await supabase
    .from("planner_sessions")
    .select("id,session_token,spec,lead_id,status,utm_source,utm_medium,utm_campaign,utm_content,utm_term")
    .eq("session_token", body.session_token)
    .maybeSingle();
  if (sErr) {
    console.error("session lookup", sErr);
    return json({ error: "Session-Lookup fehlgeschlagen." }, 500);
  }
  if (!session) {
    return json({ error: "Session nicht gefunden." }, 404);
  }
  if (session.lead_id) {
    return json({ ok: true, lead_id: session.lead_id, already_submitted: true });
  }

  const spec = (session.spec ?? {}) as Record<string, unknown>;
  const ip = pickClientIp(req);

  const { data: lead, error: lErr } = await supabase
    .from("leads")
    .insert({
      funnel_type: "traumkueche",
      funnel_variant: "C",
      status: "new",
      tier: "standard",
      user_id: userId,
      postal_code: body.postal_code,
      kitchen_form: (spec.kitchen_form as string) ?? null,
      kitchen_style: (spec.kitchen_style as string) ?? null,
      timeframe_months: body.timeframe_months ?? null,
      first_name: body.first_name.trim().slice(0, 100),
      last_name: body.last_name.trim().slice(0, 100),
      email: body.email.trim().toLowerCase(),
      phone: body.phone?.trim().slice(0, 40) ?? null,
      consent_call: !!body.consent_call,
      consent_marketing: !!body.consent_marketing,
      funnel_answers: spec,
      utm_source: session.utm_source,
      utm_medium: session.utm_medium,
      utm_campaign: session.utm_campaign,
      utm_content: session.utm_content,
      utm_term: session.utm_term,
      ip_address: ip,
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    })
    .select("id")
    .single();
  if (lErr || !lead) {
    console.error("lead insert", lErr);
    return json({ error: "Lead konnte nicht angelegt werden." }, 500);
  }

  await supabase
    .from("planner_sessions")
    .update({
      lead_id: lead.id,
      status: "completed",
      contact_captured_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  return json({ ok: true, lead_id: lead.id });
});
