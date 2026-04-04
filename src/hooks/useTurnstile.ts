import { useRef, useEffect, useCallback, useState } from 'react';

/**
 * Cloudflare Turnstile Hook für React SPA (explizites Rendering, unsichtbarer Modus).
 * 
 * Verwendung:
 * ```tsx
 * const { turnstileToken, turnstileReady, resetTurnstile, TurnstileWidget } = useTurnstile();
 * 
 * // Im JSX:
 * <form onSubmit={handleSubmit}>
 *   ...
 *   <TurnstileWidget />
 * </form>
 * 
 * // Beim Submit:
 * if (!turnstileToken) { return; } // Warten auf Token
 * await submitWithToken(turnstileToken);
 * resetTurnstile(); // Nach Submit zurücksetzen
 * ```
 */

const TURNSTILE_SITE_KEY = '0x4AAAAAAC0m73avzi9-M6cO';

interface TurnstileState {
  /** Das Turnstile-Verifizierungstoken (null wenn noch nicht gelöst) */
  turnstileToken: string | null;
  /** Ob Turnstile geladen und bereit ist */
  turnstileReady: boolean;
  /** Ob ein Fehler aufgetreten ist */
  turnstileError: boolean;
  /** Turnstile zurücksetzen (z.B. nach Form-Submit) */
  resetTurnstile: () => void;
  /** Ref für das Container-Element – muss an ein div gebunden werden */
  turnstileRef: React.RefObject<HTMLDivElement>;
}

export function useTurnstile(): TurnstileState {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const turnstileRef = useRef<HTMLDivElement>(null!);
  const widgetIdRef = useRef<string | null>(null);
  const renderAttemptedRef = useRef(false);

  const renderWidget = useCallback(() => {
    // Prüfen ob Turnstile API geladen ist
    if (typeof window === 'undefined' || !(window as any).turnstile) {
      return false;
    }

    // Prüfen ob Container existiert
    if (!turnstileRef.current) {
      return false;
    }

    // Nicht doppelt rendern
    if (widgetIdRef.current !== null) {
      return true;
    }

    try {
      const widgetId = (window as any).turnstile.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (newToken: string) => {
          setToken(newToken);
          setReady(true);
          setError(false);
        },
        'expired-callback': () => {
          setToken(null);
          setReady(false);
        },
        'error-callback': (errorCode: string) => {
          console.warn('Turnstile error:', errorCode);
          setError(true);
          // Bei Fehler trotzdem erlauben (graceful degradation)
          // Damit echte Nutzer nicht blockiert werden
          setReady(true);
        },
        'timeout-callback': () => {
          setToken(null);
          setReady(false);
        },
        size: 'invisible',
        retry: 'auto',
        'retry-interval': 3000,
        'refresh-expired': 'auto',
      });

      widgetIdRef.current = widgetId;
      return true;
    } catch (err) {
      console.warn('Turnstile render error:', err);
      // Graceful degradation: bei Fehler trotzdem erlauben
      setReady(true);
      setError(true);
      return false;
    }
  }, []);

  useEffect(() => {
    // Warten bis Turnstile API geladen ist
    const checkAndRender = () => {
      if ((window as any).turnstile && turnstileRef.current) {
        renderWidget();
        return true;
      }
      return false;
    };

    // Sofort versuchen
    if (checkAndRender()) return;

    // Falls noch nicht geladen, mit Polling warten (max 10 Sekunden)
    let attempts = 0;
    const maxAttempts = 40; // 40 × 250ms = 10s
    const interval = setInterval(() => {
      attempts++;
      if (checkAndRender() || attempts >= maxAttempts) {
        clearInterval(interval);
        if (attempts >= maxAttempts && !widgetIdRef.current) {
          // Timeout: Graceful degradation
          console.warn('Turnstile: Script loading timeout, allowing form submission');
          setReady(true);
          setError(true);
        }
      }
    }, 250);

    return () => {
      clearInterval(interval);
      // Widget aufräumen
      if (widgetIdRef.current && (window as any).turnstile) {
        try {
          (window as any).turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget]);

  const resetTurnstile = useCallback(() => {
    setToken(null);
    if (widgetIdRef.current && (window as any).turnstile) {
      try {
        (window as any).turnstile.reset(widgetIdRef.current);
      } catch {}
    }
  }, []);

  return {
    turnstileToken: token,
    turnstileReady: ready,
    turnstileError: error,
    resetTurnstile,
    turnstileRef,
  };
}
