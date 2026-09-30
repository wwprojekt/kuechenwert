import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  defaultConfig,
  defaultRoom,
  emptyProvenance,
  estimateKitchenPrice,
  formById,
  keepWallsOf,
  markStepAnswered,
  markWallEdited,
  sanitizeConfig,
  sanitizeProvenance,
  sanitizeRoom,
  type KitchenEstimate,
  type KitchenFormId,
  type PlannerConfig,
  type PlannerProvenance,
  type RoomInput,
} from "./core";
import { FUNNEL_A_BUDGET, HOUSING_OPTIONS, OCCASION_OPTIONS } from "@/features/funnel-a/catalog";
import { loadSession, renderStatus, type PlannerPhoto, type PlannerRender, type PlannerSessionRender } from "./api";
import { roomWallIssues } from "./estimate-gate";
import { normalizePlannerStep, type PlannerStep } from "./flow";
import { usePriceModel } from "./price-model";
import { plannerRenderKey } from "./render-key";

export type { PlannerStep } from "./flow";

export type OffersChoice = "ja" | "nein";

export interface PlannerState {
  step: PlannerStep;
  sessionToken: string | null;
  config: PlannerConfig;
  room: RoomInput;
  postalCode: string;
  photos: PlannerPhoto[];
  selectedPhotoPath: string | null;
  renders: PlannerRender[];
  activeRenderId: string | null;
  /** Antwort auf „Möchten Sie auch Angebote?“ (vor dem Absenden). */
  offersChoice: OffersChoice | null;
  /** Zeitrahmen in Monaten als Text ("1", "3" …), nur mit Angeboten. */
  timeframe: string;
  /** Budget in Euro, null = „Weiß ich nicht“; zählt nur mit budgetConfirmed (nur mit Angeboten). */
  budget: number | null;
  budgetConfirmed: boolean;
  /** Anlass und Wohnsituation (IDs aus dem Katalog von Funnel A), nur mit Angeboten. */
  occasion: string;
  housing: string;
  /** Kontakt erfasst: Visualisierung und Preis sind freigeschaltet. */
  submitted: boolean;
  /** Für diese Planung holen Studios Angebote ein. */
  offersRequested: boolean;
  /**
   * Vom Kunden beantwortete Schritte und eingegebene Wandlängen; alles andere
   * sind Standardwerte. null = unbekannt (Planung aus einer älteren Version).
   */
  answered: PlannerProvenance | null;
}

type Action =
  | { type: "step"; step: PlannerStep }
  | { type: "config"; patch: Partial<PlannerConfig>; step?: PlannerStep }
  | { type: "confirm"; step: PlannerStep }
  | { type: "form"; form: KitchenFormId }
  | { type: "wall"; key: string; cm: number }
  | { type: "room"; patch: Partial<RoomInput> }
  | { type: "postalCode"; value: string }
  | { type: "session"; token: string }
  | { type: "photos"; photos: PlannerPhoto[]; select?: string | null }
  | { type: "selectPhoto"; path: string | null }
  | { type: "renderAdded"; render: PlannerRender }
  | { type: "renderUpdated"; id: string; patch: Partial<PlannerRender> }
  | { type: "rendersReplaced"; renders: PlannerRender[] }
  | { type: "activeRender"; id: string }
  | { type: "offersChoice"; value: OffersChoice }
  | { type: "timeframe"; value: string }
  | { type: "budget"; value: number | null }
  | { type: "occasion"; value: string }
  | { type: "housing"; value: string }
  | { type: "hydrate"; state: Partial<PlannerState> }
  | { type: "submitted"; offersRequested: boolean }
  | { type: "offersRequested" }
  | { type: "reset" };

const STORAGE_KEY = "kw_planner_v2";

