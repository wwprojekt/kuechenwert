// Generiert von scripts/fingerprint-brand-assets.mjs, nicht von Hand bearbeiten.
//
// Brand-Bilder für Stellen außerhalb der Website (E-Mails, PDFs, Structured
// Data, Link-Vorschauen). Mail-Clients, Bild-Proxys und Messenger cachen ein
// Bild unter derselben URL dauerhaft und ignorieren Query-Strings teilweise;
// der Inhalts-Hash im Pfad gibt deshalb jeder Fassung eine eigene URL.

export const BRAND_ASSET_PATHS = {
  /** public/logo-email.png: Wortmarke hell für den dunkelgrünen E-Mail-Header. */
  email: "/brand/logo-email.d544ac2ab3.png",
  /** public/logo-2x.png: Wortmarke dunkel auf hell, doppelte Auflösung. */
  wordmark: "/brand/logo-2x.f220fbc807.png",
  /** public/logo-white.png: Wortmarke hell auf dunkel. */
  wordmarkWhite: "/brand/logo-white.f6a55bc170.png",
  /** public/logo.png: Quadratisches Logo für schema.org (Organization, Publisher). */
  logoSquare: "/brand/logo.7f518c9c3e.png",
  /** public/og-image.jpg: Open-Graph-Bild für Link-Vorschauen. */
  ogImage: "/brand/og-image.536b312637.jpg",
} as const;
