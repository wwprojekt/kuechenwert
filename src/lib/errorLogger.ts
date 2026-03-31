/**
 * Centralized Error Logging Service
 * Provides structured error reporting with user context
 */

import { logger } from './logger';

export interface ErrorContext {
  userId?: string;
  userEmail?: string;
  userAgent?: string;
  url?: string;
  timestamp?: number;
  sessionId?: string;
  buildVersion?: string;
  environment?: string;
}

export interface ErrorReport {
  message: string;
  stack?: string;
  name?: string;
  cause?: unknown;
  context?: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'auth' | 'api' | 'ui' | 'business' | 'system' | 'unknown';
  tags?: string[];
  metadata?: Record<string, unknown>;
}

class ErrorLogger {
  private context: Partial<ErrorContext> = {};
  private isProduction = import.meta.env.PROD;
  private sentryDsn = import.meta.env.VITE_SENTRY_DSN;

  constructor() {
    this.initializeContext();
  }

  /**
   * Initialize global error context
   */
  private initializeContext(): void {
    this.context = {
      userAgent: navigator.userAgent,
      url: window.location.href,
      buildVersion: import.meta.env.VITE_APP_VERSION || 'unknown',
      environment: import.meta.env.NODE_ENV || 'development',
      sessionId: this.generateSessionId(),
    };

    // Set up global error handlers
    this.setupGlobalHandlers();
  }

  /**
   * Generate a session ID for tracking related errors
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set up global error handlers
   */
  private setupGlobalHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      // Filter out CefSharp bot errors (Microsoft Outlook SafeSearch, security scanners)
      // These are not real user errors — see: https://trackjs.com/javascript-errors/object-not-found-matching-id-methodname-paramcount/
      const reasonStr = String(event.reason || '');
      if (reasonStr.includes('Object Not Found Matching Id')) {
        return;
      }

