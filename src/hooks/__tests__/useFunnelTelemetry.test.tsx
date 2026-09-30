import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as Telemetry from "@/lib/funnelTelemetry";
import type { FunnelEventInput } from "@/lib/funnelTelemetry";
import { useFunnelTelemetry, type FunnelTelemetry } from "../useFunnelTelemetry";

const { logged, trackFunnelStart, trackMetaInitiateCheckout } = vi.hoisted(() => ({
  logged: [] as FunnelEventInput[],
  trackFunnelStart: vi.fn(),
  trackMetaInitiateCheckout: vi.fn(),
}));

vi.mock("@/lib/funnelTelemetry", async () => {
  const actual = await vi.importActual<typeof Telemetry>("@/lib/funnelTelemetry");
  return {
    ...actual,
    logFunnelEvent: (event: FunnelEventInput) => logged.push(event),
    flushFunnelTelemetry: vi.fn(),
    entryMetadata: () => ({ entry_path: "/formular" }),
  };
});
vi.mock("@/lib/funnelAnalytics", () => ({ trackFunnelStart }));
vi.mock("@/lib/metaPixelService", () => ({ trackMetaInitiateCheckout }));

let api: FunnelTelemetry | null = null;

function Probe({ step, stepIndex }: { step: string; stepIndex: number }) {
  api = useFunnelTelemetry({ funnel: "a", step, stepIndex, stepLabel: `Label ${step}`, totalSteps: 18 });
  return (
    <>
      <main data-funnel-telemetry="">
        <input name="email" aria-label="E-Mail" />
        <input type="checkbox" name="marketing" aria-label="Werbung" />
        <input name="website" tabIndex={-1} aria-label="Honigtopf" />
        <button type="button">
          <span>Weiter</span>
        </button>
        <button type="button" data-track="remove_file" aria-label="Angebot_Mustermann.pdf entfernen">
          <svg aria-hidden="true" />
        </button>
        <p data-testid="text">Ihr Preis 18000 €</p>
      </main>
      <button type="button">Cookie-Banner</button>
      <input name="cookie_search" aria-label="Außerhalb" />
    </>
  );
}

const events = () => logged.map((e) => (e.field ? `${e.event}:${e.field}` : e.event));

beforeEach(() => {
  logged.length = 0;
  trackFunnelStart.mockClear();
  trackMetaInitiateCheckout.mockClear();
});

describe("useFunnelTelemetry", () => {
  it("meldet Einstieg und jeden Schrittwechsel mit Bezeichnung", () => {
    const { rerender, unmount } = render(<Probe step="kuechenform" stepIndex={0} />);
    rerender(<Probe step="raum" stepIndex={1} />);
    expect(events()).toEqual(["segmentation", "step_enter", "step_enter"]);
    expect(logged[1]).toMatchObject({ step: "kuechenform", stepIndex: 0, metadata: { label: "Label kuechenform" } });
    expect(logged[2]).toMatchObject({ step: "raum", stepIndex: 1, metadata: { label: "Label raum" } });
    act(() => api!.submitSucceeded());
    unmount();
  });

  it("erfasst Felder nur im Funnel-Container und ohne Honigtopf", () => {
    const { getByLabelText, unmount } = render(<Probe step="kontakt" stepIndex={17} />);
    logged.length = 0;
    const email = getByLabelText("E-Mail") as HTMLInputElement;
    fireEvent.focusIn(email);
    email.value = "max@example.org";
    fireEvent.focusOut(email);
    fireEvent.focusIn(email);
    fireEvent.focusIn(getByLabelText("Außerhalb"));
    fireEvent.focusIn(getByLabelText("Honigtopf"));
    expect(events()).toEqual(["field_focus:email", "field_blur_filled:email", "field_corrected:email", "field_focus:email"]);
    expect(JSON.stringify(logged)).not.toContain("max@example.org");
    act(() => api!.submitSucceeded());
    unmount();
  });

  it("erkennt Mehrfachklicks nur im Funnel und ohne Nutzerdaten", () => {
    const { getByText, getByTestId, getByLabelText, unmount } = render(<Probe step="angebot" stepIndex={0} />);
    logged.length = 0;
    const clickThrice = (el: Element) => {
      for (let i = 0; i < 3; i++) fireEvent.click(el);
    };
    clickThrice(getByText("Weiter"));
    clickThrice(getByLabelText("Angebot_Mustermann.pdf entfernen"));
    clickThrice(getByTestId("text"));
    clickThrice(getByText("Cookie-Banner"));
    fireEvent.click(getByText("Weiter"));

    const rage = logged.filter((e) => e.event === "rage_click");
    expect(rage).toHaveLength(3);
    expect(rage[0]).toMatchObject({ metadata: { label: "Weiter", tag: "button" } });
    expect(rage[1]).toMatchObject({ field: "remove_file", metadata: { label: null, tag: "button" } });
    expect(rage[2]).toMatchObject({ metadata: { tag: "p", dead: true } });
    expect(JSON.stringify(rage)).not.toContain("Mustermann");
    expect(JSON.stringify(rage)).not.toContain("18000");
    act(() => api!.submitSucceeded());
    unmount();
  });

  it("meldet den Start an GA4 und Meta nur bei der ersten Antwort", () => {
    const { unmount } = render(<Probe step="raum" stepIndex={1} />);
    act(() => {
      api!.next();
      api!.next();
    });
    expect(trackFunnelStart).toHaveBeenCalledTimes(1);
    expect(trackMetaInitiateCheckout).toHaveBeenCalledWith({ content_name: "Funnel A", content_category: "Küchenangebote" });
    act(() => api!.submitSucceeded());
    unmount();
  });

  it("schweigt nach dem Absenden, auch beim Verlassen der Seite", () => {
    const { unmount } = render(<Probe step="kontakt" stepIndex={17} />);
    act(() => api!.submitSucceeded());
    const count = logged.length;
    window.dispatchEvent(new Event("pagehide"));
    unmount();
    expect(logged.length).toBe(count);
    expect(logged[logged.length - 1]).toMatchObject({ event: "submit_succeeded", metadata: { total_steps: 18 } });
  });
});
