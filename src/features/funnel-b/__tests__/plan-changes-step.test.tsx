import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialFunnelBData, type FunnelBData } from "../state";
import { PlanChangesStep } from "../steps/OfferSteps";

function Harness({ onAdvance }: { onAdvance: () => void }) {
  const [data, setData] = useState<FunnelBData>(initialFunnelBData);
  return <PlanChangesStep data={data} update={(patch) => setData((prev) => ({ ...prev, ...patch }))} onAdvance={onAdvance} />;
}

describe("PlanChangesStep", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("blättert bei „Nein, genau so“ direkt weiter", () => {
    const onAdvance = vi.fn();
    render(<Harness onAdvance={onAdvance} />);
    fireEvent.click(screen.getByRole("button", { name: /Nein, genau so/ }));
    act(() => vi.runAllTimers());
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Was soll anders sein?")).not.toBeInTheDocument();
  });

  it("fragt bei „Ja, etwas ändern“ nach den Änderungen, statt weiterzublättern", () => {
    const onAdvance = vi.fn();
    render(<Harness onAdvance={onAdvance} />);
    fireEvent.click(screen.getByRole("button", { name: /Ja, etwas ändern/ }));
    act(() => vi.runAllTimers());
    expect(onAdvance).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Was soll anders sein?")).toHaveFocus();
  });
});
