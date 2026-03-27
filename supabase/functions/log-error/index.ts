import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.100.1';
import { checkRateLimit, createRateLimitErrorResponse } from '../_shared/rate-limiter.ts';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/cors.ts';

/**
 * Edge Function: log-error
 *
 * Logs frontend errors to the error_logs table.
 * Rate-limited to prevent abuse (max 30 requests per minute per IP/user).
 */

const LOG_ERROR_RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,      // max 30 error logs per minute per client
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightRequest(req);
  }

  const corsHeaders = getCorsHeaders(req);

  // Rate limiting
  const rateLimitResult = await checkRateLimit(req, LOG_ERROR_RATE_LIMIT);
  if (!rateLimitResult.allowed) {
    return createRateLimitErrorResponse(rateLimitResult, corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();

    const errorData: Record<string, unknown> = {
      error_code: body.error_code || 'UNKNOWN',
      error_message: body.error_message || 'Unknown error',
      error_category: body.error_category || 'unknown',
      severity: body.severity || 'low',
      page_url: body.page_url || '',
      page_path: body.page_path || '',
      page_title: body.page_title || null,
      component_name: body.component_name || null,
      user_id: body.user_id || null,
      user_role: body.user_role || null,
      user_email: body.user_email || null,
      stack_trace: body.stack_trace || null,
      original_error: body.original_error || null,
      metadata: body.metadata || {},
      user_agent: body.user_agent || null,
      browser: body.browser || null,
      device_type: body.device_type || null,
      error_hash: body.error_hash || null,
      session_id: body.session_id || null,
      app_version: body.app_version || null,
      http_status: body.http_status || null,
      request_info: body.request_info || {},
      breadcrumbs: body.breadcrumbs || [],
      error_source: body.error_source || 'caught',
      screen_resolution: body.screen_resolution || null,
      connection_type: body.connection_type || null,
      memory_usage: body.memory_usage || null,
    };

    // Deduplicate by error_hash if provided
    if (body.error_hash) {
      const { data: existing } = await supabase
        .from('error_logs')
        .select('id, occurrence_count')
        .eq('error_hash', body.error_hash)
        .eq('is_resolved', false)
        .single();

      if (existing) {
        const { error: updateError } = await supabase
          .from('error_logs')
          .update({
            occurrence_count: (existing.occurrence_count || 1) + 1,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;

        return new Response(
          JSON.stringify({ success: true, action: 'updated', id: existing.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    errorData.first_seen_at = new Date().toISOString();
    errorData.last_seen_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('error_logs')
      .insert(errorData)
      .select('id')
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, action: 'created', id: data.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error logging failed:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
