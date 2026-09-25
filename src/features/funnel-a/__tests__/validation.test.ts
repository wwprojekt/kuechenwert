import { beforeEach, describe, expect, it, vi } from "vitest";
import { callFunction } from "@/features/marketplace/api-client";
import { notifyKitchenFunnelLead } from "@/lib/funnelLeadNotify";
import { setEnhancedConversionFromForm, trackKitchenFunnelLead } from "@/lib/gadsConversionService";
import { trackMetaLead } from "@/lib/metaPixelService";
import { buildSubmitBody, submitFunnelA, trackFunnelALead, type FunnelASubmitPayload } from "../api";
import { emptyFunnelAAnswers, type FunnelAAnswers } from "../catalog";
import {
  contactFieldError,
  emptyContact,
  sanitizeContact,
  validateContact,
  type FunnelAContact,
  type ValidContact,
} from "../validation";

vi.mock("@/features/marketplace/api-client", () => ({ callFunction: vi.fn() }));
vi.mock("@/lib/funnelLeadNotify", () => ({ notifyKitchenFunnelLead: vi.fn() }));
vi.mock("@/lib/gadsConversionService", () => ({
  generateTransactionId: vi.fn(() => "funnel_a_tx"),
  setEnhancedConversionFromForm: vi.fn(),
  trackKitchenFunnelLead: vi.fn(),
}));
vi.mock("@/lib/metaPixelService", () => ({ trackMetaLead: vi.fn() }));

function contact(patch: Partial<FunnelAContact> = {}): FunnelAContact {
  return { ...emptyContact(), first_name: "Maria", last_name: "Muster", email: "maria@beispiel.de", ...patch };
}

function valueOf(input: FunnelAContact): ValidContact {
  const result = validateContact(input);
  if (!result.ok) throw new Error(`Kontakt sollte gültig sein: ${JSON.stringify(result.errors)}`);
  return result.value;
}

function errorsOf(input: FunnelAContact) {
  const result = validateContact(input);
  if (result.ok) throw new Error("Kontakt sollte ungültig sein");
  return result.errors;
}

const INVALID_EMAIL = "Bitte geben Sie eine gültige E-Mail-Adresse an, z. B. name@beispiel.de.";
const INVALID_PHONE =
  "Bitte geben Sie eine gültige Telefonnummer mit Vorwahl an, z. B. 0511 123456 – oder lassen Sie das Feld leer.";

describe("validateContact", () => {
  it("akzeptiert die Pflichtangaben ohne Anrede und Telefon", () => {
    expect(valueOf(contact({ first_name: "  Maria ", email: " maria@beispiel.de ", marketing: true }))).toEqual({
      salutation: null,
      first_name: "Maria",
      last_name: "Muster",
      email: "maria@beispiel.de",
      phone: null,
      contact_by_phone: false,
      marketing: true,
    });
  });

  it("meldet fehlende Pflichtfelder mit deutschen Texten", () => {
    expect(errorsOf(emptyContact())).toEqual({
      first_name: "Bitte geben Sie Ihren Vornamen an.",
      last_name: "Bitte geben Sie Ihren Nachnamen an.",
      email: "Bitte geben Sie Ihre E-Mail-Adresse an.",
    });
    expect(errorsOf(contact({ last_name: "   " }))).toEqual({ last_name: "Bitte geben Sie Ihren Nachnamen an." });
  });

  it("begrenzt Namen auf 80 Zeichen", () => {
    expect(valueOf(contact({ first_name: "x".repeat(80) })).first_name).toHaveLength(80);
    expect(errorsOf(contact({ first_name: "x".repeat(81) })).first_name).toBe(
      "Der Vorname darf höchstens 80 Zeichen lang sein.",
    );
  });

  it.each(["maria", "maria@", "maria@beispiel", "maria@beispiel.d", "ma ria@beispiel.de"])(
    "lehnt die E-Mail-Adresse „%s“ ab",
    (email) => {
      expect(errorsOf(contact({ email })).email).toBe(INVALID_EMAIL);
    },
  );

  it("nimmt übliche E-Mail-Adressen an und begrenzt die Länge", () => {
    expect(valueOf(contact({ email: "maria.muster+kueche@beispiel.de" })).email).toBe("maria.muster+kueche@beispiel.de");
    expect(errorsOf(contact({ email: `${"a".repeat(245)}@beispiel.de` })).email).toBe("Diese E-Mail-Adresse ist zu lang.");
  });

  it.each(["0511 123456", "+49 511 123456", "0511/123-456", "+49 (0) 511 123456"])(
    "nimmt die Telefonnummer „%s“ an",
    (phone) => {
      expect(valueOf(contact({ phone })).phone).toBe(phone);
    },
  );

  it.each(["511 123456", "0511", "0511 12345a", "+49 1234 5678 9012 3456"])(
    "lehnt die Telefonnummer „%s“ ab",
    (phone) => {
      expect(errorsOf(contact({ phone })).phone).toBe(INVALID_PHONE);
    },
  );

  it("meldet pro Feld nur den ersten Fehler", () => {
    expect(errorsOf(contact({ phone: `0${"1".repeat(40)}` })).phone).toBe("Diese Telefonnummer ist zu lang.");
  });

  it("erlaubt Rückrufe nur mit Telefonnummer", () => {
    expect(valueOf(contact({ contact_by_phone: true })).contact_by_phone).toBe(false);
    expect(valueOf(contact({ phone: " 0511 123456 ", contact_by_phone: true, salutation: "Frau" }))).toMatchObject({
      salutation: "Frau",
      phone: "0511 123456",
      contact_by_phone: true,
    });
  });

  it("liefert Fehler einzelner Felder für die Prüfung beim Verlassen", () => {
    expect(contactFieldError(contact({ email: "maria@" }), "email")).toBe(INVALID_EMAIL);
    expect(contactFieldError(contact({ email: "maria@" }), "first_name")).toBeUndefined();
    expect(contactFieldError(contact(), "email")).toBeUndefined();
  });
});

