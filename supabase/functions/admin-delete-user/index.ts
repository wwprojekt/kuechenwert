import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { edgeLogger } from "../_shared/edgeLogger.ts";
import { checkServiceRoleOrAdmin } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Admin-only Edge Function to completely delete a user.
 *
 * This function removes the user from auth.users using the Supabase Admin API.
 * Supabase will cascade-delete related data in auth schema tables.
 * We also explicitly clean up application-level tables (profiles, user_roles,
 * dealer_applications, etc.) to ensure a clean removal.
 *
 * Body: { userId: string }
 *
 * Returns: { success: true, message: string }
 */

interface DeleteUserRequest {
  userId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflightRequest(req);
  }

  const headers = { ...getCorsHeaders(req), "Content-Type": "application/json" };

  // Check authorization (admin only)
  const authResult = await checkServiceRoleOrAdmin(req, getCorsHeaders(req));
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const body: DeleteUserRequest = await req.json();

    if (!body.userId || !body.userId.trim()) {
      return new Response(
        JSON.stringify({ error: "userId ist erforderlich" }),
        { status: 400, headers }
      );
    }

    const userId = body.userId.trim();
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Verify user exists in auth.users
    const { data: authUser, error: getUserError } = await supabase.auth.admin.getUserById(userId);

    if (getUserError || !authUser?.user) {
      edgeLogger.warn(`User ${userId} not found in auth.users: ${getUserError?.message}`);
    }

    const userEmail = authUser?.user?.email || "unknown";
    edgeLogger.info(`Deleting user ${userId} (${userEmail}) completely`);

    // 2. Delete from auth.users FIRST (critical step)
    // If this fails, we abort without touching app data to avoid orphaned state.
    if (authUser?.user) {
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);

      if (deleteAuthError) {
        edgeLogger.error(`Failed to delete auth user ${userId}: ${deleteAuthError.message}`);
        return new Response(
          JSON.stringify({
            error: `Auth-Benutzer konnte nicht gelöscht werden: ${deleteAuthError.message}`,
          }),
          { status: 500, headers }
        );
      }
    }

    // 3. Clean up application-level tables (order matters for foreign keys)
    // Auth user is already deleted, so these are best-effort cleanup.

    // Delete dealer applications
    const { error: dealerAppError } = await supabase
      .from("dealer_applications")
      .delete()
      .eq("user_id", userId);
    if (dealerAppError) {
      edgeLogger.warn(`Could not delete dealer_applications for ${userId}: ${dealerAppError.message}`);
    }

    // Delete user roles
    const { error: rolesError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);
    if (rolesError) {
      edgeLogger.warn(`Could not delete user_roles for ${userId}: ${rolesError.message}`);
    }

    // Delete profile
    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);
    if (profileError) {
      edgeLogger.warn(`Could not delete profile for ${userId}: ${profileError.message}`);
    }

    edgeLogger.info(`Successfully deleted user ${userId} (${userEmail}) from all tables`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Benutzer ${userEmail} wurde vollständig gelöscht`,
      }),
      { status: 200, headers }
    );
  } catch (error: any) {
    edgeLogger.error("Error in admin-delete-user:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Interner Serverfehler" }),
      { status: 500, headers }
    );
  }
};

serve(handler);
