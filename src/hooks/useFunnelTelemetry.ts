import { useCallback, useEffect, useMemo, useRef } from "react";
import { trackFunnelStart } from "@/lib/funnelAnalytics";
import type { FunnelId } from "@/lib/funnelRoutes";
import {
  beginFunnelSession,
  endFunnelSession,
  entryMetadata,
  flushFunnelTelemetry,
  logFunnelEvent,
  markFunnelStarted,
  scrubErrorText,
  setActiveFunnelStep,
  type ActiveFunnelStep,
  type FunnelTelemetryEvent,
  type TelemetryMetadata,
} from "@/lib/funnelTelemetry";
import { trackMetaInitiateCheckout } from "@/lib/metaPixelService";
import { isFieldKey } from "../../supabase/functions/_shared/funnel-telemetry.ts";

/** Container der Funnel-Felder; Kopf, Fußzeile und Cookie-Banner liegen außerhalb. */
export const FUNNEL_TELEMETRY_ROOT = "data-funnel-telemetry";

const IDLE_MS = 25_000;
const TAB_AWAY_MIN_MS = 1500;
/** Mehrfachklick: so viele Klicks auf dasselbe Element innerhalb des Fensters. */
const RAGE_CLICKS = 3;
const RAGE_WINDOW_MS = 1000;
const CLICKABLE = 'button, a, label, select, [role="button"], [role="checkbox"], [role="radio"], [role="switch"], [data-track]';
const NON_TEXT_INPUTS = new Set(["checkbox", "radio", "button", "submit", "reset", "image", "file", "hidden", "range", "color"]);
const HELPER_ID = /-(?:error|hint|desc|unit|label|status)$/;
const CHUNK_ERROR = /ChunkLoadError|Loading chunk|dynamically imported module|Importing a module script failed/i;

const FUNNEL_NAMES: Record<FunnelId, { name: string; category: string }> = {
  a: { name: "Funnel A", category: "Küchenangebote" },
  b: { name: "Funnel B", category: "Angebot unterbieten" },
  c: { name: "Funnel C", category: "Traumküche" },
};

interface Options {
  funnel: FunnelId;
  /** Schlüssel des Schritts, z. B. der URL-Slug. */
  step: string;
  stepIndex: number;
  stepLabel: string;
  totalSteps: number;
}

export interface FunnelTelemetry {
  next: () => void;
  back: () => void;
  validationFailed: (fields: readonly string[]) => void;
  submitClicked: () => void;
  submitSucceeded: () => void;
  submitFailed: (reason: string) => void;
}

function fieldKey(el: Element): string | null {
  for (const candidate of [el.getAttribute("data-track"), el.getAttribute("name"), el.id]) {
    if (candidate && !HELPER_ID.test(candidate) && isFieldKey(candidate)) return candidate;
  }
  return null;
}

function trackedField(target: EventTarget | null): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  if (!(target instanceof Element) || !target.closest(`[${FUNNEL_TELEMETRY_ROOT}]`)) return null;
  const isEntry =
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(target.type));
  if (!isEntry || target.tabIndex < 0) return null;
  return target;
}

/**
 * Sichtbarer Text eines Bedienelements, nie Eingaben. Kein aria-label: das
 * enthält teils Nutzerdaten (z. B. den Dateinamen beim Entfernen-Button).
 */
function clickLabel(el: Element): string | null {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return null;
  const text = (el.textContent ?? "").replace(/\s+/g, " ").trim();
  return text ? scrubErrorText(text).slice(0, 60) : null;
}

function trackedCheckable(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest('input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"], [role="switch"]');
  if (!el || !el.closest(`[${FUNNEL_TELEMETRY_ROOT}]`)) return null;
  return el;
}

/**
 * Schritt- und Feldereignisse eines Funnels. Feldereignisse kommen per
 * Delegation aus dem Container mit data-funnel-telemetry; Felder brauchen
 * dafür name, id oder data-track.
 */
