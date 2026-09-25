import { existsSync } from "node:fs";
import { join } from "node:path";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import type * as RouterDom from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXTRA_APPLIANCE_ICONS, choiceIcon } from "@/components/funnel/funnel-a-icons";
import { WORKTOP_PICTOGRAMS } from "@/components/funnel/funnel-a-pictograms";
import { hasKitchenFormPlan } from "@/components/kitchen/KitchenFormPlan";
import { KITCHEN_FORMS } from "@/features/planner/core";
import { FORM_OPTIONS, FUNNEL_A_REQUIRED, UNSURE, emptyFunnelAAnswers } from "../catalog";
import { funnelEntryUrl } from "../landing/entry";
import {
  FUNNEL_A_STORAGE_KEY,
  applyQueryParams,
  hasHandoffParams,
  initialFunnelAState,
  parseStoredState,
  readStoredState,
  useFunnelA,
  withoutHandoffParams,
} from "../state";
import {
  FUNNEL_A_BASE_PATH,
  FUNNEL_A_FIRST_SLUG,
  FUNNEL_A_SLUGS,
  FUNNEL_A_STEPS,
  canLeaveStep,
  findStep,
  firstMissingStep,
  isFunnelAStepSlug,
  isStepAnswered,
  optionImage,
  stepImages,
  stepIndex,
  stepPath,
  type FunnelAChoiceStep,
  type FunnelAStepSlug,
} from "../steps";
import { emptyContact } from "../validation";

function choiceStep(slug: FunnelAStepSlug): FunnelAChoiceStep {
  const step = findStep(slug);
  if (step.kind !== "choice") throw new Error(`${slug} ist keine Einzelauswahl`);
  return step;
}

beforeEach(() => {
  vi.mocked(sessionStorage.getItem).mockReset();
});

describe("Schritte", () => {
  it("hält die vereinbarten 18 Slugs in Reihenfolge", () => {
    expect(FUNNEL_A_SLUGS).toEqual([
      "kuechenform",
      "raum",
      "groesse",
      "stil",
      "farbe",
      "arbeitsplatte",
      "kochfeld",
      "backofen",
      "kuehlen",
      "geraete",
      "kochstil",
      "anlass",
      "wohnsituation",
      "entscheidung",
      "zeitrahmen",
      "budget",
      "plz",
      "kontakt",
    ]);
    expect(FUNNEL_A_STEPS.map((s) => s.slug)).toEqual([...FUNNEL_A_SLUGS]);
    expect(FUNNEL_A_FIRST_SLUG).toBe("kuechenform");
    expect(stepPath("raum")).toBe("/funnel/a/raum");
    expect(stepIndex("kontakt")).toBe(17);
  });

  it("erkennt nur bekannte Slugs", () => {
    expect(isFunnelAStepSlug("raum")).toBe(true);
    for (const value of ["", "Raum", "kochinsel", "step-1", "constructor", undefined, null, 3]) {
      expect(isFunnelAStepSlug(value)).toBe(false);
    }
    expect(() => findStep("gibtsnicht" as FunnelAStepSlug)).toThrow();
  });

  it("verlangt nur Küchenform, Zeitrahmen, PLZ und Kontakt", () => {
    expect(FUNNEL_A_STEPS.filter((s) => s.required).map((s) => s.slug)).toEqual([
      "kuechenform",
      "zeitrahmen",
      "plz",
      "kontakt",
    ]);
    for (const field of FUNNEL_A_REQUIRED) {
      expect(FUNNEL_A_STEPS.find((s) => "field" in s && s.field === field)?.required, field).toBe(true);
    }
  });

  it("zeigt zu jeder Option ein Foto, Piktogramm, Farbmuster oder Icon", () => {
    for (const step of FUNNEL_A_STEPS) {
      if (step.kind === "multi") {
        for (const o of step.options) expect(EXTRA_APPLIANCE_ICONS[o.id], `${step.slug}/${o.id}`).toBeDefined();
      }
      if (step.kind !== "choice") continue;
      const ids = step.options.map((o) => o.id);
      expect(new Set(ids).size, step.slug).toBe(ids.length);
      for (const o of step.options) {
        const visual =
          optionImage(step.field, o.id) ??
          (step.field === "worktop_category" ? WORKTOP_PICTOGRAMS[o.id] : undefined) ??
          (step.field === "kitchen_form" && hasKitchenFormPlan(o.id) ? o.id : undefined) ??
          (o.swatches?.length ? o.swatches : undefined) ??
          choiceIcon(step.field, o.id);
        expect(visual, `${step.slug}/${o.id}`).toBeDefined();
      }
    }
  });

  it("findet die Stil-Fotos im public-Ordner", () => {
    const step = choiceStep("stil");
    const images = stepImages(step);
    expect(images).toHaveLength(step.options.filter((o) => o.id !== UNSURE).length);
    for (const src of images) expect(existsSync(join(process.cwd(), "public", src)), src).toBe(true);
    expect(optionImage("kitchen_style", UNSURE)).toBeUndefined();
    expect(optionImage("room_type", "offen")).toBeUndefined();
    expect(stepImages(findStep("plz"))).toEqual([]);
  });

  it("zeichnet jede Küchenform des Konfigurators als Grundriss, „Steht noch nicht fest“ nicht", () => {
    for (const form of KITCHEN_FORMS) expect(hasKitchenFormPlan(form.id), form.id).toBe(true);
    expect(hasKitchenFormPlan(UNSURE)).toBe(false);
    expect(hasKitchenFormPlan("toString")).toBe(false);
    expect(stepImages(choiceStep("kuechenform"))).toEqual([]);
  });
});

