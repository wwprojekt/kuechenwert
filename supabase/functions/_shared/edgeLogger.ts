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