export function useFunnelTelemetry({ funnel, step, stepIndex, stepLabel, totalSteps }: Options): FunnelTelemetry {
  const current = useRef<ActiveFunnelStep>({ funnel, step, stepIndex, enteredAt: Date.now() });
  const done = useRef(false);
  const filled = useRef(new Set<string>());
  const corrected = useRef(new Set<string>());
  const maxScroll = useRef(0);

  const log = useCallback(
    (event: FunnelTelemetryEvent, extra: { field?: string; errorFields?: readonly string[]; metadata?: TelemetryMetadata } = {}) => {
      if (done.current) return;
      const s = current.current;
      logFunnelEvent({
        funnel: s.funnel,
        step: s.step,
        stepIndex: s.stepIndex,
        event,
        timeOnStepMs: Date.now() - s.enteredAt,
        ...extra,
      });
    },
    [],
  );

  useEffect(() => {
    done.current = false;
    const { isNew } = beginFunnelSession(funnel);
    const entered: ActiveFunnelStep = { funnel, step, stepIndex, enteredAt: Date.now() };
    current.current = entered;
    setActiveFunnelStep(entered);
    filled.current = new Set();
    corrected.current = new Set();
    maxScroll.current = 0;
    if (isNew) {
      logFunnelEvent({ funnel, step, stepIndex, event: "segmentation", metadata: { ...entryMetadata(), total_steps: totalSteps } });
    }
    logFunnelEvent({ funnel, step, stepIndex, event: "step_enter", metadata: { label: stepLabel } });
    return () => {
      if (!done.current && maxScroll.current > 0) {
        logFunnelEvent({ funnel, step, stepIndex, event: "scroll_depth", metadata: { max_pct: maxScroll.current } });
      }
      setActiveFunnelStep(null);
    };
  }, [funnel, step, stepIndex, stepLabel, totalSteps]);

  useEffect(() => {
    const onScroll = () => {
      const el = document.scrollingElement ?? document.documentElement;
      const range = el.scrollHeight - el.clientHeight;
      if (range <= 0) return;
      const pct = Math.min(100, Math.round((el.scrollTop / range) * 100));
      if (pct > maxScroll.current) maxScroll.current = pct;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Einmal pro Schritt: 25 s ohne Eingabe, Klick oder Scrollen.
  useEffect(() => {
    let fired = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      if (fired) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (document.visibilityState === "hidden") return;
        fired = true;
        log("idle", { metadata: { idle_ms: IDLE_MS } });
      }, IDLE_MS);
    };
    const activity = ["pointerdown", "keydown", "scroll", "focusin"] as const;
    activity.forEach((name) => window.addEventListener(name, arm, { passive: true }));
    arm();
    return () => {
      if (timer) clearTimeout(timer);
      activity.forEach((name) => window.removeEventListener(name, arm));
    };
  }, [log, step, stepIndex]);

  // Verlassen (Tab weg, App-Wechsel, Schließen) mit Verweildauer; zurück als tab_switch.
  useEffect(() => {
    let hiddenAt = 0;
    let left = false;
    const leave = () => {
      if (!left) {
        left = true;
        log("leave");
      }
      flushFunnelTelemetry(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        leave();
        return;
      }
      left = false;
      if (hiddenAt > 0) {
        const away = Date.now() - hiddenAt;
        hiddenAt = 0;
        if (away > TAB_AWAY_MIN_MS) log("tab_switch", { metadata: { away_ms: away } });
      }
    };
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [log]);

  useEffect(() => {
    const report = (name: string, message: string, rejection: boolean, source?: string, line?: number) => {
      if (!message || message === "Script error." || message.includes("ResizeObserver")) return;
      log("js_error", {
        metadata: {
          name: name.slice(0, 32),
          message: scrubErrorText(message),
          chunk: CHUNK_ERROR.test(`${name} ${message}`),
          rejection,
          source: source ? source.split("?")[0]!.slice(-120) : null,
          line: line ?? null,
        },
      });
    };
    const onError = (event: ErrorEvent) => {
      const error = event.error instanceof Error ? event.error : null;
      report(error?.name ?? "Error", error?.message ?? event.message ?? "", false, event.filename, event.lineno);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason: unknown = event.reason;
      if (reason instanceof Error) report(reason.name, reason.message, true);
      else if (typeof reason === "string") report("UnhandledRejection", reason, true);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [log]);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const el = trackedField(event.target);
      const key = el && fieldKey(el);
      if (!key) return;
      if (filled.current.has(key) && !corrected.current.has(key)) {
        corrected.current.add(key);
        log("field_corrected", { field: key });
      }
      log("field_focus", { field: key });
    };
    const onFocusOut = (event: FocusEvent) => {
      const el = trackedField(event.target);
      const key = el && fieldKey(el);
      if (!el || !key) return;
      const empty = el.value.trim() === "";
      if (!empty) filled.current.add(key);
      log(empty ? "field_blur_empty" : "field_blur_filled", { field: key });
    };
    let burst: { el: Element; start: number; count: number } | null = null;
    const onRageClick = (target: EventTarget | null) => {
      if (!(target instanceof Element) || !target.closest(`[${FUNNEL_TELEMETRY_ROOT}]`)) return;
      const clickable = target.closest(CLICKABLE);
      const el = clickable ?? target;
      const now = Date.now();
      if (burst && burst.el === el && now - burst.start <= RAGE_WINDOW_MS) burst.count += 1;
      else burst = { el, start: now, count: 1 };
      if (burst.count !== RAGE_CLICKS) return;
      // Nicht klickbare Ziele nur mit Tag-Namen: ihr Text kann Eingaben oder Dateinamen enthalten.
      const tag = el.tagName.toLowerCase();
      log("rage_click", {
        field: fieldKey(el) ?? undefined,
        metadata: clickable ? { label: clickLabel(el), tag } : { tag, dead: true },
      });
    };

    const onClick = (event: MouseEvent) => {
      onRageClick(event.target);
      const el = trackedCheckable(event.target);
      const key = el && fieldKey(el);
      if (!el || !key) return;
      // Nach dem Klick steht der neue Zustand fest (auch bei Radix-Checkboxen).
      window.setTimeout(() => {
        const checked = el instanceof HTMLInputElement ? el.checked : el.getAttribute("aria-checked") === "true";
        log("field_change", { field: key, metadata: { checked } });
      }, 0);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("click", onClick, true);
    };
  }, [log]);

  return useMemo(
    () => ({
      next: () => {
        log("next_clicked");
        if (markFunnelStarted(funnel)) {
          trackFunnelStart(funnel);
          trackMetaInitiateCheckout({ content_name: FUNNEL_NAMES[funnel].name, content_category: FUNNEL_NAMES[funnel].category });
        }
      },
      back: () => log("back_clicked"),
      validationFailed: (fields) => log("validation_failed", { errorFields: fields }),
      submitClicked: () => log("submit_clicked"),
      submitSucceeded: () => {
        log("submit_succeeded", { metadata: { total_steps: totalSteps } });
        done.current = true;
        endFunnelSession(funnel);
      },
      submitFailed: (reason) => log("submit_failed", { metadata: { reason: reason.slice(0, 120) } }),
    }),
    [funnel, log, totalSteps],
  );
}