describe("Weiter-Logik", () => {
  const empty = emptyFunnelAAnswers();

  it("hält Pflichtschritte bis zur Antwort fest", () => {
    const form = findStep("kuechenform");
    expect(canLeaveStep(form, empty)).toBe(false);
    expect(canLeaveStep(form, { ...empty, kitchen_form: UNSURE })).toBe(true);
    const plz = findStep("plz");
    expect(canLeaveStep(plz, { ...empty, postal_code: "3015" })).toBe(false);
    expect(canLeaveStep(plz, { ...empty, postal_code: "30159" })).toBe(true);
  });

  it("lässt optionale Schritte überspringen", () => {
    const raum = findStep("raum");
    expect(isStepAnswered(raum, empty)).toBe(false);
    expect(canLeaveStep(raum, empty)).toBe(true);
    const geraete = findStep("geraete");
    expect(isStepAnswered(geraete, { ...empty, extra_appliances: [] })).toBe(false);
    expect(canLeaveStep(geraete, { ...empty, extra_appliances: [] })).toBe(true);
    expect(isStepAnswered(findStep("budget"), { ...empty, budget_eur: null })).toBe(true);
  });

  it("findet die erste fehlende Pflichtangabe", () => {
    expect(firstMissingStep(empty)).toBe("kuechenform");
    expect(firstMissingStep({ ...empty, kitchen_form: "l" })).toBe("zeitrahmen");
    expect(firstMissingStep({ ...empty, kitchen_form: "l", timeframe: "asap" })).toBe("plz");
    expect(firstMissingStep({ ...empty, kitchen_form: "l", timeframe: "asap", postal_code: "30159" })).toBeNull();
  });
});

describe("Einstiegsparameter ?form und ?plz", () => {
  it("übernimmt gültige Werte inkl. Formular-IDs aus Funnel A v1", () => {
    expect(applyQueryParams(emptyFunnelAAnswers(), new URLSearchParams("form=l-form&plz=30159"))).toMatchObject({
      kitchen_form: "l",
      postal_code: "30159",
    });
    expect(applyQueryParams(emptyFunnelAAnswers(), new URLSearchParams(`form=${UNSURE}`)).kitchen_form).toBe(UNSURE);
  });

  it("ignoriert ungültige Werte und lässt bestehende Antworten stehen", () => {
    const answers = { ...emptyFunnelAAnswers(), kitchen_form: "u", room_type: "offen", postal_code: "10115" };
    expect(applyQueryParams(answers, new URLSearchParams("form=rund&plz=3015"))).toEqual(answers);
    expect(applyQueryParams(answers, new URLSearchParams("plz=abcde"))).toEqual(answers);
  });

  it("entfernt nur form und plz aus der URL", () => {
    const params = new URLSearchParams("form=l&plz=30159&utm_source=google&gclid=abc");
    expect(hasHandoffParams(params)).toBe(true);
    expect(hasHandoffParams(new URLSearchParams("utm_source=google"))).toBe(false);
    expect(withoutHandoffParams(params).toString()).toBe("utm_source=google&gclid=abc");
    expect(params.get("form")).toBe("l");
  });

  it("nimmt jeden Einstieg von der Landing-Seite an", () => {
    for (const option of FORM_OPTIONS) {
      const url = new URL(funnelEntryUrl("?utm_source=google&plz=30159", option.id), "https://kuechenwert24.de");
      expect(isFunnelAStepSlug(url.pathname.replace(`${FUNNEL_A_BASE_PATH}/`, ""))).toBe(true);
      expect(applyQueryParams(emptyFunnelAAnswers(), url.searchParams)).toMatchObject({
        kitchen_form: option.id,
        postal_code: "30159",
      });
    }
    expect(funnelEntryUrl("")).toBe(stepPath(FUNNEL_A_FIRST_SLUG));
  });
});

