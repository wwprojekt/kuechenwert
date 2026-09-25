import { useMemo } from "react";
import type { RoomInput } from "../core";

export const DEPTH = 60;
export const ISLAND_DEPTH = 95;
export const AISLE = 120;

export interface Rect {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  vertical: boolean;
}

/** Schrankzeilen als Rechtecke in cm (Ursprung oben links, y nach unten). */
export function layoutRects(room: RoomInput): Rect[] {
  const w = (k: string) => Math.max(0, room.walls[k] ?? 0);
  const m = (cm: number) => `${(cm / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} m`;
  const rects: Rect[] = [];
  switch (room.form) {
    case "zeile":
      rects.push({ key: "a", x: 0, y: 0, w: w("a"), h: DEPTH, label: `A · ${m(w("a"))}`, vertical: false });
      break;
    case "parallel": {
      const width = Math.max(w("a"), w("b"));
      rects.push({ key: "a", x: 0, y: 0, w: w("a"), h: DEPTH, label: `A · ${m(w("a"))}`, vertical: false });
      rects.push({ key: "b", x: (width - w("b")) / 2, y: DEPTH + AISLE, w: w("b"), h: DEPTH, label: `B · ${m(w("b"))}`, vertical: false });
      break;
    }
    case "l":
      rects.push({ key: "a", x: 0, y: 0, w: w("a"), h: DEPTH, label: `A · ${m(w("a"))}`, vertical: false });
      rects.push({ key: "b", x: 0, y: DEPTH, w: DEPTH, h: Math.max(0, w("b") - DEPTH), label: `B · ${m(w("b"))}`, vertical: true });
      break;
    case "u":
    case "g": {
      const b = w("b");
      rects.push({ key: "a", x: 0, y: DEPTH, w: DEPTH, h: Math.max(0, w("a") - DEPTH), label: `A · ${m(w("a"))}`, vertical: true });
      rects.push({ key: "b", x: 0, y: 0, w: b, h: DEPTH, label: `B · ${m(b)}`, vertical: false });
      rects.push({ key: "c", x: b - DEPTH, y: DEPTH, w: DEPTH, h: Math.max(0, w("c") - DEPTH), label: `C · ${m(w("c"))}`, vertical: true });
      if (room.form === "g" && w("d") > 0) {
        const d = Math.min(w("d"), Math.max(0, b - 2 * DEPTH - 90));
        rects.push({ key: "d", x: b - DEPTH - d, y: w("c") - DEPTH, w: d, h: DEPTH, label: `Halbinsel · ${m(w("d"))}`, vertical: false });
      }
      break;
    }
    case "insel": {
      const a = w("a");
      const side = w("b");
      rects.push({ key: "a", x: 0, y: 0, w: a, h: DEPTH, label: `Rückwand · ${m(a)}`, vertical: false });
      if (side > 0) {
        rects.push({ key: "b", x: 0, y: DEPTH, w: DEPTH, h: Math.max(0, side - DEPTH), label: `B · ${m(side)}`, vertical: true });
      }
      const island = w("island");
      rects.push({ key: "island", x: Math.max(0, (a - island) / 2), y: DEPTH + AISLE, w: island, h: ISLAND_DEPTH, label: `Insel · ${m(island)}`, vertical: false });
      break;
    }
  }
  return rects.filter((r) => r.w > 0 && r.h > 0);
}

export function FloorPlanSketch({ room, className }: { room: RoomInput; className?: string }) {
  const rects = useMemo(() => layoutRects(room), [room]);
  const maxX = Math.max(1, ...rects.map((r) => r.x + r.w));
  const maxY = Math.max(1, ...rects.map((r) => r.y + r.h));
  const pad = 40;
  const vbW = maxX + pad * 2;
  const vbH = Math.max(maxY + AISLE, maxY) + pad * 2;
  const fontSize = Math.max(18, Math.min(34, vbW / 18));

  return (
    <svg
      viewBox={`${-pad} ${-pad} ${vbW} ${vbH}`}
      className={className}
      role="img"
      aria-label="Grundriss-Skizze Ihrer Küche"
    >
      <rect x={-pad / 2} y={-pad / 2} width={vbW - pad} height={vbH - pad} rx={12} className="fill-muted/40 stroke-border" strokeWidth={3} strokeDasharray="10 8" />
      {rects.map((r) => (
        <g key={r.key}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={6} className="fill-primary/15 stroke-primary" strokeWidth={4} />
          <text
            x={r.x + r.w / 2}
            y={r.y + r.h / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={fontSize}
            className="fill-foreground font-semibold"
            transform={r.vertical ? `rotate(-90 ${r.x + r.w / 2} ${r.y + r.h / 2})` : undefined}
          >
            {r.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
