/**
 * Shared CORS configuration for all Edge Functions.
 *
 * Allowed origins:
 * - Production: https://caravanwert.de and https://www.caravanwert.de
 * - Staging/Preview: Netlify deploy previews (*.netlify.app)
 * - Development: localhost on any port
 *
 * Usage in Edge Functions:
 *   import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
 *
 *   Deno.serve(async (req) => {
 *     // Handle CORS preflight
 *     if (req.method === 'OPTIONS') {
 *       return handleCorsPreflightRequest(req);
 *     }
 *
 *     // ... business logic ...
 *
 *     return new Response(JSON.stringify(data), {
 *       headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
 *     });
 *   });
 */

const ALLOWED_ORIGINS: string[] = [
  'https://caravanwert.de',
  'https://www.caravanwert.de',
];

/**
 * Checks whether the given origin is allowed.
 * Matches exact production origins, Netlify deploy previews, and localhost.
 */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;

  // Exact match for production domains
  if (ALLOWED_ORIGINS.includes(origin)) return true;

  // Netlify deploy previews: https://<deploy-id>--<site>.netlify.app
  if (/^https:\/\/[a-z0-9-]+\.netlify\.app$/.test(origin)) return true;

  // Local development: http://localhost:<port>
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;

  // Local development: http://127.0.0.1:<port>
  if (/^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return true;

  return false;
}

/**
 * Returns CORS headers with the appropriate Access-Control-Allow-Origin
 * based on the request's Origin header. If the origin is not allowed,
 * the first production origin is used (requests will be blocked by the browser).
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  const allowedOrigin = isAllowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Vary': 'Origin',
  };
}

/**
 * Returns a complete preflight (OPTIONS) response with CORS headers.
 */
export function handleCorsPreflightRequest(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(req),
  });
}
