/**
 * Brand-Assets (Frontend)
 *
 * Zentrale Referenz fuer alle visuellen Brand-Assets.
 *
 * Logos, Favicons und das OG-Bild liegen in public/. Was ausserhalb der
 * Website angezeigt wird (E-Mail, Link-Vorschau, Structured Data), kommt mit
 * Inhalts-Hash im Pfad aus BRAND_ASSET_PATHS (scripts/fingerprint-brand-assets.mjs);
 * dieselbe Datei nutzen die Edge Functions fuer ihre Mails.
 *
 * Imports (statt statischer Strings) fuer Bilder im `src/assets`-Ordner,
 * damit Vite sie hashed und optimiert.
 */

import heroKitchen from "@/assets/hero-kitchen.webp";
import kitchenBefore from "@/assets/kitchen-before.webp";
import kitchenBefore800 from "@/assets/kitchen-before-800.webp";
import kitchenBefore1200 from "@/assets/kitchen-before-1200.webp";
import kitchenAfter from "@/assets/kitchen-after.webp";
import kitchenAfter800 from "@/assets/kitchen-after-800.webp";
import kitchenAfter1200 from "@/assets/kitchen-after-1200.webp";
import heroLifestyle from "@/assets/couple-kitchen.webp";
import studioConsultant from "@/assets/studio-consultant.webp";
import kitchenConsultation from "@/assets/kitchen-consultation.webp";
import kitchenShowroom from "@/assets/kitchen-showroom.webp";
import { BRAND_ASSET_PATHS } from "../../../supabase/functions/_shared/brand-assets.ts";
import { BRAND } from "./config";

/**
 * Logo-Pfade relativ zur Site-Root. Die SVG-Icons zeigt nur die Website
 * selbst, sie behalten ihren Dateinamen.
 */
export const BRAND_LOGOS = {
  /** Icon farbig (SVG, vektorskaliert). */
  primary: "/logo.svg",
  /** Wortmarke dunkel auf hell, 964×260. */
  primary2x: BRAND_ASSET_PATHS.wordmark,
  /** Icon hell fuer dunkle Hintergruende (SVG). */
  white: "/logo-white.svg",
  /** Wortmarke hell fuer den dunkelgruenen E-Mail-Header (PNG, Outlook-tauglich). */
  email: BRAND_ASSET_PATHS.email,
  faviconIco: "/favicon.ico",
  faviconPng: "/favicon.png",
  appleTouchIcon: "/apple-touch-icon.png",
  /** Open-Graph-Bild 1200×630 (JPEG; soziale Netze rendern kein SVG). */
  ogImage: BRAND_ASSET_PATHS.ogImage,
} as const;

/** Absolute URLs fuer Structured Data und Link-Vorschauen. */
export const BRAND_ASSET_URLS = {
  /** Quadratisches Logo 512×512 (schema.org Organization und Publisher). */
  logoSquare: `${BRAND.baseUrl}${BRAND_ASSET_PATHS.logoSquare}`,
  ogImage: `${BRAND.baseUrl}${BRAND_ASSET_PATHS.ogImage}`,
} as const;

/**
 * Hero- und Content-Bilder (src/assets via Vite-Imports).
 */
export const BRAND_IMAGES = {
  heroHome: heroKitchen,
  /** Echtes KI-Beispiel: Raumfoto vorher und Nano-Banana-Edit nachher. */
  kitchenBefore,
  kitchenAfter,
  /** Handys laden 800 bzw. 1200 px statt 1600 px (Startseiten-Hero, LCP). */
  kitchenBeforeSrcSet: `${kitchenBefore800} 800w, ${kitchenBefore1200} 1200w, ${kitchenBefore} 1600w`,
  kitchenAfterSrcSet: `${kitchenAfter800} 800w, ${kitchenAfter1200} 1200w, ${kitchenAfter} 1600w`,
  heroLifestyle,
  studioConsultant,
  kitchenConsultation,
  kitchenShowroom,
} as const;
