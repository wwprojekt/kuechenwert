import { layoutRects } from "@/features/planner/components/FloorPlanSketch";
import { sanitizeRoom } from "@/features/planner/core";
import type { DealerProjectDetail } from "./dealer-api";

/**
 * Planungsbriefing für Küchenplanungs-Software.
 *
 * - JSON (Schema kuechenwert.planungsbriefing/1): vollständige Konfiguration,
 *   Maße, Schätzung und Medien-Links für Import-Skripte oder CRM.
 * - DXF (R12, Millimeter): Grundriss der Schrankzeilen mit Beschriftung. R12
 *   lesen CARAT, Winner Flex, KPS, pCon.planner und jedes CAD-Programm.
 */

export const BRIEFING_SCHEMA = "kuechenwert.planungsbriefing/1";

export function buildBriefing(detail: DealerProjectDetail, mediaUrls: Record<string, string>) {
  const s = detail.summary ?? {};
  return {
    schema: BRIEFING_SCHEMA,
    generated_at: new Date().toISOString(),
    project: {
      id: detail.auction_id,
      status: detail.status,
      source_funnel: detail.funnel_type,
      postal_prefix: detail.postal_prefix,
      region: detail.region,
      distance_km: detail.distance_km,
      timeframe_months: s.timeframe_months ?? null,
      housing_type: s.housing_type ?? null,
      offer_deadline: detail.ends_at,
    },
    room: s.room ?? null,
    layout_cm: s.layout ?? null,
    configuration: { labels: s.labels ?? null, raw: s.config ?? null },
    customer_wishes: s.wishes ?? null,
    estimate_eur: s.estimate ?? { min: detail.estimate_min_eur, max: detail.estimate_max_eur, mid: detail.reference_price_eur },
    media: detail.media.map((m) => ({ kind: m.kind, url: mediaUrls[m.path] ?? null, url_expires_in_s: 3600 })),
    contact: detail.contact ?? null,
    legacy_answers: s.answers ?? null,
  };
}

const num = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

function dxfLine(layer: string, x1: number, y1: number, x2: number, y2: number): string {
  return ["0", "LINE", "8", layer, "10", num(x1), "20", num(y1), "30", "0.0", "11", num(x2), "21", num(y2), "31", "0.0"].join("\n");
}

function dxfText(layer: string, x: number, y: number, height: number, text: string, rotation = 0): string {
  const safe = text.replace(/[\r\n]/g, " ").replace(/[^\x20-\x7E]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss", "·": "-" })[c] ?? "");
  return ["0", "TEXT", "8", layer, "10", num(x), "20", num(y), "30", "0.0", "40", num(height), "1", safe, "50", num(rotation)].join("\n");
}

/** DXF-R12-Grundriss (mm) der Schrankzeilen, y-Achse nach oben. */
export function buildFloorPlanDxf(detail: DealerProjectDetail): string | null {
  if (!detail.summary?.room?.form || !detail.summary.room.walls) return null;
  const room = sanitizeRoom(detail.summary.room);
  const rects = layoutRects(room);
  if (rects.length === 0) return null;
  const entities: string[] = [];
  for (const r of rects) {
    const x = r.x * 10;
    const y = -r.y * 10;
    const w = r.w * 10;
    const h = r.h * 10;
    entities.push(dxfLine("KUECHE", x, y, x + w, y), dxfLine("KUECHE", x + w, y, x + w, y - h), dxfLine("KUECHE", x + w, y - h, x, y - h), dxfLine("KUECHE", x, y - h, x, y));
    entities.push(dxfText("BESCHRIFTUNG", x + w / 2 - 300, y - h / 2, 80, r.label, r.vertical ? 90 : 0));
  }
  entities.push(dxfText("BESCHRIFTUNG", 0, 400, 100, `KuechenWert Projekt ${detail.auction_id.slice(0, 8)} - ${room.form} - Masse ca., bitte vor Ort aufmessen`));
  return [
    "0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "9", "$INSUNITS", "70", "4", "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    entities.join("\n"),
    "0", "ENDSEC", "0", "EOF",
  ].join("\n");
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
