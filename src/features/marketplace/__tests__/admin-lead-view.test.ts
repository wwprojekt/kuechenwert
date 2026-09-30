import { describe, expect, it } from "vitest";
import { describeLeadSummary, leadSummaryFromRow } from "@/features/funnel-a/catalog";
import { defaultConfig, defaultRoom } from "@/features/planner/core";
import { latestConsent, type LeadConsent } from "../admin-api";
import { plannerSummaryFromLead } from "../planner-preview";

const consent = (purpose: string, granted: boolean, created_at: string): LeadConsent => ({
  id: `${purpose}-${created_at}`,
  purpose,
  granted,
  text_version: "test",
  created_at,
});

describe("Einwilligungen im Admin", () => {
  it("nimmt je Zweck die jüngste Entscheidung", () => {
    const rows = [
      consent("share_with_studios", false, "2026-09-30T09:44:22.767017+00:00"),
      consent("contact_by_phone", false, "2026-09-30T09:44:22.767017+00:00"),
      consent("share_with_studios", true, "2026-10-02T08:00:00.000000+00:00"),
    ];
    expect(latestConsent(rows, "share_with_studios")).toBe(true);
    expect(latestConsent(rows, "contact_by_phone")).toBe(false);
    expect(latestConsent(rows, "marketing")).toBeUndefined();
    expect(latestConsent(undefined, "share_with_studios")).toBeUndefined();
  });
});

describe("Funnel C im Lead-Dialog", () => {
  const lead = {
    funnel_type: "traumkueche",
    kitchen_form: "u",
    kitchen_style: "modern",
    budget_midpoint: 21_500,
    has_existing_offer: null,
    existing_offer_price_cents: null,
    timeframe_months: null,
    housing_type: "unknown",
    purchase_reason: null as string | null,
    special_wishes: null,
    delivery_mode: null,
    funnel_answers: {
      planner_session_id: "576a2e51-dc1f-42e2-ab03-533b517ee83b",
      config: { ...defaultConfig(), wishes: "Viel Stauraum" },
      room: defaultRoom("u"),
      estimate: { min: 18_000, max: 25_000, mid: 21_500 },
      offers_requested: false,
    },
  };

  it("zeigt den Rahmen wie bei Studios statt einer leeren Anfrage", () => {
    expect(leadSummaryFromRow(lead)).toMatchObject({ source: "c" });
    expect(describeLeadSummary(leadSummaryFromRow({ ...lead, timeframe_months: 6 }))).toEqual([
      { title: "Rahmen", rows: [{ label: "Zeitraum", value: "In ca. 6 Monaten" }] },
    ]);
  });

  it("zeigt nur das genannte Budget, nie die KI-Schätzung als Budget", () => {
    const answered = { ...lead, funnel_answers: { ...lead.funnel_answers, budget_eur: 20_000, budget_source: "slider" } };
    expect(describeLeadSummary(leadSummaryFromRow(answered))[0]?.rows).toContainEqual({ label: "Budget", value: "ca. 20.000 €" });
    expect(JSON.stringify(describeLeadSummary(leadSummaryFromRow(lead)))).not.toContain("21.500");
  });

  it("baut die Studio-Vorschau aus der gespeicherten Planung", () => {
    const summary = plannerSummaryFromLead(lead, 0);
    expect(summary?.source).toBe("c");
    expect(summary?.labels?.style).toBeTruthy();
    expect(summary?.room?.form).toBe("u");
    expect(summary?.estimate).toEqual({ min: 18_000, max: 25_000, mid: 21_500 });
    expect(summary?.layout?.runCm).toBeGreaterThan(0);
    expect(summary?.wishes).toBe("Viel Stauraum");
  });

  it("zeigt Studios den Wunschtext ohne Kontaktangaben", () => {
    const answers = { ...lead.funnel_answers, config: { ...defaultConfig(), wishes: "Viel Stauraum, Rückruf 0171 1234567" } };
    expect(plannerSummaryFromLead({ ...lead, funnel_answers: answers }, 0)?.wishes).toBe("Viel Stauraum, Rückruf [entfernt]");
  });

  it("zeigt ohne gespeicherte Planung oder Schätzung nichts Erfundenes", () => {
    expect(plannerSummaryFromLead({ ...lead, funnel_answers: { offers_requested: false } }, 0)).toBeNull();
    const withoutEstimate = plannerSummaryFromLead({ ...lead, funnel_answers: { ...lead.funnel_answers, estimate: null } }, 0);
    expect(withoutEstimate?.estimate).toBeUndefined();
  });
});
