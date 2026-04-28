/**
 * Brand-Assets (Frontend)
 *
 * Zentrale Referenz fuer alle visuellen Brand-Assets.
 *
 * Logos + og-images liegen in public/ und werden ueber absolute Pfade
 * referenziert (damit sie auch in E-Mail-Templates funktionieren).
 *
 * Imports (statt statischer Strings) fuer Bilder im `src/assets`-Ordner,
 * damit Vite sie hashed und optimiert.
 *
 * Bei einem Rebrand (Phase 3) werden diese Pfade auf die neuen Asset-Dateien
 * umgebogen. Die Dateinamen in public/ koennen entweder ersetzt (gleiche
 * Dateinamen) oder durch neue Dateinamen ergaenzt werden; in letzterem Fall
 * muessen die Pfade hier angepasst werden.
 */

import heroKitchen from "@/assets/hero-kitchen.webp";
import heroLifestyle from "@/assets/happy-family.webp";
import dealerProfessional from "@/assets/dealer-professional.webp";
import handshakeDeal from "@/assets/handshake-deal.webp";
import kitchenInterior from "@/assets/kitchen-interior.webp";
import iconAuction from "@/assets/icon-auction.webp";
import iconInstantPrice from "@/assets/icon-instant-price.webp";
import iconStation from "@/assets/icon-station.webp";

/**
 * Statische Logo-Pfade (public/). Absolute Pfade, damit E-Mail-Templates
 * sie ueber die Base-URL einbinden koennen.
 */
export const BRAND_LOGOS = {
  /** Standard-Logo farbig auf hellem Hintergrund. */
  primary: "/logo.webp",
  /** Standard-Logo 2x fuer HiDPI. */
  primary2x: "/logo-2x.webp",
  /** Weisses Logo fuer dunklen Hintergrund. */
  white: "/logo-white.webp",
  /** PNG-Version fuer E-Mail-Templates (breiter Client-Support). */
  email: "/logo-email.png",
  /** Favicon (png + ico). */
  faviconIco: "/favicon.ico",
  faviconPng: "/favicon.png",
  /** Open-Graph-Sharing-Bild. */
  ogImage: "/og-image.webp",
} as const;

/**
 * Hero- und Content-Bilder (src/assets via Vite-Imports).
 */
export const BRAND_IMAGES = {
  heroHome: heroKitchen,
  heroLifestyle,
  dealerProfessional,
  handshakeDeal,
  kitchenInterior,
} as const;

/**
 * Icon-Illustrationen fuer Feature-Karten.
 */
export const BRAND_ICONS = {
  auction: iconAuction,
  instantPrice: iconInstantPrice,
  station: iconStation,
} as const;
