import { describe, expect, it } from "vitest";
import { offerValidityRange, plausibleOfferDate } from "@/config/funnel-b-stammdaten";
import { initialFunnelBData, submissionFields, type FunnelBData } from "../state";
import { funnelBFlow, guardFunnelBStep, isSkippable, missingIn, parseFunnelBStep } from "../steps";

const file = new File(["%PDF"], "angebot.pdf", { type: "application/pdf" });
const withOffer = (patch: Partial<FunnelBData> = {}): FunnelBData => ({
  ...initialFunnelBData,
  existingOfferPriceEur: "18000",
  offerDeliveryMethod: "later",
  ...patch,
});

describe("Schrittfolge von Funnel B", () => {
  it("zeigt den Upload nur beim Hochladen und Details nur auf Wunsch", () => {
    expect(funnelBFlow(withOffer())).toEqual([
      "preis",
      "leistungsumfang",
      "unterlagen",
      "kuechenform",
      "zeitrahmen",
      "details",
      "plz",
      "name",
      "kontakt",
    ]);
    expect(funnelBFlow(withOffer({ offerDeliveryMethod: "now" }))).toContain("hochladen");
    const detailed = funnelBFlow(withOffer({ wantsDetails: "ja" }));
    expect(detailed).toContain("marke");
    expect(detailed).not.toContain("muell");
    expect(detailed).not.toContain("lieferung");
    expect(detailed.indexOf("anzahlung")).toBeLessThan(detailed.indexOf("plz"));
  });

  it("lässt ohne vollständiges Angebot nicht zu den Kontaktdaten", () => {
    expect(guardFunnelBStep("leistungsumfang", initialFunnelBData)).toBe("leistungsumfang");
    expect(guardFunnelBStep("kuechenform", initialFunnelBData)).toBe("preis");
    expect(guardFunnelBStep("kontakt", initialFunnelBData)).toBe("preis");
    expect(guardFunnelBStep("kontakt", withOffer({ offerDeliveryMethod: "now" }))).toBe("hochladen");
    expect(guardFunnelBStep("kontakt", withOffer({ offerDeliveryMethod: "now", uploads: [{ id: "1", category: "angebot", file }] }))).toBe("kontakt");
    expect(guardFunnelBStep("kontakt", withOffer())).toBe("kontakt");
  });

  it("sagt je Schritt, was fehlt", () => {
    expect(missingIn("preis", initialFunnelBData).map((m) => m.key)).toEqual(["existing_offer_price"]);
    expect(missingIn("kontakt", withOffer({ email: "x", phone: "12" })).map((m) => m.key)).toEqual(["email", "phone", "accept_terms"]);
    expect(missingIn("kontakt", withOffer({ email: "maria@beispiel.de", phone: "0511 123456" })).map((m) => m.key)).toEqual(["accept_terms"]);
    expect(missingIn("kontakt", withOffer({ email: "maria@beispiel.de", phone: "0511 123456", acceptTerms: true }))).toEqual([]);
    expect(missingIn("zeitrahmen", withOffer())).toEqual([]);
  });

  it("prüft „Angebot gültig bis“ nur, wenn es angegeben ist", () => {
    const { min, max } = offerValidityRange();
    expect(missingIn("preis", withOffer({ offerValidUntil: "" }))).toEqual([]);
    expect(missingIn("preis", withOffer({ offerValidUntil: max }))).toEqual([]);
    expect(missingIn("preis", withOffer({ offerValidUntil: "1999-12-31" })).map((m) => m.key)).toEqual(["offer_valid_until"]);
    expect(missingIn("preis", withOffer({ offerValidUntil: min })).map((m) => m.target)).toEqual([]);
  });

  it("nennt freiwillige Auswahlschritte ohne Antwort „Überspringen“", () => {
    expect(isSkippable("zeitrahmen", withOffer())).toBe(true);
    expect(isSkippable("zeitrahmen", withOffer({ timeframe: "0-3" }))).toBe(false);
    expect(isSkippable("preis", withOffer())).toBe(false);
    expect(isSkippable("leistungsumfang", withOffer())).toBe(true);
    expect(isSkippable("leistungsumfang", withOffer({ offerIncludes: ["delivery", "assembly"] }))).toBe(false);
    expect(isSkippable("kuechenform", withOffer())).toBe(true);
    expect(isSkippable("kuechenform", withOffer({ kitchenForm: "l" }))).toBe(false);
  });

  it("liest alte Schrittnummern und schickt keine Browser-Felder an den Server", () => {
    expect(parseFunnelBStep("1")).toBe("preis");
    expect(parseFunnelBStep("9")).toBe("plz");
    expect(parseFunnelBStep("marke")).toBe("marke");
    expect(parseFunnelBStep("muell")).toBe("extras");
    expect(parseFunnelBStep("lieferung")).toBe("zahlung");
    expect(parseFunnelBStep("einwilligung")).toBe("kontakt");
    const fields = submissionFields(
      withOffer({
        wantsDetails: "ja",
        offerIncludes: ["delivery"],
        offerValidUntil: "2026-12-31",
        acceptTerms: true,
        uploads: [{ id: "1", category: "grundriss", file }],
      }),
    );
    expect(fields).not.toHaveProperty("uploads");
    expect(fields).not.toHaveProperty("wantsDetails");
    expect(fields).toHaveProperty("existingOfferPriceEur", "18000");
    expect(fields).toHaveProperty("offerIncludes", ["delivery"]);
    expect(fields).toHaveProperty("offerValidUntil", "2026-12-31");
    expect(fields).toMatchObject({ acceptTerms: true, consentShare: true, consentCall: true });
    expect(fields).not.toHaveProperty("consentStudioCall");
    expect(fields).not.toHaveProperty("consentMarketing");
  });
});

describe("plausibleOfferDate", () => {
  const now = new Date("2026-09-30T12:00:00Z");

  it("nimmt echte Kalendertage bis ein Jahr zurück und zwei Jahre voraus", () => {
    expect(plausibleOfferDate("2026-10-15", now)).toBe("2026-10-15");
    expect(plausibleOfferDate("2025-10-01", now)).toBe("2025-10-01");
    expect(plausibleOfferDate("2028-09-28", now)).toBe("2028-09-28");
  });

  it("verwirft Unsinn, Tippfehler und Daten außerhalb des Zeitraums", () => {
    expect(plausibleOfferDate("2026-02-30", now)).toBeNull();
    expect(plausibleOfferDate("15.10.2026", now)).toBeNull();
    expect(plausibleOfferDate("2024-01-01", now)).toBeNull();
    expect(plausibleOfferDate("2030-01-01", now)).toBeNull();
    expect(plausibleOfferDate(20261015, now)).toBeNull();
  });
});