function initialState(): PlannerState {
  return {
    step: "form",
    sessionToken: null,
    config: defaultConfig(),
    room: defaultRoom("l"),
    postalCode: "",
    photos: [],
    selectedPhotoPath: null,
    renders: [],
    activeRenderId: null,
    offersChoice: null,
    timeframe: "",
    budget: FUNNEL_A_BUDGET.default,
    budgetConfirmed: false,
    occasion: "",
    housing: "",
    submitted: false,
    offersRequested: false,
    answered: emptyProvenance(),
  };
}

const OCCASION_IDS = new Set(OCCASION_OPTIONS.map((o) => o.id));
const HOUSING_IDS = new Set(HOUSING_OPTIONS.map((o) => o.id));

function storedBudget(value: unknown): number | null {
  if (value === null) return null;
  return typeof value === "number" && value >= FUNNEL_A_BUDGET.min && value <= FUNNEL_A_BUDGET.max ? value : FUNNEL_A_BUDGET.default;
}

function reducer(state: PlannerState, action: Action): PlannerState {
  switch (action.type) {
    case "step":
      return { ...state, step: action.step };
    case "config":
      return { ...state, config: { ...state.config, ...action.patch }, answered: markStepAnswered(state.answered, action.step) };
    case "confirm": {
      const answered = markStepAnswered(state.answered, action.step);
      return answered === state.answered ? state : { ...state, answered };
    }
    case "form": {
      if (action.form === state.room.form) return state;
      const next = defaultRoom(action.form);
      const def = formById(action.form);
      for (const w of def?.walls ?? []) {
        const previous = state.room.walls[w.key];
        if (previous && previous > 0) next.walls[w.key] = previous;
      }
      return {
        ...state,
        room: { ...next, ceilingHeightCm: state.room.ceilingHeightCm, ventilation: state.room.ventilation ?? null, notes: state.room.notes ?? null },
        answered: keepWallsOf(state.answered, action.form),
      };
    }
    case "wall":
      return {
        ...state,
        room: { ...state.room, walls: { ...state.room.walls, [action.key]: action.cm } },
        answered: markWallEdited(state.answered, action.key),
      };
    case "room":
      return { ...state, room: { ...state.room, ...action.patch } };
    case "postalCode":
      return { ...state, postalCode: action.value.replace(/\D/g, "").slice(0, 5) };
    case "session":
      return { ...state, sessionToken: action.token };
    case "photos": {
      const selected =
        action.select !== undefined
          ? action.select
          : state.selectedPhotoPath && action.photos.some((p) => p.path === state.selectedPhotoPath)
            ? state.selectedPhotoPath
            : (action.photos[0]?.path ?? null);
      return { ...state, photos: action.photos, selectedPhotoPath: selected };
    }
    case "selectPhoto":
      return { ...state, selectedPhotoPath: action.path };
    case "renderAdded":
      return { ...state, renders: [...state.renders, action.render], activeRenderId: action.render.id };
    case "renderUpdated":
      return {
        ...state,
        renders: state.renders.map((r) => (r.id === action.id ? { ...r, ...action.patch } : r)),
      };
    case "rendersReplaced": {
      const finished = action.renders.filter((r) => r.status === "success");
      const keep = action.renders.some((r) => r.id === state.activeRenderId) ? state.activeRenderId : null;
      return { ...state, renders: action.renders, activeRenderId: keep ?? finished[finished.length - 1]?.id ?? null };
    }
    case "activeRender":
      return { ...state, activeRenderId: action.id };
    case "offersChoice":
      return { ...state, offersChoice: action.value };
    case "timeframe":
      return { ...state, timeframe: action.value };
    case "budget":
      return { ...state, budget: action.value, budgetConfirmed: true };
    case "occasion":
      return { ...state, occasion: action.value };
    case "housing":
      return { ...state, housing: action.value };
    case "hydrate":
      return { ...state, ...action.state };
    case "submitted":
      return { ...state, submitted: true, offersRequested: action.offersRequested, step: "ergebnis" };
    case "offersRequested":
      return { ...state, offersRequested: true, offersChoice: "ja" };
    case "reset":
      return initialState();
  }
}

