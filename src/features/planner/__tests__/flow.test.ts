import { describe, expect, it } from "vitest";
import { PLANNER_STEPS, nextStep, normalizePlannerStep, plannerFlow, plannerProgress, previousStep, stepDef } from "../flow";

const open = { unlocked: false, wantsOffers: null };

describe("Schrittfolge von Funnel C", () => {
  it("fragt nach der Visualisierung erst Angebote, dann Name und Kontakt – das Ergebnis kommt zuletzt", () => {
    const steps = plannerFlow(open);
    expect(steps.slice(-5)).toEqual(["plz", "visualisierung", "angebote", "name", "kontakt"]);
    expect(steps).not.toContain("ergebnis");
  });

  it("fragt den Zeitrahmen nur, wenn Angebote gewünscht sind", () => {
    expect(plannerFlow({ unlocked: false, wantsOffers: true })).toContain("zeitrahmen");
    expect(plannerFlow({ unlocked: false, wantsOffers: false })).not.toContain("zeitrahmen");
    expect(nextStep("angebote", { unlocked: false, wantsOffers: true })).toBe("zeitrahmen");
    expect(nextStep("angebote", { unlocked: false, wantsOffers: false })).toBe("name");
  });

  it("stellt Budget, Anlass und Wohnsituation nur mit „Ja, Angebote“", () => {
    const yes = plannerFlow({ unlocked: false, wantsOffers: true });
    expect(yes.slice(yes.indexOf("angebote"))).toEqual(["angebote", "zeitrahmen", "budget", "anlass", "wohnsituation", "name", "kontakt"]);
    const no = plannerFlow({ unlocked: false, wantsOffers: false });
    for (const step of ["zeitrahmen", "budget", "anlass", "wohnsituation"]) expect(no).not.toContain(step);
    expect(previousStep("name", { unlocked: false, wantsOffers: true })).toBe("wohnsituation");
    expect(previousStep("name", { unlocked: false, wantsOffers: false })).toBe("angebote");
  });

  it("fragt den Dunstabzug als Detail direkt nach Kochen & Kühlen", () => {
    const steps = plannerFlow(open);
    expect(steps.indexOf("abluft")).toBe(steps.indexOf("kochen") + 1);
    expect(stepDef("abluft").detail).toBe(true);
  });

  it("überspringt nach der Kontakterfassung alle Lead-Fragen", () => {
    const unlocked = { unlocked: true, wantsOffers: true };
    const steps = plannerFlow(unlocked);
    for (const lead of ["visualisierung", "angebote", "zeitrahmen", "budget", "anlass", "wohnsituation", "name", "kontakt"]) {
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
    expect(plannerProgress("kontakt", { unlocked: false, wantsOffers: false }).percent).toBe(95);
    expect(plannerProgress("ergebnis", { unlocked: true, wantsOffers: false }).percent).toBe(100);
  });

  it("übernimmt gespeicherte Schritte der alten Fassung", () => {
    expect(normalizePlannerStep("raum")).toBe("form");
    expect(normalizePlannerStep("ausstattung")).toBe("arbeitsplatte");
    expect(normalizePlannerStep("kontakt")).toBe("angebote");
    expect(normalizePlannerStep("stil")).toBe("stil");
    expect(normalizePlannerStep("unbekannt")).toBe("form");
  });
});
