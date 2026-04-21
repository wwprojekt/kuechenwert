import { useEffect, useRef, useCallback } from "react";
import {
  flushWizardTelemetry,
  logWizardEvent,
  setWizardTelemetrySession,
} from "@/lib/wizardTelemetry";

/**
 * Thin React-side adapter around the wizard telemetry singleton.
 *
 * Responsibilities:
 *  1. Bind the current `sessionId` to the telemetry module so events
 *     are attributed to the right wizard_sessions row.
 *  2. Emit `step_enter` whenever `currentStep` changes.
 *  3. Track `time_on_step_ms` so we can answer "how long did the user
 *     sit on step 2 before giving up?".
 *  4. Attach a delegated focusin / focusout listener on the wizard
 *     container so we pick up every input/select without modifying
 *     the individual Step components. Every input in the wizard
 *     already has an `id` that matches its form-state key
 *     (manufacturer, model, year, …). We rely on that convention.
 *  5. Flush the buffer on `pagehide` / `visibilitychange=hidden` via
 *     `navigator.sendBeacon` so the final `leave` event survives.
 *
 * The hook is a layer ON TOP of the existing wizard state — it never
 * touches formData or validation. If anything fails it degrades
 * silently to a no-op (drop-off analytics must never break the actual
 * drop-off funnel).
 */
interface UseWizardTelemetryOptions {
  /** Wizard session id. Telemetry is disabled until this is non-null. */
  sessionId: string | null;
  /** Currently rendered step (1-based). */
  currentStep: number;
  /** Total number of steps — used for `submit_succeeded.metadata`. */
  totalSteps: number;
  /**
   * Ref to the wizard root element. We attach the delegated
   * focusin/focusout listener here so events bubble from any
   * descendant input. Works for Radix-based inputs too (they forward
   * focus to the underlying input).
   */
  rootRef: React.RefObject<HTMLElement>;
}

interface UseWizardTelemetryReturn {
  logNextClicked: () => void;
  logBackClicked: () => void;
  logValidationFailed: (errorFields: string[]) => void;
  logSubmitClicked: () => void;
  logSubmitSucceeded: () => void;
  logSubmitFailed: (reason?: string) => void;
}