function readStorage(): Partial<PlannerState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlannerState> & { furthestIndex?: unknown };
    const { furthestIndex: _legacy, ...rest } = parsed;
    const room = sanitizeRoom(parsed.room);
    return {
      ...rest,
      step: normalizePlannerStep(parsed.step),
      config: sanitizeConfig(parsed.config),
      room,
      // Ohne gespeicherte Angabe ist unbekannt, was der Kunde gewählt hat – nicht „alles Standard“.
      answered: "answered" in parsed ? sanitizeProvenance(parsed.answered, room) : null,
      photos: [],
      offersChoice: parsed.offersChoice === "ja" || parsed.offersChoice === "nein" ? parsed.offersChoice : null,
      timeframe: typeof parsed.timeframe === "string" ? parsed.timeframe : "",
      budget: storedBudget(parsed.budget),
      budgetConfirmed: parsed.budgetConfirmed === true,
      occasion: OCCASION_IDS.has(String(parsed.occasion)) ? String(parsed.occasion) : "",
      housing: HOUSING_IDS.has(String(parsed.housing)) ? String(parsed.housing) : "",
      submitted: parsed.submitted === true,
      offersRequested: parsed.offersRequested === true,
      // Bild-URLs laufen ab und kommen frisch vom Server (erst nach der Kontakterfassung).
      renders: (parsed.renders ?? []).map((r) => ({ ...r, image_url: null })),
    };
  } catch {
    return null;
  }
}

function writeStorage(state: PlannerState) {
  try {
    const { photos: _photos, ...rest } = state;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...rest, renders: state.renders.map(({ image_url: _url, ...r }) => r) }),
    );
  } catch {
    /* Speicher voll oder privat – Planung läuft trotzdem weiter */
  }
}

export function clearPlannerStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function fromSessionRender({ spec, ...render }: PlannerSessionRender): PlannerRender {
  return { ...render, config_key: spec?.config ? plannerRenderKey(spec.config, spec.room, spec.photo_path) : null };
}

function useLastValid<T>(value: T, valid: boolean): T {
  const [last, setLast] = useState(value);
  if (valid && value !== last) setLast(value);
  return valid ? value : last;
}

/**
 * Zustand des Planers im localStorage (ohne Fotos und Bild-URLs). Eine
 * abgeschickte Planung bleibt als Ergebnis stehen, bis „Neue Küche planen“
 * sie zurücksetzt.
 */
