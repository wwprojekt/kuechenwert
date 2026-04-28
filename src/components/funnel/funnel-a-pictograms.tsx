import type { ReactNode } from "react";

/**
 * Custom SVG-Pictogramme fuer Funnel A — KP-Style (kuechenportal.de).
 *
 * Einheitlicher Stil:
 *  - viewBox 120 x 90 (4:3-artig, passt zum Card-Aspect)
 *  - strokeWidth 3, strokeLinecap/Linejoin "round"
 *  - Farbe via currentColor (Parent-Card setzt text-brand-500)
 *  - Fuellung: brand-100-aehnliche helle Flaeche fuer Kontrast, oder fill="none"
 *
 * Ziel: konsistente Familie, die sich vom Foto-Chaos abhebt und das Quiz-Feeling
 * von Kuechenportal imitiert (dort sind alle Pictogramme gruene Outline-Figuren).
 */

const SVG_PROPS = {
  viewBox: "0 0 120 90",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-full w-full",
};

/** Zentrale Fill-Opacity fuer gefuellte Haupt-Flaechen (KP-Look). */
const FILL_MAIN = 0.2;
const FILL_ACCENT = 0.35;

/** Kreis fuer Kochstelle (fill) */
const Hob = ({ cx, cy, r = 4 }: { cx: number; cy: number; r?: number }) => (
  <circle cx={cx} cy={cy} r={r} fill="currentColor" />
);

// ==================================================================
// KUECHENFORM-PICTOGRAMME (Top-Down-Ansicht)
// ==================================================================

const KuechenformZeile = () => (
  <svg {...SVG_PROPS}>
    <rect x="10" y="35" width="100" height="22" rx="3" fill="currentColor" fillOpacity={FILL_MAIN} />
    <Hob cx={30} cy={46} />
    <Hob cx={42} cy={46} />
    <rect x="78" y="40" width="22" height="12" rx="2" fill="currentColor" fillOpacity={FILL_ACCENT} />
  </svg>
);

const KuechenformLForm = () => (
  <svg {...SVG_PROPS}>
    <path d="M10 30 h80 v40 h20" fill="currentColor" fillOpacity={FILL_MAIN} />
    <path d="M10 30 v22 h80 v-22" fill="none" />
    <path d="M10 30 h80 v40 h20" />
    <Hob cx={25} cy={41} />
    <Hob cx={37} cy={41} />
    <rect x="92" y="54" width="14" height="14" rx="2" fill="currentColor" fillOpacity={FILL_ACCENT} />
  </svg>
);

const KuechenformUForm = () => (
  <svg {...SVG_PROPS}>
    <path d="M15 22 h90 v48 h-22 v-26 h-46 v26 h-22 z" fill="currentColor" fillOpacity={FILL_MAIN} />
    <path d="M15 22 h90 v48 h-22 v-26 h-46 v26 h-22 z" />
    <Hob cx={54} cy={33} />
    <Hob cx={66} cy={33} />
    <rect x="20" y="50" width="14" height="14" rx="2" fill="currentColor" fillOpacity={FILL_ACCENT} />
  </svg>
);

const KuechenformZweizeilig = () => (
  <svg {...SVG_PROPS}>
    <rect x="10" y="18" width="100" height="18" rx="3" fill="currentColor" fillOpacity={FILL_MAIN} />
    <rect x="10" y="54" width="100" height="18" rx="3" fill="currentColor" fillOpacity={FILL_MAIN} />
    <Hob cx={30} cy={27} />
    <Hob cx={42} cy={27} />
    <rect x="75" y="58" width="22" height="10" rx="2" fill="currentColor" fillOpacity={FILL_ACCENT} />
  </svg>
);

const KuechenformKochinsel = () => (
  <svg {...SVG_PROPS}>
    <rect x="10" y="15" width="100" height="18" rx="3" fill="currentColor" fillOpacity={FILL_MAIN} />
    <rect x="35" y="55" width="50" height="22" rx="3" fill="currentColor" fillOpacity={FILL_MAIN} />
    <Hob cx={52} cy={66} />
    <Hob cx={68} cy={66} />
    <rect x="75" y="19" width="22" height="10" rx="2" fill="currentColor" fillOpacity={FILL_ACCENT} />
  </svg>
);

