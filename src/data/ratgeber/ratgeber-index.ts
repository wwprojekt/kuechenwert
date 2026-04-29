// Public API fuer Ratgeber-Daten.
//
// Die Caravanwert-Ratgeber (15 Brand-Files + 2 Condition-Files) wurden beim
// KuechenWert-Umbau entfernt. Dieses Modul bleibt als Loader-Geruest
// bestehen, damit /ratgeber/:slug → RatgeberTemplate spaeter einfach mit
// neuen Kuechen-Themen gefuettert werden kann (z.B. nobilia-kueche-planen,
// grifflose-kueche-2026, l-kueche-kosten).
//
// Um neuen Content zu registrieren:
//   1. src/data/ratgeber/ratgeber-<topic>.ts mit einem `RatgeberConfig`
//      Default-Export anlegen.
//   2. Einen entsprechenden Eintrag in `ratgeberMeta` (ratgeber-meta.ts)
//      ergaenzen, Feld `dataFile: "ratgeber-<topic>"`.
//   3. Den neuen Dateipfad unten in `dataModules` eintragen, damit Vite das
//      Modul in ein eigenes Chunk splitten kann.

import type { RatgeberConfig } from "./ratgeber-types";
import { ratgeberMeta, type RatgeberMeta } from "./ratgeber-meta";

export type { RatgeberConfig, RatgeberMeta };
export { ratgeberMeta };

// Derzeit leer — keine aktiven Ratgeber-Data-Files im Repo. Sobald
// ratgeber-<topic>.ts-Files existieren, hier als Glob-Pattern ergaenzen.
const dataModules = import.meta.glob<Record<string, unknown>>([]);

const slugToFile = new Map<string, string>();
for (const m of ratgeberMeta) {
  slugToFile.set(m.slug, `./${m.dataFile}.ts`);
}

function isRatgeberConfig(value: unknown, slug: string): value is RatgeberConfig {
  return (
    !!value &&
    typeof value === "object" &&
    "slug" in value &&
    (value as { slug: unknown }).slug === slug
  );
}

/**
 * Loads the full RatgeberConfig for a given slug. Returns null when the slug
 * is unknown or the chunk fails to load. Currently always returns null
 * because no Kuechen-Ratgeber data files exist yet.
 */
export async function loadRatgeberConfig(
  slug: string,
): Promise<RatgeberConfig | null> {
  const file = slugToFile.get(slug);
  if (!file) return null;
  const loader = dataModules[file];
  if (!loader) return null;
  const mod = await loader();
  for (const value of Object.values(mod)) {
    if (isRatgeberConfig(value, slug)) return value;
  }
  return null;
}

/**
 * Resolves a list of related slugs to their meta records (h1, path, etc.)
 * without triggering any dynamic chunk loads.
 */
export function findRatgeberMetaBySlugs(slugs: string[]): RatgeberMeta[] {
  if (slugs.length === 0) return [];
  return slugs
    .map((slug) => ratgeberMeta.find((m) => m.slug === slug))
    .filter((m): m is RatgeberMeta => Boolean(m));
}
