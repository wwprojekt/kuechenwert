/**
 * Production Rate Limiter for Supabase Edge Functions
 * Uses Supabase database for distributed rate limiting across function instances
 * 
 * This replaces the previous in-memory Map implementation which didn't work
 * in production where each Edge Function instance has isolated memory.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  error?: string;
}

/**
 * Create Supabase client for rate limiting operations
 * Uses service role key for database access
 */
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables for rate limiting');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Generate rate limit key from request
 * Prioritizes user ID from JWT, falls back to IP address
 */
function getDefaultKey(req: Request): string {
  // Try to get user ID from auth header
  const authHeader = req.headers.get('authorization');
  if (authHeader) {
    try {
      // Extract user info from JWT (simplified)
      const token = authHeader.replace('Bearer ', '');
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.sub) {
          return `user:${payload.sub}`;
        }
      }
    } catch {
      // Fall back to IP if JWT parsing fails
    }
  }

  // Fall back to IP-based limiting
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';
  
  return `ip:${ip}`;
}

/**
 * Check if request should be rate limited
 * Uses Supabase table for distributed state across function instances
 */
export async function checkRateLimit(
  req: Request,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  try {
    const supabase = getSupabaseClient();
    const key = config.keyGenerator ? config.keyGenerator(req) : getDefaultKey(req);
    const now = new Date();
    const windowEnd = new Date(now.getTime() + config.windowMs);

    // Try to get existing rate limit entry
    const { data: existing, error: fetchError } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('key', key)
      .single();

    // Handle case where entry doesn't exist (not an error)
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Rate limiter fetch error:', fetchError);
    }

    if (!existing || new Date(existing.window_end) < now) {
      // No entry or window expired - create/reset entry
      const { error: upsertError } = await supabase
        .from('rate_limits')
        .upsert({
          key,
          count: 1,
          window_start: now.toISOString(),
          window_end: windowEnd.toISOString(),
          updated_at: now.toISOString()
        }, { onConflict: 'key' });

      if (upsertError) {
        console.error('Rate limiter upsert error:', upsertError);
        // Fail open on error
        return {
          allowed: true,
          remaining: config.maxRequests - 1,
          resetTime: windowEnd.getTime(),
          error: 'Rate limiter upsert error'
        };
      }

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: windowEnd.getTime()
      };
    }

    // Check if rate limit exceeded
    if (existing.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: new Date(existing.window_end).getTime(),
        error: 'Rate limit exceeded'
      };
    }

    // Increment counter atomically
    const { error: updateError } = await supabase
      .from('rate_limits')
      .update({ 
        count: existing.count + 1,
        updated_at: now.toISOString()
      })
      .eq('key', key)
      .eq('count', existing.count); // Optimistic locking

    if (updateError) {
      console.error('Rate limiter update error:', updateError);
    }

    return {
      allowed: true,
      remaining: config.maxRequests - existing.count - 1,
      resetTime: new Date(existing.window_end).getTime()
    };

  } catch (error) {
    // On error, fail open (allow the request) but log the issue
    console.error('Rate limiter error:', error);
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowMs,
      error: 'Rate limiter error'
    };
  }
}

/**
 * Create rate limit response headers
 * Following standard rate limit header conventions
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
    'X-RateLimit-Allowed': result.allowed.toString(),
  };
}

/**
 * Create rate limit error response (HTTP 429)
 */
export function createRateLimitErrorResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string> = {}
): Response {
  const retryAfterSeconds = Math.max(1, Math.ceil((result.resetTime - Date.now()) / 1000));
  
  const headers = {
    ...corsHeaders,
    ...createRateLimitHeaders(result),
    'Content-Type': 'application/json',
    'Retry-After': retryAfterSeconds.toString()
  };

  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Try again after ${new Date(result.resetTime).toISOString()}`,
      resetTime: result.resetTime,
      retryAfter: retryAfterSeconds
    }),
    {
      status: 429,
      headers
    }
  );
}

/**
 * Predefined rate limit configurations for different endpoint types
 */
export const RATE_LIMITS = {
  // General API endpoints - generous limit
  API_GENERAL: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100
  },

  // Authentication endpoints - stricter to prevent brute force
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5
  },

  // Bidding endpoints - prevent bid spam
  BIDDING: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10
  },

  // File upload endpoints
  UPLOAD: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20
  },

  // Admin endpoints - higher limits for admins
  ADMIN: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200
  }
} as const;
