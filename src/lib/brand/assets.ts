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
import kitchenBefore from "@/assets/kitchen-before.webp";
import kitchenAfter from "@/assets/kitchen-after.webp";
import heroLifestyle from "@/assets/couple-kitchen.webp";
import studioConsultant from "@/assets/studio-consultant.webp";
import kitchenConsultation from "@/assets/kitchen-consultation.webp";
import kitchenShowroom from "@/assets/kitchen-showroom.webp";

/**
 * Statische Logo-Pfade (public/), relativ zur Site-Root. Rasterdateien
 * erzeugt scripts/generate-logo-assets.mjs aus den SVG-Quellen.
 */
export const BRAND_LOGOS = {
  /** Icon farbig (SVG, vektorskaliert). */
  primary: "/logo.svg",
  /** Wortmarke dunkel auf hell, 964×260. */
  primary2x: "/logo-2x.png",
  /** Icon hell fuer dunkle Hintergruende (SVG). */
  white: "/logo-white.svg",
  /** Wortmarke hell fuer den dunkelgruenen E-Mail-Header (PNG, Outlook-tauglich). */
  email: "/logo-email.png",
  faviconIco: "/favicon.ico",
  faviconPng: "/favicon.png",
  appleTouchIcon: "/apple-touch-icon.png",
  /** Open-Graph-Bild 1200×630 (JPEG; soziale Netze rendern kein SVG). */
  ogImage: "/og-image.jpg",
} as const;

/**
 * Hero- und Content-Bilder (src/assets via Vite-Imports).
 */
export const BRAND_IMAGES = {
  heroHome: heroKitchen,
  /** Echtes KI-Beispiel: Raumfoto vorher und Nano-Banana-Edit nachher. */
  kitchenBefore,
  kitchenAfter,
  heroLifestyle,
  studioConsultant,
  kitchenConsultation,
  kitchenShowroom,
} as const;
