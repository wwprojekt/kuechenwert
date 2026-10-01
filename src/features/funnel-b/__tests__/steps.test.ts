import { describe, expect, it } from "vitest";
import { offerValidityRange, plausibleOfferDate } from "@/config/funnel-b-stammdaten";
import type { LeadFileCategory } from "../files";
import { initialFunnelBData, planningOnFile, submissionUploads, type FunnelBData } from "../state";
import { funnelBFlow, guardFunnelBStep, isSkippable, missingIn, parseFunnelBStep, submissionFields } from "../steps";

const file = new File(["%PDF"], "angebot.pdf", { type: "application/pdf" });
const upload = (category: LeadFileCategory, id = category) => ({ id, category, file });
const withOffer = (patch: Partial<FunnelBData> = {}): FunnelBData => ({
  ...initialFunnelBData,
  existingOfferPriceEur: "18000",
  offerDeliveryMethod: "later",
  ...patch,
});
const withPlanning = (patch: Partial<FunnelBData> = {}) =>
  withOffer({ offerDeliveryMethod: "now", uploads: [upload("grundriss")], ...patch });

describe("Schrittfolge von Funnel B", () => {
  it("fragt ohne Planung Küchenform und auf Wunsch die Details ab", () => {
    expect(funnelBFlow(withOffer())).toEqual([
      "preis",
      "leistungsumfang",
      "unterlagen",
      "aenderungen",
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

  it("fragt mit hochgeladener Planung nichts ab, was darin steht", () => {
    const flow = ["preis", "leistungsumfang", "unterlagen", "hochladen", "aenderungen", "zeitrahmen", "plz", "name", "kontakt"];
    expect(funnelBFlow(withPlanning())).toEqual(flow);
    expect(funnelBFlow(withPlanning({ wantsDetails: "ja" }))).toEqual(flow);
    expect(funnelBFlow(withOffer({ offerDeliveryMethod: "now", uploads: [upload("angebot")] }))).toEqual(flow);
  });

  it("zählt nur Planung oder Angebot als Planung, keine Fotos", () => {
    const photos = withOffer({ offerDeliveryMethod: "now", uploads: [upload("kueche_bild")], wantsDetails: "ja" });
    expect(planningOnFile(photos)).toBe(false);
    expect(funnelBFlow(photos)).toEqual(expect.arrayContaining(["kuechenform", "details", "marke"]));
    expect(planningOnFile(withPlanning({ uploads: [upload("kueche_bild"), upload("grundriss")] }))).toBe(true);
    // Später nachreichen: ausgewählte Dateien liegen noch im Speicher, gehen aber nicht mit.
    expect(planningOnFile(withOffer({ uploads: [upload("grundriss")] }))).toBe(false);
  });

  it("lässt ohne vollständiges Angebot nicht zu den Kontaktdaten", () => {
    expect(guardFunnelBStep("leistungsumfang", initialFunnelBData)).toBe("leistungsumfang");
    expect(guardFunnelBStep("kuechenform", initialFunnelBData)).toBe("preis");
    expect(guardFunnelBStep("kontakt", initialFunnelBData)).toBe("preis");
    expect(guardFunnelBStep("kontakt", withOffer({ offerDeliveryMethod: "now" }))).toBe("hochladen");
    expect(guardFunnelBStep("kontakt", withOffer({ offerDeliveryMethod: "now", uploads: [{ id: "1", category: "angebot", file }] }))).toBe("kontakt");
    expect(guardFunnelBStep("kontakt", withOffer())).toBe("kontakt");
    expect(guardFunnelBStep("aenderungen", withOffer({ offerDeliveryMethod: "now" }))).toBe("hochladen");
  });

  it("sagt je Schritt, was fehlt", () => {
    expect(missingIn("preis", initialFunnelBData).map((m) => m.key)).toEqual(["existing_offer_price"]);
    expect(missingIn("kontakt", withOffer({ email: "x", phone: "12" })).map((m) => m.key)).toEqual(["email", "phone", "accept_terms"]);
    expect(missingIn("kontakt", withOffer({ email: "maria@beispiel.de", phone: "0511 123456" })).map((m) => m.key)).toEqual(["accept_terms"]);
    expect(missingIn("kontakt", withOffer({ email: "maria@beispiel.de", phone: "0511 123456", acceptTerms: true }))).toEqual([]);
    expect(missingIn("zeitrahmen", withOffer())).toEqual([]);
  });

  it("verlangt bei „Ja, etwas ändern“ eine Beschreibung", () => {
    expect(missingIn("aenderungen", withPlanning())).toEqual([]);
    expect(missingIn("aenderungen", withPlanning({ planChanges: "none" }))).toEqual([]);
    expect(missingIn("aenderungen", withPlanning({ planChanges: "changes", planChangesText: "  " })).map((m) => m.target)).toEqual([
      "funnel-b-plan-changes-text",
    ]);
    expect(missingIn("aenderungen", withPlanning({ planChanges: "changes", planChangesText: "Siemens statt Bosch" }))).toEqual([]);
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
    expect(isSkippable("aenderungen", withPlanning())).toBe(true);
    expect(isSkippable("aenderungen", withPlanning({ planChanges: "none" }))).toBe(false);
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

describe("Was an kw-lead-b geht", () => {
  const details: Partial<FunnelBData> = {
    wantsDetails: "ja",
    kitchenForm: "l",
    brand: "nolte",
    frontName: "Riva",
    appliances: [{ id: "a1", categorySlug: "backofen", brandSlug: "bosch", model: "" }],
    extrasNotes: "Glas-Spritzschutz",
  };

  it("schickt keine Details mit, die vor dem Upload der Planung eingegeben wurden", () => {
    const fields = submissionFields(withPlanning({ ...details, planChanges: "changes", planChangesText: "Siemens statt Bosch" }));
    expect(fields).toMatchObject({ kitchenForm: "", brand: "", frontName: "", appliances: [], extrasNotes: "" });
    expect(fields).toMatchObject({ planChanges: "changes", planChangesText: "Siemens statt Bosch", offerDeliveryMethod: "now" });
  });

  it("schickt Details nur, wenn der Kunde sie zuletzt angeben wollte", () => {
    expect(submissionFields(withOffer(details))).toMatchObject({ kitchenForm: "l", brand: "nolte", extrasNotes: "Glas-Spritzschutz" });
    expect(submissionFields(withOffer({ ...details, wantsDetails: "nein" }))).toMatchObject({ kitchenForm: "l", brand: "", extrasNotes: "" });
  });

  it("schickt Felder, die erst eine Auswahl einblendet, nur mit dieser Auswahl", () => {
    expect(submissionFields(withPlanning({ planChanges: "none", planChangesText: "alt" }))).toMatchObject({ planChanges: "none", planChangesText: "" });
    const detailed = withOffer({ wantsDetails: "ja", brand: "nolte", brandCustom: "Marquardt", paymentFinancing: "none", paymentFinancingApr: "4.9" });
    expect(submissionFields(detailed)).toMatchObject({ brand: "nolte", brandCustom: "", paymentFinancingApr: "" });
    expect(submissionFields({ ...detailed, brand: "sonstiger", paymentFinancing: "with_interest" })).toMatchObject({
      brandCustom: "Marquardt",
      paymentFinancingApr: "4.9",
    });
  });

  it("lädt Dateien nur mit „Jetzt hochladen“ hoch", () => {
    expect(submissionUploads(withPlanning())).toHaveLength(1);
    expect(submissionUploads(withOffer({ uploads: [upload("grundriss")] }))).toEqual([]);
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
