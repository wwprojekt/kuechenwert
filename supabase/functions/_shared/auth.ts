/**
 * Shared authentication helper for Edge Functions.
 *
 * Provides a robust service-role check that works regardless of whether
 * SUPABASE_SERVICE_ROLE_KEY contains the legacy JWT or the new sb_secret_... key.
 *
 * Strategy:
 * 1. Try direct string comparison with SUPABASE_SERVICE_ROLE_KEY (legacy approach)
 * 2. If that fails, decode the JWT payload and check if role === "service_role"
 * 3. If neither works, fall back to user-based admin check
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';

/**
 * Decode a JWT payload without verification (we trust Supabase's relay).
 * Returns null if the token is not a valid JWT.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Base64url decode
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Check if the request is authenticated as service_role or admin.
 *
 * @returns { authorized: true } if authorized, or { authorized: false, response: Response } with error response
 */
export async function checkServiceRoleOrAdmin(
  req: Request,
  corsHeaders: Record<string, string> = {}
): Promise<{ authorized: true } | { authorized: false; response: Response }> {
  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // ─── Method 1: Direct string comparison (works when env var = legacy JWT) ───
  if (serviceRoleKey && authHeader.includes(serviceRoleKey)) {
    return { authorized: true };
  }

  // ─── Method 2: Decode JWT and check role claim ───
  if (token) {
    const payload = decodeJwtPayload(token);
    if (payload && payload.role === 'service_role') {
      return { authorized: true };
    }
  }

  // ─── Method 3: Check if caller is an authenticated admin user ───
  if (token) {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
      const supabaseAuth = createClient(supabaseUrl, anonKey);
      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

      if (!userError && user) {
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || anonKey);
        const { data: roles } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        const isAdmin = roles?.some((r: { role: string }) => r.role === 'admin');
        if (isAdmin) {
          return { authorized: true };
        }
      }
    } catch {
      // Fall through to unauthorized
    }
  }

  // ─── Not authorized ───
  return {
    authorized: false,
    response: new Response(
      JSON.stringify({ error: 'Nicht autorisiert: Ungültiger oder fehlender Token' }),
      {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    ),
  };
}
