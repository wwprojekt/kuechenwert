import { describe, expect, it } from "vitest";
import {
  formatIban,
  formatRegisterEntry,
  isValidIban,
  issuerProfile,
  missingIssuerFields,
} from "../../../../supabase/functions/_shared/issuer-profile.ts";

describe("formatRegisterEntry", () => {
  it.each([
    ["HRB 230114 Amtsgericht Hannover", "Amtsgericht Hannover, HRB 230114"],
    ["HRB 12345, Amtsgericht München", "Amtsgericht München, HRB 12345"],
    ["Amtsgericht Frankfurt am Main, HRB 987", "Amtsgericht Frankfurt am Main, HRB 987"],
    ["Amtsgericht Hannover HRB 230114", "Amtsgericht Hannover, HRB 230114"],
    ["hrb230114", "Amtsgericht Hannover, HRB 230114"],
    ["230114", "Amtsgericht Hannover, HRB 230114"],
    ["", "Amtsgericht Hannover, HRB 230114"],
  ])("%s", (raw, expected) => {
    expect(formatRegisterEntry(raw)).toBe(expected);
  });
});

describe("IBAN", () => {
  it("prüft die Prüfziffer", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("de89370400440532013000")).toBe(true);
    expect(isValidIban("DE89370400440532013001")).toBe(false);
    expect(isValidIban("DE89")).toBe(false);
  });

  it("gruppiert in Viererblöcken", () => {
    expect(formatIban("de89370400440532013000")).toBe("DE89 3704 0044 0532 0130 00");
  });
});

describe("issuerProfile", () => {
  it("nutzt die Pflichtangaben aus der Brand-Konfiguration als Rückfall", () => {
    const profile = issuerProfile(null);
    expect(profile.company).toBe("WohnWert GmbH");
    expect(profile.registerEntry).toBe("Amtsgericht Hannover, HRB 230114");
    expect(profile.vatId).toBe("DE462042479");
    expect(missingIssuerFields(profile)).toEqual(["Bankverbindung (IBAN)"]);
  });

  it("bevorzugt ausgefüllte Einstellungen", () => {
    const profile = issuerProfile({
      company_address: "Musterweg 1",
      company_city: "Hildesheim",
      bank_iban: "DE89 3704 0044 0532 0130 00",
      ust_id: "de 123456789",
      managing_director: "  Erika   Muster ",
    });
    expect(profile.street).toBe("Musterweg 1");
    expect(profile.city).toBe("Hildesheim");
    expect(profile.iban).toBe("DE89370400440532013000");
    expect(profile.vatId).toBe("DE123456789");
    expect(profile.managingDirector).toBe("Erika Muster");
    expect(missingIssuerFields(profile)).toEqual([]);
  });

  it("meldet eine IBAN mit falscher Prüfziffer", () => {
    expect(missingIssuerFields(issuerProfile({ bank_iban: "DE89370400440532013001" }))).toEqual([
      "gültige IBAN (Prüfziffer stimmt nicht)",
    ]);
  });
});
