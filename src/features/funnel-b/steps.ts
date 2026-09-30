import { isOfferReady, type FunnelBData } from "./state";

/**
 * Funnel B („Angebot unterbieten“): eine Frage pro Bildschirm. Nach Preis,
 * Unterlagen und Zeitrahmen entscheidet der Kunde, ob er Details angibt;
 * wer Unterlagen hochlädt, braucht sie meist nicht.
 */
export type FunnelBStepKey =
  | "preis"
  | "unterlagen"
  | "hochladen"
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
  | "muell"
  | "extras"
  | "notizen"
  | "lieferung"
  | "zahlung"
  | "anzahlung"
  | "plz"
  | "name"
  | "kontakt"
  | "einwilligung";

export interface FunnelBStep {
  key: FunnelBStepKey;
  question: string;
  hint?: string;
  /** Detailfrage: nur mit „Details angeben“, jederzeit überspringbar. */
  detail?: boolean;
}

export const FUNNEL_B_STEPS: readonly FunnelBStep[] = [
  { key: "preis", question: "Was kostet Ihr Küchenangebot?", hint: "Bruttopreis laut Angebot – diesen Preis sollen die Studios unterbieten." },
  { key: "unterlagen", question: "Haben Sie Angebot oder Planung zur Hand?", hint: "Mit Unterlagen können wir genau vergleichen." },
  { key: "hochladen", question: "Laden Sie Ihre Unterlagen hoch", hint: "PDF oder Fotos, höchstens 10 Dateien à 20 MB." },
  { key: "zeitrahmen", question: "Wann soll die Küche geliefert werden?", hint: "Ein fester Termin bringt oft den besseren Preis." },
  { key: "details", question: "Möchten Sie Details zu Ihrem Angebot angeben?", hint: "Freiwillig – was Sie nicht wissen, klären wir im Experten-Check." },
  { key: "marke", question: "Von welchem Hersteller ist die Küche?", detail: true },
  { key: "fronten", question: "Welche Fronten hat die Küche?", hint: "Bezeichnung und Material laut Angebot.", detail: true },
  { key: "griffe", question: "Welcher Grifftyp ist geplant?", detail: true },
  { key: "arbeitsplatte", question: "Welche Arbeitsplatte ist geplant?", detail: true },
  { key: "arbeitsplatte-name", question: "Wie heißt die Arbeitsplatte genau?", hint: "Steht meist im Angebot, z. B. „Calacatta Roma“.", detail: true },
  { key: "geraete", question: "Welche Geräte sind im Angebot?", hint: "Marke und Modell machen den Vergleich genauer.", detail: true },
  { key: "spuele", question: "Welche Spüle ist geplant?", detail: true },
  { key: "spuele-marke", question: "Welche Marke und welches Modell?", detail: true },
  { key: "muell", question: "Ist ein Mülltrennsystem geplant?", detail: true },
  { key: "extras", question: "Welche Extras sind im Angebot?", hint: "Mehrfachauswahl möglich.", detail: true },
  { key: "notizen", question: "Gibt es noch etwas, das wir wissen sollten?", hint: "Optional, z. B. Glas-Spritzschutz oder USB-Dosen.", detail: true },
  { key: "lieferung", question: "Wie soll geliefert werden?", detail: true },
  { key: "zahlung", question: "Wie soll bezahlt werden?", detail: true },
  { key: "anzahlung", question: "Wie hoch ist die Anzahlung?", hint: "Was Ihr Studio fordert, z. B. 30 %.", detail: true },
  { key: "plz", question: "Wo soll die Küche hin?", hint: "Wir stellen Ihr Angebot Studios aus Ihrer Region vor." },
  { key: "name", question: "Wie dürfen wir Sie ansprechen?" },
  { key: "kontakt", question: "Wie erreichen wir Sie für den Experten-Check?", hint: "Wir rufen werktags kurz an, bevor Studios Ihr Angebot sehen." },
  { key: "einwilligung", question: "Fast geschafft – Ihre Zustimmung", hint: "Damit Studios Ihr Angebot unterbieten können." },
];

const KEYS = new Set<string>(FUNNEL_B_STEPS.map((s) => s.key));
/** ?schritt=1…9 aus der Version bis 09/2026. */
const LEGACY: Record<string, FunnelBStepKey> = { "1": "preis", "2": "zeitrahmen", "9": "plz" };

export function parseFunnelBStep(raw: string | null): FunnelBStepKey {
  if (raw && KEYS.has(raw)) return raw as FunnelBStepKey;
  return (raw && LEGACY[raw]) || "preis";
}

export function funnelBStep(key: FunnelBStepKey): FunnelBStep {
  return FUNNEL_B_STEPS.find((s) => s.key === key) ?? FUNNEL_B_STEPS[0]!;
}

export function funnelBFlow(data: FunnelBData): FunnelBStepKey[] {
  return FUNNEL_B_STEPS.filter((s) => {
    if (s.key === "hochladen") return data.offerDeliveryMethod === "now";
    if (s.detail) return data.wantsDetails === "ja";
    return true;
  }).map((s) => s.key);
}

const OFFER_STEPS: ReadonlySet<FunnelBStepKey> = new Set(["preis", "unterlagen", "hochladen"]);

/** Ohne vollständiges Angebot geht es nicht zu den weiteren Schritten (Dateien überstehen kein Neuladen). */
export function guardFunnelBStep(key: FunnelBStepKey, data: FunnelBData): FunnelBStepKey {
  if (OFFER_STEPS.has(key) || isOfferReady(data)) return key;
  if (!(Number(data.existingOfferPriceEur) > 0)) return "preis";
  return data.offerDeliveryMethod === "now" ? "hochladen" : "unterlagen";
}

/** Freiwillige Einzelauswahl je Schritt: ohne Antwort heißt „Weiter“ „Überspringen“. */
const OPTIONAL_CHOICE: Partial<Record<FunnelBStepKey, keyof FunnelBData>> = {
  zeitrahmen: "timeframe",
  griffe: "handleType",
  arbeitsplatte: "worktopMaterial",
  spuele: "sinkMaterial",
  muell: "wasteSeparationSystem",
  lieferung: "deliveryMode",
  zahlung: "paymentFinancing",
};

export function isSkippable(key: FunnelBStepKey, data: FunnelBData): boolean {
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
      if (!(Number(data.existingOfferPriceEur) > 0)) add("existing_offer_price", "Bitte geben Sie den Angebotspreis an.", "funnel-b-offer-price");
      break;
    case "unterlagen":
      if (!data.offerDeliveryMethod) add("offer_delivery", "Bitte wählen Sie, ob Sie Unterlagen jetzt hochladen oder später nachreichen.", "funnel-b-offer-delivery");
      break;
    case "hochladen":
      if (data.uploads.length === 0) add("uploads", "Bitte laden Sie mindestens eine Datei hoch – oder wählen Sie „Später nachreichen“.", "funnel-b-uploads");
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
      break;
    case "einwilligung":
      if (!data.consentShare) add("consent_share", "Bitte stimmen Sie der Weitergabe an Küchenstudios zu.", "funnel-b-consent-share");
      if (!data.consentCall) add("consent_call", "Bitte stimmen Sie dem Rückruf für den Experten-Check zu.", "funnel-b-consent-call");
      break;
  }
  return missing;
}
