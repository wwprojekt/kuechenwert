/**
 * Error Log Service
 * 
 * Loggt jeden Fehler, der einem Nutzer angezeigt wird, in die Supabase error_logs Tabelle.
 * Wird vom zentralen Toast-Wrapper, ErrorBoundary und globalem Error-Handler aufgerufen.
 * 
 * Erweitert um:
 * - Breadcrumbs (letzte Navigationen/Aktionen des Users)
 * - Session-Tracking (Session-ID für zusammenhängende Fehler)
 * - Error-Fingerprinting (Hash für Gruppierung gleicher Fehler)
 * - Device/Network-Kontext (Bildschirmauflösung, Verbindungstyp, Speicher)
 * - HTTP-Status und Request-Info bei API-Fehlern
 */

import { supabase } from '@/integrations/supabase/client';
import { ensureValidRLSSession, isNetworkError } from '@/lib/sessionGuard';
import { translateError, getPageTitle, type ErrorCategory, type ErrorSeverity } from './germanErrors';
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
  httpStatus?: number;
  requestInfo?: Record<string, unknown>;
  errorSource?: 'caught' | 'uncaught' | 'unhandled-rejection' | 'error-boundary' | 'global';
}

// ============================================================================
// Session & Breadcrumb Tracking
// ============================================================================

const SESSION_ID = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
const APP_VERSION = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_VERSION) || 'unknown';
const MAX_BREADCRUMBS = 20;

interface Breadcrumb {
  type: 'navigation' | 'click' | 'input' | 'api' | 'error' | 'custom';
  message: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

const breadcrumbs: Breadcrumb[] = [];

/**
 * Fügt einen Breadcrumb hinzu (letzte Aktionen des Users vor dem Fehler)
 */
export function addBreadcrumb(crumb: Omit<Breadcrumb, 'timestamp'>): void {
  breadcrumbs.push({
    ...crumb,
    timestamp: Date.now(),
  });
  // Nur die letzten MAX_BREADCRUMBS behalten
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
}

/**
 * Gibt die aktuellen Breadcrumbs zurück
 */
function getBreadcrumbs(): Breadcrumb[] {
  return [...breadcrumbs];
}

// ============================================================================
// Automatische Breadcrumb-Erfassung
// ============================================================================

let _breadcrumbsInitialized = false;

export function initBreadcrumbTracking(): void {
  if (_breadcrumbsInitialized || typeof window === 'undefined') return;
  _breadcrumbsInitialized = true;

  // Navigation tracking
  let lastUrl = window.location.href;
  const checkNavigation = () => {
    if (window.location.href !== lastUrl) {
      addBreadcrumb({
        type: 'navigation',
        message: `Navigiert zu ${window.location.pathname}`,
        data: { from: lastUrl, to: window.location.href },
      });
      lastUrl = window.location.href;
    }
  };

  // Überwache URL-Änderungen
  const origPushState = history.pushState;
  history.pushState = function (...args) {
    origPushState.apply(this, args);
    checkNavigation();
  };
  const origReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    origReplaceState.apply(this, args);
    checkNavigation();
  };
  window.addEventListener('popstate', checkNavigation);

  // Click tracking (nur auf Buttons, Links, und interaktive Elemente)
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const interactiveEl = target.closest('button, a, [role="button"], [data-track]');
    if (interactiveEl) {
      const text = (interactiveEl as HTMLElement).textContent?.trim().slice(0, 50) || '';
      const tag = interactiveEl.tagName.toLowerCase();
      const id = interactiveEl.id ? `#${interactiveEl.id}` : '';
      const className = interactiveEl.className && typeof interactiveEl.className === 'string'
        ? `.${interactiveEl.className.split(' ')[0]}` : '';
      addBreadcrumb({
        type: 'click',
        message: `Klick auf ${tag}${id || className}: "${text}"`,
      });
    }
  }, { passive: true, capture: true });

  // API-Call tracking (fetch interceptor)
  const origFetch = window.fetch;
  window.fetch = async function (input, init) {
    try {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.includes('supabase') || url.includes('/rest/') || url.includes('/functions/')) {
        const method = init?.method || 'GET';
        addBreadcrumb({
          type: 'api',
          message: `${method} ${new URL(url, window.location.origin).pathname}`,
          data: { method, url: url.slice(0, 200) },
        });
      }
    } catch { /* breadcrumb failure must never block fetch */ }
    return origFetch.apply(this, [input, init]);
  };
}

