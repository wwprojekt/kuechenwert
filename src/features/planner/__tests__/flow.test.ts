import { describe, expect, it } from "vitest";
import { PLANNER_STEPS, knownPlannerStep, nextStep, normalizePlannerStep, plannerFlow, plannerProgress, previousStep, stepDef } from "../flow";

const open = { unlocked: false };

describe("Schrittfolge von Funnel C", () => {
  it("stellt nach der Visualisierung die Fragen für die Studios, dann Name und Kontakt – das Ergebnis kommt zuletzt", () => {
    const steps = plannerFlow(open);
    expect(steps.slice(steps.indexOf("plz"))).toEqual(["plz", "visualisierung", "zeitrahmen", "budget", "anlass", "wohnsituation", "name", "kontakt"]);
    expect(steps).not.toContain("ergebnis");
  });

  it("fragt nicht mehr, ob Angebote gewünscht sind: jede Planung wird ausgeschrieben", () => {
    expect(PLANNER_STEPS.map((s) => s.id)).not.toContain("angebote");
    expect(nextStep("visualisierung", open)).toBe("zeitrahmen");
  });

  it("überspringt beim Zurückgehen den Lade-Bildschirm", () => {
    expect(previousStep("zeitrahmen", open)).toBe("plz");
    expect(previousStep("visualisierung", open)).toBe("plz");
    expect(previousStep("name", open)).toBe("wohnsituation");
  });

  it("fragt den Dunstabzug als Detail direkt nach Kochen & Kühlen", () => {
    const steps = plannerFlow(open);
    expect(steps.indexOf("abluft")).toBe(steps.indexOf("kochen") + 1);
    expect(stepDef("abluft").detail).toBe(true);
  });

  it("überspringt nach der Kontakterfassung alle Lead-Fragen", () => {
    const unlocked = { unlocked: true };
    const steps = plannerFlow(unlocked);
    for (const lead of ["visualisierung", "zeitrahmen", "budget", "anlass", "wohnsituation", "name", "kontakt"]) {
      expect(steps).not.toContain(lead);
    }
    expect(nextStep("plz", unlocked)).toBe("ergebnis");
  });

  it("beginnt ohne Zurück und kennt jeden Schritt genau einmal", () => {
    expect(previousStep("form", open)).toBeNull();
    const ids = PLANNER_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("zeigt Fortschritt mit Vorsprung und 100 % im Ergebnis", () => {
    expect(plannerProgress("form", open).percent).toBe(10);
    expect(plannerProgress("kontakt", open).percent).toBe(95);
    expect(plannerProgress("ergebnis", { unlocked: true }).percent).toBe(100);
  });

  it("übernimmt gespeicherte Schritte und Links älterer Fassungen", () => {
    expect(normalizePlannerStep("raum")).toBe("form");
    expect(normalizePlannerStep("ausstattung")).toBe("arbeitsplatte");
    expect(normalizePlannerStep("angebote")).toBe("zeitrahmen");
    expect(normalizePlannerStep("kontakt")).toBe("kontakt");
    expect(normalizePlannerStep("stil")).toBe("stil");
    expect(normalizePlannerStep("unbekannt")).toBe("form");
    expect(knownPlannerStep("angebote")).toBe("zeitrahmen");
    expect(knownPlannerStep("unbekannt")).toBeNull();
    expect(knownPlannerStep(null)).toBeNull();
  });
});
