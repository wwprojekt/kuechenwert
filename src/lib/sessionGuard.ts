/**
 * Session Guard Utility
 * 
 * Provides defensive session validation and refresh logic
 * to prevent RLS errors caused by expired/invalid JWT tokens.
 * 
 * Supabase Token Lifecycle:
 * - Access Token (JWT): 12 hours (configured in Supabase Dashboard), auto-refreshed by client
 * - Refresh Token: 1 week default
 * - autoRefreshToken: true is set in our client config
 * 
 * Edge Cases that can cause stale sessions:
 * 1. Browser tab inactive for extended period (refresh timer paused)
 * 2. Refresh token expired (>1 week inactive)
 * 3. User signed up but email not confirmed (partial auth state)
 * 4. localStorage corrupted or cleared by browser
 * 5. Network interruption during token refresh
 * 6. Navigator Lock conflicts between tabs (steal/timeout)
 */

import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';
import { logger } from './logger';

/**
 * Prüft ob ein Fehler ein Netzwerkfehler ist (z.B. instabile Mobilfunkverbindung).
 * "Failed to fetch" tritt auf bei: Netzwerkabbruch, DNS-Fehler, Server nicht erreichbar,
 * CORS-Fehler, oder wenn der Browser den Request abbricht (z.B. Tab im Hintergrund).
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : (error as { message?: string })?.message || '';
  return (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Load failed') ||
    message.includes('net::ERR_') ||
    message.includes('fetch failed') ||
    message.includes('network request failed') ||
    message.includes('The Internet connection appears to be offline') ||
    message.includes('A server with the specified hostname could not be found')
  );
}

/**
 * Führt eine Operation mit automatischem Retry bei Netzwerkfehlern aus.
 * Wartet zwischen Versuchen mit exponentiellem Backoff (500ms, 1000ms, 2000ms).
 * 
 * @param operation Die auszuführende async Operation
 * @param maxRetries Maximale Anzahl an Wiederholungsversuchen (Standard: 2)
 * @param operationName Name für Logging-Zwecke
 * @returns Das Ergebnis der Operation
 */
