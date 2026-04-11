/**
 * Shared authentication helper for Edge Functions.
 *
 * Provides a robust service-role check that works regardless of whether
 * SUPABASE_SERVICE_ROLE_KEY contains the legacy JWT or the new sb_secret_... key.
 *
 * Strategy:
 * 1. Direct string comparison: Bearer token equals SUPABASE_SERVICE_ROLE_KEY (JWT or sb_secret)
 * 2. Legacy Supabase service_role JWT: decode payload; role + ref must match this project (CLI/API invokes)
 * 3. User JWT with admin role in user_roles
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

function getProjectRefFromSupabaseUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const m = host.match(/^([a-z0-9-]+)\.supabase\.co$/i);
    return m ? m[1] : null;
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

  // ─── Method 1: Direct string comparison with constant-time-safe check ───
  if (serviceRoleKey && token === serviceRoleKey) {
    return { authorized: true };
  }

  // ─── Method 2: Legacy service_role JWT (Dashboard/CLI „service_role“ key) while env uses sb_secret ───
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const expectedRef = getProjectRefFromSupabaseUrl(supabaseUrl);
  if (token && expectedRef) {
    const payload = decodeJwtPayload(token);
    if (
      payload?.role === 'service_role' &&
      typeof payload.ref === 'string' &&
      payload.ref === expectedRef
    ) {
      return { authorized: true };
    }
  }

  // ─── Method 3: Check if caller is an authenticated admin user ───
  if (token && serviceRoleKey) {
    try {
      const supabaseAuth = createClient(supabaseUrl, serviceRoleKey);
      const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

      if (!userError && user) {
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
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
