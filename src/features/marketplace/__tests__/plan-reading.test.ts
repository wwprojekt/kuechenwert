import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN_READING_MODEL,
  PLAN_READING_SCHEMA,
  briefingFromPlanReading,
  buildPlanReadingRequest,
  describePlanReading,
  isRedactedCopy,
  mistralErrorText,
  normalizePlanReading,
  parsePlanReadingResponse,
  planReadingModel,
  planReadingNotes,
  planReadingWarnings,
  type PlanReading,
} from "../plan-reading";

const inMonths = (months: number) => new Date(Date.now() + months * 30 * 86_400_000).toISOString().slice(0, 10);

const modelAnswer = {
  is_kitchen_planning: true,
  kitchen_form: "l",
  manufacturer: "nobilia-Werke",
  program: "Touch 340",
  fronts: "Alpinweiß Ultramatt, grifflos",
  worktop: "Eiche Sierra, 38 mm",
  run_length_cm: 620,
  wall_lengths_cm: [320, 240, 9999],
  ceiling_height_cm: 250,
  appliances: [
    { category: "backofen", brand: "siemens", model: "HB778G3B1" },
    { category: "kochfeld", brand: "Siemens", model: "" },
    { category: "toaster", brand: "", model: "" },
  ],
  sink: "Blanco Subline 500-U, Silgranit",
  extras: ["Apothekerauszug", "unknown"],
  offer_total_eur: 18400,
  offer_includes: ["delivery", "assembly", "teleport"],
  offer_valid_until: inMonths(2),
  personal_data: { customer_name: true, customer_address: true, customer_contact: false, studio_identity: true },
  summary: "L-Küche mit Hochschrankwand. Rückfragen unter 0511 1234567 oder info@studio-beispiel.de.",
};

/** Alle Objekte des Schemas: strikter Modus verlangt jedes Feld als Pflicht und keine Zusatzfelder. */
function objectNodes(node: unknown): Record<string, unknown>[] {
  if (!node || typeof node !== "object") return [];
  const n = node as Record<string, unknown>;
  const children = [...Object.values((n.properties ?? {}) as Record<string, unknown>), n.items];
  return [...(n.type === "object" ? [n] : []), ...children.flatMap(objectNodes)];
}

describe("Schema und Anfrage an Mistral", () => {
  it("ist für den strikten JSON-Schema-Modus vollständig", () => {
    const nodes = objectNodes(PLAN_READING_SCHEMA);
    expect(nodes.length).toBeGreaterThanOrEqual(3);
    for (const node of nodes) {
      expect(node.additionalProperties).toBe(false);
      expect([...(node.required as string[])].sort()).toEqual(Object.keys(node.properties as object).sort());
    }
  });

  it("schickt PDFs als Dokument, Fotos als Bild und verlangt das Schema", () => {
    const request = buildPlanReadingRequest("gibt-es-nicht", [
      { kind: "document", url: "https://example.test/planung.pdf" },
      { kind: "image", url: "https://example.test/foto.jpg" },
    ]);
    expect(request.model).toBe(DEFAULT_PLAN_READING_MODEL);
    const user = (request.messages as { role: string; content: unknown }[])[1]!;
    expect(user.content).toEqual([
      expect.objectContaining({ type: "text" }),
      { type: "document_url", document_url: "https://example.test/planung.pdf" },
      { type: "image_url", image_url: "https://example.test/foto.jpg" },
    ]);
    expect(request.response_format).toEqual({ type: "json_schema", json_schema: { name: "kuechenplanung", strict: true, schema: PLAN_READING_SCHEMA } });
    expect(request.temperature).toBe(0);
  });

  it("liest die Antwort als Text oder als Bausteine und gibt Fehler ohne Anfrageinhalt wieder", () => {
    const body = (content: unknown) => JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 1200, completion_tokens: 300 } });
    expect(parsePlanReadingResponse(body('{"kitchen_form":"u"}'))).toEqual({ content: { kitchen_form: "u" }, inputTokens: 1200, outputTokens: 300 });
    expect(parsePlanReadingResponse(body([{ type: "text", text: '{"kitchen_form":' }, { type: "text", text: '"l"}' }])).content).toEqual({ kitchen_form: "l" });
    expect(() => parsePlanReadingResponse(body(""))).toThrow("Antwort ohne Inhalt");
    expect(mistralErrorText('{"object":"error","message":"Invalid model: foo","type":"invalid_request"}')).toBe("Invalid model: foo");
    expect(mistralErrorText("<html>Bad Gateway</html>")).toBe("<html>Bad Gateway</html>");
  });

  it("kennt nur freigegebene Modelle und erkennt geschwärzte Kopien", () => {
    expect(planReadingModel("mistral-small-latest")).toBe("mistral-small-latest");
    expect(planReadingModel(undefined)).toBe(DEFAULT_PLAN_READING_MODEL);
    expect(isRedactedCopy("planung (geschwärzt).pdf")).toBe(true);
    expect(isRedactedCopy("planung-geschwaerzt.pdf")).toBe(false);
    expect(isRedactedCopy(null)).toBe(false);
  });
});

