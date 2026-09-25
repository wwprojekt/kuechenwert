import { describe, expect, it } from "vitest";
import {
  UNSURE,
  describeFunnelA,
  describeFunnelB,
  describeLeadSummary,
  emptyFunnelAAnswers,
  estimateFunnelA,
  formLabel,
  funnelAPlannerInput,
  housingType,
  leadSummaryFromRow,
  missingRequired,
  regionForPostalCode,
  sanitizeFunnelAAnswers,
  styleLabel,
  timeframeMonths,
  toStoredAnswers,
  type FunnelAAnswers,
} from "../catalog";

function answers(patch: Partial<FunnelAAnswers> = {}): FunnelAAnswers {
  return { ...emptyFunnelAAnswers(), kitchen_form: "l", timeframe: "4-6", postal_code: "30159", ...patch };
}

describe("sanitizeFunnelAAnswers", () => {
  it("verwirft unbekannte Werte und hält Pflichtfelder fest", () => {
    const a = sanitizeFunnelAAnswers({
      kitchen_form: "rund",
      kitchen_style: "barock",
      extra_appliances: ["geschirrspueler", "raketenantrieb", "geschirrspueler"],
      postal_code: "3015",
      budget_eur: 123_456,
    });
    expect(a.kitchen_form).toBe("");
    expect(a.kitchen_style).toBe("");
    expect(a.extra_appliances).toEqual(["geschirrspueler"]);
    expect(a.postal_code).toBe("");
    expect(a.budget_eur).toBe(50_000);
    expect(missingRequired(a)).toEqual(["kitchen_form", "timeframe", "postal_code"]);
  });

  it("übernimmt IDs aus Funnel A v1", () => {
    const a = sanitizeFunnelAAnswers({ kitchen_form: "l-form", kitchen_style: "minimalistisch" });
    expect(a.kitchen_form).toBe("l");
    expect(a.kitchen_style).toBe("modern_grifflos");
    expect(sanitizeFunnelAAnswers({ kitchen_form: "kochinsel" }).kitchen_form).toBe("insel");
    expect(sanitizeFunnelAAnswers({ kitchen_style: "individuell" }).kitchen_style).toBe(UNSURE);
  });

  it("unterscheidet „Budget weiß ich nicht“ von fehlender Angabe", () => {
    expect(sanitizeFunnelAAnswers({ budget_eur: null }).budget_eur).toBeNull();
    expect(sanitizeFunnelAAnswers({}).budget_eur).toBe(10_000);
    expect(sanitizeFunnelAAnswers({ budget_eur: 12_345 }).budget_eur).toBe(12_500);
  });
});

describe("Preisanker", () => {
  it("bildet Kochfeld, Kühlen und Zusatzgeräte auf den Konfigurator ab", () => {
    const { config, room } = funnelAPlannerInput(
      answers({ cooktop_type: "kochfeldabzug", cooling: "side_by_side", oven_placement: "doppelt", extra_appliances: ["kaffee"] }),
    );
    expect(room.form).toBe("l");
    expect(config.appliances).toEqual(expect.arrayContaining(["backofen", "kochfeldabzug", "side_by_side", "dampfgarer", "kaffee"]));
    expect(config.appliances).not.toContain("haube");
    expect(config.appliances).not.toContain("kuehl");
    expect(config.quality).toBe("mittel");
  });

  it("skaliert die Wände mit der Küchengröße", () => {
    const small = funnelAPlannerInput(answers({ kitchen_size: "klein" })).room.walls.a!;
    const large = funnelAPlannerInput(answers({ kitchen_size: "xl" })).room.walls.a!;
    expect(large).toBeGreaterThan(small);
    expect(small % 10).toBe(0);
  });

  it("liefert eine plausible, aufsteigende Spanne", () => {
    const zeile = estimateFunnelA(answers({ kitchen_form: "zeile", kitchen_size: "klein" }));
    const insel = estimateFunnelA(answers({ kitchen_form: "insel", kitchen_size: "xl", worktop_category: "keramik" }));
    expect(zeile.min).toBeGreaterThan(3_000);
    expect(zeile.min).toBeLessThan(zeile.max);
    expect(insel.mid).toBeGreaterThan(zeile.mid);
  });

  it("nutzt für „Steht noch nicht fest“ eine L-Küche als typische Annahme", () => {
    expect(funnelAPlannerInput(answers({ kitchen_form: UNSURE })).room.form).toBe("l");
  });
});