// ============================================================================
// Error Fingerprinting
// ============================================================================

/**
 * Erzeugt einen Hash-Fingerprint für einen Fehler.
 * Gleiche Fehler (gleicher Code + gleiche Seite + gleiche Komponente) bekommen den gleichen Hash.
 */
function generateErrorHash(entry: ErrorLogEntry): string {
  const parts = [
    entry.errorCode,
    entry.pagePath,
    entry.componentName || '',
    // Ersten 100 Zeichen der Original-Fehlermeldung (ohne dynamische Teile)
    (entry.originalError || entry.errorMessage || '')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID') // UUIDs ersetzen
      .replace(/\d{10,}/g, 'TIMESTAMP') // Timestamps ersetzen
      .replace(/\d+\.\d+\.\d+\.\d+/g, 'IP') // IPs ersetzen
      .slice(0, 100),
  ].join('|');

  // Simple hash function (djb2)
  let hash = 5381;
  for (let i = 0; i < parts.length; i++) {
    hash = ((hash << 5) + hash) + parts.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return `err_${Math.abs(hash).toString(36)}`;
}

// ============================================================================
// Device & Network Context
// ============================================================================

function getScreenResolution(): string {
  if (typeof window === 'undefined') return 'unknown';
  return `${window.screen.width}x${window.screen.height}@${window.devicePixelRatio || 1}x`;
}

function getConnectionType(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (!conn) return 'unknown';
  return conn.effectiveType || conn.type || 'unknown';
}

function getMemoryUsage(): Record<string, unknown> | null {
  if (typeof performance === 'undefined') return null;
  const mem = (performance as any).memory;
  if (!mem) return null;
  return {
    usedJSHeapSize: Math.round(mem.usedJSHeapSize / 1024 / 1024),
    totalJSHeapSize: Math.round(mem.totalJSHeapSize / 1024 / 1024),
    jsHeapSizeLimit: Math.round(mem.jsHeapSizeLimit / 1024 / 1024),
  };
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

// Throttle: Maximal 10 Fehler pro Minute loggen um Spam zu vermeiden
let _errorCount = 0;
let _errorCountResetTime = Date.now();
const MAX_ERRORS_PER_MINUTE = 10;

function isThrottled(): boolean {
  const now = Date.now();
  if (now - _errorCountResetTime > 60000) {
    _errorCount = 0;
    _errorCountResetTime = now;
  }
  _errorCount++;
  return _errorCount > MAX_ERRORS_PER_MINUTE;
}

/**
 * Loggt einen Fehler in die Supabase error_logs Tabelle.
 * Wird asynchron ausgeführt und blockiert nicht die UI.
 */
export async function logErrorToSupabase(entry: ErrorLogEntry): Promise<void> {
  try {
    // Throttle check
    if (isThrottled()) {
      logger.warn('Error logging throttled - too many errors per minute');
      return;
    }

    // Aktuellen Nutzer und Rolle ermitteln
    await ensureValidRLSSession();
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

    const errorHash = generateErrorHash(entry);

    const { error } = await supabase.rpc('log_error', {
      p_error_code: entry.errorCode,
      p_error_message: entry.errorMessage,
      p_error_category: entry.errorCategory,
      p_severity: entry.severity,
      p_page_url: window.location.href,
      p_page_path: entry.pagePath || window.location.pathname,
      p_page_title: entry.pageTitle || getPageTitle(window.location.pathname),
      p_component_name: entry.componentName || null,
      p_user_id: user?.id || null,
      p_user_role: userRole,
      p_user_email: userEmail || null,
      p_stack_trace: entry.stackTrace || null,
      p_original_error: entry.originalError || null,
      p_metadata: entry.metadata || {},
      p_user_agent: navigator.userAgent,
      p_browser: getBrowser(),
      p_device_type: getDeviceType(),
      // New fields
      p_error_hash: errorHash,
      p_session_id: SESSION_ID,
      p_app_version: APP_VERSION,
      p_http_status: entry.httpStatus || null,
      p_request_info: entry.requestInfo || {},
      p_breadcrumbs: getBreadcrumbs(),
      p_environment: import.meta.env.PROD ? 'production' : 'development',
      p_error_source: entry.errorSource || 'caught',
      p_screen_resolution: getScreenResolution(),
      p_connection_type: getConnectionType(),
      p_memory_usage: getMemoryUsage(),
    });

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
    httpStatus?: number;
    requestInfo?: Record<string, unknown>;
    errorSource?: ErrorLogEntry['errorSource'];
  }
): string {
  // Extract error message robustly – covers Error, string, Supabase PostgrestError,
  // FunctionsHttpError, plain objects, and edge cases like {code: "PGRST...", details: "..."}
  let originalMessage: string;
  if (error instanceof Error) {
    originalMessage = error.message;
  } else if (typeof error === 'string') {
    originalMessage = error;
  } else if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    originalMessage = (typeof e.message === 'string' && e.message)
      || (typeof e.error === 'string' && e.error)
      || (typeof e.error_description === 'string' && e.error_description)
      || (typeof e.details === 'string' && e.details)
      || (typeof e.hint === 'string' && e.hint)
      || (typeof e.code === 'string' ? `Error code: ${e.code}` : '')
      || 'Unbekannter Fehler';
    // If there's a nested cause, append it
    if (typeof e.cause === 'string') originalMessage += ` (${e.cause})`;
  } else {
    originalMessage = 'Unbekannter Fehler';
  }

  const translated = translateError(originalMessage);
  
  // Kategorie und Severity können überschrieben werden
  const category = options?.category || translated.category;
  const severity = options?.severity || translated.severity;

  // Duplikat-Marker setzen damit toast-auto-capture diesen Fehler nicht nochmal loggt
  if (typeof window !== 'undefined') {
    (window as any).__lastLoggedErrorMessage = translated.message;
    (window as any).__lastLoggedErrorTime = Date.now();
  }

  // Harmlose Fehler NICHT loggen (normales Benutzerverhalten, kein Bug)
  const harmlessPatterns = [
    // Auth – falsche Credentials, unbestätigte Email, Passwort-Wiederverwendung
    'Invalid login credentials',
    'Email not confirmed',
    'New password should be different',
    'same_password',
    'Ungültige E-Mail-Adresse oder Passwort',
    'E-Mail-Adresse wurde noch nicht bestätigt',
    'muss sich vom alten Passwort unterscheiden',
    'muss sich vom bisherigen Passwort unterscheiden',
    'User already registered',
    'already registered',
    'For security purposes, you can only request this',
    'Aus Sicherheitsgründen können Sie',
    // Bidding – erwartete Validierungsfehler bei zu niedrigen Geboten
    'Gebot muss mindestens',
    'Gebot muss höher',
    'Bid must be at least',
    'Bid must be higher',
  ];
  const isHarmless = harmlessPatterns.some(p => 
    originalMessage.includes(p) || translated.message.includes(p)
  );
  if (isHarmless) {
    return translated.message;
  }

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
    httpStatus: options?.httpStatus,
    requestInfo: options?.requestInfo,
    errorSource: options?.errorSource || 'caught',
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
  // HINWEIS: Validierungsfehler werden NICHT mehr in error_logs geschrieben,
  // da sie normales Benutzerverhalten darstellen (z.B. "Weiter" klicken ohne Pflichtfeld).
  // Sie werden nur als Toast dem User angezeigt.
  if (error && typeof error === 'object' && 'issues' in error) {
    const zodError = error as { issues: Array<{ message: string; path: (string | number)[] }> };
    if (zodError.issues.length > 0) {
      const firstIssue = zodError.issues[0];
      const translated = translateError(firstIssue.message);
      
      logger.debug(`[Validation] ${componentName || 'unknown'}: ${translated.message}`, {
        field: firstIssue.path?.join('.'),
        allErrors: zodError.issues.map(e => ({ message: e.message, path: e.path?.join('.') })),
      });

      return translated.message;
    }
  }

  // Nur bei nicht-Zod-Fehlern in die DB loggen (echte Fehler)
  if (error instanceof Error && error.name !== 'ZodError') {
    return handleAndLogError(error, { componentName, category: 'validation', severity: 'low' });
  }
  
  const translated = translateError(error instanceof Error ? error.message : String(error));
  return translated.message;
}

/**
 * Speziell für Auth-Fehler
 */
export function handleAuthError(
  error: unknown,
  componentName?: string,
  metadata?: Record<string, unknown>
): string {
  return handleAndLogError(error, { componentName, category: 'auth', severity: 'medium', metadata });
}

/**
 * Speziell für API/Supabase-Fehler
 */
export function handleApiError(
  error: unknown,
  componentName?: string,
  metadata?: Record<string, unknown>
): string {
  // Versuche HTTP-Status aus dem Fehler zu extrahieren
  let httpStatus: number | undefined;
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    if (typeof err.status === 'number') httpStatus = err.status;
    else if (typeof err.statusCode === 'number') httpStatus = err.statusCode;
  }
  
  return handleAndLogError(error, { 
    componentName, 
    category: 'api', 
    severity: 'medium', 
    metadata,
    httpStatus,
  });
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

// ============================================================================
// Global Error Handler Integration
// ============================================================================

let _globalHandlersInstalled = false;

/**
 * Installiert globale Fehler-Handler die ALLE ungefangenen Fehler an Supabase senden.
 * Sollte einmal beim App-Start aufgerufen werden.
 */
export function installGlobalErrorHandlers(): void {
  if (_globalHandlersInstalled || typeof window === 'undefined') return;
  _globalHandlersInstalled = true;

  // Fange ungefangene JavaScript-Fehler
  window.addEventListener('error', (event) => {
    // Ignoriere Fehler von externen Scripts (CORS)
    if (!event.filename || event.filename === '') return;
    // Ignoriere ResizeObserver-Fehler (harmlos)
    if (event.message?.includes('ResizeObserver')) return;
    // Ignoriere Browser-Extension-Fehler (LastPass, Bitwarden, 1Password etc.)
    if (event.message?.includes('Object Not Found Matching Id')) return;
    // Ignoriere Navigator Lock-Fehler (harmlos, Supabase Auth-JS Session-Synchronisierung)
    if (
      event.message?.includes('Lock broken by another request') ||
      event.message?.includes('Lock was stolen by another request') ||
      event.message?.includes('released because another request stole it') ||
      event.message?.includes('Lock acquisition timed out') ||
      event.message?.includes('was not released within') ||
      event.message?.includes('Acquiring an exclusive Navigator LockManager lock')
    ) return;

    const translated = translateError(event.message || 'Uncaught error');
    logErrorToSupabase({
      errorCode: 'GLOBAL_UNCAUGHT_ERROR',
      errorMessage: translated.message,
      errorCategory: 'system',
      severity: 'high',
      pagePath: window.location.pathname,
      pageTitle: getPageTitle(window.location.pathname),
      originalError: event.message,
      stackTrace: event.error?.stack || `at ${event.filename}:${event.lineno}:${event.colno}`,
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        errorName: event.error?.name,
      },
      errorSource: 'uncaught',
    });
  });

  // Fange ungefangene Promise-Rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error 
      ? reason.message 
      : typeof reason === 'string' 
        ? reason 
        : 'Unhandled Promise Rejection';

    // Ignoriere bestimmte harmlose Rejections
    if (message.includes('AbortError') || message.includes('The user aborted')) return;
    // Ignoriere Browser-Extension-Fehler (LastPass, Bitwarden, 1Password etc.)
    if (message.includes('Object Not Found Matching Id')) return;

    const reasonName = reason instanceof Error ? reason.name : '';

    // Ignoriere Navigator Lock-Fehler (harmlos, Supabase Auth-JS Session-Synchronisierung)
    if (
      message.includes('lock request') ||
      message.includes('Lock broken by another request') ||
      message.includes('Lock was stolen by another request') ||
      message.includes('released because another request stole it') ||
      message.includes('Lock acquisition timed out') ||
      message.includes('was not released within') ||
      message.includes('Acquiring an exclusive Navigator LockManager lock') ||
      message.includes('Acquiring process lock') ||
      message.includes('isAcquireTimeout') ||
      reasonName === 'AbortError'
    ) return;
    // SessionExpiredError nicht protokollieren – Dialog wurde bereits ausgelöst.
    if (reason instanceof Error && (reason.name === 'SessionExpiredError' || reason.message === 'SESSION_EXPIRED')) return;
    // Transiente Netzwerkfehler nicht protokollieren – nicht actionable
    // (siehe ausführlichen Kommentar im console.error-Interceptor unten).
    if (isNetworkError(reason)) return;
    const translated = translateError(message);
    logErrorToSupabase({
      errorCode: 'GLOBAL_UNHANDLED_REJECTION',
      errorMessage: translated.message,
      errorCategory: 'system',
      severity: 'high',
      pagePath: window.location.pathname,
      pageTitle: getPageTitle(window.location.pathname),
      originalError: message,
      stackTrace: reason instanceof Error ? reason.stack : undefined,
      metadata: {
        reasonType: typeof reason,
        reasonName: reason instanceof Error ? reason.name : undefined,
      },
      errorSource: 'unhandled-rejection',
    });
  });

  // Console.error interceptor - fängt Fehler die nur in die Console geloggt werden
  const origConsoleError = console.error;
  console.error = function (...args: unknown[]) {
    origConsoleError.apply(console, args);

    // Nur loggen wenn es ein echter Fehler ist (nicht unsere eigenen Logs)
    const firstArg = args[0];
    if (typeof firstArg === 'string' && (
      firstArg.includes('Error-Log-Service') ||
      firstArg.includes('Fehler beim Speichern') ||
      firstArg.startsWith('[ERROR]')
    )) {
      return; // Eigene Logs nicht erneut loggen
    }

    // Nur Error-Objekte und bestimmte Strings loggen
    const errorArg = args.find(a => a instanceof Error) as Error | undefined;
    if (errorArg) {
      // Ignoriere Browser-Extension-Fehler
      if (errorArg.message?.includes('Object Not Found Matching Id')) return;

      // SessionExpiredError vollständig ignorieren:
      // Der globale SessionExpiredDialog wird bereits von sessionGuard.ts ausgelöst
      // und Aufrufer-Toasts werden in use-toast.ts unterdrückt. Es gibt nichts zu
      // protokollieren – die Session ist abgelaufen, das ist erwartetes Verhalten.
      if (errorArg.name === 'SessionExpiredError' || errorArg.message === 'SESSION_EXPIRED') return;

      // Transiente Netzwerkfehler aus dem globalen Interceptor filtern.
      //
      // Begründung:
      // - "Load failed" (Safari) / "Failed to fetch" (Chrome) / "NetworkError" (Firefox)
      //   entstehen bei instabiler Verbindung, Tab-Wechsel, Sleep-Aufwachen etc.
      // - Sie sind NICHT actionable: Der Nutzer kann nichts tun, der Browser/Supabase
      //   versucht es automatisch erneut.
      // - Wenn der Fehler tatsächlich eine User-Action betrifft, wird er über den
      //   sichtbaren Pfad (toast() → toast-auto-capture, oder explizit handleApiError())
      //   bereits geloggt. Hier im console.error-Interceptor landen NUR Fehler,
      //   die niemand explizit gefangen hat (z.B. Hintergrund-Refresh, ein
      //   useQuery der nach 3 Retries aufgibt aber kein Toast zeigt).
      // - Vorheriger Versuch via stack.includes('_refreshAccessToken') versagte in
      //   Safari, weil der Production-Bundle Funktionsnamen mangelt.
      // Falls wir später Hintergrund-Netzwerkfehler-Trends sehen wollen, ginge das
      // über Supabase-Realtime oder ein dediziertes APM-Tool deutlich präziser.
      if (isNetworkError(errorArg)) return;

      const translated = translateError(errorArg.message);

      // ── Dedup gegen handleAndLogError ────────────────────────────────
      // Wenn derselbe Fehler in den letzten 2 Sekunden bereits über
      // handleAndLogError protokolliert wurde (Toast-Pfad), wird er hier
      // nicht erneut als CONSOLE_ERROR doppelt geschrieben. Vorher hatten
      // wir z.B. bei Login (Safari "Load failed") und Edge-Function-Fehlern
      // immer zwei Einträge pro Fehler — einer aus dem Mutation-onError,
      // einer aus dem console.error des Supabase-Clients.
      const w = window as unknown as {
        __lastLoggedErrorMessage?: string;
        __lastLoggedErrorTime?: number;
      };
      if (
        w.__lastLoggedErrorMessage === translated.message &&
        typeof w.__lastLoggedErrorTime === 'number' &&
        Date.now() - w.__lastLoggedErrorTime < 2000
      ) {
        return; // Same error already logged via the toast path — skip duplicate
      }

      logErrorToSupabase({
        errorCode: 'CONSOLE_ERROR',
        errorMessage: translated.message,
        errorCategory: translated.category,
        severity: 'medium',
        pagePath: window.location.pathname,
        pageTitle: getPageTitle(window.location.pathname),
        originalError: errorArg.message,
        stackTrace: errorArg.stack,
        metadata: {
          consoleArgs: args.map(a => {
            if (a instanceof Error) return { name: a.name, message: a.message };
            if (typeof a === 'string') return a.slice(0, 200);
            try { return JSON.parse(JSON.stringify(a)); } catch { return String(a).slice(0, 200); }
          }),
        },
        errorSource: 'global',
      });
    }
  };
}
