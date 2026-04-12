import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { edgeLogger } from "../_shared/edgeLogger.ts";
import { checkRateLimit, createRateLimitErrorResponse } from "../_shared/rate-limiter.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * register-dealer – Public Edge Function for dealer self-registration.
 *
 * Replaces the previous approach of calling supabase.auth.signUp() from the
 * frontend, which triggered Supabase's generic confirmation email and caused
 * duplicate/incorrect welcome emails via the on_user_email_confirmed trigger.
 *
 * This function:
 * 1. Creates the auth user via admin.createUser (email_confirm: false)
 *    → handle_new_user trigger automatically creates profile + dealer_application
 * 2. Generates a signup confirmation link (NOT a magic link – so the user
 *    must still log in with their password after confirming)
 * 3. Calls send-dealer-notification (type: application_received) with the
 *    confirmation URL embedded in a professional CaravanWert-branded email
 *
 * The result: The dealer receives exactly ONE email – a beautiful,
 * branded "Bewerbung eingegangen + E-Mail bestätigen" email.
 *
 * Security: This function is PUBLIC (no auth required) because it's the
 * registration endpoint. It uses the service_role key internally.
 * Rate limiting is handled by Supabase Edge Functions infrastructure.
 */

interface RegisterDealerRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  companyName: string;
  companyAddress: string;
  companyPostalCode: string;
  companyCity: string;
  country: string;
  contactPersonName: string;
  contactPersonPosition?: string;
  website?: string;
  legalForm?: string;
  foundedYear?: string;
  vatId?: string;
  agbAccepted?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };

  // Rate limit: max 5 registrations per IP per 15 minutes
  const rateLimitResult = await checkRateLimit(req, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    keyGenerator: (r) => {
      const ip = r.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || r.headers.get('x-real-ip')
        || 'unknown';
      return `register-dealer:${ip}`;
    },
  });
  if (!rateLimitResult.allowed) {
    return createRateLimitErrorResponse(rateLimitResult, getCorsHeaders(req));
  }

  try {
    const body: RegisterDealerRequest = await req.json();

    // ── Validation ──────────────────────────────────────────────────────
    if (!body.email?.trim()) {
      return new Response(
        JSON.stringify({ error: "E-Mail-Adresse ist erforderlich" }),
        { status: 400, headers }
      );
    }
    if (!body.password || body.password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Passwort muss mindestens 8 Zeichen lang sein" }),
        { status: 400, headers }
      );
    }
    if (!body.companyName?.trim()) {
      return new Response(
        JSON.stringify({ error: "Firmenname ist erforderlich" }),
        { status: 400, headers }
      );
    }
    if (body.agbAccepted === false) {
      return new Response(
        JSON.stringify({ error: "Sie müssen die AGB und Datenschutzbestimmungen akzeptieren" }),
        { status: 400, headers }
      );
    }
    if (body.agbAccepted !== true) {
      edgeLogger.warn(`Dealer registration without explicit AGB acceptance (legacy frontend): ${body.email}`);
    }

    const email = body.email.trim().toLowerCase();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Step 1: Check if user already exists ────────────────────────────
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      edgeLogger.info(`Dealer registration attempt for existing email: ${email}`);
      return new Response(
        JSON.stringify({
          error: "Ein Konto mit dieser E-Mail-Adresse existiert bereits. Bitte melden Sie sich an oder verwenden Sie eine andere E-Mail-Adresse.",
          code: "USER_EXISTS",
        }),
        { status: 409, headers }
      );
    }

    // ── Step 2: Create auth user ────────────────────────────────────────
    // email_confirm: false → email_confirmed_at stays NULL
    // The user must confirm their email via the link we send
    // handle_new_user trigger fires automatically (AFTER INSERT on auth.users):
    //   → Creates profile (id, email, first_name, last_name, phone)
    //   → Creates user_role (seller – all users start as seller)
    //   → Creates dealer_application (status: pending) because user_type = 'dealer'
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: body.password,
      email_confirm: false,
      user_metadata: {
        first_name: body.firstName || body.contactPersonName?.split(" ")[0] || "",
        last_name: body.lastName || body.contactPersonName?.split(" ").slice(1).join(" ") || "",
        phone: body.phone || "",
        company_name: body.companyName,
        company_address: body.companyAddress,
        company_postal_code: body.companyPostalCode,
        company_city: body.companyCity,
        country: body.country || "DE",
        contact_person_name: body.contactPersonName,
        contact_person_position: body.contactPersonPosition || null,
        website: body.website || null,
        legal_form: body.legalForm || null,
        founded_year: body.foundedYear || null,
        vat_id: body.vatId || null,
        is_dealer: true,
        user_type: "dealer",
      },
    });

    if (createError) {
      // Handle "already registered" edge case (user in auth but not in profiles)
      if (
        createError.message?.includes("already been registered") ||
        createError.message?.includes("already exists")
      ) {
        edgeLogger.warn(`Auth user already exists for ${email} but no profile found`);
        return new Response(
          JSON.stringify({
            error: "Ein Konto mit dieser E-Mail-Adresse existiert bereits. Bitte melden Sie sich an oder verwenden Sie eine andere E-Mail-Adresse.",
            code: "USER_EXISTS",
          }),
          { status: 409, headers }
        );
      }
      edgeLogger.error("Failed to create dealer user:", createError.message);
      return new Response(
        JSON.stringify({ error: `Registrierung fehlgeschlagen: ${createError.message}` }),
        { status: 500, headers }
      );
    }

    const userId = newUser.user.id;
    edgeLogger.info(`Created dealer user ${userId} for ${email}`);

    // ── Record AGB acceptance (server-side for legal audit trail) ─────
    try {
      await supabase.rpc('record_agb_acceptance', {
        p_user_id: userId,
        p_context: 'dealer_registration',
        p_ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null,
        p_user_agent: req.headers.get('user-agent') || null,
      });
      edgeLogger.info(`Recorded AGB acceptance for dealer ${userId}`);
    } catch (agbErr) {
      edgeLogger.error("Failed to record AGB acceptance:", agbErr);
    }

    // ── Step 3: Generate email confirmation link ────────────────────────
    // We use type: "signup" so that when the user clicks the link,
    // Supabase sets email_confirmed_at. The user then needs to log in
    // with their password (unlike magiclink which auto-logs in).
    const redirectUrl = "https://caravanwert.de/login";
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "signup",
      email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    let confirmationUrl = "";
    if (linkError) {
      edgeLogger.error("Failed to generate confirmation link:", linkError.message);
      // Non-critical: The user can still request a new confirmation link later.
      // We continue and send the email without the confirmation button.
    } else {
      // The action_link goes through Supabase's auth endpoint which handles
      // the token verification and redirect. We use it as-is.
      confirmationUrl = linkData?.properties?.action_link || "";
      edgeLogger.info(`Generated confirmation link for ${email}`);
    }

    // ── Step 4: Send branded application_received email ─────────────────
    // This calls our existing send-dealer-notification function internally.
    // We pass the confirmationUrl so the email includes the confirm button.
    try {
      const notificationResponse = await fetch(
        `${SUPABASE_URL}/functions/v1/send-dealer-notification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            email,
            name: body.contactPersonName || `${body.firstName} ${body.lastName}`.trim(),
            type: "application_received",
            companyName: body.companyName,
            confirmationUrl,
          }),
        }
      );

      if (!notificationResponse.ok) {
        const errText = await notificationResponse.text();
        edgeLogger.error("Failed to send dealer notification:", errText);
        // Non-critical: User is created, they can request a new email later
      } else {
        edgeLogger.info(`Sent application_received email to ${email}`);
      }
    } catch (emailErr) {
      edgeLogger.error("Error calling send-dealer-notification:", emailErr);
      // Non-critical: User is created, they can request a new email later
    }

    // ── Step 5: Send admin notification about new dealer application ────
    try {
      const adminNotifyRes = await fetch(
        `${SUPABASE_URL}/functions/v1/send-lead-notification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            type: "dealer",
            name: body.contactPersonName || `${body.firstName} ${body.lastName}`.trim(),
            email,
            phone: body.phone || undefined,
            companyName: body.companyName,
            country: body.country || "DE",
            skipUserEmail: true,
          }),
        }
      );
      if (!adminNotifyRes.ok) {
        edgeLogger.error("Admin notification failed:", adminNotifyRes.status, await adminNotifyRes.text());
      } else {
        edgeLogger.info(`Sent admin notification for new dealer application: ${email}`);
      }
    } catch (adminEmailErr) {
      edgeLogger.error("Error sending admin notification:", adminEmailErr);
      // Non-critical
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        message: "Registrierung erfolgreich. Bitte bestätigen Sie Ihre E-Mail-Adresse.",
      }),
      { status: 201, headers }
    );
  } catch (error: any) {
    edgeLogger.error("Error in register-dealer:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Interner Serverfehler" }),
      { status: 500, headers }
    );
  }
};

serve(handler);
