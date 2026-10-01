import { plausibleOfferDate } from "@/config/funnel-b-stammdaten";
import { TERMS_MISSING } from "../../../supabase/functions/_shared/lead-terms.ts";
import { initialFunnelBData, isOfferReady, planningOnFile, type FunnelBData } from "./state";

/**
 * Funnel B („Fertige Planung vergleichen“): eine Frage pro Bildschirm. Die
 * meisten Studios geben kein schriftliches Angebot mit, aber die Planung
 * (Grundriss, Ansichten, Geräteliste) und nennen einen Preis. Liegt die
 * Planung oder das Angebot bei, fragt der Funnel nichts ab, was darin steht:
 * nach Preis, Leistungsumfang und Upload nur, ob sich an der Planung etwas
 * ändern soll, dann Zeitrahmen und Kontakt. Ohne Planung (später nachreichen
 * oder nur Fotos) folgen Küchenform und auf Wunsch die Detailfragen.
 */
export type FunnelBStepKey =
  | "preis"
  | "leistungsumfang"
  | "unterlagen"
  | "hochladen"
  | "aenderungen"
  | "kuechenform"
  | "zeitrahmen"
  | "details"
  | "marke"
  | "fronten"
  | "griffe"
  | "arbeitsplatte"
  | "arbeitsplatte-name"
  | "geraete"
  | "spuele"
  | "spuele-marke"
  | "extras"
  | "notizen"
  | "zahlung"
  | "anzahlung"
  | "plz"
  | "name"
  | "kontakt";

export interface FunnelBStep {
  key: FunnelBStepKey;
  question: string;
  hint?: string;
  /** Detailfrage: nur mit „Details angeben“, jederzeit überspringbar. */
  detail?: boolean;
}

export const FUNNEL_B_STEPS: readonly FunnelBStep[] = [
  {
    key: "preis",
    question: "Welchen Preis hat Ihnen das Küchenstudio genannt?",
    hint: "Gesamtpreis inkl. MwSt., auch mündlich genannt – diesen Preis sollen die Studios unterbieten.",
  },
  {
    key: "leistungsumfang",
    question: "Was ist in diesem Preis enthalten?",
    hint: "Mehrfachauswahl – so bieten die Studios denselben Umfang an.",
  },
  {
    key: "unterlagen",
    question: "Haben Sie die Planung vom Küchenstudio?",
    hint: "Grundriss, Ansichten oder Geräteliste – damit können die Studios genau Ihre Küche anbieten.",
  },
  { key: "hochladen", question: "Laden Sie Ihre Planung hoch", hint: "Handyfotos der Ausdrucke genügen – Detailfragen zur Küche entfallen dann." },
  { key: "aenderungen", question: "Soll sich an der Planung noch etwas ändern?", hint: "Sonst bieten die Studios genau Ihre Planung an." },
  { key: "kuechenform", question: "Welche Form hat die geplante Küche?", hint: "Damit Studios Ihre Küche auch ohne Planung einordnen können." },
  { key: "zeitrahmen", question: "Wann soll die Küche geliefert werden?", hint: "Ein fester Termin bringt oft den besseren Preis." },
  { key: "details", question: "Möchten Sie Details zu Ihrer Küche angeben?", hint: "Freiwillig – was Sie nicht wissen, klären wir im Experten-Check." },
  { key: "marke", question: "Von welchem Hersteller ist die Küche?", detail: true },
  { key: "fronten", question: "Welche Fronten hat die Küche?", hint: "Bezeichnung und Material laut Planung oder Angebot.", detail: true },
  { key: "griffe", question: "Welcher Grifftyp ist geplant?", detail: true },
  { key: "arbeitsplatte", question: "Welche Arbeitsplatte ist geplant?", detail: true },
  { key: "arbeitsplatte-name", question: "Wie heißt die Arbeitsplatte genau?", hint: "Steht meist in der Planung, z. B. „Calacatta Roma“.", detail: true },
  { key: "geraete", question: "Welche Geräte sind geplant?", hint: "Marke und Modell stehen meist in der Planung oder Geräteliste.", detail: true },
  { key: "spuele", question: "Welche Spüle ist geplant?", detail: true },
  { key: "spuele-marke", question: "Welche Marke und welches Modell?", detail: true },
  { key: "extras", question: "Welche Extras sind geplant?", hint: "Mehrfachauswahl möglich.", detail: true },
  { key: "notizen", question: "Gibt es noch etwas, das wir wissen sollten?", hint: "Optional, z. B. Glas-Spritzschutz oder USB-Dosen.", detail: true },
  { key: "zahlung", question: "Wie soll bezahlt werden?", detail: true },
  { key: "anzahlung", question: "Wie hoch ist die Anzahlung?", hint: "Was Ihr Studio fordert, z. B. 30 %.", detail: true },
  { key: "plz", question: "Wo soll die Küche hin?", hint: "Wir zeigen Ihre Planung Studios aus Ihrer Region." },
  { key: "name", question: "Wie dürfen wir Sie ansprechen?" },
  { key: "kontakt", question: "Wie erreichen wir Sie für den Experten-Check?", hint: "Wir rufen werktags kurz an, bevor Studios Ihre Planung sehen." },
];