export function useWizardTelemetry(
  options: UseWizardTelemetryOptions,
): UseWizardTelemetryReturn {
  const { sessionId, currentStep, totalSteps, rootRef } = options;

  // `stepEnteredAt` is a ref so updating it never causes a re-render
  // and the closure in our listener always sees the latest step.
  const stepEnteredAtRef = useRef<number>(Date.now());
  const currentStepRef = useRef<number>(currentStep);

  // Keep currentStepRef in sync with the prop so the focus/blur
  // listener — which lives in a single useEffect — always knows
  // which step its events belong to without recreating on every
  // step change.
  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  // Bind sessionId to the telemetry singleton.
  useEffect(() => {
    setWizardTelemetrySession(sessionId);
    // We intentionally don't clear on unmount — the wizard page
    // unmounting is the exact signal we want to flush via the
    // pagehide listener below.
  }, [sessionId]);

  // Emit step_enter on step change and remember the enter timestamp.
  useEffect(() => {
    if (!sessionId) return;
    stepEnteredAtRef.current = Date.now();
    logWizardEvent({
      step: currentStep,
      event: "step_enter",
    });
  }, [sessionId, currentStep]);

  // Delegated focus/blur listener. Reads input.id + input.value and
  // emits one of field_focus / field_blur_empty / field_blur_filled.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !sessionId) return;

    const pickField = (target: EventTarget | null): string | null => {
      if (!target || !(target instanceof HTMLElement)) return null;
      // Direct id if present and plausibly a form field key.
      const id = target.getAttribute("id");
      if (id && /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(id)) {
        // Filter out helper ids used for error/description wrappers.
        if (id.endsWith("-error") || id.endsWith("-desc") || id.endsWith("-hint")) {
          return null;
        }
        return id;
      }
      // Fallback: name attribute on inputs
      const name = target.getAttribute("name");
      if (name && /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(name)) return name;
      return null;
    };

    const isFocusableInput = (el: HTMLElement): boolean => {
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      // Radix Select / Combobox triggers are buttons with role="combobox"
      const role = el.getAttribute("role");
      if (role === "combobox" || role === "textbox") return true;
      return false;
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !isFocusableInput(target)) return;
      const field = pickField(target);
      if (!field) return;
      logWizardEvent({
        step: currentStepRef.current,
        event: "field_focus",
        field_name: field,
      });
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !isFocusableInput(target)) return;
      const field = pickField(target);
      if (!field) return;
      let isEmpty = true;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
        isEmpty = !target.value || target.value.trim().length === 0;
      } else {
        // Radix combobox button: read aria-label / textContent fallback
        const text = target.textContent?.trim() || "";
        // Trigger usually shows a placeholder when empty — heuristic:
        // if aria-expanded exists and data-placeholder attr is present
        // and matches text, treat as empty.
        const placeholder = target.getAttribute("data-placeholder");
        isEmpty = !text || (!!placeholder && text === placeholder);
      }
      logWizardEvent({
        step: currentStepRef.current,
        event: isEmpty ? "field_blur_empty" : "field_blur_filled",
        field_name: field,
      });
    };

    // Click-tracking for Radix Checkbox/Radio (and native checkbox/radio).
    // Mobile Safari often does not fire focus on these — only click. We use
    // CAPTURE phase so we still receive the event even if a child element
    // calls e.stopPropagation() in its bubble-phase onClick handler (the
    // FeatureCheckbox in EquipmentStep does exactly that on its inner
    // <Checkbox>).
    //
    // Two real-world wrapper patterns we explicitly support:
    //   1. EquipmentStep FeatureCheckbox — a <div role="button"> wrapping
    //      a Radix <Checkbox>. Tap on the wrapper toggles the inner
    //      checkbox via React state, no click ever reaches the checkbox
    //      element. We must detect "wrapper has a single checkable
    //      descendant" and attribute the click to that descendant.
    //   2. SaleChannelStep <Card role="button"> wrapping a RadioGroupItem.
    //      Same idea.
    // For wrapper detection we accept role="button", <button>, <label>
    // and an explicit data-track-checkable opt-in escape hatch.
    const isCheckableTarget = (el: HTMLElement): HTMLElement | null => {
      let node: HTMLElement | null = el;
      let depth = 0;
      while (node && depth < 5 && node !== root) {
        // Direct match — input / Radix Checkbox / Radix RadioGroupItem.
        const role = node.getAttribute("role");
        if (role === "checkbox" || role === "radio") return node;
        if (node.tagName === "INPUT") {
          const type = (node as HTMLInputElement).type;
          if (type === "checkbox" || type === "radio") return node;
        }
        // Wrapper detection: an interactive container that holds a
        // single checkable. We look only at descendants OF THE WRAPPER
        // so a "Show more" button next to (but outside of) a checkbox
        // can never be misattributed.
        const isWrapperInteractive =
          role === "button" ||
          node.tagName === "BUTTON" ||
          node.tagName === "LABEL" ||
          node.hasAttribute("data-track-checkable");
        if (isWrapperInteractive) {
          const inner = node.querySelector<HTMLElement>(
            '[role="checkbox"], [role="radio"], input[type="checkbox"], input[type="radio"]',
          );
          if (inner) return inner;
        }
        node = node.parentElement;
        depth += 1;
      }
      return null;
    };

    const handleClickCapture = (e: MouseEvent) => {
      const initialTarget = e.target as HTMLElement | null;
      if (!initialTarget) return;
      const checkable = isCheckableTarget(initialTarget);
      if (!checkable) return;
      const field = pickField(checkable);
      if (!field) return;
      logWizardEvent({
        step: currentStepRef.current,
        event: "field_change",
        field_name: field,
      });
    };

    root.addEventListener("focusin", handleFocusIn);
    root.addEventListener("focusout", handleFocusOut);
    root.addEventListener("click", handleClickCapture, true);

    return () => {
      root.removeEventListener("focusin", handleFocusIn);
      root.removeEventListener("focusout", handleFocusOut);
      root.removeEventListener("click", handleClickCapture, true);
    };
    // rootRef is a ref; eslint-exhaustive-deps would flag it, but the
    // effect deliberately uses its `.current` snapshot at mount time.
    // We re-run if sessionId changes so listeners re-bind after login.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Flush + leave on pagehide / tab-hide. We DO NOT double-flush with
  // the existing beforeunload listener in VerkaufenWizard — that one
  // persists wizard_sessions data; this one logs the telemetry event
  // and flushes the buffer independently.
  useEffect(() => {
    if (!sessionId) return;

    let fired = false;
    const leaveAndFlush = () => {
      if (fired) return;
      fired = true;
      const timeOnStep = Date.now() - stepEnteredAtRef.current;
      logWizardEvent({
        step: currentStepRef.current,
        event: "leave",
        time_on_step_ms: timeOnStep,
      });
      void flushWizardTelemetry("pagehide");
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") leaveAndFlush();
    };

    window.addEventListener("pagehide", leaveAndFlush);
    window.addEventListener("beforeunload", leaveAndFlush);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("pagehide", leaveAndFlush);
      window.removeEventListener("beforeunload", leaveAndFlush);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [sessionId]);

  // Flush periodically is already handled inside wizardTelemetry.ts
  // via its internal flushTimer. Nothing to do here.

  const makeTimeOnStep = useCallback(
    () => Date.now() - stepEnteredAtRef.current,
    [],
  );

  const logNextClicked = useCallback(() => {
    logWizardEvent({
      step: currentStepRef.current,
      event: "next_clicked",
      time_on_step_ms: makeTimeOnStep(),
    });
  }, [makeTimeOnStep]);

  const logBackClicked = useCallback(() => {
    logWizardEvent({
      step: currentStepRef.current,
      event: "back_clicked",
      time_on_step_ms: makeTimeOnStep(),
    });
  }, [makeTimeOnStep]);

  const logValidationFailed = useCallback(
    (errorFields: string[]) => {
      logWizardEvent({
        step: currentStepRef.current,
        event: "validation_failed",
        error_fields: errorFields.length > 0 ? errorFields : null,
        time_on_step_ms: makeTimeOnStep(),
      });
    },
    [makeTimeOnStep],
  );

  const logSubmitClicked = useCallback(() => {
    logWizardEvent({
      step: currentStepRef.current,
      event: "submit_clicked",
      time_on_step_ms: makeTimeOnStep(),
    });
  }, [makeTimeOnStep]);

  const logSubmitSucceeded = useCallback(() => {
    logWizardEvent({
      step: currentStepRef.current,
      event: "submit_succeeded",
      time_on_step_ms: makeTimeOnStep(),
      metadata: { total_steps: totalSteps },
    });
    void flushWizardTelemetry("manual");
  }, [makeTimeOnStep, totalSteps]);

  const logSubmitFailed = useCallback(
    (reason?: string) => {
      const metadata: Record<string, unknown> = {};
      if (reason) metadata.reason = reason.slice(0, 120);
      logWizardEvent({
        step: currentStepRef.current,
        event: "submit_failed",
        time_on_step_ms: makeTimeOnStep(),
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
      });
    },
    [makeTimeOnStep],
  );

  // Silence "rootRef is unused" eslint by referencing it in the list
  // of dependencies isn't necessary — it was used in the effect above.
  void rootRef;

  const api: UseWizardTelemetryReturn = {
    logNextClicked,
    logBackClicked,
    logValidationFailed,
    logSubmitClicked,
    logSubmitSucceeded,
    logSubmitFailed,
  };
  return api;
}

export type { UseWizardTelemetryReturn };
