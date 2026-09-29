import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as Telemetry from "../funnelTelemetry";

type TelemetryModule = typeof Telemetry;

const consent = (analytics: boolean) => ({
  essential: true,
  functional: false,
  analytics,
  marketing: false,
  consentId: "1727640000000-abc123def",
  consentVersion: "1.0",
  timestamp: Date.now(),
});

function storeConsent(analytics: boolean) {
  localStorage.setItem("cookie-consent", JSON.stringify(consent(analytics)));
}

function announceConsent(analytics: boolean) {
  storeConsent(analytics);
  window.dispatchEvent(new CustomEvent("consent-updated", { detail: consent(analytics) }));
}

const fetchMock = vi.fn();

/** Das Test-Setup ersetzt die Storages durch leere Attrappen; hier braucht es echte. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

async function load(): Promise<TelemetryModule> {
  vi.resetModules();
  return import("../funnelTelemetry");
}

function sentBodies(): Array<{ session_id: string; funnel: string; consent_id: string | null; events: Array<Record<string, unknown>> }> {
  return fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.stubGlobal("sessionStorage", memoryStorage());
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetchMock);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Funnel-Telemetrie im Browser", () => {
  it("wartet bis zur Einwilligung und sendet dann den Puffer", async () => {
    const t = await load();
    const { sessionId, isNew } = t.beginFunnelSession("a");
    expect(isNew).toBe(true);
    t.logFunnelEvent({ funnel: "a", step: "kuechenform", stepIndex: 0, event: "step_enter" });
    t.logFunnelEvent({ funnel: "a", step: "kuechenform", stepIndex: 0, event: "next_clicked", timeOnStepMs: 1234.4 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem("kw_funnel_telemetry_a")).toBeNull();

    announceConsent(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [body] = sentBodies();
    expect(body).toMatchObject({ session_id: sessionId, funnel: "a", consent_id: "1727640000000-abc123def" });
    expect(body!.events.map((e) => e.event)).toEqual(["step_enter", "next_clicked"]);
    expect(body!.events[1]).toMatchObject({ step: "kuechenform", step_index: 0, time_on_step_ms: 1234 });
    expect(sessionStorage.getItem("kw_funnel_telemetry_a")).toBe(sessionId);
  });

  it("verwirft den Puffer bei Ablehnung und sammelt danach nichts mehr", async () => {
    const t = await load();
    t.beginFunnelSession("b");
    t.logFunnelEvent({ funnel: "b", step: "angebot", stepIndex: 0, event: "step_enter" });
    announceConsent(false);
    t.logFunnelEvent({ funnel: "b", step: "angebot", stepIndex: 0, event: "next_clicked" });
    t.flushFunnelTelemetry(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sendet mit Einwilligung gebündelt nach kurzer Wartezeit", async () => {
    storeConsent(true);
    const t = await load();
    t.beginFunnelSession("c");
    t.logFunnelEvent({ funnel: "c", step: "raum", stepIndex: 0, event: "step_enter" });
    t.logFunnelEvent({ funnel: "c", step: "raum", stepIndex: 0, event: "field_focus", field: "wall-a" });
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBodies()[0]!.events[1]).toMatchObject({ event: "field_focus", field_name: "wall-a" });
  });

  it("nutzt beim Verlassen sendBeacon", async () => {
    storeConsent(true);
    const beacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", { value: beacon, configurable: true });
    const t = await load();
    t.beginFunnelSession("a");
    t.logFunnelEvent({ funnel: "a", step: "raum", stepIndex: 1, event: "leave" });
    t.flushFunnelTelemetry(true);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    Reflect.deleteProperty(navigator, "sendBeacon");
  });

  it("ignoriert Ereignisse ohne laufende Sitzung und beginnt nach dem Absenden neu", async () => {
    storeConsent(true);
    const t = await load();
    t.logFunnelEvent({ funnel: "a", step: "raum", stepIndex: 1, event: "step_enter" });
    await vi.advanceTimersByTimeAsync(2100);
    expect(fetchMock).not.toHaveBeenCalled();

    const first = t.beginFunnelSession("a").sessionId;
    expect(t.markFunnelStarted("a")).toBe(true);
    expect(t.markFunnelStarted("a")).toBe(false);
    t.endFunnelSession("a");
    const second = t.beginFunnelSession("a");
    expect(second.sessionId).not.toBe(first);
    expect(second.isNew).toBe(true);
    expect(t.markFunnelStarted("a")).toBe(true);
  });

  it("übernimmt nach dem Neuladen die Sitzung aus dem Tab", async () => {
    storeConsent(true);
    sessionStorage.setItem("kw_funnel_telemetry_b", "5f0c7a52-0f4e-4c1e-9d6b-2f1d3c4b5a69");
    const t = await load();
    expect(t.beginFunnelSession("b")).toEqual({ sessionId: "5f0c7a52-0f4e-4c1e-9d6b-2f1d3c4b5a69", isNew: false });
    expect(t.markFunnelStarted("b")).toBe(false);
  });

  it("entfernt E-Mail-Adressen und Ziffernfolgen aus Fehlertexten", async () => {
    const t = await load();
    expect(t.scrubErrorText("Invalid max.mustermann@example.org or 0511515324 at line 12")).toBe(
      "Invalid [email] or [zahl] at line 12",
    );
  });
});
