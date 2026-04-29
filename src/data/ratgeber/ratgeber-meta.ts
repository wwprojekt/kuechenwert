// Ratgeber-Meta (Übersichtsseite + related-Links).
//
// Zuvor waren hier 88 Caravan-Eintraege (Hymer/Dethleffs/Buerstner … plus
// 13 Condition-Ratgeber). Alle wurden beim KuechenWert-Umbau entfernt, weil
// der Content inhaltlich auf Wohnmobil-Verkauf ausgerichtet war.
//
// Sobald Kuechen-Ratgeber geschrieben sind (z.B. "nobilia-kueche-planen",
// "grifflose-kueche-planen", "l-kueche-kosten"), werden sie hier eingetragen
// und als ratgeber-<topic>.ts Data-Files angelegt.

export interface RatgeberMeta {
  slug: string;
  path: string;
  h1: string;
  metaDescription: string;
  category: "brand" | "condition" | "topic";
  brandName?: string;
  /** Filename (without extension) of the data file that owns the full config. */
  dataFile: string;
}

export const ratgeberMeta: RatgeberMeta[] = [];
