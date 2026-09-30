import { describe, expect, it } from "vitest";
import { REDACTED, redactContactData, redactOptional } from "../../../../supabase/functions/_shared/contact-redaction.ts";
import { describeLeadDetails, detailsRoom, hasDetails, sanitizeCustomerDetails, sanitizeExpertBriefing } from "../lead-details";

describe("redactContactData", () => {
  it.each([
    ["Bitte an max.muster@web.de schreiben", "Bitte an [entfernt] schreiben"],
    ["Mail: max (at) web.de", "Mail: [entfernt]"],
    ["Ruf mich an: 0170 1234567", "Ruf mich an: [entfernt]"],
    ["Tel. +49 511 12345-67", "Tel. [entfernt]"],
    ["Handy 0171/2345678, abends", "Handy [entfernt], abends"],
    ["Unser Haus: www.muster-haus.de/kueche", "Unser Haus: [entfernt]"],
    ["Plan unter https://example.com/plan?id=1", "Plan unter [entfernt]"],
  ])("entfernt Kontaktdaten aus „%s“", (input, expected) => {
    expect(redactContactData(input)).toBe(expected);
  });

  it.each([
    "Budget ca. 15.000 € bis 18.500 €",
    "Wände 300 240 180 cm, Raumhöhe 2,50 m",
    "Einzug am 15.03.2027, Lieferung KW 12",
    "Kochfeld Siemens EX875LYC1E, 80 cm",
    "Kaufpreis 1.250.000 € fürs Haus",
  ])("lässt Maße, Preise und Daten in „%s“ stehen", (input) => {
    expect(redactContactData(input)).toBe(input);
  });

  it("gibt für leere Freitexte null zurück", () => {
    expect(redactOptional("  max@web.de ")).toBe(REDACTED);
    expect(redactOptional("   ")).toBeNull();
    expect(redactOptional(null)).toBeNull();
  });
});

describe("sanitizeCustomerDetails", () => {
  it("behält nur bekannte Angaben und die Wände der Küchenform", () => {
    const details = sanitizeCustomerDetails(
      {
        walls: { a: 320, b: 50, c: 280 },
        ceiling_height_cm: "255",
        room_features: ["fenster", "pool"],
        ventilation: "umluft",
        connections: "versetzbar",
        consultation: ["video", "telefon", "brief"],
        notes: "Bitte abends anrufen: 0170 1234567",
        extra: "weg",
      },
      "l",
    );
    expect(details).toEqual({
      walls: { a: 320 },
      ceiling_height_cm: 255,
      room_features: ["fenster"],
      ventilation: "umluft",
      connections: "versetzbar",
      consultation: ["video", "telefon"],
      notes: "Bitte abends anrufen: [entfernt]",
    });
  });

  it("verwirft Wände ohne bekannte Küchenform und unplausible Werte", () => {
    expect(sanitizeCustomerDetails({ walls: { a: 300 } }, "unsicher")).toEqual({});
    expect(sanitizeCustomerDetails({ walls: { a: 300 } }, null)).toEqual({});
    expect(sanitizeCustomerDetails({ ceiling_height_cm: 900, ventilation: "fenster" }, "l")).toEqual({});
    expect(sanitizeCustomerDetails("kaputt", "l")).toEqual({});
    expect(hasDetails(sanitizeCustomerDetails({}, "l"))).toBe(false);
  });
});

describe("sanitizeExpertBriefing", () => {
  it("prüft Form, Laufmeter, Leistungsumfang und Datum", () => {
    expect(
      sanitizeExpertBriefing({
        kitchen_form: "u",
        manufacturer: "Nobilia Touch 339, Studio: info@kuechen-x.de",
        run_length_cm: 780,
        offer_includes: ["delivery", "assembly", "foo"],
        offer_valid_until: "2026-11-15",
        notes: "Geräte nur Mittelklasse",
      }),
    ).toEqual({
      kitchen_form: "u",
      manufacturer: "Nobilia Touch 339, Studio: [entfernt]",
      run_length_cm: 780,
      offer_includes: ["delivery", "assembly"],
      offer_valid_until: "2026-11-15",
      notes: "Geräte nur Mittelklasse",
    });
  });

  it("lässt „nicht bekannt“ allein stehen und verwirft ungültige Werte", () => {
    expect(
      sanitizeExpertBriefing({ offer_includes: ["unknown", "delivery"], run_length_cm: 20, offer_valid_until: "2026-02-30", kitchen_form: "rund" }),
    ).toEqual({ offer_includes: ["unknown"] });
  });
});

describe("describeLeadDetails", () => {
  const details = {
    expert: { kitchen_form: "u" as const, offer_includes: ["delivery", "assembly"], run_length_cm: 780 },
    expert_updated_at: "2026-09-30T08:00:00Z",
    customer: { walls: { a: 320, b: 240 }, ventilation: "umluft" as const, notes: "Fenster links" },
    customer_updated_at: "2026-10-01T08:00:00Z",
  };

  it("zeigt zuerst den Experten-Check, dann die Angaben des Kunden", () => {
    const [expert, customer, ...rest] = describeLeadDetails(details, "l");
    expect(rest).toEqual([]);
    expect(expert!.title).toMatch(/^Aus dem Experten-Check · 30\.0?9\.2026$/);
    expect(expert!.rows).toEqual(
      expect.arrayContaining([
        { label: "Laufmeter", value: "ca. 7,8 m" },
        { label: "Im Preis enthalten", value: "Lieferung, Montage" },
      ]),
    );
    expect(customer!.title).toMatch(/^Vom Kunden nachgetragen · 0?1\.10\.2026$/);
    expect(customer!.rows).toEqual([
      { label: "Wandlängen", value: "Wand A 3,2 m · Wand B 2,4 m" },
      { label: "Dunstabzug", value: "Nur Umluft" },
      { label: "Hinweis", value: "Fenster links" },
    ]);
  });

  it("liefert ohne Ergänzungen keine Gruppen", () => {
    expect(describeLeadDetails(null, "l")).toEqual([]);
    expect(describeLeadDetails({ customer: {}, expert: {} }, "l")).toEqual([]);
  });
});

describe("detailsRoom", () => {
  it("baut den Raum aus der Küchenform der Anfrage, wenn alle Pflichtwände da sind", () => {
    expect(detailsRoom({ customer: { walls: { a: 320, b: 240 } } }, "l")).toEqual({ form: "l", walls: { a: 320, b: 240 } });
    expect(detailsRoom({ customer: { walls: { a: 360, island: 200 } } }, "insel")).toEqual({
      form: "insel",
      walls: { a: 360, b: 0, island: 200 },
    });
  });

  it("gibt ohne vollständige Maße oder Küchenform null zurück", () => {
    expect(detailsRoom({ customer: { walls: { a: 320 } } }, "l")).toBeNull();
    expect(detailsRoom({ customer: { walls: { a: 320, b: 240 } } }, "unsicher")).toBeNull();
    expect(detailsRoom(null, "l")).toBeNull();
  });
});