describe("sanitizeContact", () => {
  it("startet bei unlesbaren Daten leer", () => {
    for (const input of [null, undefined, "Maria", 42, ["Maria"]]) {
      expect(sanitizeContact(input)).toEqual(emptyContact());
    }
  });

  it("übernimmt nur gültige Werte in erlaubter Länge", () => {
    expect(
      sanitizeContact({
        salutation: "Dr.",
        first_name: 42,
        last_name: "x".repeat(200),
        email: "maria@beispiel.de",
        contact_by_phone: "true",
        marketing: true,
      }),
    ).toEqual({ ...emptyContact(), last_name: "x".repeat(80), email: "maria@beispiel.de", marketing: true });
    expect(sanitizeContact({ salutation: "Divers" }).salutation).toBe("Divers");
  });
});

describe("Absenden an kw-lead", () => {
  const answers: FunnelAAnswers = {
    ...emptyFunnelAAnswers(),
    kitchen_form: "l",
    timeframe: "1-3",
    budget_eur: null,
    postal_code: "30159",
  };
  const valid: ValidContact = {
    salutation: "Frau",
    first_name: "Maria",
    last_name: "Muster",
    email: "maria@beispiel.de",
    phone: "0511 123456",
    contact_by_phone: true,
    marketing: false,
  };
  const payload: FunnelASubmitPayload = { answers, contact: valid, turnstileToken: "cf-token", website: "" };

  beforeEach(() => {
    window.history.replaceState(null, "", "/funnel/a/kontakt");
    vi.mocked(sessionStorage.getItem).mockImplementation((key) =>
      key === "kw_utm" ? JSON.stringify({ utm_source: "google", utm_campaign: "kueche" }) : null,
    );
  });

  it("baut genau den vereinbarten Body", () => {
    expect(buildSubmitBody(payload)).toStrictEqual({
      action: "submit",
      answers,
      contact: {
        salutation: "Frau",
        first_name: "Maria",
        last_name: "Muster",
        email: "maria@beispiel.de",
        phone: "0511 123456",
      },
      consents: { share_with_studios: true, contact_by_phone: true, marketing: false },
      turnstile_token: "cf-token",
      website: "",
      utm: { utm_source: "google", utm_campaign: "kueche" },
      landing_page: "/funnel/a/kontakt",
    });
  });

  it("meldet die Einstiegsseite der Sitzung statt des Kontaktschritts", () => {
    vi.mocked(sessionStorage.getItem).mockImplementation((key) => (key === "kw_entry_path" ? "/formular" : null));
    expect(buildSubmitBody(payload).landing_page).toBe("/formular");
  });

  it("überträgt fehlende Angaben als null", () => {
    const body = buildSubmitBody({
      ...payload,
      contact: { ...valid, salutation: null, phone: null, contact_by_phone: false },
      turnstileToken: null,
    });
    expect(body.contact).toStrictEqual({
      salutation: null,
      first_name: "Maria",
      last_name: "Muster",
      email: "maria@beispiel.de",
      phone: null,
    });
    expect(body.consents).toStrictEqual({ share_with_studios: true, contact_by_phone: false, marketing: false });
    expect(body.turnstile_token).toBeNull();
  });

  it("ruft kw-lead mit diesem Body auf", async () => {
    vi.mocked(callFunction).mockResolvedValueOnce({ ok: true, project_token: "tok", project_url: "/projekt/tok" });
    await expect(submitFunnelA(payload)).resolves.toMatchObject({ project_token: "tok" });
    expect(callFunction).toHaveBeenCalledWith("kw-lead", buildSubmitBody(payload));
  });

  it("meldet den Lead an Lead-Benachrichtigung, Ads und Meta", async () => {
    await trackFunnelALead({ ...valid, phone: null, contact_by_phone: false }, answers);
    expect(notifyKitchenFunnelLead).toHaveBeenCalledWith(
      expect.objectContaining({ funnel: "a", kitchenForm: "L-Küche", postalCode: "30159", transactionId: "funnel_a_tx" }),
    );
    expect(setEnhancedConversionFromForm).toHaveBeenCalledWith({
      email: "maria@beispiel.de",
      firstName: "Maria",
      lastName: "Muster",
      postalCode: "30159",
    });
    expect(trackKitchenFunnelLead).toHaveBeenCalledWith("a", "funnel_a_tx");
    expect(trackMetaLead).toHaveBeenCalledWith({ content_name: "Funnel A", content_category: "Küchenanfrage" });
  });

  it("blockiert die Weiterleitung nicht, wenn das Tracking scheitert", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(trackKitchenFunnelLead).mockRejectedValueOnce(new Error("gtag fehlt"));
    await expect(trackFunnelALead(valid, answers)).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
