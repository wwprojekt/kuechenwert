/**
 * Shared authentication helper for Edge Functions.
 *
 * Strategy:
 * 1. Direct constant-time comparison: Bearer token equals SUPABASE_SERVICE_ROLE_KEY
 * 2. User JWT verified via Supabase auth.getUser + admin role in user_roles
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
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
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';

  // ─── Method 1: Direct constant-time comparison with service role key ───
  if (serviceRoleKey && token.length > 0 && timingSafeEqual(token, serviceRoleKey)) {
    return { authorized: true };
  }

  // ─── Method 2: Verify user JWT via Supabase auth.getUser + check admin role ───
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