      this.logError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        severity: 'high',
        category: 'system',
        tags: ['unhandled-rejection'],
        metadata: {
          reason: event.reason,
          promise: event.promise,
        },
      });
    });

    // Handle uncaught JavaScript errors
    window.addEventListener('error', (event) => {
      this.logError({
        message: event.message,
        stack: event.error?.stack,
        name: event.error?.name,
        severity: 'high',
        category: 'system',
        tags: ['uncaught-error'],
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });
  }

  /**
   * Update user context for error tracking
   */
  setUserContext(userContext: Partial<ErrorContext>): void {
    this.context = { ...this.context, ...userContext };
  }

  /**
   * Clear user context (e.g., on logout)
   */
  clearUserContext(): void {
    const { userId: _userId, userEmail: _userEmail, ...rest } = this.context;
    this.context = rest;
  }

  /**
   * Log an error with full context
   */
  logError(errorReport: Partial<ErrorReport> & Pick<ErrorReport, 'message' | 'severity' | 'category'>): void {
    const fullReport: ErrorReport = {
      ...errorReport,
      context: {
        ...this.context,
        timestamp: Date.now(),
        url: window.location.href,
        ...errorReport.context,
      },
    };

    // Always log to console in development
    if (!this.isProduction) {
      logger.error('Error Report:', fullReport);
    }

    // Send to monitoring service in production
    if (this.isProduction && this.sentryDsn) {
      this.sendToSentry(fullReport);
    }

    // Send to custom analytics if available
    this.sendToCustomAnalytics(fullReport);

    // Store critical errors locally for debugging
    if (fullReport.severity === 'critical') {
      this.storeCriticalError(fullReport);
    }
  }

  /**
   * Log an error from a caught exception
   */
  logException(error: Error, context?: Partial<ErrorContext & Pick<ErrorReport, 'severity' | 'category' | 'tags'>>): void {
    this.logError({
      message: error.message,
      stack: error.stack,
      name: error.name,
      cause: error.cause,
      severity: context?.severity || 'medium',
      category: context?.category || 'unknown',
      tags: context?.tags,
      context,
    });
  }

  /**
   * Log a business logic error (user-facing)
   */
  logBusinessError(message: string, metadata?: Record<string, unknown>): void {
    this.logError({
      message,
      severity: 'low',
      category: 'business',
      metadata,
    });
  }

  /**
   * Log an API error
   */
  logApiError(endpoint: string, error: Error, response?: Response): void {
    this.logError({
      message: `API Error: ${endpoint} - ${error.message}`,
      stack: error.stack,
      severity: 'medium',
      category: 'api',
      tags: ['api-error'],
      metadata: {
        endpoint,
        status: response?.status,
        statusText: response?.statusText,
        headers: response ? Object.fromEntries(response.headers.entries()) : undefined,
      },
    });
  }

  /**
   * Log an authentication error
   */
  logAuthError(message: string, metadata?: Record<string, unknown>): void {
    this.logError({
      message: `Auth Error: ${message}`,
      severity: 'high',
      category: 'auth',
      tags: ['auth-error'],
      metadata,
    });
  }

  /**
   * Send error to Sentry (if configured)
   */
  private async sendToSentry(errorReport: ErrorReport): Promise<void> {
    try {
      // This would be replaced with actual Sentry integration
      // For now, just prepare the payload
      const sentryPayload = {
        message: errorReport.message,
        level: this.mapSeverityToSentryLevel(errorReport.severity),
        tags: {
          category: errorReport.category,
          ...(errorReport.tags?.reduce((acc, tag) => ({ ...acc, [tag]: true }), {}) || {}),
        },
        extra: {
          ...errorReport.metadata,
          context: errorReport.context,
        },
        user: {
          id: errorReport.context?.userId,
          email: errorReport.context?.userEmail,
        },
      };

      // In a real implementation, you would send this to Sentry
      logger.log('Would send to Sentry:', sentryPayload);
    } catch (error) {
      logger.error('Failed to send error to Sentry:', error);
    }
  }

  /**
   * Send to custom analytics service
   */
  private async sendToCustomAnalytics(errorReport: ErrorReport): Promise<void> {
    try {
      // This could be your own analytics endpoint
      const analyticsPayload = {
        type: 'error',
        ...errorReport,
      };

      // In a real implementation, you would send this to your analytics service
      logger.log('Would send to analytics:', analyticsPayload);
    } catch (error) {
      logger.error('Failed to send error to analytics:', error);
    }
  }

  /**
   * Store critical errors locally for debugging
   */
  private storeCriticalError(errorReport: ErrorReport): void {
    try {
      const criticalErrors = JSON.parse(localStorage.getItem('criticalErrors') || '[]');
      criticalErrors.push(errorReport);
      
      // Keep only the last 10 critical errors
      if (criticalErrors.length > 10) {
        criticalErrors.shift();
      }
      
      localStorage.setItem('criticalErrors', JSON.stringify(criticalErrors));
    } catch (error) {
      logger.error('Failed to store critical error:', error);
    }
  }

  /**
   * Map severity to Sentry level
   */
  private mapSeverityToSentryLevel(severity: ErrorReport['severity']): string {
    switch (severity) {
      case 'low': return 'info';
      case 'medium': return 'warning';
      case 'high': return 'error';
      case 'critical': return 'fatal';
      default: return 'error';
    }
  }

  /**
   * Get stored critical errors for debugging
   */
  getCriticalErrors(): ErrorReport[] {
    try {
      return JSON.parse(localStorage.getItem('criticalErrors') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Clear stored critical errors
   */
  clearCriticalErrors(): void {
    localStorage.removeItem('criticalErrors');
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger();

// Export convenience functions
export const logError = (errorReport: Parameters<typeof errorLogger.logError>[0]) => 
  errorLogger.logError(errorReport);

export const logException = (error: Error, context?: Parameters<typeof errorLogger.logException>[1]) => 
  errorLogger.logException(error, context);

export const logBusinessError = (message: string, metadata?: Record<string, unknown>) => 
  errorLogger.logBusinessError(message, metadata);

export const logApiError = (endpoint: string, error: Error, response?: Response) => 
  errorLogger.logApiError(endpoint, error, response);

export const logAuthError = (message: string, metadata?: Record<string, unknown>) => 
  errorLogger.logAuthError(message, metadata);

export const setUserContext = (userContext: Partial<ErrorContext>) => 
  errorLogger.setUserContext(userContext);

export const clearUserContext = () => 
  errorLogger.clearUserContext();
