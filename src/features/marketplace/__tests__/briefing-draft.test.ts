import { describe, expect, it } from "vitest";
import { fillBriefingDraft, toBriefingDraft } from "../briefing-draft";

describe("fillBriefingDraft", () => {
  it("füllt nur leere Felder und meldet, welche", () => {
    const draft = { ...toBriefingDraft(null), manufacturer: "Häcker AV 6000", offer_includes: ["delivery"] };
    const { draft: next, filled } = fillBriefingDraft(draft, {
      kitchen_form: "u",
      manufacturer: "Nobilia Touch 340",
      run_length_cm: 640,
      offer_includes: ["delivery", "assembly"],
      notes: "Fronten: Alpinweiß",
    });
    expect(next).toEqual({
      kitchen_form: "u",
      manufacturer: "Häcker AV 6000",
      run_length_cm: "640",
      offer_includes: ["delivery"],
      offer_valid_until: "",
      notes: "Fronten: Alpinweiß",
    });
    expect(filled).toEqual(["kitchen_form", "run_length_cm", "notes"]);
  });

  it("lässt alles stehen, wenn der Vorschlag leer ist", () => {
    const draft = toBriefingDraft({ kitchen_form: "l", notes: "  " });
    expect(fillBriefingDraft(draft, {})).toEqual({ draft, filled: [] });
  });
});
