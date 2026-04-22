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

// Lease-lock tuning: how long we wait for another worker to finish refreshing
// before we give up and try to grab the lock ourselves. Must be < 30s
// (the lock TTL itself) to avoid double-acquire.
const LOCK_WAIT_TOTAL_MS = 12_000;
const LOCK_WAIT_POLL_MS = 250;

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

  // Helper to read the current state row.
  const readState = async () => {
    const { data, error } = await supabase
      .from('bing_oauth_state')
      .select(
        'refresh_token, access_token, access_token_expires_at, rotation_count',
      )
      .eq('id', STATE_ROW_ID)
      .maybeSingle();
    if (error) {
      throw new Error(`bing_oauth_state read failed: ${error.message}`);
    }
    return data as
      | {
          refresh_token: string | null;
          access_token: string | null;
          access_token_expires_at: string | null;
          rotation_count: number | null;
        }
      | null;
  };

  const isFreshCache = (s: Awaited<ReturnType<typeof readState>>) =>
    !!(
      s?.access_token &&
      s.access_token_expires_at &&
      new Date(s.access_token_expires_at).getTime() - Date.now() >
        ACCESS_TOKEN_REFRESH_BUFFER_MS
    );

  // --- Step 1: Try to read existing state from DB ---
  let state = await readState();

  // --- Step 2: Cache hit? ---
  if (isFreshCache(state)) {
    log(
      `cache hit, access_token valid until ${state!.access_token_expires_at} (rotation_count=${state!.rotation_count ?? 0})`,
    );
    return {
      accessToken: state!.access_token!,
      refreshed: false,
      rotationCount: state!.rotation_count ?? 0,
    };
  }

  // --- Step 2b: Cache miss → try to acquire the lease lock ---
  // If another worker is already mid-refresh, we wait + poll the DB for the
  // freshly-written cache instead of doing a parallel refresh that could
  // race-stomp the rotated refresh-token.
  let lockAcquired = false;
  {
    const { data: gotLock, error: lockErr } = await supabase.rpc(
      'bing_oauth_try_acquire_lock',
      { p_id: STATE_ROW_ID },
    );
    if (lockErr) {
      // Non-fatal — fall through and try a refresh anyway. Worst case we
      // still hit the error-path race-safety in Step 4 below.
      log(`lock acquire RPC failed (${lockErr.message}), proceeding without lock`);
    } else {
      lockAcquired = !!gotLock;
    }
  }

  if (!lockAcquired) {
    log('lock held by another worker — polling DB for fresh cache');
    const deadline = Date.now() + LOCK_WAIT_TOTAL_MS;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, LOCK_WAIT_POLL_MS));
      state = await readState();
      if (isFreshCache(state)) {
        log(
          `lock-wait cache hit after ${LOCK_WAIT_TOTAL_MS - (deadline - Date.now())}ms`,
        );
        return {
          accessToken: state!.access_token!,
          refreshed: false,
          rotationCount: state!.rotation_count ?? 0,
        };
      }
    }
    // Timeout: assume previous holder crashed; force-acquire (lock TTL is 30s
    // anyway, so just try again — likely the lock has now expired and the
    // CAS-RPC will succeed).
    log('lock-wait timed out — attempting forced acquire');
    const { data: forcedLock } = await supabase.rpc(
      'bing_oauth_try_acquire_lock',
      { p_id: STATE_ROW_ID },
    );
    lockAcquired = !!forcedLock;
    if (!lockAcquired) {
      throw new Error(
        'OAuth lease lock unavailable after wait — previous worker is hung',
      );
    }
  }

  // --- Step 3: Determine which refresh token to use ---
  // Prefer DB row; fall back to env (initial setup or after manual reset).
  // Re-read state in case another worker rotated AND released between our
  // initial read and lock acquisition.
  state = await readState();
  if (isFreshCache(state)) {
    // Another worker beat us to it after we locked — release and use cache.
    await supabase.rpc('bing_oauth_release_lock', { p_id: STATE_ROW_ID });
    log('post-lock cache hit (someone else refreshed) — releasing lock');
    return {
      accessToken: state!.access_token!,
      refreshed: false,
      rotationCount: state!.rotation_count ?? 0,
    };
  }
  const refreshToken = state?.refresh_token || creds.initialRefreshToken;
  if (!refreshToken) {
    // Release lock before throwing — otherwise it would block other workers
    // for 30s for nothing.
    await supabase
      .rpc('bing_oauth_release_lock', { p_id: STATE_ROW_ID })
      .catch(() => {});
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

  let resp: Response;
  try {
    resp = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch (fetchErr) {
    // Network-level failure → release lock so the next caller can retry.
    await supabase
      .rpc('bing_oauth_release_lock', { p_id: STATE_ROW_ID })
      .catch(() => {});
    throw fetchErr;
  }

  if (!resp.ok) {
    const txt = await resp.text();
    // RACE-SAFETY: ONLY update error fields, NEVER touch refresh_token.
    // If a parallel call already rotated the token successfully, our
    // `refreshToken` here is the now-invalid old one — overwriting the
    // freshly-rotated value would permanently break tracking.
    // (UPDATE is a no-op if the row doesn't exist yet, which is fine —
    // first-ever call with bad creds doesn't need an error log.)
    await supabase
      .from('bing_oauth_state')
      .update({
        last_error: `${resp.status}: ${txt.slice(0, 500)}`,
        last_error_at: new Date().toISOString(),
        lock_holder_until: null, // release lock in same write
      })
      .eq('id', STATE_ROW_ID);
    throw new Error(`OAuth token error: ${resp.status} ${txt}`);
  }

  const json = await resp.json();
  const accessToken = json.access_token as string | undefined;
  const newRefreshToken = json.refresh_token as string | undefined;
  const expiresIn = Number(json.expires_in) || 3599;
  if (!accessToken) {
    await supabase
      .rpc('bing_oauth_release_lock', { p_id: STATE_ROW_ID })
      .catch(() => {});
    throw new Error('OAuth response missing access_token');
  }
  // If MS didn't rotate (rare), keep the one we used.
  const finalRefreshToken = newRefreshToken || refreshToken;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const newRotationCount =
    (state?.rotation_count ?? 0) +
    (newRefreshToken && newRefreshToken !== refreshToken ? 1 : 0);

  // --- Step 5: Persist new state ATOMICALLY (also releases lock) ---
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
      lock_holder_until: null, // release lock in same atomic write
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
    // Best-effort lock release.
    await supabase
      .rpc('bing_oauth_release_lock', { p_id: STATE_ROW_ID })
      .catch(() => {});
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
