import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sanitizeFeedbackReasons } from "../../../../supabase/functions/_shared/render-feedback.ts";
import { RenderFeedback } from "../components/RenderFeedback";

describe("sanitizeFeedbackReasons", () => {
  it("behält nur bekannte Gründe, jeden einmal, in Katalog-Reihenfolge", () => {
    expect(sanitizeFeedbackReasons(["unecht", "raum", "raum", "hack", 3])).toEqual(["raum", "unecht"]);
    expect(sanitizeFeedbackReasons("raum")).toEqual([]);
    expect(sanitizeFeedbackReasons(null)).toEqual([]);
  });
});

describe("RenderFeedback", () => {
  it("fragt erst nach „Gefällt mir nicht“ nach Gründen", () => {
    const onChange = vi.fn();
    const { rerender } = render(<RenderFeedback value={null} onChange={onChange} />);
    expect(screen.queryByRole("group", { name: "Was passt nicht?" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Gefällt mir nicht" }));
    expect(onChange).toHaveBeenLastCalledWith(-1, []);

    rerender(<RenderFeedback value={-1} reasons={["raum"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Wirkt künstlich" }));
    expect(onChange).toHaveBeenLastCalledWith(-1, ["raum", "unecht"]);
    fireEvent.click(screen.getByRole("button", { name: "Raum verändert" }));
    expect(onChange).toHaveBeenLastCalledWith(-1, []);
  });

  it("verwirft Gründe beim Wechsel auf „Gefällt mir“", () => {
    const onChange = vi.fn();
    render(<RenderFeedback value={-1} reasons={["material"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Gefällt mir" }));
    expect(onChange).toHaveBeenLastCalledWith(1, []);
  });
});