const KEYS = new Set<string>(FUNNEL_B_STEPS.map((s) => s.key));
/**
 * ?schritt=1…9 aus der Version bis 09/2026; „muell“ ist in „extras“
 * aufgegangen, „lieferung“ im Leistungsumfang, „einwilligung“ im
 * Kontaktschritt. Alte Links landen an derselben Stelle im Ablauf.
 */
const LEGACY: Record<string, FunnelBStepKey> = {
  "1": "preis",
  "2": "zeitrahmen",
  "9": "plz",
  muell: "extras",
  lieferung: "zahlung",
  einwilligung: "kontakt",
};

export function parseFunnelBStep(raw: string | null): FunnelBStepKey {
  if (raw && KEYS.has(raw)) return raw as FunnelBStepKey;
  return (raw && LEGACY[raw]) || "preis";
}

export function funnelBStep(key: FunnelBStepKey): FunnelBStep {
  return FUNNEL_B_STEPS.find((s) => s.key === key) ?? FUNNEL_B_STEPS[0]!;
}

/** Steht in der Planung: Mit Planung oder Angebot im Upload entfallen diese Schritte samt Detailfragen. */
const IN_PLANNING: ReadonlySet<FunnelBStepKey> = new Set(["kuechenform", "details"]);

export function funnelBFlow(data: FunnelBData): FunnelBStepKey[] {
  const planned = planningOnFile(data);
  return FUNNEL_B_STEPS.filter((s) => {
    if (s.key === "hochladen") return data.offerDeliveryMethod === "now";
    if (planned && (s.detail || IN_PLANNING.has(s.key))) return false;
    if (s.detail) return data.wantsDetails === "ja";
    return true;
  }).map((s) => s.key);
}

const OFFER_STEPS: ReadonlySet<FunnelBStepKey> = new Set(["preis", "leistungsumfang", "unterlagen", "hochladen"]);

/** Ohne Preis und Planung geht es nicht zu den weiteren Schritten (Dateien überstehen kein Neuladen). */
export function guardFunnelBStep(key: FunnelBStepKey, data: FunnelBData): FunnelBStepKey {
  if (OFFER_STEPS.has(key) || isOfferReady(data)) return key;
  if (!(Number(data.existingOfferPriceEur) > 0)) return "preis";
  return data.offerDeliveryMethod === "now" ? "hochladen" : "unterlagen";
}

type FieldKey = keyof FunnelBData;

/** Was jeder Schritt erfragt; Schritte, die immer im Pfad liegen, fehlen. */
const STEP_FIELDS: Partial<Record<FunnelBStepKey, readonly FieldKey[]>> = {
  aenderungen: ["planChanges", "planChangesText"],
  kuechenform: ["kitchenForm"],
  marke: ["brand", "brandCustom"],
  fronten: ["frontName", "frontMaterialName"],
  griffe: ["handleType"],
  arbeitsplatte: ["worktopMaterial"],
  "arbeitsplatte-name": ["worktopDesign", "worktopDesignCustom"],
  geraete: ["appliances"],
  spuele: ["sinkMaterial"],
  "spuele-marke": ["sinkBrand", "sinkDesignation"],
  extras: ["extras"],
  notizen: ["extrasNotes"],
  zahlung: ["paymentFinancing", "paymentFinancingApr", "paymentFinancingMonths"],
  anzahlung: ["paymentDownPaymentPercent"],
};

/** Felder, die ihr Schritt nur nach einer bestimmten Auswahl zeigt. */
const SHOWN_IF: Partial<Record<FieldKey, (data: FunnelBData) => boolean>> = {
  planChangesText: (d) => d.planChanges === "changes",
  brandCustom: (d) => d.brand === "sonstiger",
  paymentFinancingApr: (d) => d.paymentFinancing === "with_interest",
  paymentFinancingMonths: (d) => d.paymentFinancing === "with_interest",
};

/**
 * Die Daten für kw-lead-b: nur, was der Kunde auf seinem Weg durch den Funnel
 * zuletzt gesehen hat. Antworten aus Schritten außerhalb des Pfads (etwa
 * Details vor dem Upload der Planung) gehen nicht mit, sonst hielten Studios
 * sie für aktuelle Wünsche. Ohne Dateien und ohne reine Browser-Felder;
 * consentShare/consentCall verlangt kw-lead-b in der Fassung vor dem
 * AGB-Haken, der Hinweis am Haken deckt beides ab.
 */