describe("Hilfsfunktionen", () => {
  it("rechnet Zeitraum und Wohnsituation um", () => {
    expect(timeframeMonths("asap")).toBe(1);
    expect(timeframeMonths("beratung")).toBeNull();
    expect(housingType("own_house")).toBe("own");
    expect(housingType("")).toBe("unknown");
  });

  it("liefert Labels auch für Legacy-IDs", () => {
    expect(formLabel("u-form")).toBe("U-Küche");
    expect(formLabel(UNSURE)).toBeNull();
    expect(styleLabel("landhaus")).toBe("Modernes Landhaus");
  });

  it("findet Regionen zum PLZ-Leitbereich", () => {
    expect(regionForPostalCode("30159")).toBe("Hannover");
    expect(regionForPostalCode("80331")).toBe("München");
    expect(regionForPostalCode("0515")).toBeNull();
  });

  it("speichert Budget-Quelle und Version", () => {
    const stored = toStoredAnswers(answers({ budget_eur: null }), { salutation: "Frau", estimate: null });
    expect(stored.version).toBe(2);
    expect(stored.budget_source).toBe("unknown");
  });
});

describe("describeFunnelA", () => {
  it("gruppiert Angaben mit Labels und sammelt Beratungsthemen", () => {
    const groups = describeFunnelA({
      source: "a",
      kitchen_form: "l",
      kitchen_style: UNSURE,
      budget_eur: 18_000,
      purchase_reason: "renovierung",
      answers: {
        room_type: "offen",
        kitchen_size: UNSURE,
        worktop_category: UNSURE,
        cooktop_type: "induktion",
        cooling: "kombi",
        extra_appliances: ["geschirrspueler", "dampfgarer"],
        decision_maker: "gemeinsam",
        timeframe: "1-3",
        budget_source: "slider",
      },
    });
    const rows = Object.fromEntries(groups.flatMap((g) => g.rows.map((r) => [r.label, r.value])));
    expect(groups.map((g) => g.title)).toEqual(["Küche", "Geräte", "Rahmen"]);
    expect(rows.Form).toBe("L-Küche");
    expect(rows["Größe"]).toBe("Noch nicht ausgemessen");
    expect(rows["Weitere Geräte"]).toBe("Geschirrspüler, Kombi-Dampfgarer");
    expect(rows.Budget).toBe("ca. 18.000 €");
    expect(rows["Beratung gewünscht zu"]).toBe("Stil, Arbeitsplatte");
    expect(Object.values(rows).join(" ")).not.toMatch(/unsicher|_/);
  });

  it("zeigt Alt-Leads ohne Roh-IDs und UUIDs", () => {
    const groups = describeFunnelA({
      source: "a",
      kitchen_form: "kochinsel",
      housing_type: "own",
      timeframe_months: 5,
      answers: {
        front_material_ids: ["4f1d2c7a-0000-0000-0000-000000000000"],
        front_material_names: ["Mattlack"],
        appliance_brand_names: ["Miele"],
        timeframe: "4-6",
      },
    });
    const text = JSON.stringify(groups);
    expect(text).toContain("Mit Kochinsel");
    expect(text).toContain("Mattlack");
    expect(text).toContain("Miele");
    expect(text).toContain("Eigentum");
    expect(text).not.toContain("4f1d2c7a");
  });
});

