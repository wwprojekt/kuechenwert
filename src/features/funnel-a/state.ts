import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { emptyFunnelAAnswers, sanitizeFunnelAAnswers, type FunnelAAnswers } from "./catalog";
import { emptyContact, sanitizeContact, type FunnelAContact } from "./validation";

export const FUNNEL_A_STORAGE_KEY = "kw_funnel_a_v2";

/** Einstiegsparameter (Landing, Ads, Ratgeber), die der Funnel einmalig übernimmt. */
const HANDOFF_PARAMS = ["form", "plz"] as const;

export interface FunnelAState {
  answers: FunnelAAnswers;
  contact: FunnelAContact;
}

export function initialFunnelAState(): FunnelAState {
  return { answers: emptyFunnelAAnswers(), contact: emptyContact() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Liest den gespeicherten Stand; alles Unbekannte fällt auf leere Werte zurück. */
export function parseStoredState(raw: string | null | undefined): FunnelAState {
  if (!raw) return initialFunnelAState();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return initialFunnelAState();
  }
  if (!isRecord(parsed)) return initialFunnelAState();
  return {
    answers: isRecord(parsed.answers) ? sanitizeFunnelAAnswers(parsed.answers) : emptyFunnelAAnswers(),
    contact: sanitizeContact(parsed.contact),
  };
}

export function readStoredState(): FunnelAState {
  try {
    return parseStoredState(sessionStorage.getItem(FUNNEL_A_STORAGE_KEY));
  } catch {
    return initialFunnelAState();
  }
}

function writeStoredState(state: FunnelAState): void {
  try {
    sessionStorage.setItem(FUNNEL_A_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Privater Modus / Speicher voll: Der Funnel funktioniert auch ohne Zwischenstand.
  }
}

function clearStoredState(): void {
  try {
    sessionStorage.removeItem(FUNNEL_A_STORAGE_KEY);
  } catch {
    // siehe writeStoredState
  }
}

export function hasHandoffParams(params: URLSearchParams): boolean {
  return HANDOFF_PARAMS.some((key) => params.has(key));
}

/** Übernimmt gültige ?form= und ?plz=; ungültige Werte lassen die Antworten unverändert. */
export function applyQueryParams(answers: FunnelAAnswers, params: URLSearchParams): FunnelAAnswers {
  const probe = sanitizeFunnelAAnswers({ kitchen_form: params.get("form"), postal_code: params.get("plz") });
  return {
    ...answers,
    kitchen_form: probe.kitchen_form || answers.kitchen_form,
    postal_code: probe.postal_code || answers.postal_code,
  };
}

export function withoutHandoffParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of HANDOFF_PARAMS) next.delete(key);
  return next;
}

/**
 * Zustand von Funnel A im sessionStorage des Tabs: Zurück, Reload und
 * Unterbrechungen verlieren nichts. clear() nach dem Absenden leert den
 * Speicher, lässt den Stand im Speicher aber stehen, bis weiternavigiert wird.
 */
export function useFunnelA() {
  const [state, setState] = useState<FunnelAState>(readStoredState);
  const [searchParams, setSearchParams] = useSearchParams();
  const persist = useRef(true);

  // Einmalig übernehmen und aus der URL entfernen, damit ein Reload spätere
  // Änderungen nicht wieder überschreibt.
  useEffect(() => {
    if (!hasHandoffParams(searchParams)) return;
    setState((prev) => ({ ...prev, answers: applyQueryParams(prev.answers, searchParams) }));
    setSearchParams(withoutHandoffParams(searchParams), { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (persist.current) writeStoredState(state);
  }, [state]);

  const setAnswer = useCallback(<K extends keyof FunnelAAnswers>(key: K, value: FunnelAAnswers[K]) => {
    setState((prev) => ({ ...prev, answers: { ...prev.answers, [key]: value } }));
  }, []);

  const patchContact = useCallback((patch: Partial<FunnelAContact>) => {
    setState((prev) => ({ ...prev, contact: { ...prev.contact, ...patch } }));
  }, []);

  const clear = useCallback(() => {
    persist.current = false;
    clearStoredState();
  }, []);

  return { answers: state.answers, contact: state.contact, setAnswer, patchContact, clear };
}
