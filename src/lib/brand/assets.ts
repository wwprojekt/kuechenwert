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
  /** Standard-Logo farbig auf hellem Hintergrund (SVG, vektorskaliert). */
  primary: "/logo.svg",
  /** HiDPI-Alias (SVG skaliert automatisch, identisch zu primary). */
  primary2x: "/logo.svg",
  /** Weisses Logo fuer dunklen Hintergrund (Teal-auf-Weiss-Variante). */
  white: "/logo-white.svg",
  /** E-Mail-Logo. SVG hat in manchen Clients (Outlook Desktop) keinen Support,
   *  daher bleibt bei E-Mails bis zur Bereitstellung eines PNG-Exports das
   *  Primary-Logo in Nutzung. */
  email: "/logo.svg",
  /** Favicon. SVG als Primary — moderne Browser (Chrome/FF/Safari) unterstuetzen
   *  SVG-Favicons seit 2020. Apple Touch Icon nutzt denselben Pfad. */
  faviconIco: "/favicon.svg",
  faviconPng: "/favicon.svg",
  /** Open-Graph-Sharing-Bild. Soziale Netze rendern KEIN SVG — daher Unsplash
   *  als interim Bild bis ein eigenes 1200x630-PNG gestaltet ist. */
  ogImage:
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=1200&h=630&q=80",
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
