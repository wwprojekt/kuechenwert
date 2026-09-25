import { describe, expect, it } from "vitest";
import { BRIEFING_SCHEMA, buildBriefing, buildFloorPlanDxf } from "../briefing-export";
import type { DealerProjectDetail } from "../dealer-api";

function detail(overrides: Partial<DealerProjectDetail> = {}): DealerProjectDetail {
  return {
    auction_id: "3f1c2b7a-1111-4222-8333-944455556666",
    status: "active",
    funnel_type: "traumkueche",
    published_at: "2026-09-25T10:00:00Z",
    ends_at: "2026-10-02T10:00:00Z",
    decision_deadline_at: null,
    postal_prefix: "301",
    region: "Hannover",
    distance_km: 12,
    summary: {
      source: "c",
      room: { form: "l", walls: { a: 300, b: 240 }, ceiling_height_cm: 250 },
      estimate: { min: 14000, max: 21000, mid: 17100 },
      wishes: "Große Arbeitsfläche · Kochinsel später möglich",
    },
    estimate_min_eur: 14000,
    estimate_max_eur: 21000,
    reference_price_eur: 17100,
    offer_count: 2,
    lowest_offer_eur: 16500,
    my_offer: null,
    contact_unlocked: false,
    contact_purchases: 0,
    max_contact_purchases: 3,
    contact_price_cents: 4900,
    awarded_to_me: false,
    service_radius_km: 80,
    bid_visibility: "lowest_price",
    media: [
      { bucket: "planner-media", path: "s1/photos/a.jpg", kind: "photo" },
      { bucket: "planner-media", path: "s1/renders/v1.jpg", kind: "render", mode: "edit" },
    ],
    contact: null,
    ...overrides,
  };
}

describe("buildBriefing", () => {
  it("enthält Schema, Maße, Schätzung und signierte Medien-Links", () => {
    const b = buildBriefing(detail(), { "s1/renders/v1.jpg": "https://signed/render" });
    expect(b.schema).toBe(BRIEFING_SCHEMA);
    expect(b.room).toMatchObject({ form: "l", walls: { a: 300, b: 240 } });
    expect(b.estimate_eur).toEqual({ min: 14000, max: 21000, mid: 17100 });
    expect(b.media).toEqual([
      { kind: "photo", url: null, url_expires_in_s: 3600 },
      { kind: "render", url: "https://signed/render", url_expires_in_s: 3600 },
    ]);
    expect(b.contact).toBeNull();
  });

  it("fällt für Alt-Leads ohne Summary-Schätzung auf die Ausschreibungswerte zurück", () => {
    const b = buildBriefing(detail({ summary: { source: "a" } }), {});
    expect(b.estimate_eur).toEqual({ min: 14000, max: 21000, mid: 17100 });
    expect(b.room).toBeNull();
  });
});

describe("buildFloorPlanDxf", () => {
  it("liefert null ohne Raummaße", () => {
    expect(buildFloorPlanDxf(detail({ summary: { source: "a" } }))).toBeNull();
  });

  it("erzeugt gültiges DXF R12 in Millimetern", () => {
    const dxf = buildFloorPlanDxf(detail());
    expect(dxf).not.toBeNull();
    const lines = dxf!.split("\n");
    expect(lines.length % 2).toBe(0);
    expect(lines.slice(0, 4)).toEqual(["0", "SECTION", "2", "HEADER"]);
    expect(dxf).toContain("$ACADVER\n1\nAC1009");
    expect(lines.slice(-2)).toEqual(["0", "EOF"]);

    const entityTypes = lines.filter((_, i) => i % 2 === 1 && lines[i - 1] === "0");
    expect(entityTypes.filter((t) => t === "LINE")).toHaveLength(8);
    expect(entityTypes.filter((t) => t === "TEXT")).toHaveLength(3);

    // Zeile A: 3,00 m Wandlänge → 3000 mm
    expect(dxf).toContain("10\n0.0\n20\n0.0\n30\n0.0\n11\n3000.0\n21\n0.0");
  });

  it("schreibt ausschließlich ASCII (Umlaute transliteriert)", () => {
    const dxf = buildFloorPlanDxf(detail())!;
    expect(/^[\x20-\x7E\n]*$/.test(dxf)).toBe(true);
    expect(dxf).toContain("Masse ca., bitte vor Ort aufmessen");
  });
});
