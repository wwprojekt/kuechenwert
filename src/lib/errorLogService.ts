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
// Helpers: Browser-Translator + chunk-preload detection
// ============================================================================

/**
 * Detects errors triggered by browser-side translators (Edge iOS / Microsoft
 * Translator, Google Translate, Safari iOS Translate) which mutate the DOM
 * after React has rendered. React then loses track of nodes and throws errors
 * like `t.textContent`, `Failed to execute 'removeChild'`, `insertBefore`,
 * `replaceChild` etc.
 *
 * Two signals together are very reliable:
 *  1) The error message matches one of the known DOM-mutation patterns the
 *     React reconciler emits when nodes vanish under it.
 *  2) Every frame in the stack points to the current HTML document (the
 *     translator injects a script directly into the page) — there is not a
 *     single `/assets/*.js` frame from our own bundle.
 *
 * Either signal alone is enough — translator errors should never reach the
 * error_logs table; they are a symptom of the user enabling translation, not
 * a bug we can fix in code beyond `<html translate="no">` (already set).
 */
function isTranslatorError(message: string, stack?: string): boolean {
  const msg = message || '';
  const knownPatterns = [
    "evaluating 't.textContent'",
    "undefined is not an object (evaluating 'e.removeChild",
    "Failed to execute 'removeChild' on 'Node'",
    "Failed to execute 'insertBefore' on 'Node'",
    "Failed to execute 'replaceChild' on 'Node'",
    "The node to be removed is not a child of this node",
    "The node before which the new node is to be inserted is not a child of this node",
    "NotFoundError: The object can not be found here",
  ];
  if (knownPatterns.some((p) => msg.includes(p))) return true;

  if (!stack) return false;
  // Stack-only signal: every frame URL is the HTML document of the page
  // (caravanwert.de/<route>:1:NNN) and none point at our /assets/ bundle.
  const lines = stack.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('@') || l.includes('@http'));
  if (lines.length === 0) return false;
  const hasAssetFrame = /\/assets\/[A-Za-z0-9_.-]+\.(?:js|mjs)/.test(stack);
  if (hasAssetFrame) return false;
  // All non-native frames point to the HTML document
  const nonNative = lines.filter((l) => !l.includes('[native code]'));
  if (nonNative.length === 0) return false;
  return nonNative.every((l) => /https?:\/\/[^/]+\/[^@]*:\d+:\d+/.test(l));
}

/**
 * Detects errors thrown by browser-injected native autofill/contact bridges
 * (Samsung Internet `setContactAutofillValuesFromBridge`, Edge iOS Contact
 * Fill, Android WebView Autofill). These scripts inject anonymous JS into
 * the top of the page and iterate over form elements. When their internal
 * mapping misses an element they throw `TypeError: Cannot read properties
 * of undefined (reading 'value')` — the stack has ZERO `/assets/*.js`
 * frames because no code of ours is on the stack.
 *
 * The function-name signature is the cheapest and most precise signal; the
 * "no asset frame" fallback protects against future bridge renames. Either
 * alone is enough — these errors are NOT our bug and land as Critical
 * GLOBAL_UNCAUGHT_ERROR alerts otherwise (see report 2026-04-24 #1).
 */
function isInjectedBrowserBridgeError(_message: string, stack?: string): boolean {
  if (!stack) return false;
  // Named signatures are the cheapest + safest signal: they only appear in
  // the WebView's own injected contact/autofill bridge. Matching on the
  // function name (not on the generic "reading 'value'" message) prevents
  // this filter from ever masking a real bug in our bundle.
  const knownBridgeNames = [
    'setContactAutofillValuesFromBridge', // Samsung Internet / Android WebView
    'setAutofillValuesFromBridge', // Edge iOS Contact Fill
    'contactAutofillBridge', // generic iOS/Android bridge
    '__AutofillBridge', // Android WebView (older)
  ];
  return knownBridgeNames.some((n) => stack.includes(n));
}

/**
 * Detects Vite/Rollup chunk-preload failures that happen when a long-lived
 * tab tries to lazy-load a CSS/JS chunk whose hash no longer exists on the
 * server (after a deploy). Recovery is a single hard reload — the new
 * `index.html` references the new hashes.
 *
 * Patterns observed in production:
 *   - "Unable to preload CSS for /assets/..."
 *   - "Failed to fetch dynamically imported module: https://.../assets/..."
 *   - "Importing a module script failed."
 *   - "error loading dynamically imported module"
 */
function isChunkPreloadError(message: string): boolean {
  const m = message || '';
  return (
    m.includes('Unable to preload CSS for') ||
    m.includes('Failed to fetch dynamically imported module') ||
    m.includes('error loading dynamically imported module') ||
    m.includes('Importing a module script failed')
  );
}

