/**
 * Microsoft Advertising OAuth Token Manager
 *
 * Microsoft rotates the refresh token on every call to /token. If we kept the
 * refresh token in env-vars (Supabase Secrets) only, the Edge Function would
 * work exactly ONCE per deploy and then 401 forever.
 *
 * This helper:
 *   1. reads the *current* refresh token from `public.bing_oauth_state`
 *      (falls back to env-var on first call ever, then writes to DB).
 *   2. checks if the cached access_token is still valid (>5min remaining) —
 *      if yes, returns it without calling the OAuth endpoint at all.
 *   3. calls /token, gets a new access_token AND a new refresh_token, and
 *      atomically persists both back to the DB before returning.
 *
 * Single source of truth = `public.bing_oauth_state.refresh_token`.
 * Service-role-only RLS, so no other code can read/write it.
 */

const OAUTH_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const OAUTH_SCOPE = 'https://ads.microsoft.com/msads.manage offline_access';
const ACCESS_TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry
const STATE_ROW_ID = 'bing_ads_main';

export interface BingOAuthCredentials {
  clientId: string;
  clientSecret: string;
  /** Initial refresh token from the manual OAuth setup (fallback only). */
  initialRefreshToken: string;
}

export interface BingOAuthResult {
  accessToken: string;
  /** Whether we hit the OAuth endpoint (true) or used cache (false). */
  refreshed: boolean;
  /** Number of times this token has been rotated since first setup. */
  rotationCount: number;
}

/**
 * Get a valid Bing Ads access token. Will refresh + rotate-and-persist
 * the refresh token automatically if needed.
 *
 * Throws on hard failure (invalid_grant, network, etc.). Caller should
 * catch and downgrade to "skip this conversion" instead of crashing
 * the sale flow.
 */
export async function getBingAccessToken(
  supabase: any,
  creds: BingOAuthCredentials,
): Promise<BingOAuthResult> {
  const log = (msg: string, ...rest: unknown[]) =>
    console.log(`[bing-oauth] ${msg}`, ...rest);

  // --- Step 1: Try to read existing state from DB ---
  const { data: state, error: readErr } = await supabase
    .from('bing_oauth_state')
    .select(
      'refresh_token, access_token, access_token_expires_at, rotation_count',
    )
    .eq('id', STATE_ROW_ID)
    .maybeSingle();

  if (readErr) {
    throw new Error(`bing_oauth_state read failed: ${readErr.message}`);
  }

  // --- Step 2: Cache hit? ---
  if (
    state?.access_token &&
    state.access_token_expires_at &&
    new Date(state.access_token_expires_at).getTime() - Date.now() >
      ACCESS_TOKEN_REFRESH_BUFFER_MS
  ) {
    log(
      `cache hit, access_token valid until ${state.access_token_expires_at} (rotation_count=${state.rotation_count ?? 0})`,
    );
    return {
      accessToken: state.access_token,
      refreshed: false,
      rotationCount: state.rotation_count ?? 0,
    };
  }

  // --- Step 3: Determine which refresh token to use ---
  // Prefer DB row; fall back to env (initial setup or after manual reset).
  const refreshToken = state?.refresh_token || creds.initialRefreshToken;
  if (!refreshToken) {
    throw new Error(
      'No refresh token available — neither in bing_oauth_state nor in env-var',
    );
  }
  const usedFallback = !state?.refresh_token;
  if (usedFallback) {
    log('no DB state yet — using initial refresh token from env-var');
  }

  // --- Step 4: Hit /token ---
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: refreshToken,
    scope: OAUTH_SCOPE,
  });

  const resp = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!resp.ok) {
    const txt = await resp.text();
    // Persist error for monitoring (don't blow up on this — it's diagnostic)
    await supabase
      .from('bing_oauth_state')
      .upsert(
        {
          id: STATE_ROW_ID,
          refresh_token: refreshToken, // keep what we had
          last_error: `${resp.status}: ${txt.slice(0, 500)}`,
          last_error_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );
    throw new Error(`OAuth token error: ${resp.status} ${txt}`);
  }

  const json = await resp.json();
  const accessToken = json.access_token as string | undefined;
  const newRefreshToken = json.refresh_token as string | undefined;
  const expiresIn = Number(json.expires_in) || 3599;
  if (!accessToken) {
    throw new Error('OAuth response missing access_token');
  }
  // If MS didn't rotate (rare), keep the one we used.
  const finalRefreshToken = newRefreshToken || refreshToken;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const newRotationCount =
    (state?.rotation_count ?? 0) +
    (newRefreshToken && newRefreshToken !== refreshToken ? 1 : 0);

  // --- Step 5: Persist new state ATOMICALLY ---
  // We MUST write the new refresh token back BEFORE returning, because the
  // old one is now invalid for future use after rotation.
  const { error: writeErr } = await supabase.from('bing_oauth_state').upsert(
    {
      id: STATE_ROW_ID,
      refresh_token: finalRefreshToken,
      access_token: accessToken,
      access_token_expires_at: expiresAt,
      last_refreshed_at: new Date().toISOString(),
      last_error: null,
      last_error_at: null,
      rotation_count: newRotationCount,
    },
    { onConflict: 'id' },
  );

  if (writeErr) {
    // CRITICAL: token rotated but we couldn't persist it. Future calls will
    // 401 until manually re-bootstrapped. We still return the access_token
    // so this *one* call succeeds, but we shout LOUDLY.
    console.error(
      '[bing-oauth] CRITICAL: refresh token rotated but DB write failed — ' +
        `next call will fail until re-bootstrap! err=${writeErr.message}`,
    );
  } else {
    log(
      `refreshed (rotation_count=${newRotationCount}, expires_at=${expiresAt}, used_fallback=${usedFallback})`,
    );
  }

  return {
    accessToken,
    refreshed: true,
    rotationCount: newRotationCount,
  };
}
