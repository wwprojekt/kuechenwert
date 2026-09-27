import { describe, expect, it } from "vitest";
import { EMAIL_PREFERENCE_DEFAULTS, EMAIL_PREFERENCE_OPTIONS, resolveEmailPreferences, toEmailPreferenceRow } from "../email-preferences";

describe("resolveEmailPreferences", () => {
  it("ohne gespeicherte Zeile: Plattform-Hinweise an, Newsletter und Werbung aus", () => {
    expect(resolveEmailPreferences(null)).toEqual(EMAIL_PREFERENCE_DEFAULTS);
    expect(EMAIL_PREFERENCE_DEFAULTS).toEqual({ broadcast: true, newsletter: false, promotional: false });
  });

  it("wertet NULL-Spalten wie send-broadcast-email aus", () => {
    expect(resolveEmailPreferences({ broadcast_emails_enabled: null, newsletter_enabled: null, promotional_emails: null })).toEqual({
      broadcast: true,
      newsletter: false,
      promotional: false,
    });
  });

  it("übernimmt explizit gespeicherte Werte", () => {
    expect(resolveEmailPreferences({ broadcast_emails_enabled: false, newsletter_enabled: true, promotional_emails: true })).toEqual({
      broadcast: false,
      newsletter: true,
      promotional: true,
    });
  });
});

describe("toEmailPreferenceRow", () => {
  it("schreibt alle drei Einwilligungen explizit", () => {
    expect(toEmailPreferenceRow("u1", { broadcast: false, newsletter: false, promotional: false })).toEqual({
      user_id: "u1",
      broadcast_emails_enabled: false,
      newsletter_enabled: false,
      promotional_emails: false,
    });
  });

  it("ist die Umkehrung von resolveEmailPreferences", () => {
    const prefs = { broadcast: true, newsletter: true, promotional: false };
    expect(resolveEmailPreferences(toEmailPreferenceRow("u1", prefs))).toEqual(prefs);
  });
});

describe("EMAIL_PREFERENCE_OPTIONS", () => {
  it("bietet jeder Zielgruppe jede Einstellung genau einmal an", () => {
    for (const options of Object.values(EMAIL_PREFERENCE_OPTIONS)) {
      expect(options.map((o) => o.key).sort()).toEqual(["broadcast", "newsletter", "promotional"]);
    }
  });
});