describe("normalizePlanReading", () => {
  const reading = normalizePlanReading(modelAnswer);

  it("übernimmt nur bekannte Werte und plausible Maße", () => {
    expect(reading).toMatchObject({
      is_kitchen_planning: true,
      kitchen_form: "l",
      manufacturer: "Nobilia",
      program: "Touch 340",
      run_length_cm: 620,
      wall_lengths_cm: [320, 240],
      ceiling_height_cm: 250,
      extras: ["Apothekerauszug"],
      offer_total_eur: 18400,
      offer_includes: ["delivery", "assembly"],
      offer_valid_until: modelAnswer.offer_valid_until,
    });
    expect(reading.appliances).toEqual([
      { category: "backofen", brand: "Siemens", model: "HB778G3B1" },
      { category: "kochfeld", brand: "Siemens", model: null },
    ]);
  });

  it("entfernt Kontaktdaten aus Freitexten und merkt sich nur, ob welche auf den Unterlagen stehen", () => {
    expect(reading.summary).toContain("[entfernt]");
    expect(reading.summary).not.toMatch(/0511|info@/);
    expect(reading.personal_data).toEqual({ customer_name: true, customer_address: true, customer_contact: false, studio_identity: true });
  });

  it("macht aus einer kaputten Antwort ein leeres Ergebnis statt eines Fehlers", () => {
    const empty = normalizePlanReading({ kitchen_form: "rund", run_length_cm: "600", offer_total_eur: 12, personal_data: "ja", summary: "unbekannt" });
    expect(empty).toMatchObject({
      is_kitchen_planning: false,
      kitchen_form: null,
      run_length_cm: null,
      offer_total_eur: null,
      summary: null,
      appliances: [],
      personal_data: { customer_name: false, customer_address: false, customer_contact: false, studio_identity: false },
    });
    expect(describePlanReading(empty)).toEqual([]);
  });
});

describe("Vorschlag fürs Briefing und Hinweise fürs Team", () => {
  const reading = normalizePlanReading(modelAnswer);

  it("füllt die Felder des Experten-Checks", () => {
    const briefing = briefingFromPlanReading(reading);
    expect(briefing).toMatchObject({
      kitchen_form: "l",
      manufacturer: "Nobilia Touch 340",
      run_length_cm: 620,
      offer_includes: ["delivery", "assembly"],
      offer_valid_until: modelAnswer.offer_valid_until,
    });
    expect(briefing.notes).toContain("Fronten: Alpinweiß Ultramatt, grifflos");
    expect(briefing.notes).toContain("Geräte: Backofen: Siemens HB778G3B1; Herd / Kochfeld: Siemens");
    expect(briefingFromPlanReading(normalizePlanReading({}))).toEqual({});
  });

  it("kürzt den Hinweistext auf die Länge des Briefings", () => {
    const long: PlanReading = { ...reading, summary: "Sehr lange Beschreibung ".repeat(30), extras: Array.from({ length: 12 }, (_, i) => `Extra ${i} mit Text`) };
    const notes = planReadingNotes(long)!;
    expect(notes.length).toBeLessThanOrEqual(1000);
    expect(notes.endsWith("…")).toBe(true);
  });

  it("warnt vor Namen auf den Unterlagen und vor einem abweichenden Preis", () => {
    expect(planReadingWarnings(reading, 18_000)).toEqual([
      "Auf den Unterlagen stehen vermutlich Name, Anschrift der Kundin bzw. des Kunden sowie Name oder Logo des Studios – vor einer Freigabe für Studios schwärzen.",
    ]);
    expect(planReadingWarnings(reading, 16_000)).toContainEqual(expect.stringMatching(/stehen 18\.400\s€, genannt wurden 16\.000\s€/));
    const clean: PlanReading = { ...reading, personal_data: { customer_name: false, customer_address: false, customer_contact: false, studio_identity: false } };
    expect(planReadingWarnings(clean, null)).toEqual([]);
    expect(planReadingWarnings({ ...clean, is_kitchen_planning: false })).toEqual([
      "Die Unterlagen sehen nicht nach einer Küchenplanung aus – bitte selbst ansehen.",
    ]);
  });

  it("zeigt dem Team alle erkannten Angaben", () => {
    const labels = describePlanReading(reading).map((r) => r.label);
    expect(labels).toEqual([
      "Küchenform",
      "Hersteller & Programm",
      "Fronten",
      "Arbeitsplatte",
      "Laufmeter",
      "Wandlängen",
      "Raumhöhe",
      "Geräte",
      "Spüle",
      "Ausstattung",
      "Preis laut Angebot",
      "Im Preis enthalten",
      "Gültig bis",
      "Zusammenfassung",
    ]);
  });
});
