// Public API for ratgeber data.
//
// IMPORTANT: this file must stay tiny. Do NOT add static `import` statements
// for any of the heavy ratgeber-<brand>.ts data files here — they should be
// reached only through the dynamic loader below so each brand/condition
// becomes its own lazy chunk (~7–10 KB gzipped instead of one 116 KB blob).
//
// The metadata used by the overview page and related-link rendering lives in
// ratgeber-meta.ts (auto-generated, ~5 KB gzipped).

import type { RatgeberConfig } from "./ratgeber-types";
import { ratgeberMeta, type RatgeberMeta } from "./ratgeber-meta";

export type { RatgeberConfig, RatgeberMeta };
export { ratgeberMeta };

// Vite turns each entry below into its own code-split chunk that is fetched
// only when a slug routed to that file is actually requested.
//
// IMPORTANT: this list MUST mirror every ratgeber-<group>.ts data file. Add
// a new entry here whenever a new data file is added.
const dataModules = import.meta.glob<Record<string, unknown>>([
  "./ratgeber-adria.ts",
  "./ratgeber-buerstner.ts",
  "./ratgeber-carado.ts",
  "./ratgeber-carthago.ts",
  "./ratgeber-chausson.ts",
  "./ratgeber-concorde.ts",
  "./ratgeber-dethleffs.ts",
  "./ratgeber-hobby.ts",
  "./ratgeber-hymer.ts",
  "./ratgeber-knaus.ts",
  "./ratgeber-laika.ts",
  "./ratgeber-poessl.ts",
  "./ratgeber-rapido.ts",
  "./ratgeber-sunlight.ts",
  "./ratgeber-weinsberg.ts",
  "./ratgeber-condition-damage.ts",
  "./ratgeber-condition-situation.ts",
]);

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
 * is unknown or the chunk fails to load. The returned promise resolves with
 * the cached chunk on subsequent calls — Vite memoises dynamic imports.
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
