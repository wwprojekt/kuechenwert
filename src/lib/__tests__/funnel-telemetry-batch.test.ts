import { describe, expect, it } from "vitest";
import {
  MAX_METADATA_KEYS,
  MAX_TELEMETRY_BATCH,
  MAX_TIME_ON_STEP_MS,
  parseTelemetryBatch,
  sanitizeTelemetryMetadata,
} from "../../../supabase/functions/_shared/funnel-telemetry.ts";

const SESSION = "5f0c7a52-0f4e-4c1e-9d6b-2f1d3c4b5a69";

const batch = (events: unknown[], extra: Record<string, unknown> = {}) => ({
  session_id: SESSION,
  funnel: "a",
  device_type: "mobile",
  viewport_width: 390.4,
  consent_id: "1727640000000-abc123def",
  events,
  ...extra,
});

describe("parseTelemetryBatch", () => {
  it("übernimmt gültige Ereignisse mit Gerät, Breite und Einwilligung", () => {
    const result = parseTelemetryBatch(
      batch([{ step: "raum", step_index: 1, event: "next_clicked", time_on_step_ms: 4200.6, metadata: { label: "Raum" } }]),
    );
    expect(result).toEqual({
      ok: true,
      skipped: 0,
      rows: [
        {
          session_id: SESSION,
          funnel: "a",
          step: "raum",
          step_index: 1,
          event: "next_clicked",
          field_name: null,
          error_fields: null,
          time_on_step_ms: 4201,
          device_type: "mobile",
          viewport_width: 390,
          consent_id: "1727640000000-abc123def",
          metadata: { label: "Raum" },
        },
      ],
    });
  });

  it("lehnt kaputte Batches ganz ab", () => {
    expect(parseTelemetryBatch(null)).toMatchObject({ ok: false });
    expect(parseTelemetryBatch(batch([], { session_id: "keine-uuid" }))).toMatchObject({ ok: false });
    expect(parseTelemetryBatch(batch([], { funnel: "x" }))).toMatchObject({ ok: false });
    expect(parseTelemetryBatch(batch([], { events: "nope" }))).toMatchObject({ ok: false });
    const tooMany = Array.from({ length: MAX_TELEMETRY_BATCH + 1 }, () => ({ step: "raum", step_index: 1, event: "idle" }));
    expect(parseTelemetryBatch(batch(tooMany))).toMatchObject({ ok: false });
  });

  it("überspringt unbekannte Ereignisse und ungültige Schritte", () => {
    const result = parseTelemetryBatch(
      batch([
        { step: "raum", step_index: 1, event: "keylogger" },
        { step: "Raum mit Leerzeichen", step_index: 1, event: "step_enter" },
        { step: "raum", step_index: 41, event: "step_enter" },
        { step: "raum", step_index: 1.5, event: "step_enter" },
        { step: "raum", step_index: 1, event: "step_enter" },
      ]),
    );
    expect(result.ok && result.rows.map((r) => r.event)).toEqual(["step_enter"]);
    expect(result.ok && result.skipped).toBe(4);
  });

  it("nimmt nur Feldschlüssel, nie Werte oder beliebige Zeichen", () => {
    const result = parseTelemetryBatch(
      batch([
        { step: "kontakt", step_index: 17, event: "field_focus", field_name: "max@example.org" },
        {
          step: "kontakt",
          step_index: 17,
          event: "validation_failed",
          error_fields: ["email", "email", "phone", "<script>", 42, ...Array.from({ length: 30 }, (_, i) => `f${i}`)],
        },
        { step: "kontakt", step_index: 17, event: "field_blur_empty", field_name: "wall-a" },
      ]),
    );
    if (!result.ok) throw new Error("erwartet ok");
    expect(result.rows[0]!.field_name).toBeNull();
    expect(result.rows[1]!.error_fields).toHaveLength(20);
    expect(result.rows[1]!.error_fields!.slice(0, 3)).toEqual(["email", "phone", "f0"]);
    expect(result.rows[2]!.field_name).toBe("wall-a");
  });

  it("begrenzt Verweildauer und verwirft unplausible Geräteangaben", () => {
    const result = parseTelemetryBatch(
      batch([{ step: "raum", step_index: 1, event: "leave", time_on_step_ms: 99 * MAX_TIME_ON_STEP_MS }], {
        device_type: "fernseher",
        viewport_width: -3,
        consent_id: "x",
      }),
    );
    if (!result.ok) throw new Error("erwartet ok");
    expect(result.rows[0]).toMatchObject({ time_on_step_ms: MAX_TIME_ON_STEP_MS, device_type: null, viewport_width: null, consent_id: null });
  });
});

describe("sanitizeTelemetryMetadata", () => {
  it("behält nur flache, kurze Werte mit sauberen Schlüsseln", () => {
    const meta = sanitizeTelemetryMetadata({
      label: "Raum & Foto",
      away_ms: 1800,
      checked: true,
      source: null,
      nested: { a: 1 },
      list: [1, 2],
      "Bad Key": "x",
      nan: Number.NaN,
      message: "x".repeat(500),
    });
    expect(meta).toEqual({ label: "Raum & Foto", away_ms: 1800, checked: true, source: null, message: "x".repeat(160) });
  });

  it("kappt die Anzahl der Schlüssel", () => {
    const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(sanitizeTelemetryMetadata(many) ?? {})).toHaveLength(MAX_METADATA_KEYS);
    expect(sanitizeTelemetryMetadata({})).toBeNull();
    expect(sanitizeTelemetryMetadata("text")).toBeNull();
  });
});