export function usePlanner() {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ ...initialState(), ...(readStorage() ?? {}) }));
  const hydratedToken = useRef<string | null>(null);

  useEffect(() => {
    writeStorage(state);
  }, [state]);

  const hydrate = useCallback((token: string) => {
    hydratedToken.current = token;
    return loadSession(token)
      .then(({ session }) => {
        if (!session) {
          dispatch({
            type: "hydrate",
            state: { sessionToken: null, renders: [], photos: [], selectedPhotoPath: null, submitted: false, offersRequested: false },
          });
          return;
        }
        dispatch({ type: "rendersReplaced", renders: session.renders.map(fromSessionRender) });
        dispatch({
          type: "hydrate",
          state: {
            photos: session.photos,
            submitted: session.submitted,
            offersRequested: session.offers_requested === true,
          },
        });
        dispatch({ type: "photos", photos: session.photos });
      })
      .catch(() => {
        /* Offline oder Session abgelaufen: lokaler Stand bleibt nutzbar */
      });
  }, []);

  useEffect(() => {
    const token = state.sessionToken;
    if (!token || hydratedToken.current === token) return;
    void hydrate(token);
  }, [state.sessionToken, hydrate]);

  const { card, calibration, rateCardVersion } = usePriceModel();
  // Während eine Wandlänge getippt wird (0, 3, 35 …), gilt der letzte vollständige Raum.
  const pricedRoom = useLastValid(state.room, Object.keys(roomWallIssues(state.room)).length === 0);
  const estimate: KitchenEstimate = useMemo(
    () =>
      estimateKitchenPrice(state.config, pricedRoom, {
        card,
        calibration,
        rateCardVersion,
        postalCode: state.postalCode || null,
      }),
    [state.config, pricedRoom, state.postalCode, card, calibration, rateCardVersion],
  );

  const actions = useMemo(
    () => ({
      goTo: (step: PlannerStep) => dispatch({ type: "step", step }),
      /** Mit step gilt der Schritt als vom Kunden beantwortet. */
      patchConfig: (patch: Partial<PlannerConfig>, step?: PlannerStep) => dispatch({ type: "config", patch, step }),
      confirmStep: (step: PlannerStep) => dispatch({ type: "confirm", step }),
      setForm: (form: KitchenFormId) => dispatch({ type: "form", form }),
      setWall: (key: string, cm: number) => dispatch({ type: "wall", key, cm }),
      patchRoom: (patch: Partial<RoomInput>) => dispatch({ type: "room", patch }),
      setPostalCode: (value: string) => dispatch({ type: "postalCode", value }),
      setSession: (token: string) => {
        hydratedToken.current = token;
        dispatch({ type: "session", token });
      },
      setPhotos: (photos: PlannerPhoto[], select?: string | null) => dispatch({ type: "photos", photos, select }),
      selectPhoto: (path: string | null) => dispatch({ type: "selectPhoto", path }),
      addRender: (render: PlannerRender) => dispatch({ type: "renderAdded", render }),
      updateRender: (id: string, patch: Partial<PlannerRender>) => dispatch({ type: "renderUpdated", id, patch }),
      replaceRenders: (renders: PlannerRender[]) => dispatch({ type: "rendersReplaced", renders }),
      setActiveRender: (id: string) => dispatch({ type: "activeRender", id }),
      setOffersChoice: (value: OffersChoice) => dispatch({ type: "offersChoice", value }),
      setTimeframe: (value: string) => dispatch({ type: "timeframe", value }),
      setBudget: (value: number | null) => dispatch({ type: "budget", value }),
      setOccasion: (value: string) => dispatch({ type: "occasion", value }),
      setHousing: (value: string) => dispatch({ type: "housing", value }),
      markSubmitted: (offersRequested: boolean) => dispatch({ type: "submitted", offersRequested }),
      markOffersRequested: () => dispatch({ type: "offersRequested" }),
      reset: () => {
        clearPlannerStorage();
        hydratedToken.current = null;
        dispatch({ type: "reset" });
      },
    }),
    [],
  );

  return { state, estimate, hydrate, ...actions };
}

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

/** Pollt alle offenen Renders, bis sie fertig oder fehlgeschlagen sind. */
export function useRenderPolling(
  sessionToken: string | null,
  renders: PlannerRender[],
  onUpdate: (id: string, patch: Partial<PlannerRender>) => void,
) {
  const pendingIds = renders.filter((r) => r.status === "pending").map((r) => r.id).join(",");
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const poll = useCallback(
    async (id: string, started: number, signal: { cancelled: boolean }) => {
      while (!signal.cancelled) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        if (signal.cancelled || !sessionToken) return;
        try {
          const status = await renderStatus(sessionToken, id);
          if (status.status === "success") {
            onUpdateRef.current(id, { status: "success", image_url: status.image_url ?? null, locked: status.locked === true });
            return;
          }
          if (status.status === "failed") {
            onUpdateRef.current(id, { status: "failed", error: status.error ?? null });
            return;
          }
        } catch {
          /* kurzzeitiger Netzwerkfehler – nächster Versuch */
        }
        if (Date.now() - started > POLL_TIMEOUT_MS) {
          onUpdateRef.current(id, { status: "failed", error: "Die Visualisierung dauert ungewöhnlich lange." });
          return;
        }
      }
    },
    [sessionToken],
  );

  useEffect(() => {
    if (!pendingIds || !sessionToken) return;
    const signal = { cancelled: false };
    const started = Date.now();
    for (const id of pendingIds.split(",")) void poll(id, started, signal);
    return () => {
      signal.cancelled = true;
    };
  }, [pendingIds, sessionToken, poll]);
}
