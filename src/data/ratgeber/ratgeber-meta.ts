// Ratgeber-Meta (Übersichtsseite + related-Links).
//
// Neue Küchen-Ratgeber (z.B. "nobilia-kueche-planen", "l-kueche-kosten")
// werden hier eingetragen und als ratgeber-<topic>.ts Data-Files angelegt.

export interface RatgeberMeta {
  slug: string;
  path: string;
  h1: string;
  metaDescription: string;
  category: "brand" | "topic";
  brandName?: string;
  /** Filename (without extension) of the data file that owns the full config. */
  dataFile: string;
}

export const ratgeberMeta: RatgeberMeta[] = [];
