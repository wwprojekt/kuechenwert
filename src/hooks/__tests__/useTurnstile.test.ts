import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TurnstileApi } from "../useTurnstile";

type RenderOptions = Record<string, (...args: unknown[]) => unknown> & { sitekey?: string };

function mockTurnstile() {
  let options: RenderOptions | null = null;
  const api: TurnstileApi = {
    render: vi.fn((_container: HTMLElement, opts: Record<string, unknown>) => {
      options = opts as RenderOptions;
      return "widget-1";
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  };
  window.turnstile = api;
  return { api, options: () => options! };
}

async function loadHook(siteKey: string) {
  vi.stubEnv("VITE_TURNSTILE_SITE_KEY", siteKey);
  vi.resetModules();
  return (await import("../useTurnstile")).useTurnstile;
}

const flush = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

describe("useTurnstile", () => {
  beforeEach(() => {
    delete window.turnstile;
    document.head.querySelectorAll("script[src*='turnstile']").forEach((s) => s.remove());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("lädt ohne Site-Key nichts und blockiert das Formular nicht", async () => {
    const { api } = mockTurnstile();
    const useTurnstile = await loadHook("");
    const { result } = renderHook(() => useTurnstile());
    act(() => result.current.turnstileCallbackRef(document.createElement("div")));
    await flush();
    expect(result.current.turnstileReady).toBe(true);
    expect(api.render).not.toHaveBeenCalled();
    expect(document.head.querySelector("script[src*='turnstile']")).toBeNull();
  });

  it("lädt das Skript erst, wenn ein Formular mit Site-Key erscheint", async () => {
    const useTurnstile = await loadHook("0x4AAAAAAAtest");
    const { result } = renderHook(() => useTurnstile());
    expect(document.head.querySelector("script[src*='turnstile']")).toBeNull();
    act(() => result.current.turnstileCallbackRef(document.createElement("div")));
    expect(document.head.querySelectorAll("script[src*='turnstile']")).toHaveLength(1);
    expect(result.current.turnstileReady).toBe(false);
  });

  it("übernimmt das Token und setzt es nach dem Absenden zurück", async () => {
    const { api, options } = mockTurnstile();
    const useTurnstile = await loadHook("0x4AAAAAAAtest");
    const { result } = renderHook(() => useTurnstile());
    act(() => result.current.turnstileCallbackRef(document.createElement("div")));
    await flush();
    expect(options().sitekey).toBe("0x4AAAAAAAtest");
    act(() => void options().callback!("token-123"));
    expect(result.current.turnstileToken).toBe("token-123");
    act(() => result.current.resetTurnstile());
    expect(result.current.turnstileToken).toBeNull();
    expect(api.reset).toHaveBeenCalledWith("widget-1");
  });

  it("beendet das Widget bei Konfigurationsfehlern statt es endlos neu zu versuchen", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { api, options } = mockTurnstile();
    const useTurnstile = await loadHook("0x4AAAAAAAtest");
    const { result } = renderHook(() => useTurnstile());
    act(() => result.current.turnstileCallbackRef(document.createElement("div")));
    await flush();

    let handled: unknown;
    act(() => {
      handled = options()["error-callback"]!("110200");
    });
    await flush();
    expect(handled).toBe(true);
    expect(api.remove).toHaveBeenCalledWith("widget-1");
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(result.current.turnstileReady).toBe(true);
    expect(result.current.turnstileError).toBe(true);
  });

  it("lässt vorübergehende Fehler von Turnstile selbst wiederholen", async () => {
    const { api, options } = mockTurnstile();
    const useTurnstile = await loadHook("0x4AAAAAAAtest");
    const { result } = renderHook(() => useTurnstile());
    act(() => result.current.turnstileCallbackRef(document.createElement("div")));
    await flush();
    act(() => void options()["error-callback"]!("300030"));
    await flush();
    expect(api.remove).not.toHaveBeenCalled();
  });
});