export function submissionFields(data: FunnelBData): Record<string, unknown> {
  const flow = new Set(funnelBFlow(data));
  const hidden = new Set<FieldKey>();
  for (const [step, keys] of Object.entries(STEP_FIELDS) as [FunnelBStepKey, readonly FieldKey[]][]) {
    if (!flow.has(step)) keys.forEach((key) => hidden.add(key));
  }
  for (const [key, shown] of Object.entries(SHOWN_IF) as [FieldKey, (d: FunnelBData) => boolean][]) {
    if (!shown(data)) hidden.add(key);
  }
  const fields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data) as [FieldKey, unknown][]) {
    if (key === "uploads" || key === "wantsDetails") continue;
    fields[key] = hidden.has(key) ? initialFunnelBData[key] : value;
  }
  return { ...fields, consentShare: data.acceptTerms, consentCall: data.acceptTerms };
}

/** Freiwillige Einzelauswahl je Schritt: ohne Antwort heißt „Weiter“ „Überspringen“. */
const OPTIONAL_CHOICE: Partial<Record<FunnelBStepKey, keyof FunnelBData>> = {
  aenderungen: "planChanges",
  kuechenform: "kitchenForm",
  zeitrahmen: "timeframe",
  griffe: "handleType",
  arbeitsplatte: "worktopMaterial",
  spuele: "sinkMaterial",
  zahlung: "paymentFinancing",
};

export function isSkippable(key: FunnelBStepKey, data: FunnelBData): boolean {
  if (key === "leistungsumfang") return data.offerIncludes.length === 0;
  const field = OPTIONAL_CHOICE[key];
  return !!field && !data[field];
}

export interface Missing {
  /** Feldschlüssel für die Telemetrie. */
  key: string;
  message: string;
  /** Element, das den Fokus bekommt. */
  target: string;
}

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Was im Schritt noch fehlt, bevor es weitergeht. */
export function missingIn(key: FunnelBStepKey, data: FunnelBData): Missing[] {
  const missing: Missing[] = [];
  const add = (k: string, message: string, target: string) => missing.push({ key: k, message, target });
  switch (key) {
    case "preis":
      if (!(Number(data.existingOfferPriceEur) > 0)) add("existing_offer_price", "Bitte geben Sie den Preis an, den Ihnen das Studio genannt hat.", "funnel-b-offer-price");
      if (data.offerValidUntil && !plausibleOfferDate(data.offerValidUntil)) {
        add("offer_valid_until", "Bitte prüfen Sie das Datum, bis wann der Preis gilt – oder lassen Sie das Feld leer.", "funnel-b-offer-valid-until");
      }
      break;
    case "unterlagen":
      if (!data.offerDeliveryMethod) add("offer_delivery", "Bitte wählen Sie, ob Sie die Planung jetzt hochladen oder später nachreichen.", "funnel-b-offer-delivery");
      break;
    case "hochladen":
      if (data.uploads.length === 0) add("uploads", "Bitte laden Sie mindestens eine Datei hoch – oder wählen Sie „Später nachreichen“.", "funnel-b-uploads");
      break;
    case "aenderungen":
      if (data.planChanges === "changes" && !data.planChangesText.trim()) {
        add("plan_changes_text", "Bitte beschreiben Sie kurz, was sich ändern soll – oder wählen Sie „Nein, genau so“.", "funnel-b-plan-changes-text");
      }
      break;
    case "details":
      if (!data.wantsDetails) add("wants_details", "Bitte wählen Sie eine Antwort aus.", "funnel-b-details");
      break;
    case "plz":
      if (!/^\d{5}$/.test(data.postalCode)) add("postal_code", "Bitte geben Sie Ihre fünfstellige Postleitzahl ein.", "funnel-plz");
      break;
    case "name":
      if (data.firstName.trim().length <= 1) add("first_name", "Bitte geben Sie Ihren Vornamen an.", "funnel-b-first-name");
      if (data.lastName.trim().length <= 1) add("last_name", "Bitte geben Sie Ihren Nachnamen an.", "funnel-b-last-name");
      break;
    case "kontakt":
      if (!EMAIL_OK.test(data.email.trim())) add("email", "Bitte geben Sie eine gültige E-Mail-Adresse an.", "funnel-b-email");
      if (data.phone.replace(/\D/g, "").length < 6) add("phone", "Bitte geben Sie Ihre Telefonnummer an.", "funnel-b-phone");
      if (!data.acceptTerms) add("accept_terms", TERMS_MISSING, "funnel-b-accept-terms");
      break;
  }
  return missing;
}
