import type { ReactNode } from "react";

/**
 * Arbeitsplatten-Piktogramme für Funnel A: Material-Muster als Linienzeichnung.
 *
 * Einheitlicher Stil:
 *  - viewBox 120 x 90 (passt zum 4:3-Kachelformat)
 *  - Farbe über currentColor, die Kachel setzt die Textfarbe
 *  - Füllflächen mit geringer Deckkraft statt fester Farben
 */

const SVG_PROPS = {
  viewBox: "0 0 120 90",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-full w-full",
  "aria-hidden": true,
};

const FILL_MAIN = 0.2;
const FILL_ACCENT = 0.35;

const WorktopHolz = () => (
  <svg {...SVG_PROPS}>
    <rect x="10" y="20" width="100" height="50" rx="4" fill="currentColor" fillOpacity={FILL_MAIN} />
    <path d="M15 32 Q40 28 65 32 T110 32" strokeWidth={1.8} />
    <path d="M15 44 Q40 41 65 44 T110 44" strokeWidth={1.8} />
    <path d="M15 56 Q40 52 65 56 T110 56" strokeWidth={1.8} />
  </svg>
);

const WorktopNaturstein = () => (
  <svg {...SVG_PROPS}>
    <rect x="10" y="20" width="100" height="50" rx="4" fill="currentColor" fillOpacity={FILL_MAIN} />
    <circle cx={28} cy={35} r={5} fill="currentColor" fillOpacity={FILL_ACCENT} stroke="none" />
    <circle cx={55} cy={52} r={7} fill="currentColor" fillOpacity={FILL_ACCENT} stroke="none" />
    <circle cx={85} cy={38} r={6} fill="currentColor" fillOpacity={FILL_ACCENT} stroke="none" />
    <circle cx={42} cy={60} r={4} fill="currentColor" fillOpacity={FILL_ACCENT} stroke="none" />
    <circle cx={95} cy={58} r={3} fill="currentColor" fillOpacity={FILL_ACCENT} stroke="none" />
    <circle cx={22} cy={55} r={2.5} fill="currentColor" fillOpacity={FILL_ACCENT} stroke="none" />
    <circle cx={70} cy={32} r={3.5} fill="currentColor" fillOpacity={FILL_ACCENT} stroke="none" />
  </svg>
);

const WorktopQuarz = () => (
  <svg {...SVG_PROPS}>
    <rect x="10" y="20" width="100" height="50" rx="4" fill="currentColor" fillOpacity={FILL_MAIN} />
    {Array.from({ length: 6 }).map((_, row) =>
      Array.from({ length: 12 }).map((_, col) => (
        <circle key={`${row}-${col}`} cx={17 + col * 8} cy={28 + row * 7} r={1} fill="currentColor" stroke="none" />
      )),
    )}
  </svg>
);

const WorktopKeramik = () => (
  <svg {...SVG_PROPS}>
    <rect x="10" y="20" width="100" height="50" rx="4" fill="currentColor" fillOpacity={FILL_MAIN} />
    <path d="M15 36 Q40 30 75 40 T108 34" strokeWidth={1.4} />
    <path d="M15 55 Q50 48 85 57" strokeWidth={1.4} />
  </svg>
);

const WorktopSchichtstoff = () => (
  <svg {...SVG_PROPS}>
    <rect x="10" y="20" width="100" height="50" rx="4" fill="currentColor" fillOpacity={FILL_MAIN} />
    {Array.from({ length: 5 }).map((_, i) => (
      <line key={`h-${i}`} x1={15} x2={107} y1={28 + i * 10} y2={28 + i * 10} strokeWidth={0.9} strokeOpacity={0.6} />
    ))}
    {Array.from({ length: 10 }).map((_, i) => (
      <line key={`v-${i}`} y1={25} y2={67} x1={20 + i * 10} x2={20 + i * 10} strokeWidth={0.9} strokeOpacity={0.6} />
    ))}
  </svg>
);

const WorktopUnsicher = () => (
  <svg {...SVG_PROPS}>
    <rect x="10" y="20" width="100" height="50" rx="4" fill="currentColor" fillOpacity={FILL_MAIN} />
    <path d="M52 35 a10 10 0 1 1 8 10 v4" />
    <circle cx={60} cy={57} r={2.2} fill="currentColor" stroke="none" />
  </svg>
);

export const WORKTOP_PICTOGRAMS: Record<string, ReactNode> = {
  holz: <WorktopHolz />,
  naturstein: <WorktopNaturstein />,
  quarz: <WorktopQuarz />,
  keramik: <WorktopKeramik />,
  schichtstoff: <WorktopSchichtstoff />,
  unsicher: <WorktopUnsicher />,
};

/** Hintergrund-Tönung je Material (warm, steinern, hell …). */
export const WORKTOP_TINTS: Record<string, string> = {
  holz: "bg-orange-50",
  naturstein: "bg-slate-100",
  quarz: "bg-neutral-50",
  keramik: "bg-zinc-100",
  schichtstoff: "bg-stone-100",
  unsicher: "bg-brand-50",
};