describe("Zwischenstand im sessionStorage", () => {
  it.each([null, undefined, "", "{kaputt", "[]", "42", '"text"', "null"])("startet bei %j leer", (raw) => {
    expect(parseStoredState(raw)).toEqual(initialFunnelAState());
  });

  it("bereinigt gespeicherte Antworten und Kontaktdaten", () => {
    const raw = JSON.stringify({
      answers: {
        kitchen_form: "kochinsel",
        kitchen_style: "barock",
        extra_appliances: ["kaffee", "raketenantrieb"],
        timeframe: "1-3",
        budget_eur: null,
        postal_code: "30159",
      },
      contact: { salutation: "Frau", first_name: "Maria", email: 7, marketing: "ja" },
    });
    expect(parseStoredState(raw)).toEqual({
      answers: {
        ...emptyFunnelAAnswers(),
        kitchen_form: "insel",
        extra_appliances: ["kaffee"],
        timeframe: "1-3",
        budget_eur: null,
        postal_code: "30159",
      },
      contact: { ...emptyContact(), salutation: "Frau", first_name: "Maria" },
    });
  });

  it("behält Kontaktdaten, wenn die Antworten unlesbar sind", () => {
    const state = parseStoredState(JSON.stringify({ answers: "kaputt", contact: { first_name: "Maria" } }));
    expect(state.answers).toEqual(emptyFunnelAAnswers());
    expect(state.contact.first_name).toBe("Maria");
  });

  it("liest unter kw_funnel_a_v2 und übersteht Speicherfehler", () => {
    vi.mocked(sessionStorage.getItem).mockReturnValueOnce(JSON.stringify({ answers: { kitchen_form: "zeile" } }));
    expect(readStoredState().answers.kitchen_form).toBe("zeile");
    expect(sessionStorage.getItem).toHaveBeenCalledWith("kw_funnel_a_v2");
    vi.mocked(sessionStorage.getItem).mockImplementationOnce(() => {
      throw new Error("SecurityError");
    });
    expect(readStoredState()).toEqual(initialFunnelAState());
  });
});

describe("useFunnelA", () => {
  async function renderFunnel(initialEntry: string) {
    const { useLocation } = await vi.importActual<typeof RouterDom>("react-router-dom");
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(MemoryRouter, { initialEntries: [initialEntry] }, children);
    return renderHook(() => ({ funnel: useFunnelA(), location: useLocation() }), { wrapper });
  }

  it("übernimmt ?form und ?plz einmalig und behält Tracking-Parameter in der URL", async () => {
    vi.mocked(sessionStorage.getItem).mockReturnValue(JSON.stringify({ answers: { kitchen_form: "u", room_type: "offen" } }));
    const { result } = await renderFunnel("/funnel/a/raum?form=l-form&plz=30159&utm_source=google");
    expect(result.current.funnel.answers).toMatchObject({ kitchen_form: "l", postal_code: "30159", room_type: "offen" });
    expect(result.current.location).toMatchObject({ pathname: "/funnel/a/raum", search: "?utm_source=google" });
  });

  it("speichert Antworten und Kontaktdaten im Tab", async () => {
    const { result } = await renderFunnel("/funnel/a/groesse");
    act(() => result.current.funnel.setAnswer("kitchen_size", "mittel"));
    act(() => result.current.funnel.patchContact({ first_name: "Maria" }));
    const [key, json] = vi.mocked(sessionStorage.setItem).mock.lastCall ?? [];
    expect(key).toBe(FUNNEL_A_STORAGE_KEY);
    expect(parseStoredState(json)).toMatchObject({ answers: { kitchen_size: "mittel" }, contact: { first_name: "Maria" } });
  });

  it("speichert nach clear() nichts mehr", async () => {
    const { result } = await renderFunnel("/funnel/a/kontakt");
    act(() => result.current.funnel.clear());
    expect(sessionStorage.removeItem).toHaveBeenCalledWith(FUNNEL_A_STORAGE_KEY);
    vi.mocked(sessionStorage.setItem).mockClear();
    act(() => result.current.funnel.patchContact({ email: "maria@beispiel.de" }));
    expect(sessionStorage.setItem).not.toHaveBeenCalled();
  });
});
