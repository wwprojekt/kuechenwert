/**
 * Edge Functions Logger
 * Centralized logging for Supabase Edge Functions
 */

export const edgeLogger = {
  log: (...args: unknown[]) => console.log('[Edge]', ...args),
  error: (...args: unknown[]) => console.error('[Edge Error]', ...args),
  warn: (...args: unknown[]) => console.warn('[Edge Warning]', ...args),
  info: (...args: unknown[]) => console.info('[Edge Info]', ...args),
  debug: (...args: unknown[]) => console.debug('[Edge Debug]', ...args),
};

export default edgeLogger;

// ─── Persistent error logging to error_logs ────────────────────────────────
// Allows Edge Functions to record failures (especially silently-caught ones
// like email/notification dispatch errors) so admins can see them in the
// dashboard instead of having to read function logs.

type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
type ErrorCategory =
  | 'email'
  | 'notification'
  | 'kaufchance'
  | 'auction'
  | 'invoice'
  | 'contract'
  | 'unknown';

interface SupabaseLike {
  from: (table: string) => {
    insert: (rows: Record<string, unknown>) => Promise<{ error: unknown }>;
  };
}

interface LogEdgeErrorOptions {
  component: string;
  message: string;
  severity?: ErrorSeverity;
  category?: ErrorCategory;
  errorCode?: string;
  metadata?: Record<string, unknown>;
  originalError?: unknown;
  userId?: string | null;
}

/**
 * Persists an error from an Edge Function into the public.error_logs table.
 * Never throws — failures here are swallowed and printed to console so the
 * caller's flow is never disturbed by the act of logging itself.
 */
export async function logEdgeError(
  supabase: SupabaseLike,
  opts: LogEdgeErrorOptions,
): Promise<void> {
  const {
    component,
    message,
    severity = 'medium',
    category = 'unknown',
    errorCode,
    metadata,
    originalError,
    userId,
  } = opts;

  try {
    const originalErrorText =
      originalError == null
        ? null
        : originalError instanceof Error
          ? `${originalError.name}: ${originalError.message}`
          : typeof originalError === 'string'
            ? originalError
            : (() => {
                try {
                  return JSON.stringify(originalError);
                } catch {
                  return String(originalError);
                }
              })();

    const stackTrace =
      originalError instanceof Error && originalError.stack
        ? originalError.stack
        : null;

    const { error } = await supabase.from('error_logs').insert({
      error_code: errorCode || `EDGE_${component.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`,
      error_message: message,
      error_category: category,
      severity,
      page_url: `edge://${component}`,
      page_path: `/edge/${component}`,
      page_title: null,
      component_name: component,
      user_id: userId ?? null,
      stack_trace: stackTrace,
      original_error: originalErrorText,
      metadata: metadata ?? {},
      environment: 'production',
      error_source: 'edge-function',
    });

    if (error) {
      console.error('[edgeLogger] Failed to persist error_log entry:', error);
    }
  } catch (e) {
    console.error('[edgeLogger] Exception while logging:', e);
  }
}
