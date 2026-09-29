import { describe, expect, it } from "vitest";
import {
  classifyUploadError,
  clickConversion,
  googleAdsDateTime,
  normalizeEmail,
  normalizePhoneE164,
  retryDelayHours,
  sha256Hex,
} from "../../../supabase/functions/_shared/google-ads-conversions.ts";

const candidate = {
  orderId: "kw-inv-1",
  valueEur: 45.004,
  conversionAt: "2026-10-02T08:15:30.123Z",
  gclid: "Cj0KCQjw-gclid",
  gbraid: "gbraid-value",
  email: " Anna.Muster@GMail.com ",
  phone: "0171 2345678",
};

describe("Google-Ads-Offline-Conversions", () => {
  it("ordnet Google-Fehlercodes richtig ein", () => {
    expect(classifyUploadError("CLICK_CONVERSION_ALREADY_EXISTS")).toBe("done");
    expect(classifyUploadError("CONVERSION_ALREADY_RETRACTED")).toBe("done");
    expect(classifyUploadError("EXPIRED_EVENT")).toBe("final");
    expect(classifyUploadError("CONVERSION_EXPIRED")).toBe("final");
    expect(classifyUploadError("TOO_RECENT_CONVERSION_ACTION")).toBe("retry");
    expect(classifyUploadError("CLICK_NOT_FOUND")).toBe("retry");
  });

  it("wartet mit wachsendem Abstand, höchstens einen Tag", () => {
    expect([1, 2, 3, 4, 5, 6].map(retryDelayHours)).toEqual([2, 4, 8, 16, 24, 24]);
  });

  it("formatiert Zeitpunkte wie Google sie verlangt", () => {
    expect(googleAdsDateTime("2026-10-02T08:15:30.123Z")).toBe("2026-10-02 08:15:30+00:00");
  });

  it("normalisiert E-Mail und Telefon vor dem Hashen", () => {
    expect(normalizeEmail(" Anna.Muster@GMail.com ")).toBe("annamuster@gmail.com");
    expect(normalizeEmail("max.mustermann@web.de")).toBe("max.mustermann@web.de");
    expect(normalizeEmail("kein-at")).toBeNull();
    expect(normalizePhoneE164("0171 2345678")).toBe("+491712345678");
    expect(normalizePhoneE164("0049 30 1234567")).toBe("+49301234567");
    expect(normalizePhoneE164("12345")).toBeNull();
  });

  it("baut eine Conversion mit genau einer Klick-ID und Einwilligung", async () => {
    const conversion = await clickConversion(candidate, "customers/1/conversionActions/2", false);
    expect(conversion).toEqual({
      conversionAction: "customers/1/conversionActions/2",
      conversionDateTime: "2026-10-02 08:15:30+00:00",
      conversionValue: 45,
      currencyCode: "EUR",
      orderId: "kw-inv-1",
      gclid: "Cj0KCQjw-gclid",
      consent: { adUserData: "GRANTED", adPersonalization: "GRANTED" },
    });
  });

  it("hängt gehashte Kontaktdaten nur an, wenn Google sie annimmt", async () => {
    const conversion = await clickConversion({ ...candidate, gclid: null }, "a", true);
    expect(conversion?.gbraid).toBe("gbraid-value");
    expect(conversion?.gclid).toBeUndefined();
    expect(conversion?.userIdentifiers).toEqual([
      { hashedEmail: await sha256Hex("annamuster@gmail.com") },
      { hashedPhoneNumber: await sha256Hex("+491712345678") },
    ]);
  });

  it("meldet nichts ohne Klick-ID", async () => {
    expect(await clickConversion({ ...candidate, gclid: null, gbraid: null }, "a", true)).toBeNull();
  });
});
