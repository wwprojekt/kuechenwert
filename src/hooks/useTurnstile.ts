import { useRef, useEffect, useCallback, useState } from 'react';

/**
 * Cloudflare Turnstile Hook für React SPA (explizites Rendering, unsichtbarer Modus).
 * 
 * Löst das Timing-Problem bei Multi-Step-Formularen:
 * Gibt einen Callback-Ref zurück, der das Widget erst rendert wenn das Container-div
 * tatsächlich ins DOM eingefügt wird (z.B. wenn Step 6 sichtbar wird).
 * 
 * Verwendung:
 * ```tsx
 * const { turnstileToken, turnstileReady, resetTurnstile, turnstileCallbackRef } = useTurnstile();
 * 
 * // Im JSX (kann auch in einem bedingten Step sein):
 * <div ref={turnstileCallbackRef} />
 * 
 * // Beim Submit:
 * await submitWithToken(turnstileToken); // Token kann null sein (graceful degradation)
 * resetTurnstile();
 * ```
 */

const TURNSTILE_SITE_KEY = '0x4AAAAAAC0m73avzi9-M6cO';

interface TurnstileState {
  /** Das Turnstile-Verifizierungstoken (null wenn noch nicht gelöst) */
  turnstileToken: string | null;
  /** Ob Turnstile geladen und bereit ist (oder graceful degradation aktiv) */
  turnstileReady: boolean;
  /** Ob ein Fehler aufgetreten ist */
  turnstileError: boolean;
  /** Turnstile zurücksetzen (z.B. nach Form-Submit) */
  resetTurnstile: () => void;
  /** Callback-Ref für das Container-div – rendert Widget sobald div im DOM ist */
  turnstileCallbackRef: (node: HTMLDivElement | null) => void;
}

export function useTurnstile(): TurnstileState {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const widgetIdRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const renderWidget = useCallback((container: HTMLDivElement) => {
    // Nicht doppelt rendern
    if (widgetIdRef.current !== null) return;

    try {
      const widgetId = (window as any).turnstile.render(container, {
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
    } catch (err) {
      console.warn('Turnstile render error:', err);
      setReady(true);
      setError(true);
    }
  }, []);

  // Callback-Ref: Wird von React aufgerufen wenn das div ins DOM kommt
  const turnstileCallbackRef = useCallback((node: HTMLDivElement | null) => {
    // Vorheriges Polling stoppen
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // Vorheriges Widget aufräumen wenn Container wechselt
    if (containerRef.current && containerRef.current !== node && widgetIdRef.current) {
      try {
        (window as any).turnstile?.remove(widgetIdRef.current);
      } catch {}
      widgetIdRef.current = null;
      setToken(null);
      setReady(false);
      setError(false);
    }

    containerRef.current = node;

    if (!node) return;

    // Turnstile API schon geladen?
    if ((window as any).turnstile) {
      renderWidget(node);
      return;
    }

    // API noch nicht geladen – warte mit Polling (max 10 Sekunden)
    let attempts = 0;
    const maxAttempts = 40; // 40 × 250ms = 10s
    pollingRef.current = setInterval(() => {
      attempts++;
      if ((window as any).turnstile && containerRef.current) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        renderWidget(containerRef.current);
      } else if (attempts >= maxAttempts) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        console.warn('Turnstile: Script loading timeout, allowing form submission');
        setReady(true);
        setError(true);
      }
    }, 250);
  }, [renderWidget]);

  // Cleanup bei Unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (widgetIdRef.current && (window as any).turnstile) {
        try {
          (window as any).turnstile.remove(widgetIdRef.current);
        } catch {}
        widgetIdRef.current = null;
      }
    };
  }, []);

  const resetTurnstile = useCallback(() => {
    setToken(null);
    setReady(false);
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
    turnstileCallbackRef,
  };
}
