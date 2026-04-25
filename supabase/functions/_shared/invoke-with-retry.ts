/**
 * Retry wrapper for Supabase Edge Function invocations.
 *
 * Root cause context:
 *   Sub-step Edge Functions (e.g. generate-invoice-pdf, generate-purchase-contract,
 *   send-invoice-email, notify-auction-winner, send-auction-notification) are
 *   occasionally hit by transient cold-start or gateway failures that surface as
 *   "Edge Function returned a non-2xx status code". A single retry attempt almost
 *   always succeeds. Without retry, an otherwise healthy sale leaves the database
 *   in a half-finished state (invoice draft, no contract, no emails) because the
 *   parent admin-sell-to-dealer flow collects the error and continues.
 *
 * This helper adds bounded retry with exponential backoff to any
 * `supabase.functions.invoke()` call so transient failures no longer leak into
 * the sale flow. Permanent failures (e.g. validation errors returned as a
 * structured response) still propagate on the last attempt.
 */

export interface InvokeRetryResult<T = unknown> {
  data: T | null;
  error: { message: string; context?: unknown } | null;
  attempts: number;
}

export interface InvokeRetryOptions {
  /** Max attempts. Defaults to 3. */
  maxAttempts?: number;
  /** Initial delay between retries in ms. Defaults to 500. Doubles each attempt. */
  initialDelayMs?: number;
  /** Max cap per delay step. Defaults to 4000. */
  maxDelayMs?: number;
  /**
   * Optional label used in console logging so we can spot which invocation
   * retried / failed when reading Edge Function logs.
   */
  label?: string;
}

function isTransientError(err: unknown): boolean {
  const msg =
    (typeof err === 'object' && err !== null && 'message' in err
      ? String((err as { message: unknown }).message ?? '')
      : String(err ?? '')
    ).toLowerCase();

  // Typical transient failure signatures we observe on Supabase Edge Functions:
  //   - "Edge Function returned a non-2xx status code"  (cold start / relay)
  //   - network timeouts / resets
  //   - fetch failures
  //   - 502/503/504 from the gateway
  // Hard logical failures (400/401/403/404/409/422) usually contain the
  // structured error response and should NOT be retried, but they typically
  // do NOT say "non-2xx" — they surface as a parsed error body. We therefore
  // only retry when we see the generic non-2xx wrapper or a network-level
  // failure.
  return (
    msg.includes('non-2xx') ||
    msg.includes('non 2xx') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('network') ||
    msg.includes('fetch failed') ||
    msg.includes('socket') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('connection reset') ||
    msg.includes('connection closed')
  );
}

/**
 * Invoke a Supabase Edge Function with bounded retry on transient failures.
 *
 * Returns the same shape as `supabase.functions.invoke()` (`{ data, error }`)
 * plus an `attempts` counter so the caller can log/notify on eventual success
 * after retry.
 */
export async function invokeWithRetry<T = unknown>(
  supabase: { functions: { invoke: (name: string, opts: { body: unknown }) => Promise<{ data: unknown; error: unknown }> } },
  functionName: string,
  body: unknown,
  options: InvokeRetryOptions = {},
): Promise<InvokeRetryResult<T>> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const initialDelay = Math.max(0, options.initialDelayMs ?? 500);
  const maxDelay = Math.max(initialDelay, options.maxDelayMs ?? 4000);
  const label = options.label ?? functionName;

  let lastError: unknown = null;
  let lastData: unknown = null;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (!error) {
        if (attempt > 1) {
          console.log(`[invoke-with-retry] ${label} succeeded on attempt ${attempt}/${maxAttempts}`);
        }
        return { data: (data as T) ?? null, error: null, attempts: attempt };
      }
      lastError = error;
      lastData = data;
      const transient = isTransientError(error);
      console.warn(
        `[invoke-with-retry] ${label} attempt ${attempt}/${maxAttempts} failed (transient=${transient}):`,
        (error as { message?: string } | null)?.message ?? error,
      );
      if (!transient || attempt === maxAttempts) break;
    } catch (err) {
      lastError = err;
      const transient = isTransientError(err);
      console.warn(
        `[invoke-with-retry] ${label} attempt ${attempt}/${maxAttempts} threw (transient=${transient}):`,
        (err as Error)?.message ?? err,
      );
      if (!transient || attempt === maxAttempts) break;
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, maxDelay);
    }
  }

  const errorMessage =
    (lastError && typeof lastError === 'object' && 'message' in lastError
      ? String((lastError as { message: unknown }).message ?? 'Unbekannter Fehler')
      : String(lastError ?? 'Unbekannter Fehler'));

  return {
    data: (lastData as T) ?? null,
    error: { message: errorMessage, context: lastError },
    attempts: maxAttempts,
  };
}
