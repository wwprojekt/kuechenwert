import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { edgeLogger } from "../_shared/edgeLogger.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Admin-only Edge Function to create a user account for a customer.
 * Used when admin converts a wizard session to a kitchen listing.
 *
 * NOTE: verify_jwt is set to false to avoid 401 errors from expired tokens.
 * Authentication is handled internally by verifying the caller is an admin.
 *
 * The user is created with email_confirm: false so they can't log in yet.
 * A separate "send-registration-invite" function sends them a magic link.
 *
 * Body: {
 *   email: string (required)
 *   firstName?: string
 *   lastName?: string
 *   phone?: string
 *   role?: "private" | "seller" (default: "private")
 * }
 *
 * Returns: { userId: string, isExisting: boolean }
 */

interface CreateUserRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };

  try {
    // ── Internal Auth Check ──────────────────────────────────────────────
    // Since verify_jwt is false, we manually verify the caller is an admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Nicht autorisiert – kein Token vorhanden" }),
        { status: 401, headers }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    // Verify the caller's identity using service_role + token parameter
    // (same pattern as place-bid, instant-buy – avoids SUPABASE_ANON_KEY dependency)
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user: callerUser }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !callerUser) {
      edgeLogger.warn("Auth failed for admin-create-user:", authError?.message || "No user");
      return new Response(
        JSON.stringify({ error: "Nicht autorisiert – ungültiger Token" }),
        { status: 401, headers }
      );
    }

    // Verify the caller is an admin using the service role client
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .maybeSingle();

    if (!roleData || roleData.role !== "admin") {
      edgeLogger.warn(`Non-admin user ${callerUser.id} tried to call admin-create-user`);
      return new Response(
        JSON.stringify({ error: "Zugriff verweigert – nur für Administratoren" }),
        { status: 403, headers }
      );
    }

    // ── Business Logic ───────────────────────────────────────────────────
    const body: CreateUserRequest = await req.json();

    if (!body.email || !body.email.trim()) {
      return new Response(
        JSON.stringify({ error: "E-Mail-Adresse ist erforderlich" }),
        { status: 400, headers }
      );
    }

    const email = body.email.trim().toLowerCase();
    const firstName = body.firstName?.trim() || "";
    const lastName = body.lastName?.trim() || "";
    const phone = body.phone?.trim() || null;
    const role = body.role || "private";

    // Check if user already exists by email in profiles table
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      edgeLogger.info(`User already exists for ${email}: ${existingProfile.id}`);
      return new Response(
        JSON.stringify({
          userId: existingProfile.id,
          isExisting: true,
          message: "Benutzer existiert bereits",
        }),
        { status: 200, headers }
      );
    }

    // Create user via Supabase Admin API
    // email_confirm: false means the user exists but hasn't confirmed their email yet
    // They will receive a magic link via send-registration-invite to activate their account
    const randomPassword = crypto.randomUUID() + "Aa1!"; // Strong random password (user will use magic link instead)

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: randomPassword,
      email_confirm: false,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        phone: phone,
      },
    });

    if (createError) {
      // If user already exists in auth but not in profiles
      if (createError.message?.includes("already been registered") || createError.message?.includes("already exists")) {
        edgeLogger.info(`Auth user already exists for ${email}, looking up...`);

        // Try to find the user in profiles
        const { data: profileByEmail } = await adminClient
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        if (profileByEmail) {
          return new Response(
            JSON.stringify({
              userId: profileByEmail.id,
              isExisting: true,
              message: "Benutzer existiert bereits",
            }),
            { status: 200, headers }
          );
        }

        // User exists in auth but not in profiles - this shouldn't happen normally
        return new Response(
          JSON.stringify({ error: "Benutzer existiert in Auth, aber Profil fehlt. Bitte manuell prüfen." }),
          { status: 409, headers }
        );
      }

      edgeLogger.error("Failed to create user:", createError.message);
      return new Response(
        JSON.stringify({ error: `Benutzer konnte nicht erstellt werden: ${createError.message}` }),
        { status: 500, headers }
      );
    }

    const userId = newUser.user.id;
    edgeLogger.info(`Created new user ${userId} for ${email}`);

    // Create profile entry
    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: userId,
        email,
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phone,
        account_type: role,
      }, { onConflict: "id" });

    if (profileError) {
      edgeLogger.warn("Profile creation/update failed (non-critical):", profileError.message);
      // Non-critical: the profile trigger on auth.users might handle this
    }

    // Assign user role
    const { error: roleError } = await adminClient
      .from("user_roles")
      .upsert({
        user_id: userId,
        role: role === "dealer" ? "dealer" : "seller",
      }, { onConflict: "user_id" });

    if (roleError) {
      edgeLogger.warn("Role assignment failed (non-critical):", roleError.message);
    }

    return new Response(
      JSON.stringify({
        userId,
        isExisting: false,
        message: "Benutzer erfolgreich erstellt",
      }),
      { status: 201, headers }
    );

  } catch (error: any) {
    edgeLogger.error("Error in admin-create-user:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Interner Serverfehler" }),
      { status: 500, headers }
    );
  }
};

serve(handler);
