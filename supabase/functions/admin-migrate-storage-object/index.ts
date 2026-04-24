import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';
import { checkServiceRoleOrAdmin } from '../_shared/auth.ts';

/**
 * Edge Function: admin-migrate-storage-object
 *
 * Admin-only one-shot helper to migrate a single storage object from one
 * path to another within the same bucket. Typical use case: a user had a
 * duplicate account, their files live under `<old-uid>/…`, and we want to
 * consolidate them under `<new-uid>/…` before deleting the old auth user.
 *
 * Flow:
 *   1. download(old)
 *   2. upload(new, bytes)
 *   3. remove(old)
 *   4. createSignedUrl(new, 10 years)
 *
 * Body: { bucket: string, fromPath: string, toPath: string, upsert?: boolean }
 * Auth: service_role or admin
 *
 * Returns: { success, signedUrl, expiresInSeconds }
 */

const TEN_YEARS_SECONDS = 10 * 365 * 24 * 60 * 60;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }
  const corsHeaders = getCorsHeaders(req);

  const authResult = await checkServiceRoleOrAdmin(req, corsHeaders);
  if (!authResult.authorized) return authResult.response;

  try {
    const { bucket, fromPath, toPath, upsert = false } = await req.json();

    if (!bucket || !fromPath || !toPath) {
      return new Response(
        JSON.stringify({ error: 'bucket, fromPath and toPath are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (fromPath === toPath) {
      return new Response(
        JSON.stringify({ error: 'fromPath and toPath must differ' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: blob, error: dlErr } = await supabase.storage.from(bucket).download(fromPath);
    if (dlErr || !blob) {
      return new Response(
        JSON.stringify({ error: `download failed: ${dlErr?.message || 'no data'}`, fromPath }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const contentType = blob.type || 'application/octet-stream';
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const { error: upErr } = await supabase.storage.from(bucket).upload(toPath, bytes, {
      contentType,
      cacheControl: '31536000, immutable',
      upsert,
    });
    if (upErr) {
      return new Response(
        JSON.stringify({ error: `upload failed: ${upErr.message}`, toPath }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { error: rmErr } = await supabase.storage.from(bucket).remove([fromPath]);
    if (rmErr) {
      console.warn(`migrate-storage-object: remove failed for ${fromPath}: ${rmErr.message}`);
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrl(toPath, TEN_YEARS_SECONDS);
    if (signErr || !signed) {
      return new Response(
        JSON.stringify({
          success: true,
          warning: 'object moved but signing new URL failed',
          signError: signErr?.message ?? null,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        bucket,
        fromPath,
        toPath,
        signedUrl: signed.signedUrl,
        expiresInSeconds: TEN_YEARS_SECONDS,
        bytes: bytes.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e: any) {
    console.error('admin-migrate-storage-object error:', e);
    return new Response(
      JSON.stringify({ error: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
