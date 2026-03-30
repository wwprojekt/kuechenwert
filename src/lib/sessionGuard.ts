/**
 * Session Guard Utility
 * 
 * Provides defensive session validation and refresh logic
 * to prevent RLS errors caused by expired/invalid JWT tokens.
 * 
 * Supabase Token Lifecycle:
 * - Access Token (JWT): 1 hour default, auto-refreshed by client
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
    message.includes('released because another request stole it') ||
    message.includes('Lock acquisition timed out') ||
    message.includes('was not released within') ||
    message.includes('Acquiring an exclusive Navigator LockManager lock') ||
    message.includes('Acquiring process lock') ||
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
    // Lock-Fehler sind harmlos - Session als nicht verfügbar melden, aber nicht als abgelaufen
    if (isLockError(err)) {
      logger.log('ensureValidSession: Lock-Fehler (harmlos, wird ignoriert)');
      return { user: null, wasRefreshed: false, sessionExpired: false };
    }
    logger.error('ensureValidSession error:', err);
    return { user: null, wasRefreshed: false, sessionExpired: true };
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
