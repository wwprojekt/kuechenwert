import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  defaultConfig,
  defaultRoom,
  estimateKitchenPrice,
  formById,
  sanitizeConfig,
  sanitizeRoom,
  type KitchenEstimate,
  type KitchenFormId,
  type PlannerConfig,
  type RoomInput,
} from "./core";
import { loadSession, renderStatus, type PlannerPhoto, type PlannerRender } from "./api";

export type PlannerStep = "raum" | "stil" | "ausstattung" | "geraete" | "visualisierung" | "kontakt";

export const PLANNER_STEPS: Array<{ id: PlannerStep; label: string }> = [
  { id: "raum", label: "Raum & Foto" },
  { id: "stil", label: "Stil & Fronten" },
  { id: "ausstattung", label: "Arbeitsplatte" },
  { id: "geraete", label: "Geräte & Extras" },
  { id: "visualisierung", label: "Visualisierung" },
  { id: "kontakt", label: "Angebote erhalten" },
];

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
  submitted: boolean;
}

type Action =
  | { type: "step"; step: PlannerStep }
  | { type: "config"; patch: Partial<PlannerConfig> }
  | { type: "form"; form: KitchenFormId }
  | { type: "wall"; key: string; cm: number }
  | { type: "room"; patch: Partial<RoomInput> }
  | { type: "postalCode"; value: string }
  | { type: "session"; token: string }
  | { type: "photos"; photos: PlannerPhoto[]; select?: string | null }
  | { type: "selectPhoto"; path: string | null }
  | { type: "renderAdded"; render: PlannerRender }
  | { type: "renderUpdated"; id: string; patch: Partial<PlannerRender> }
  | { type: "activeRender"; id: string }
  | { type: "hydrate"; state: Partial<PlannerState> }
  | { type: "submitted" }
  | { type: "reset" };

const STORAGE_KEY = "kw_planner_v2";

function initialState(): PlannerState {
  return {
    step: "raum",
    sessionToken: null,
    config: defaultConfig(),
    room: defaultRoom("l"),
    postalCode: "",
    photos: [],
    selectedPhotoPath: null,
    renders: [],
    activeRenderId: null,
    submitted: false,
  };
}

function reducer(state: PlannerState, action: Action): PlannerState {
  switch (action.type) {
    case "step":
      return { ...state, step: action.step };
    case "config":
      return { ...state, config: { ...state.config, ...action.patch } };
    case "form": {
      if (action.form === state.room.form) return state;
      const next = defaultRoom(action.form);
      const def = formById(action.form);
      for (const w of def?.walls ?? []) {
        const previous = state.room.walls[w.key];
        if (previous && previous > 0) next.walls[w.key] = previous;
      }
      return { ...state, room: { ...next, ceilingHeightCm: state.room.ceilingHeightCm } };
    }
    case "wall":
      return { ...state, room: { ...state.room, walls: { ...state.room.walls, [action.key]: action.cm } } };
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
    case "activeRender":
      return { ...state, activeRenderId: action.id };
    case "hydrate":
      return { ...state, ...action.state };
    case "submitted":
      return { ...state, submitted: true };
    case "reset":
      return initialState();
  }
}

function readStorage(): Partial<PlannerState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlannerState>;
    return {
      ...parsed,
      config: sanitizeConfig(parsed.config),
      room: sanitizeRoom(parsed.room),
      photos: [],
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

export function usePlanner() {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ ...initialState(), ...(readStorage() ?? {}) }));
  const hydratedToken = useRef<string | null>(null);

  useEffect(() => {
    writeStorage(state);
  }, [state]);

  useEffect(() => {
    const token = state.sessionToken;
    if (!token || hydratedToken.current === token) return;
    hydratedToken.current = token;
    loadSession(token)
      .then(({ session }) => {
        if (!session) {
          dispatch({ type: "hydrate", state: { sessionToken: null, renders: [], photos: [], selectedPhotoPath: null } });
          return;
        }
        const finished = session.renders.filter((r) => r.status === "success");
        dispatch({
          type: "hydrate",
          state: {
            photos: session.photos,
            renders: session.renders,
            submitted: session.submitted,
            activeRenderId: finished[finished.length - 1]?.id ?? null,
          },
        });
        dispatch({ type: "photos", photos: session.photos });
      })
      .catch(() => {
        /* Offline oder Session abgelaufen: lokaler Stand bleibt nutzbar */
      });
  }, [state.sessionToken]);

  const estimate: KitchenEstimate = useMemo(
    () => estimateKitchenPrice(state.config, state.room, { postalCode: state.postalCode || null }),
    [state.config, state.room, state.postalCode],
  );

  const actions = useMemo(
    () => ({
      goTo: (step: PlannerStep) => dispatch({ type: "step", step }),
      patchConfig: (patch: Partial<PlannerConfig>) => dispatch({ type: "config", patch }),
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
      setActiveRender: (id: string) => dispatch({ type: "activeRender", id }),
      markSubmitted: () => dispatch({ type: "submitted" }),
      reset: () => {
        clearPlannerStorage();
        hydratedToken.current = null;
        dispatch({ type: "reset" });
      },
    }),
    [],
  );

  return { state, estimate, ...actions };
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
            onUpdateRef.current(id, { status: "success", image_url: status.image_url ?? null });
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
