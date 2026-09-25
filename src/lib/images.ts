/**
 * Zentrale Bild-URLs (Unsplash, alle CC0 / Unsplash-License = kommerziell nutzbar).
 * Optimiert via Unsplash-Image-CDN-Parameter (w=, q=, fm=webp).
 */

const u = (id: string, w = 1200, q = 75) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=${q}`;

export const KITCHEN_IMAGES = {
  // Hero: moderne, helle Kueche mit Insel + Holz-Akzent
  hero: u("1556909114-f6e7ad7d3136", 1400, 80),
  heroMobile: u("1556909114-f6e7ad7d3136", 720, 75),

  // 6 Kuechen-Stile fuer Auktions-Thumbnails (diverse Optik)
  modern: u("1556909212-d5b604d0c90d", 800),
  classic: u("1565538810643-b5bdb714032a", 800),
  lshape: u("1600585154340-be6161a56a0c", 800),
  island: u("1600566753190-17f0baa2a6c8", 800),
  black: u("1556911220-bff31c812dba", 800),
  scandi: u("1560448204-e02f11c3d0e2", 800),

  // CTA-Bottom-Background
  ctaBackground: u("1556909114-f6e7ad7d3136", 1600, 70),
};

/** Hero-Avatar-Foto (Pravatar = Unsplash-User-Pool, stabile Test-Avatars) */
export const AVATARS = {
  martin: "https://i.pravatar.cc/120?img=12",
  julia: "https://i.pravatar.cc/120?img=47",
  thomas: "https://i.pravatar.cc/120?img=33",
  anna: "https://i.pravatar.cc/120?img=44",
};

/** Mapping Kuechenform -> Thumbnail */
export function imageForKitchenForm(form: string | null): string {
  switch ((form ?? "").toLowerCase()) {
    case "l":
    case "l-form":
    case "l-kueche":
      return KITCHEN_IMAGES.lshape;
    case "u":
    case "u-form":
    case "u-kueche":
      return KITCHEN_IMAGES.classic;
    case "insel":
    case "kochinsel":
    case "kitchen-island":
      return KITCHEN_IMAGES.island;
    case "kuechenzeile":
    case "zeile":
      return KITCHEN_IMAGES.modern;
    default:
      return KITCHEN_IMAGES.modern;
  }
}