const KuechenformUnsicher = () => (
  <svg {...SVG_PROPS}>
    {/* Fragezeichen gross und zentriert */}
    <path d="M45 32 a15 15 0 1 1 15 15 v8" />
    <circle cx={60} cy={70} r={3} fill="currentColor" stroke="none" />
  </svg>
);

// ==================================================================
// STIL-PICTOGRAMME (Elevation-View)
// ==================================================================

const StilModern = () => (
  <svg {...SVG_PROPS}>
    <rect x="10" y="20" width="23" height="50" rx="2" fill="currentColor" fillOpacity={FILL_MAIN} />
    <rect x="36" y="20" width="23" height="50" rx="2" fill="currentColor" fillOpacity={FILL_MAIN} />
    <rect x="62" y="20" width="23" height="50" rx="2" fill="currentColor" fillOpacity={FILL_MAIN} />
    <rect x="88" y="20" width="23" height="50" rx="2" fill="currentColor" fillOpacity={FILL_MAIN} />
    <line x1="7" y1="18" x2="114" y2="18" strokeWidth={4.5} />
  </svg>
);

const StilLandhaus = () => (
  <svg {...SVG_PROPS}>
    {[10, 44, 78].map((x) => (
      <g key={x}>
        <rect x={x} y={22} width="27" height="48" rx="2" fill="currentColor" fillOpacity={FILL_MAIN} />
        <line x1={x + 13.5} y1={26} x2={x + 13.5} y2={66} strokeWidth={1.8} />
        <line x1={x + 3} y1={46} x2={x + 24} y2={46} strokeWidth={1.8} />
        <line x1={x + 5} y1={35} x2={x + 5} y2={41} strokeWidth={2.5} />
      </g>
    ))}
    <line x1="7" y1="20" x2="114" y2="20" strokeWidth={4.5} />
  </svg>
);

const StilKlassisch = () => (
  <svg {...SVG_PROPS}>
    {[10, 44, 78].map((x) => (
      <g key={x}>
        <rect x={x} y={22} width="27" height="48" rx="2" fill="currentColor" fillOpacity={FILL_MAIN} />
        <rect x={x + 4} y={27} width="19" height="18" rx="1" strokeWidth={1.8} fill="none" />
        <rect x={x + 4} y={49} width="19" height="16" rx="1" strokeWidth={1.8} fill="none" />
        <circle cx={x + 20} cy={46} r={1.8} fill="currentColor" stroke="none" />
      </g>
    ))}
    <line x1="7" y1="20" x2="114" y2="20" strokeWidth={4.5} />
  </svg>
);

const StilMinimalistisch = () => (
  <svg {...SVG_PROPS}>
    <rect x="10" y="22" width="100" height="48" rx="2" fill="currentColor" fillOpacity={FILL_MAIN} />
    <line x1="60" y1="22" x2="60" y2="70" strokeWidth={1.2} />
    <line x1="7" y1="20" x2="114" y2="20" strokeWidth={4.5} />
  </svg>
);

const StilIndustrial = () => (
  <svg {...SVG_PROPS}>
    {/* Offene Regalstruktur */}
    <line x1="10" y1="22" x2="110" y2="22" strokeWidth={2.8} />
    <line x1="10" y1="38" x2="110" y2="38" strokeWidth={2.8} />
    <line x1="10" y1="53" x2="110" y2="53" strokeWidth={2.8} />
    {/* Schrankfronten unten — gefuellt */}
    <rect x="10" y="53" width="32" height="17" rx="2" fill="currentColor" fillOpacity={FILL_MAIN} />
    <rect x="44" y="53" width="32" height="17" rx="2" fill="currentColor" fillOpacity={FILL_MAIN} />
    <rect x="78" y="53" width="32" height="17" rx="2" fill="currentColor" fillOpacity={FILL_MAIN} />
    {/* Deko-Objekte auf Regalen */}
    <circle cx={25} cy={30} r={3.5} fill="currentColor" fillOpacity={FILL_ACCENT} stroke="none" />
    <rect x={40} y={26} width={7} height={9} rx={1} fill="currentColor" fillOpacity={FILL_ACCENT} stroke="none" />
    <circle cx={62} cy={30} r={3} fill="currentColor" fillOpacity={FILL_ACCENT} stroke="none" />
    <rect x={80} y={44} width={9} height={7} rx={1} fill="currentColor" fillOpacity={FILL_ACCENT} stroke="none" />
  </svg>
);

