/**
 * Error Log Service
 * 
 * Loggt jeden Fehler, der einem Nutzer angezeigt wird, in die Supabase error_logs Tabelle.
 * Wird vom zentralen Toast-Wrapper und ErrorBoundary aufgerufen.
 */

import { supabase } from '@/integrations/supabase/client';
import { translateError, getPageTitle, getGermanErrorMessage, type ErrorCategory, type ErrorSeverity } from './germanErrors';
import { logger } from './logger';

// ============================================================================
// Types
// ============================================================================

export interface ErrorLogEntry {
  errorCode: string;
  errorMessage: string;
  errorCategory: ErrorCategory;
  severity: ErrorSeverity;
  pagePath: string;
  pageTitle: string;
  componentName?: string;
  originalError?: string;
  stackTrace?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Browser/Device Detection
// ============================================================================

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

function getBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Opera') || ua.includes('OPR/')) return 'Opera';
  return 'Unbekannt';
}

// ============================================================================
// Haupt-Logging-Funktion
// ============================================================================

/**
 * Loggt einen Fehler in die Supabase error_logs Tabelle.
 * Wird asynchron ausgeführt und blockiert nicht die UI.
 */
export async function logErrorToSupabase(entry: ErrorLogEntry): Promise<void> {
  try {
    // Aktuellen Nutzer und Rolle ermitteln
    const { data: { user } } = await supabase.auth.getUser();
    let userRole = 'anonymous';
    let userEmail: string | undefined;

    if (user) {
      userEmail = user.email;
      // Rolle aus user_roles Tabelle holen
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .limit(1);
      
      if (roles && roles.length > 0) {
        userRole = roles[0].role;
      } else {
        userRole = 'customer';
      }
    }

    const logEntry = {
      error_code: entry.errorCode,
      error_message: entry.errorMessage,
      error_category: entry.errorCategory,
      severity: entry.severity,
      page_url: window.location.href,
      page_path: entry.pagePath || window.location.pathname,
      page_title: entry.pageTitle || getPageTitle(window.location.pathname),
      component_name: entry.componentName || null,
      user_id: user?.id || null,
      user_role: userRole,
      user_email: userEmail || null,
      stack_trace: entry.stackTrace || null,
      original_error: entry.originalError || null,
      metadata: entry.metadata || {},
      user_agent: navigator.userAgent,
      browser: getBrowser(),
      device_type: getDeviceType(),
    };

    const { error } = await supabase
      .from('error_logs')
      .insert([logEntry]);

    if (error) {
      // Fehler beim Loggen nur in der Konsole ausgeben, nicht erneut anzeigen
      logger.error('Fehler beim Speichern des Error-Logs:', error);
    }
  } catch (err) {
    // Fehler beim Loggen dürfen die App nicht beeinflussen
    logger.error('Error-Log-Service Fehler:', err);
  }
}

// ============================================================================
// Convenience-Funktionen
// ============================================================================

/**
 * Übersetzt einen Fehler ins Deutsche, loggt ihn und gibt die deutsche Meldung zurück.
 * Dies ist die Hauptfunktion, die überall im Projekt verwendet werden soll.
 */
export function handleAndLogError(
  error: unknown,
  options?: {
    componentName?: string;
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    metadata?: Record<string, unknown>;
  }
): string {
  const originalMessage = error instanceof Error 
    ? error.message 
    : typeof error === 'string' 
      ? error 
      : (error as { message?: string })?.message || 'Unknown error';

  const translated = translateError(originalMessage);
  
  // Kategorie und Severity können überschrieben werden
  const category = options?.category || translated.category;
  const severity = options?.severity || translated.severity;

  // Asynchron in Supabase loggen (blockiert nicht die UI)
  logErrorToSupabase({
    errorCode: translated.code,
    errorMessage: translated.message,
    errorCategory: category,
    severity: severity,
    pagePath: window.location.pathname,
    pageTitle: getPageTitle(window.location.pathname),
    componentName: options?.componentName,
    originalError: originalMessage,
    stackTrace: error instanceof Error ? error.stack : undefined,
    metadata: options?.metadata,
  });

  return translated.message;
}

/**
 * Speziell für Validierungsfehler (Zod)
 */
export function handleValidationError(
  error: unknown,
  componentName?: string
): string {
  // Bei ZodError die erste Fehlermeldung extrahieren
  if (error && typeof error === 'object' && 'errors' in error) {
    const zodError = error as { errors: Array<{ message: string; path: string[] }> };
    if (zodError.errors.length > 0) {
      const firstError = zodError.errors[0];
      const translated = translateError(firstError.message);
      
      logErrorToSupabase({
        errorCode: translated.code,
        errorMessage: translated.message,
        errorCategory: 'validation',
        severity: 'low',
        pagePath: window.location.pathname,
        pageTitle: getPageTitle(window.location.pathname),
        componentName,
        originalError: firstError.message,
        metadata: { field: firstError.path?.join('.') },
      });

      return translated.message;
    }
  }

  return handleAndLogError(error, { componentName, category: 'validation', severity: 'low' });
}

/**
 * Speziell für Auth-Fehler
 */
export function handleAuthError(
  error: unknown,
  componentName?: string
): string {
  return handleAndLogError(error, { componentName, category: 'auth', severity: 'medium' });
}

/**
 * Speziell für API/Supabase-Fehler
 */
export function handleApiError(
  error: unknown,
  componentName?: string,
  metadata?: Record<string, unknown>
): string {
  return handleAndLogError(error, { componentName, category: 'api', severity: 'medium', metadata });
}

/**
 * Speziell für Geschäftslogik-Fehler
 */
export function handleBusinessError(
  error: unknown,
  componentName?: string
): string {
  return handleAndLogError(error, { componentName, category: 'business', severity: 'low' });
}
