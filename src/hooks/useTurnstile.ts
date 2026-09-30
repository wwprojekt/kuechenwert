import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile (explizites Rendering) für Formulare, auch in
 * Mehrschritt-Abläufen: Das Widget entsteht erst, wenn das Container-div ins
 * DOM kommt (Callback-Ref).
 *
 * Verwendung:
 * ```tsx
 * const { turnstileToken, resetTurnstile, turnstileCallbackRef } = useTurnstile();
 * <div ref={turnstileCallbackRef} />
 * await submitWithToken(turnstileToken); // Token kann null sein (graceful degradation)
 * resetTurnstile();
 * ```
 *
 * Der Site-Key kommt aus VITE_TURNSTILE_SITE_KEY (Widget für kuechenwert24.de im
 * Cloudflare-Dashboard). Ohne Key wird nichts geladen. Anfragen ohne gültiges
 * Token nehmen die Edge Functions trotzdem an, veröffentlichen den Lead aber
 * nicht automatisch an Studios (leads.bot_check).
 */

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || null;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Fehler, die kein erneuter Versuch behebt: Site-Key, Domain, Konfiguration, Uhrzeit. */
const PERMANENT_ERROR = /^(1101\d\d|110200|200100|4000\d\d)$/;

export interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi | null> | null = null;

function loadTurnstile(): Promise<TurnstileApi | null> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(window.turnstile ?? null);
    script.onerror = () => {
      scriptPromise = null;
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface TurnstileState {
  /** Das Turnstile-Verifizierungstoken (null wenn noch nicht gelöst) */
  turnstileToken: string | null;
  /** Ob Turnstile bereit ist (oder graceful degradation aktiv) */
  turnstileReady: boolean;
  /** Ob ein Fehler aufgetreten ist */
  turnstileError: boolean;
  /** Turnstile zurücksetzen (z.B. nach Form-Submit) */
  resetTurnstile: () => void;
  /**
   * Liefert das Token, sobald Turnstile es ausgestellt hat, spätestens nach
   * `timeoutMs` (dann null). Ohne Site-Key, bei blockiertem Skript oder
   * dauerhaftem Fehler sofort null.
   */
  waitForToken: (timeoutMs?: number) => Promise<string | null>;
  /** Callback-Ref für das Container-div – rendert Widget sobald div im DOM ist */
  turnstileCallbackRef: (node: HTMLDivElement | null) => void;
}

export function useTurnstile(): TurnstileState {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(!SITE_KEY);
  const [error, setError] = useState(false);
  const widgetIdRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tokenRef = useRef<string | null>(null);
  const unavailableRef = useRef(!SITE_KEY);
  const waitersRef = useRef<Array<(token: string | null) => void>>([]);

  const settle = useCallback((value: string | null) => {
    const waiters = waitersRef.current;
    waitersRef.current = [];
    waiters.forEach((resolve) => resolve(value));
  }, []);

  const removeWidget = useCallback(() => {
    const id = widgetIdRef.current;
    widgetIdRef.current = null;
    if (!id || !window.turnstile) return;
    try {
      window.turnstile.remove(id);
    } catch {
      // Widget war bereits entfernt.
    }
  }, []);

  const renderWidget = useCallback(
    (container: HTMLDivElement, api: TurnstileApi) => {
      if (widgetIdRef.current !== null || containerRef.current !== container) return;
      try {
        widgetIdRef.current = api.render(container, {
          sitekey: SITE_KEY,
          // Sichtbar nur, wenn Cloudflare eine Eingabe braucht; sonst verdrängt die Box den Rechtshinweis unter die mobile Leiste.
          appearance: "interaction-only",
          callback: (newToken: string) => {
            tokenRef.current = newToken;
            setToken(newToken);
            setReady(true);
            setError(false);
            settle(newToken);
          },
          "expired-callback": () => {
            tokenRef.current = null;
            setToken(null);
            setReady(false);
          },
          "timeout-callback": () => {
            tokenRef.current = null;
            setToken(null);
            setReady(false);
          },
          // true = Fehler behandelt; sonst wirft Turnstile ihn als ungefangene Exception.
          "error-callback": (code: string) => {
            setError(true);
            setReady(true);
            if (PERMANENT_ERROR.test(String(code))) {
              console.error(`Turnstile deaktiviert: Fehler ${code} (Site-Key oder Domain in Cloudflare prüfen)`);
              unavailableRef.current = true;
              settle(null);
              setTimeout(removeWidget, 0);
            }
            return true;
          },
          retry: "auto",
          "refresh-expired": "auto",
        });
      } catch (err) {
        console.error("Turnstile konnte nicht gerendert werden:", err);
        unavailableRef.current = true;
        settle(null);
        setReady(true);
        setError(true);
      }
    },
    [removeWidget, settle],
  );

  const turnstileCallbackRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (containerRef.current && containerRef.current !== node) {
        removeWidget();
        tokenRef.current = null;
        setToken(null);
        setReady(!SITE_KEY);
        setError(false);
      }
      containerRef.current = node;
      if (!node || !SITE_KEY) return;
      void loadTurnstile().then((api) => {
        if (!api) {
          // Skript blockiert (z. B. Adblocker): Formular trotzdem absendbar.
          unavailableRef.current = true;
          settle(null);
          setReady(true);
          setError(true);
          return;
        }
        renderWidget(node, api);
      });
    },
    [removeWidget, renderWidget, settle],
  );

  useEffect(() => removeWidget, [removeWidget]);

  const waitForToken = useCallback(
    (timeoutMs = 4000) => {
      if (tokenRef.current) return Promise.resolve(tokenRef.current);
      if (unavailableRef.current) return Promise.resolve(null);
      return new Promise<string | null>((resolve) => {
        const timer = setTimeout(() => {
          waitersRef.current = waitersRef.current.filter((w) => w !== done);
          resolve(tokenRef.current);
        }, timeoutMs);
        const done = (value: string | null) => {
          clearTimeout(timer);
          resolve(value);
        };
        waitersRef.current.push(done);
      });
    },
    [],
  );

  const resetTurnstile = useCallback(() => {
    tokenRef.current = null;
    setToken(null);
    const id = widgetIdRef.current;
    if (!id || !window.turnstile) return;
    setReady(false);
    try {
      window.turnstile.reset(id);
    } catch {
      // Widget wurde zwischenzeitlich entfernt.
    }
  }, []);

  return {
    turnstileToken: token,
    turnstileReady: ready,
    turnstileError: error,
    resetTurnstile,
    waitForToken,
    turnstileCallbackRef,
  };
}