const StilIndividuell = () => (
  <svg {...SVG_PROPS}>
    {/* Glatte Front */}
    <rect x="10" y="22" width="30" height="48" rx="2" fill="currentColor" fillOpacity={FILL_MAIN} />
    {/* Sprossen-Front */}
    <rect x="43" y="22" width="30" height="48" rx="2" fill="currentColor" fillOpacity={FILL_MAIN} />
    <line x1={58} y1={26} x2={58} y2={66} strokeWidth={1.8} />
    <line x1={47} y1={46} x2={69} y2={46} strokeWidth={1.8} />
    {/* Regal-Mix rechts */}
    <rect x={76} y={22} width={34} height={48} rx={1} fill="none" />
    <line x1={76} y1={38} x2={110} y2={38} strokeWidth={2.2} />
    <line x1={76} y1={54} x2={110} y2={54} strokeWidth={2.2} />
    <circle cx={87} cy={30} r={2.5} fill="currentColor" fillOpacity={FILL_ACCENT} stroke="none" />
    <rect x={97} y={27} width={7} height={7} rx={1} fill="currentColor" fillOpacity={FILL_ACCENT} stroke="none" />
    <line x1="7" y1="20" x2="114" y2="20" strokeWidth={4.5} />
  </svg>
);

// ==================================================================
// ARBEITSPLATTEN-PICTOGRAMME (Material-Swatch mit Pattern)
// ==================================================================

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
        <circle
          key={`${row}-${col}`}
          cx={17 + col * 8}
          cy={28 + row * 7}
          r={1}
          fill="currentColor"
          stroke="none"
        />
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
      <line
        key={`h-${i}`}
        x1={15}
        x2={107}
        y1={28 + i * 10}
        y2={28 + i * 10}
        strokeWidth={0.9}
        strokeOpacity={0.6}
      />
    ))}
    {Array.from({ length: 10 }).map((_, i) => (
      <line
        key={`v-${i}`}
        y1={25}
        y2={67}
        x1={20 + i * 10}
        x2={20 + i * 10}
        strokeWidth={0.9}
        strokeOpacity={0.6}
      />
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

// ==================================================================
// EXPORTS — Maps fuer Config
// ==================================================================

export const KITCHEN_FORM_PICTOGRAMS: Record<string, ReactNode> = {
  zeile: <KuechenformZeile />,
  "l-form": <KuechenformLForm />,
  "u-form": <KuechenformUForm />,
  zweizeilig: <KuechenformZweizeilig />,
  kochinsel: <KuechenformKochinsel />,
  unsicher: <KuechenformUnsicher />,
};

export const KITCHEN_STYLE_PICTOGRAMS: Record<string, ReactNode> = {
  modern: <StilModern />,
  landhaus: <StilLandhaus />,
  klassisch: <StilKlassisch />,
  minimalistisch: <StilMinimalistisch />,
  industrial: <StilIndustrial />,
  individuell: <StilIndividuell />,
};

export const WORKTOP_PICTOGRAMS: Record<string, ReactNode> = {
  holz: <WorktopHolz />,
  naturstein: <WorktopNaturstein />,
  quarz: <WorktopQuarz />,
  keramik: <WorktopKeramik />,
  schichtstoff: <WorktopSchichtstoff />,
  unsicher: <WorktopUnsicher />,
};
