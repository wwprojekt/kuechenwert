import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { defaultConfig, defaultRoom, estimateKitchenPrice } from "../core";
import { PLANNER_STEPS, plannerProgress, type PlannerStep } from "../flow";
import { PlannerFunnel } from "../PlannerFunnel";
import type { PlannerState } from "../state";
import type { PlannerFunnel as Controller } from "../usePlannerFunnel";

vi.mock("@/hooks/useSupportPhone", () => ({
  useSupportPhone: () => ({ display: "+49 511 51532476", href: "tel:+4951151532476" }),
}));
vi.mock("@/components/SiteLogo", () => ({ SiteLogo: () => <span>KüchenWert</span> }));
vi.mock("@/features/funnel-a/coverage", () => ({ useStudioCoverage: () => null }));

const noop = () => undefined;
const RENDER = { id: "r1", version: 1, status: "success" as const, mode: "text" as const, variant_label: null, image_url: "/k.webp", feedback: null };

function controller(step: PlannerStep, submitted: boolean): Controller {
  const state: PlannerState = {
    step,
    sessionToken: "kw_x",
    config: defaultConfig(),
    room: defaultRoom("l"),
    postalCode: "30159",
    photos: [],
    selectedPhotoPath: null,
    renders: [submitted ? RENDER : { ...RENDER, image_url: null, locked: true }],
    activeRenderId: "r1",
    offersChoice: "ja",
    timeframe: "",
    submitted,
    offersRequested: false,
  };
  const flow = { unlocked: submitted, wantsOffers: true };
  const fn = new Proxy({}, { get: () => noop });
  return {
    planner: fn,
    state,
    estimate: estimateKitchenPrice(state.config, state.room),
    step,
    flow,
    progress: plannerProgress(step, flow),
    blocked: null,
    wallIssues: {},
    showWallErrors: false,
    contact: { first_name: "Max", last_name: "", email: "", phone: "", contact_by_phone: false },
    setContact: noop,
    leadErrors: {},
    honeypot: "",
    setHoneypot: noop,
    turnstileCallbackRef: noop,
    submitting: false,
    generating: false,
    genError: null,
    renderPhase: submitted ? "ready" : "pending",
    renderStarted: Date.now(),
    activeRender: state.renders[0]!,
    activeOutdated: false,
    offersDialog: false,
    setOffersDialog: noop,
    offersBusy: false,
    offersError: null,
    aiTraining: null,
    actions: fn,
  } as unknown as Controller;
}

const renderStep = (step: PlannerStep, submitted = false) =>
  render(
    <MemoryRouter>
      <PlannerFunnel c={controller(step, submitted)} />
    </MemoryRouter>,
  );

describe("Funnel C: Preis und Küche erst nach der Kontakterfassung", () => {
  const before = PLANNER_STEPS.filter((s) => s.kind !== "result").map((s) => s.id);

  it.each(before)("zeigt im Schritt „%s“ keinen Preis und kein Küchenbild", (step) => {
    const { container, unmount } = renderStep(step);
    expect(container.textContent).not.toMatch(/\d\s?€/);
    expect(container.querySelector('img[src="/k.webp"]')).toBeNull();
    unmount();
  });

  it("zeigt nur einen Fortschrittsbalken in Prozent statt Schrittnamen", () => {
    renderStep("farbe");
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByText(/Schritt \d+ von/)).not.toBeInTheDocument();
  });

  it("zeigt im Ergebnis Küche und Preis", () => {
    const { container } = renderStep("ergebnis", true);
    expect(container.textContent).toMatch(/\d\s?€/);
    expect(container.querySelector('img[src="/k.webp"]')).not.toBeNull();
  });
});
