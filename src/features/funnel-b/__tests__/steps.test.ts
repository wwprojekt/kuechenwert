import { describe, expect, it } from "vitest";
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
    expect(funnelBFlow(withOffer())).toEqual(["preis", "unterlagen", "zeitrahmen", "details", "plz", "name", "kontakt", "einwilligung"]);
    expect(funnelBFlow(withOffer({ offerDeliveryMethod: "now" }))).toContain("hochladen");
    const detailed = funnelBFlow(withOffer({ wantsDetails: "ja" }));
    expect(detailed).toContain("marke");
    expect(detailed.indexOf("anzahlung")).toBeLessThan(detailed.indexOf("plz"));
  });

  it("lässt ohne vollständiges Angebot nicht zu den Kontaktdaten", () => {
    expect(guardFunnelBStep("kontakt", initialFunnelBData)).toBe("preis");
    expect(guardFunnelBStep("kontakt", withOffer({ offerDeliveryMethod: "now" }))).toBe("hochladen");
    expect(guardFunnelBStep("kontakt", withOffer({ offerDeliveryMethod: "now", uploads: [{ id: "1", category: "angebot", file }] }))).toBe("kontakt");
    expect(guardFunnelBStep("kontakt", withOffer())).toBe("kontakt");
  });

  it("sagt je Schritt, was fehlt", () => {
    expect(missingIn("preis", initialFunnelBData).map((m) => m.key)).toEqual(["existing_offer_price"]);
    expect(missingIn("kontakt", withOffer({ email: "x", phone: "12" })).map((m) => m.key)).toEqual(["email", "phone"]);
    expect(missingIn("einwilligung", withOffer({ consentShare: true })).map((m) => m.key)).toEqual(["consent_call"]);
    expect(missingIn("zeitrahmen", withOffer())).toEqual([]);
  });

  it("nennt freiwillige Auswahlschritte ohne Antwort „Überspringen“", () => {
    expect(isSkippable("zeitrahmen", withOffer())).toBe(true);
    expect(isSkippable("zeitrahmen", withOffer({ timeframe: "0-3" }))).toBe(false);
    expect(isSkippable("preis", withOffer())).toBe(false);
  });

  it("liest alte Schrittnummern und schickt keine Browser-Felder an den Server", () => {
    expect(parseFunnelBStep("1")).toBe("preis");
    expect(parseFunnelBStep("9")).toBe("plz");
    expect(parseFunnelBStep("marke")).toBe("marke");
    const fields = submissionFields(withOffer({ wantsDetails: "ja", uploads: [{ id: "1", category: "angebot", file }] }));
    expect(fields).not.toHaveProperty("uploads");
    expect(fields).not.toHaveProperty("wantsDetails");
    expect(fields).toHaveProperty("existingOfferPriceEur", "18000");
  });
});