/**
 * One-shot recovery for Vite chunk-preload failures. Reloads the page so the
 * browser fetches the freshly-deployed `index.html`. Guarded by sessionStorage
 * so a permanently-broken deploy can never trap the user in a reload loop:
 * the second occurrence in the same tab session is ignored.
 */
function tryRecoverFromChunkPreloadError(): void {
  if (typeof window === 'undefined') return;
  try {
    const KEY = 'cw_chunk_reload_done';
    if (window.sessionStorage.getItem(KEY) === '1') return;
    window.sessionStorage.setItem(KEY, '1');
    // Defer one tick so the current event loop finishes
    window.setTimeout(() => window.location.reload(), 0);
  } catch {
    // sessionStorage may be blocked (private mode, embedded webview) — give up
    // silently rather than risk a loop.
  }
}

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

    // ── Dedup-Marker fuer den globalen console.error-Interceptor ────────
    // React ruft nach `componentDidCatch` automatisch `console.error(error)`
    // auf. Ohne diesen Marker wuerde der Interceptor unten (siehe
    // installGlobalErrorHandlers) denselben Fehler ein zweites Mal als
    // CONSOLE_ERROR/medium protokollieren — ein klassischer doppelter Eintrag
    // pro ErrorBoundary-Treffer (siehe Bug-Report 20.04.2026, beide Eintraege
    // hatten identischen Hash err_lpcvga + err_naru9c, gleiche Session,
    // gleicher Stack). Dasselbe Marker-Pattern verwendet handleAndLogError
    // bereits fuer den Toast-Pfad. Wir setzen hier zusaetzlich einen Marker
    // fuer den unuebersetzten Original-Fehlertext, weil das genau die
    // Zeichenkette ist, die der Interceptor in `errorArg.message` sieht.
    if (typeof window !== 'undefined' && entry.originalError) {
      const w = window as unknown as {
        __lastLoggedOriginalError?: string;
        __lastLoggedOriginalErrorTime?: number;
      };
      w.__lastLoggedOriginalError = entry.originalError;
      w.__lastLoggedOriginalErrorTime = Date.now();
    }

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

  // Transient network errors (Safari "Load failed", Chrome "Failed to fetch",
  // Firefox "NetworkError when attempting to fetch resource") are not
  // actionable: the user closed the tab, switched off Wi-Fi, or hit a
  // momentary CDN blip. The toast still fires for UX, but we must not flood
  // error_logs — see also the global console-error and unhandledrejection
  // filters below for the same reasoning.
  if (isNetworkError(error)) {
    return translated.message;
  }

  // Browser-translator induced DOM mutation errors are out of our control
  // (Edge iOS / Microsoft Translator inject scripts despite `<html
  // translate="no">`). Logging them creates Critical alerts for something
  // only the user can fix in their browser settings.
  const stack = error instanceof Error ? error.stack : undefined;
  if (isTranslatorError(originalMessage, stack)) {
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
    // Transient network errors (Safari/Chrome/Firefox variants) are not
    // actionable bugs — silently drop instead of producing critical alerts.
    if (isNetworkError(event.error || event.message)) return;
    // Browser-translator (Edge iOS / Microsoft / Google Translate) injects
    // scripts that mutate React's DOM and throw `t.textContent` /
    // `removeChild` / `insertBefore` errors. There is nothing actionable on
    // our side beyond the `<html translate="no">` we already ship.
    const stack = event.error?.stack || `at ${event.filename}:${event.lineno}:${event.colno}`;
    if (isTranslatorError(event.message || '', stack)) return;
    // Browser-injected autofill/contact bridges (Samsung Internet, Edge iOS
    // Contact Fill, Android WebView) throw inside their own injected code
    // when iterating over form inputs. Nothing to fix on our side — the
    // error never touches our bundle (no `/assets/*.js` frame in the stack).
    if (isInjectedBrowserBridgeError(event.message || '', stack)) return;
    // Vite chunk-preload failure after a deploy: try a one-shot reload so
    // the browser fetches the freshly-deployed `index.html`.
    if (isChunkPreloadError(event.message || '')) {
      tryRecoverFromChunkPreloadError();
      return;
    }

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
    // Object-shaped rejections (Supabase/PostgREST error payloads, fetch
    // Response-like objects, custom `{ code, message, details }` throws)
    // historically landed as the literal string "Unhandled Promise
    // Rejection" with no metadata — impossible to debug (see report
    // 2026-04-24 #7, error_hash err_985yqm). Extract the first plausible
    // message field and, as last resort, a short JSON snapshot.
    let message: string;
    if (reason instanceof Error) {
      message = reason.message;
    } else if (typeof reason === 'string') {
      message = reason;
    } else if (reason && typeof reason === 'object') {
      const r = reason as Record<string, unknown>;
      message =
        (typeof r.message === 'string' && r.message) ||
        (typeof r.error === 'string' && r.error) ||
        (typeof r.error_description === 'string' && r.error_description) ||
        (typeof r.details === 'string' && r.details) ||
        (typeof r.hint === 'string' && r.hint) ||
        (typeof r.code === 'string' && `Error code: ${r.code}`) ||
        (() => {
          try {
            const snapshot = JSON.stringify(r);
            return snapshot && snapshot !== '{}' ? `Unhandled Promise Rejection: ${snapshot.slice(0, 280)}` : 'Unhandled Promise Rejection';
          } catch {
            return 'Unhandled Promise Rejection';
          }
        })();
    } else {
      message = 'Unhandled Promise Rejection';
    }

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
    // Vite chunk-preload failure after a deploy (typically surfaces as a
    // promise rejection from `import()`). One-shot reload so the new
    // `index.html` is fetched.
    if (isChunkPreloadError(message)) {
      tryRecoverFromChunkPreloadError();
      return;
    }
    // Browser-translator (Edge iOS / Microsoft / Google Translate) DOM
    // mutation errors that bubble up as unhandled rejections.
    if (isTranslatorError(message, reason instanceof Error ? reason.stack : undefined)) return;
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
        // Short JSON snapshot of object-shaped reasons so future occurrences
        // are debuggable without a reproduction. Cap at 500 chars to stay
        // well within error_logs row-size budget.
        reasonSnapshot: (() => {
          if (reason instanceof Error || typeof reason === 'string' || reason == null) return undefined;
          if (typeof reason !== 'object') return String(reason).slice(0, 500);
          try {
            const keys = Object.keys(reason as Record<string, unknown>);
            const snap = JSON.stringify(reason, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
            return snap && snap !== '{}' ? snap.slice(0, 500) : `object with keys: ${keys.join(',').slice(0, 200)}`;
          } catch {
            try {
              return `object with keys: ${Object.keys(reason as Record<string, unknown>).join(',').slice(0, 200)}`;
            } catch {
              return undefined;
            }
          }
        })(),
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

      // Browser-translator (Edge iOS / Microsoft / Google Translate) DOM
      // mutation errors. The same error that already passed the
      // `window.addEventListener('error', ...)` filter is re-emitted here
      // by React's console.error fallback — without this guard it would
      // surface as a CONSOLE_ERROR duplicate (see error #2 from
      // 20.04.2026).
      if (isTranslatorError(errorArg.message, errorArg.stack)) return;

      // Browser-injected autofill/contact bridge errors (see filter on the
      // `error` listener above). Same error can surface here if React's
      // console.error fallback re-emits it during render.
      if (isInjectedBrowserBridgeError(errorArg.message, errorArg.stack)) return;

      // Vite chunk-preload failure: don't log, recovery is already handled
      // in the `error` / `unhandledrejection` listeners above.
      if (isChunkPreloadError(errorArg.message)) return;

      const translated = translateError(errorArg.message);

      // ── Dedup gegen handleAndLogError und logErrorToSupabase ─────────
      // Zwei voneinander unabhängige Pfade können denselben Fehler innerhalb
      // weniger Millisekunden in den Logger schicken:
      //
      // 1. Toast-Pfad: handleAndLogError(...) -> setzt
      //    __lastLoggedErrorMessage = translated.message (deutsch).
      //    Beispiele: Mutation-onError + console.error des Supabase-Clients.
      //
      // 2. ErrorBoundary-Pfad: componentDidCatch -> logErrorToSupabase(...)
      //    -> setzt __lastLoggedOriginalError = originalError (roher Text,
      //    z.B. "Minified React error #300").
      //    React ruft danach automatisch console.error(error) auf, was hier
      //    landet — ohne diesen Check als zweiter CONSOLE_ERROR-Eintrag mit
      //    identischer Stack-Trace (siehe Bug-Report 20.04.2026).
      //
      // Beide Marker werden geprueft. Match = Duplikat = skip.
      const w = window as unknown as {
        __lastLoggedErrorMessage?: string;
        __lastLoggedErrorTime?: number;
        __lastLoggedOriginalError?: string;
        __lastLoggedOriginalErrorTime?: number;
      };
      if (
        w.__lastLoggedErrorMessage === translated.message &&
        typeof w.__lastLoggedErrorTime === 'number' &&
        Date.now() - w.__lastLoggedErrorTime < 2000
      ) {
        return; // Same error already logged via the toast path — skip duplicate
      }
      if (
        w.__lastLoggedOriginalError === errorArg.message &&
        typeof w.__lastLoggedOriginalErrorTime === 'number' &&
        Date.now() - w.__lastLoggedOriginalErrorTime < 2000
      ) {
        return; // Same error already logged via ErrorBoundary path — skip duplicate
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