export async function withNetworkRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  operationName: string = 'operation'
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (isNetworkError(error) && attempt < maxRetries) {
        const delay = 500 * Math.pow(2, attempt); // 500ms, 1000ms, 2000ms
        logger.warn(`${operationName}: Netzwerkfehler bei Versuch ${attempt + 1}/${maxRetries + 1}, warte ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * Prüft ob ein Fehler ein Navigator Lock-Fehler ist.
 * Diese Fehler sind harmlos und entstehen durch die Supabase Auth-JS
 * Session-Synchronisierung zwischen Tabs (Web Locks API).
 * Sie treten auf wenn mehrere Auth-Operationen gleichzeitig laufen
 * und der Lock-Timeout (5s) erreicht wird.
 */
export function isLockError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : (error as { message?: string })?.message || '';
  return (
    message.includes('Lock broken by another request') ||
    message.includes('Lock was stolen by another request') ||
    message.includes('released because another request stole it') ||
    message.includes('Lock acquisition timed out') ||
    message.includes('was not released within') ||
    message.includes('Acquiring an exclusive Navigator LockManager lock') ||
    message.includes('Acquiring process lock') ||
    message.includes('lock request is aborted') ||
    message.includes('The lock request is aborted') ||
    (error instanceof Error && error.name === 'AbortError') ||
    (error instanceof Error && 'isAcquireTimeout' in error && !!(error as any).isAcquireTimeout)
  );
}

/**
 * Check if an error is caused by an expired/invalid session or RLS violation.
 * Works with Supabase PostgrestError, AuthError, and generic Error objects.
 */
export function isSessionOrRLSError(error: unknown): boolean {
  if (!error) return false;

  const message = typeof error === 'string'
    ? error
    : (error as { message?: string })?.message || '';
  const code = (error as { code?: string })?.code || '';

  const sessionPatterns = [
    'row-level security',
    'JWT expired',
    'Token expired',
    'Invalid refresh token',
    'Auth session missing',
    'Unauthorized',
    'not authenticated',
    'invalid claim',
    'session_not_found',
  ];

  // Check error code
  if (code === '42501' || code === 'PGRST301') return true;

  // Check error message
  return sessionPatterns.some(pattern =>
    message.toLowerCase().includes(pattern.toLowerCase())
  );
}

/**
 * Validate and refresh the current session.
 * Returns a valid user or null if the session cannot be restored.
 * 
 * This performs a two-step validation:
 * 1. Try to get the current user (fast, uses cached token)
 * 2. If that fails or returns null, try to refresh the session
 * 
 * @returns Valid User object or null
 */
export async function getValidatedUser(): Promise<User | null> {
  try {
    // Step 1: Try getUser (validates JWT server-side)
    const { data: { user }, error } = await supabase.auth.getUser();

    if (user && !error) {
      return user;
    }

    // Step 2: If getUser failed, try refreshing the session
    logger.warn('Session validation failed, attempting refresh...', { error: error?.message });

    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError || !refreshData.session) {
      logger.warn('Session refresh failed', { error: refreshError?.message });
      return null;
    }

    return refreshData.session.user;
  } catch (err) {
    // Lock-Fehler sind harmlos - einfach null zurückgeben, der nächste Versuch klappt
    if (isLockError(err)) {
      logger.log('getValidatedUser: Lock-Fehler (harmlos, wird ignoriert)');
      return null;
    }
    logger.error('Session validation error:', err);
    return null;
  }
}

/**
 * Ensure the session is valid before performing a write operation.
 * If the session is invalid, attempts to refresh it once.
 * 
 * @returns Object with user (or null) and a flag indicating if session was refreshed
 */
export async function ensureValidSession(): Promise<{
  user: User | null;
  wasRefreshed: boolean;
  sessionExpired: boolean;
}> {
  try {
    // First try: get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Verify the token is still valid by checking expiry
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const expiresAt = session.expires_at;
        const now = Math.floor(Date.now() / 1000);
        const bufferSeconds = 60; // 1 minute buffer

        if (expiresAt && (expiresAt - now) > bufferSeconds) {
          // Token is valid with sufficient buffer
          return { user, wasRefreshed: false, sessionExpired: false };
        }

        // Token is about to expire, proactively refresh
        logger.info('Token expiring soon, proactively refreshing...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

        if (!refreshError && refreshData.session) {
          return { user: refreshData.session.user, wasRefreshed: true, sessionExpired: false };
        }
      }

      // Session object missing but user exists - try refresh
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshData.session) {
        return { user: refreshData.session.user, wasRefreshed: true, sessionExpired: false };
      }

      // Refresh failed - session is truly expired
      return { user: null, wasRefreshed: false, sessionExpired: true };
    }

    // No user at all
    return { user: null, wasRefreshed: false, sessionExpired: false };
  } catch (err) {
    // Lock-Fehler: Kurz warten und erneut versuchen.
    // Ohne Retry würde user:null zurückgegeben, was im Wizard-Submit dazu führt
    // dass der eingeloggte User fälschlicherweise "Passwort fehlt" sieht.
    if (isLockError(err)) {
      logger.log('ensureValidSession: Lock-Fehler erkannt, warte 500ms und versuche erneut...');
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          return { user, wasRefreshed: false, sessionExpired: false };
        }
        // Zweiter Versuch fehlgeschlagen – versuche getSession als Fallback
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && session.access_token && isTokenValid(session.access_token, 60)) {
          return { user: session.user, wasRefreshed: false, sessionExpired: false };
        }
        return { user: null, wasRefreshed: false, sessionExpired: false };
      } catch (retryErr) {
        logger.log('ensureValidSession: Retry nach Lock-Fehler ebenfalls fehlgeschlagen');
        // Letzter Fallback: getSession() ist lokal und braucht keinen Lock
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && session.access_token && isTokenValid(session.access_token, 60)) {
            return { user: session.user, wasRefreshed: false, sessionExpired: false };
          }
        } catch {
          // Alles fehlgeschlagen
        }
        return { user: null, wasRefreshed: false, sessionExpired: false };
      }
    }
    logger.error('ensureValidSession error:', err);
    return { user: null, wasRefreshed: false, sessionExpired: true };
  }
}

/**
 * Stellt eine valide, nicht-abgelaufene Session sicher bevor RLS-geschützte Queries ausgeführt werden.
 * 
 * KRITISCH: supabase.auth.getSession() liest aus dem LOKALEN CACHE und gibt
 * Session-Objekte zurück, auch wenn der Access Token BEREITS ABGELAUFEN ist!
 * RLS-Queries mit abgelaufenem Token liefern stil leere Ergebnisse (auth.uid()=NULL),
 * was z.B. dazu führt, dass isDealer=false wird und das Bieten-UI verschwindet.
 * 
 * Diese Funktion prüft die Token-Gültigkeit und refresht proaktiv wenn nötig.
 * Dedupliziert parallele Aufrufe: wenn 10 Komponenten gleichzeitig aufrufen,
 * wird nur EIN Auth-Request gemacht und alle 10 bekommen das gleiche Ergebnis.
 * 
 * @returns true wenn Session gültig, false wenn nicht wiederherstellbar
 */
let _pendingRLSCheck: Promise<boolean> | null = null;

export function ensureValidRLSSession(): Promise<boolean> {
  if (_pendingRLSCheck) return _pendingRLSCheck;
  
  _pendingRLSCheck = _doEnsureValidRLSSession().finally(() => {
    _pendingRLSCheck = null;
  });
  
  return _pendingRLSCheck;
}

async function _doEnsureValidRLSSession(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      const { data, error } = await supabase.auth.refreshSession();
      return !error && !!data.session;
    }
    
    if (session.access_token && !isTokenValid(session.access_token, 60)) {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) return false;
    }
    
    return true;
  } catch (e) {
    if (isLockError(e)) {
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token && isTokenValid(session.access_token, 60)) {
          return true;
        }
        const { data, error } = await supabase.auth.refreshSession();
        return !error && !!data.session;
      } catch {
        return false;
      }
    }
    return false;
  }
}

/**
 * Prüft ob ein Access Token noch gültig ist (nicht abgelaufen).
 * Ein JWT hat 3 Base64-Segmente: header.payload.signature.
 * Wir prüfen nur das `exp`-Feld im Payload.
 * 
 * @param token Der Access Token (JWT)
 * @param bufferSeconds Puffer in Sekunden (Token gilt als abgelaufen wenn < buffer übrig)
 * @returns true wenn Token noch gültig, false wenn abgelaufen/korrupt
 */
export function isTokenValid(token: string, bufferSeconds: number = 30): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false; // Malformed JWT
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    if (!payload.exp) return false;
    return payload.exp > (Date.now() / 1000) + bufferSeconds;
  } catch {
    return false; // Parse error → corrupted token
  }
}

/**
 * Get a guaranteed fresh access token for Edge Function calls.
 *
 * IMPORTANT: Do NOT use getSession().access_token for Edge Functions with verify_jwt: true!
 * getSession() reads from local cache and can return stale/expired tokens.
 * This function calls refreshSession() and returns the token DIRECTLY from the response,
 * bypassing any cache issues.
 * 
 * CRITICAL FIX (10.04.2026): Previous version had a dangerous fallback that returned
 * stale/corrupted tokens from getSession() cache. This caused place-bid 401 errors
 * because a malformed JWT was sent to the Edge Function instead of redirecting to login.
 * Now: EVERY token is validated before being returned. Corrupted tokens → null → login redirect.
 *
 * @returns Fresh access token string, or null if session cannot be refreshed
 */
export async function getFreshAccessToken(): Promise<string | null> {
  try {
    // Primary: refreshSession() returns the fresh token directly in its response
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session?.access_token) {
      // Validate the token is well-formed and not expired
      if (isTokenValid(data.session.access_token)) {
        return data.session.access_token;
      }
      logger.warn('getFreshAccessToken: refreshSession returned invalid token');
    }

    // Lock error: wait and retry once
    if (isLockError(error)) {
      logger.warn('getFreshAccessToken: Lock-Fehler, warte 500ms und versuche erneut...');
      await new Promise(resolve => setTimeout(resolve, 500));
      const { data: retryData, error: retryError } = await supabase.auth.refreshSession();
      if (!retryError && retryData.session?.access_token && isTokenValid(retryData.session.access_token)) {
        return retryData.session.access_token;
      }
    }

    // Fallback: getSession – but ONLY if the cached token is actually valid
    // Previously this returned stale/corrupted tokens → caused 401 on Edge Functions
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token && isTokenValid(session.access_token)) {
      logger.warn('getFreshAccessToken: using validated getSession fallback');
      return session.access_token;
    }

    // All attempts failed → session is truly expired/corrupted
    logger.warn('getFreshAccessToken: Alle Versuche fehlgeschlagen, Session ist abgelaufen');
    return null;
  } catch (err) {
    if (isLockError(err)) {
      logger.warn('getFreshAccessToken: Lock-Fehler im catch, versuche getSession fallback...');
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token && isTokenValid(session.access_token)) {
          return session.access_token;
        }
      } catch { /* all failed */ }
    } else {
      logger.error('getFreshAccessToken: unexpected error', err);
    }
    return null;
  }
}

/**
 * Retry a Supabase operation once after refreshing the session.
 * Use this to wrap write operations that might fail due to expired tokens.
 * 
 * @param operation The async operation to execute
 * @param operationName Name for logging purposes
 * @returns The result of the operation
 */
export async function withSessionRetry<T>(
  operation: () => Promise<T>,
  operationName: string = 'operation'
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Lock-Fehler: kurz warten und direkt erneut versuchen (ohne Session-Refresh)
    if (isLockError(error)) {
      logger.log(`${operationName}: Lock-Fehler erkannt, warte kurz und versuche erneut...`);
      await new Promise(resolve => setTimeout(resolve, 500));
      return await operation();
    }

    if (isSessionOrRLSError(error)) {
      logger.warn(`${operationName}: RLS/session error detected, refreshing session and retrying...`);

      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

      if (refreshError || !refreshData.session) {
        logger.error(`${operationName}: Session refresh failed, cannot retry`);
        throw error; // Re-throw original error
      }

      logger.info(`${operationName}: Session refreshed, retrying operation...`);
      return await operation(); // Retry once
    }

    throw error; // Non-session error, re-throw
  }
}

/**
 * SESSION_EXPIRED error sentinel – can be caught by callers to show SessionExpiredDialog.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super('SESSION_EXPIRED');
    this.name = 'SessionExpiredError';
  }
}

/**
 * Sichere Edge Function Aufrufe mit automatischem Token-Refresh + 401-Retry.
 * 
 * Verwendung: Statt `supabase.functions.invoke('fn', { body })` direkt,
 * nutze `invokeWithAuth('fn', { body })`. Der Token wird vor dem Aufruf
 * validiert und bei 401 automatisch erneuert + retry.
 * 
 * Bei fehlgeschlagenem Refresh wird SessionExpiredError geworfen,
 * den der Caller fangen und den SessionExpiredDialog anzeigen kann.
 * 
 * @param functionName Name der Edge Function
 * @param options body und andere Optionen
 * @returns { data, error } vom Edge Function Aufruf
 */
export async function invokeWithAuth(
  functionName: string,
  options?: { body?: Record<string, unknown> | FormData }
): Promise<{ data: unknown; error: null } | { data: null; error: Error }> {
  // Step 1: Get a validated fresh token
  let accessToken = await getFreshAccessToken();
  if (!accessToken) {
    throw new SessionExpiredError();
  }

  // Step 2: Call with fresh token
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: options?.body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // Step 3: If 401, retry once with a new token
  if (error && 'context' in error && (error as any).context?.status === 401) {
    logger.warn(`${functionName}: 401, retrying with fresh token...`);
    accessToken = await getFreshAccessToken();
    if (!accessToken) {
      throw new SessionExpiredError();
    }

    const retry = await supabase.functions.invoke(functionName, {
      body: options?.body,
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (retry.error && 'context' in retry.error && (retry.error as any).context?.status === 401) {
      throw new SessionExpiredError();
    }

    return retry;
  }

  return { data, error };
}