describe("describeFunnelB / describeLeadSummary", () => {
  it("übersetzt Slugs in Labels und gruppiert Angebot, Geräte und Rahmen", () => {
    const groups = describeFunnelB({
      source: "b",
      existing_offer_eur: 24_500,
      timeframe_months: 5,
      delivery_mode: "delivery_assembly",
      special_wishes: ["steckdosen", "besteckeinsatz", "unbekannt"],
      answers: {
        brand: "nolte",
        handleType: "grifflos-push",
        worktopMaterial: "quarzkomposit",
        worktopDesign: "Calacatta Gold",
        sinkBrand: "blanco",
        sinkMaterial: "sonstige-sink-mat",
        appliances: [
          { categorySlug: "backofen", brandSlug: "siemens", model: "iQ700" },
          { categorySlug: "backofen", brandSlug: "neff", model: "" },
          { categorySlug: "geschirrspueler", brandSlug: "sonstige", model: "" },
        ],
        extrasNotes: "Bitte mit Wasserfilter",
        timeframeSlug: "3-6",
      },
    });
    expect(groups).toEqual([
      {
        title: "Vorhandenes Angebot",
        rows: [
          { label: "Vorhandenes Angebot", value: "24.500 €" },
          { label: "Küchenmarke", value: "Nolte" },
          { label: "Griffe", value: "Grifflos (Push-to-Open)" },
          { label: "Arbeitsplatte", value: "Quarzkomposit" },
          { label: "Dekor", value: "Calacatta Gold" },
          { label: "Spüle", value: "Blanco" },
        ],
      },
      {
        title: "Geräte",
        rows: [
          { label: "Backofen", value: "Siemens iQ700, Neff" },
          { label: "Geschirrspüler", value: "enthalten" },
        ],
      },
      {
        title: "Rahmen",
        rows: [
          { label: "Zeitraum", value: "In 3-6 Monaten" },
          { label: "Lieferung", value: "Lieferung + Montage" },
          { label: "Extras", value: "Steckdosen / USB-Buchsen, Besteckeinsatz, unbekannt" },
          { label: "Hinweise", value: "Bitte mit Wasserfilter" },
        ],
      },
    ]);
  });

  it("zeigt eigene Markenangaben und Klartext älterer Einträge", () => {
    const rows = (answers: Record<string, unknown>) => describeFunnelB({ source: "b", answers })[0]?.rows;
    expect(rows({ brand: "sonstiger", brandCustom: "Marquardt" })).toEqual([{ label: "Küchenmarke", value: "Marquardt" }]);
    expect(rows({ brand: "Nolte", worktopMaterial: "Quarz" })).toEqual([
      { label: "Küchenmarke", value: "Nolte" },
      { label: "Arbeitsplatte", value: "Quarz" },
    ]);
    expect(describeFunnelB({ source: "b", timeframe_months: 9 })).toEqual([
      { title: "Rahmen", rows: [{ label: "Zeitraum", value: "In ca. 9 Monaten" }] },
    ]);
  });

  it("baut aus einer leads-Zeile dieselbe Struktur wie kw_lead_public_summary", () => {
    const summary = leadSummaryFromRow({
      funnel_type: "b",
      kitchen_form: null,
      kitchen_style: null,
      budget_midpoint: 24_500,
      has_existing_offer: true,
      existing_offer_price_cents: 2_450_000,
      timeframe_months: 5,
      housing_type: null,
      purchase_reason: null,
      special_wishes: ["steckdosen"],
      delivery_mode: "pickup",
      funnel_answers: { salutation: "frau", brand: "nolte" },
    });
    expect(summary).toMatchObject({ source: "b", existing_offer_eur: 24_500, estimate: null, answers: { brand: "nolte" } });
    expect(summary.answers).not.toHaveProperty("salutation");
    expect(describeLeadSummary(summary)[0]?.rows[0]).toEqual({ label: "Vorhandenes Angebot", value: "24.500 €" });
  });

  it("wählt die Darstellung nach Herkunft", () => {
    expect(describeLeadSummary({ source: "c" })).toEqual([]);
    expect(describeLeadSummary({ source: "a", kitchen_form: "zeile" })[0]?.rows[0]).toEqual({ label: "Form", value: "Küchenzeile" });
  });
});
