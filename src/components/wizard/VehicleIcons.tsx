/**
 * Benutzerdefinierte SVG-Icons für Wohnmobil- und Wohnwagen-Aufbauarten.
 * Jedes Icon zeigt die charakteristische Silhouette der jeweiligen Aufbauart.
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { className?: string };

/** Teilintegriert: Flaches Fahrerhaus + kastenförmiger Aufbau dahinter */
export const TeilintegriertIcon = (props: IconProps) => (
  <svg viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M4 30 L4 16 L18 16 L20 10 L28 8 L56 8 L58 10 L60 12 L60 30"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
    {/* Fenster Fahrerhaus */}
    <rect x="8" y="18" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Fenster Aufbau */}
    <rect x="32" y="12" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <rect x="46" y="12" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Boden */}
    <line x1="2" y1="30" x2="62" y2="30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    {/* Räder */}
    <circle cx="14" cy="30" r="4.5" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="50" cy="30" r="4.5" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

/** Alkoven: Markanter Überhang über dem Fahrerhaus */
export const AlkovenIcon = (props: IconProps) => (
  <svg viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M4 30 L4 18 L18 18 L18 6 L58 6 L60 8 L60 30"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
    {/* Alkoven-Beule oben */}
    <path
      d="M10 18 L10 10 Q10 6 14 6 L18 6"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
    {/* Fenster Fahrerhaus */}
    <rect x="6" y="20" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Fenster Aufbau */}
    <rect x="28" y="10" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <rect x="44" y="10" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Boden */}
    <line x1="2" y1="30" x2="62" y2="30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    {/* Räder */}
    <circle cx="14" cy="30" r="4.5" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="50" cy="30" r="4.5" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

/** Vollintegriert: Durchgehende Karosserie, kein separates Fahrerhaus */
export const VollintegriertIcon = (props: IconProps) => (
  <svg viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M4 30 L4 8 Q4 6 6 6 L58 6 Q60 6 60 8 L60 30"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
    {/* Große Panorama-Windschutzscheibe */}
    <path
      d="M6 10 L6 20 L18 20 L18 10 Q18 8 16 8 L8 8 Q6 8 6 10Z"
      stroke="currentColor" strokeWidth="1.5" fill="none"
    />
    {/* Fenster Aufbau */}
    <rect x="26" y="10" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <rect x="40" y="10" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Tür */}
    <rect x="52" y="14" width="5" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Boden */}
    <line x1="2" y1="30" x2="62" y2="30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    {/* Räder */}
    <circle cx="14" cy="30" r="4.5" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="50" cy="30" r="4.5" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

/** Kastenwagen: Kompakter Van-Aufbau mit Hochdach */
export const KastenwagenIcon = (props: IconProps) => (
  <svg viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M6 30 L6 14 L16 14 L18 10 L24 8 L54 8 L56 10 L58 14 L58 30"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
    {/* Fenster Fahrerhaus */}
    <rect x="8" y="16" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Fenster hinten */}
    <rect x="38" y="12" width="7" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Schiebetür */}
    <rect x="24" y="12" width="8" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Boden */}
    <line x1="4" y1="30" x2="60" y2="30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    {/* Räder */}
    <circle cx="14" cy="30" r="4.5" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="50" cy="30" r="4.5" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

/** Campingbus: Kompakter Bus mit Aufstelldach */
export const CampingbusIcon = (props: IconProps) => (
  <svg viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d="M8 30 L8 16 L16 16 L18 12 L24 10 L52 10 L54 12 L56 16 L56 30"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
    {/* Aufstelldach (Pop-up roof) */}
    <path
      d="M22 10 L22 6 L50 6 L50 10"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
      strokeDasharray="3 2"
    />
    {/* Fenster Fahrerhaus */}
    <rect x="10" y="18" width="6" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Fenster Seite */}
    <rect x="26" y="14" width="10" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <rect x="40" y="14" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Boden */}
    <line x1="6" y1="30" x2="58" y2="30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    {/* Räder */}
    <circle cx="16" cy="30" r="4.5" stroke="currentColor" strokeWidth="2" fill="none" />
    <circle cx="48" cy="30" r="4.5" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

/** Wohnwagen: Klassischer Anhänger mit Deichsel */
export const WohnwagenIcon = (props: IconProps) => (
  <svg viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    {/* Karosserie */}
    <path
      d="M12 30 L12 8 Q12 6 14 6 L54 6 Q56 6 56 8 L56 30"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
    {/* Deichsel */}
    <path
      d="M12 26 L4 26 L2 28"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
    {/* Fenster */}
    <rect x="18" y="10" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <rect x="32" y="10" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Tür */}
    <rect x="46" y="12" width="6" height="14" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Boden */}
    <line x1="10" y1="30" x2="58" y2="30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    {/* Rad */}
    <circle cx="40" cy="30" r="4.5" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

/** Faltcaravan: Zusammenfaltbarer Anhänger */
export const FaltcaravanIcon = (props: IconProps) => (
  <svg viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    {/* Karosserie (niedrig, zusammengefaltet) */}
    <path
      d="M12 30 L12 16 L52 16 L52 30"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
    {/* Aufgeklapptes Dach (Zeltform) */}
    <path
      d="M12 16 L16 8 L48 8 L52 16"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
      strokeDasharray="3 2"
    />
    {/* Deichsel */}
    <path
      d="M12 24 L4 24 L2 26"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
    {/* Fenster */}
    <rect x="24" y="18" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Boden */}
    <line x1="10" y1="30" x2="54" y2="30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    {/* Rad */}
    <circle cx="32" cy="30" r="4.5" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

/** Mobilheim: Stationäres Wohnheim auf Rädern */
export const MobilheimIcon = (props: IconProps) => (
  <svg viewBox="0 0 64 40" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    {/* Karosserie (breit, hausförmig) */}
    <path
      d="M4 30 L4 14 L32 6 L60 14 L60 30"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
    />
    {/* Fenster links */}
    <rect x="10" y="16" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Tür Mitte */}
    <rect x="28" y="16" width="8" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Fenster rechts */}
    <rect x="46" y="16" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    {/* Boden */}
    <line x1="2" y1="30" x2="62" y2="30" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    {/* Stützen statt Räder */}
    <line x1="10" y1="30" x2="10" y2="34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <line x1="54" y1="30" x2="54" y2="34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
