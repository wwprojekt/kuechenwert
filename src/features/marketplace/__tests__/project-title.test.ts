import { describe, expect, it } from "vitest";
import { projectTitle } from "../components/DealerProjectCard";

describe("projectTitle", () => {
  it("nennt die Küchenform im Klartext", () => {
    expect(projectTitle({ funnel_type: "a", summary: { source: "a", kitchen_form: "l" } })).toBe("Küchenprojekt · L-Küche");
    expect(projectTitle({ funnel_type: "b", summary: { source: "b", kitchen_form: "u" } })).toBe("Angebot unterbieten · U-Küche");
  });

  it("übersetzt Formular-IDs aus Funnel A v1", () => {
    expect(projectTitle({ funnel_type: "a", summary: { kitchen_form: "zweizeilig" } })).toBe("Küchenprojekt · Zweizeilig");
  });

  it("lässt offene oder unbekannte Formen weg", () => {
    expect(projectTitle({ funnel_type: "a", summary: { kitchen_form: "unsicher" } })).toBe("Küchenprojekt");
    expect(projectTitle({ funnel_type: "a", summary: { kitchen_form: "wendeltreppe" } })).toBe("Küchenprojekt");
    expect(projectTitle({ funnel_type: "b", summary: {} })).toBe("Angebot unterbieten");
  });

  it("bevorzugt die Raumbeschreibung aus dem Planer", () => {
    expect(projectTitle({ funnel_type: "traumkueche", summary: { room: { description: "L-Küche · 3,0 × 2,4 m" }, kitchen_form: "l" } })).toBe(
      "L-Küche · 3,0 × 2,4 m",
    );
  });
});
