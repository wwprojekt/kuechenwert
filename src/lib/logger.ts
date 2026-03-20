/**
 * Logger Utility
 * 
 * Provides environment-aware logging that only outputs in development mode,
 * except for errors which are always logged.
 * 
 * Usage:
 * import { logger } from '@/lib/logger';
 * logger.log('Some debug info');
 * logger.error('Error occurred', error);
 */

const isDev = import.meta.env.DEV;

interface Logger {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
}

export const logger: Logger = {
  /** Log general information (dev only) */
  log: (...args) => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log('[LOG]', ...args);
    }
  },
  
  /** Log errors (always, in all environments) */
  error: (...args) => {
    console.error('[ERROR]', ...args);
  },
  
  /** Log warnings (dev only) */
  warn: (...args) => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.warn('[WARN]', ...args);
    }
  },
  
  /** Log debug information (dev only) */
  debug: (...args) => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.debug('[DEBUG]', ...args);
    }
  },
  
  /** Log informational messages (dev only) */
  info: (...args) => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.info('[INFO]', ...args);
    }
  },
};

export default logger;
