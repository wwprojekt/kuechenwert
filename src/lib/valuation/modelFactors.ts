/**
 * Modell-Faktoren: feinere Wert-Kalibrierung innerhalb einer Marke.
 *
 * Ein Hymer B-Klasse MasterLine (Flaggschiff) und ein Hymer Free (Einstieg) landen
 * beim gleichen Marken-Tier, sind aber preislich sehr unterschiedlich. Dieses
 * Modul multipliziert den Marken-Tier-Wert mit einem Modell-spezifischen Faktor.
 *
 * Faktor = 1.0 = Standard (Marken-Tier unveraendert).
 * Faktor 1.15 = 15% Aufschlag (Flaggschiff).
 * Faktor 0.85 = 15% Abschlag (Einstiegsmodell).
 *
 * Die Liste ist bewusst kurz und auf die wichtigsten Modelle im deutschen Markt
 * beschraenkt. Unbekannte Modelle -> Faktor 1.0 (Marken-Tier allein entscheidet).
 *
 * Matching: case-insensitive, startsWith (damit "B-Klasse MasterLine 780" auf
 * "B-Klasse MasterLine" passt).
 */

export interface ModelFactor {
  manufacturer: string;
  modelPrefix: string;
  factor: number;
  /** Optionaler Hinweis fuer Admin-Dashboard. */
  note?: string;
}

export const MODEL_FACTORS: ModelFactor[] = [
  // ── Hymer Wohnmobil ─────────────────────────────────────────────────────
  { manufacturer: "Hymer", modelPrefix: "B-Klasse MasterLine", factor: 1.20, note: "Flaggschiff" },
  { manufacturer: "Hymer", modelPrefix: "B-Klasse ModernComfort", factor: 1.10 },
  { manufacturer: "Hymer", modelPrefix: "B-Klasse SL", factor: 1.05 },
  { manufacturer: "Hymer", modelPrefix: "B-Klasse White Line", factor: 0.95 },
  { manufacturer: "Hymer", modelPrefix: "ML-T", factor: 1.15, note: "Mercedes-basiert" },
  { manufacturer: "Hymer", modelPrefix: "Grand Canyon S", factor: 1.10 },
  { manufacturer: "Hymer", modelPrefix: "Exsis-i", factor: 1.05 },
  { manufacturer: "Hymer", modelPrefix: "Exsis-t", factor: 1.00 },
  { manufacturer: "Hymer", modelPrefix: "Free", factor: 0.75, note: "Einstiegsmodell" },
  { manufacturer: "Hymer", modelPrefix: "Venture S", factor: 0.85 },
  { manufacturer: "Hymer", modelPrefix: "Tramp", factor: 0.95 },

  // ── Carthago ────────────────────────────────────────────────────────────
  { manufacturer: "Carthago", modelPrefix: "liner-for-two", factor: 1.35 },
  { manufacturer: "Carthago", modelPrefix: "highliner", factor: 1.40 },
  { manufacturer: "Carthago", modelPrefix: "chic e-line", factor: 1.20 },
  { manufacturer: "Carthago", modelPrefix: "chic s-plus", factor: 1.15 },
  { manufacturer: "Carthago", modelPrefix: "chic c-line", factor: 1.05 },
  { manufacturer: "Carthago", modelPrefix: "c-tourer", factor: 1.00 },
  { manufacturer: "Carthago", modelPrefix: "c-compactline", factor: 0.90 },

  // ── Bürstner ────────────────────────────────────────────────────────────
  { manufacturer: "Bürstner", modelPrefix: "Signature", factor: 1.15 },
  { manufacturer: "Bürstner", modelPrefix: "Lyseo Gallery", factor: 1.10 },
  { manufacturer: "Bürstner", modelPrefix: "Lyseo Harmony", factor: 1.05 },
  { manufacturer: "Bürstner", modelPrefix: "Lyseo", factor: 1.00 },
  { manufacturer: "Bürstner", modelPrefix: "Ixeo", factor: 1.00 },
  { manufacturer: "Bürstner", modelPrefix: "Nexxo", factor: 0.92 },
  { manufacturer: "Bürstner", modelPrefix: "Campeo", factor: 0.90 },
  { manufacturer: "Bürstner", modelPrefix: "Copa", factor: 0.95 },

  // ── Dethleffs ───────────────────────────────────────────────────────────
  { manufacturer: "Dethleffs", modelPrefix: "Alpa", factor: 1.20 },
  { manufacturer: "Dethleffs", modelPrefix: "Esprit", factor: 1.10 },
  { manufacturer: "Dethleffs", modelPrefix: "Globetrotter", factor: 1.15 },
  { manufacturer: "Dethleffs", modelPrefix: "Trend", factor: 0.95 },
  { manufacturer: "Dethleffs", modelPrefix: "Advantage", factor: 0.90 },
  { manufacturer: "Dethleffs", modelPrefix: "Globebus", factor: 0.95 },
  { manufacturer: "Dethleffs", modelPrefix: "Globeline", factor: 0.92 },
  { manufacturer: "Dethleffs", modelPrefix: "Globevan", factor: 0.88 },
  { manufacturer: "Dethleffs", modelPrefix: "Pulse", factor: 1.00 },
  { manufacturer: "Dethleffs", modelPrefix: "c-joy", factor: 0.80 },
  { manufacturer: "Dethleffs", modelPrefix: "c-go", factor: 0.80 },
  { manufacturer: "Dethleffs", modelPrefix: "Just", factor: 0.85 },

  // ── Knaus ──────────────────────────────────────────────────────────────
  { manufacturer: "Knaus", modelPrefix: "Sun Liner", factor: 1.15 },
  { manufacturer: "Knaus", modelPrefix: "Sun I", factor: 1.10 },
  { manufacturer: "Knaus", modelPrefix: "Sun TI", factor: 1.00 },
  { manufacturer: "Knaus", modelPrefix: "Sky I", factor: 1.05 },
  { manufacturer: "Knaus", modelPrefix: "Sky TI", factor: 0.98 },
  { manufacturer: "Knaus", modelPrefix: "Van TI Plus", factor: 1.05 },
  { manufacturer: "Knaus", modelPrefix: "Van TI", factor: 0.95 },
  { manufacturer: "Knaus", modelPrefix: "L!VE", factor: 0.92 },
  { manufacturer: "Knaus", modelPrefix: "BoxStar", factor: 1.00 },
  { manufacturer: "Knaus", modelPrefix: "BoxLife", factor: 0.95 },
  { manufacturer: "Knaus", modelPrefix: "BoxDrive", factor: 1.05 },

  // ── Volkswagen Camper (sehr wertstabil) ────────────────────────────────
  { manufacturer: "Volkswagen", modelPrefix: "Grand California", factor: 1.25 },
  { manufacturer: "Volkswagen", modelPrefix: "California Ocean", factor: 1.20 },
  { manufacturer: "Volkswagen", modelPrefix: "California Coast", factor: 1.10 },
  { manufacturer: "Volkswagen", modelPrefix: "California Beach", factor: 1.05 },
  { manufacturer: "Volkswagen", modelPrefix: "California", factor: 1.15 },
  { manufacturer: "Volkswagen", modelPrefix: "Multivan", factor: 0.90 },
  { manufacturer: "Volkswagen", modelPrefix: "Caravelle", factor: 0.85 },

  // ── Pössl ──────────────────────────────────────────────────────────────
  { manufacturer: "Pössl", modelPrefix: "Summit Prime", factor: 1.10 },
  { manufacturer: "Pössl", modelPrefix: "Summit Shine", factor: 1.08 },
  { manufacturer: "Pössl", modelPrefix: "Summit", factor: 1.00 },
  { manufacturer: "Pössl", modelPrefix: "Roadcruiser", factor: 1.05 },
  { manufacturer: "Pössl", modelPrefix: "Roadcamp", factor: 0.95 },
  { manufacturer: "Pössl", modelPrefix: "2Win", factor: 0.90 },

  // ── Wohnwagen: Hobby ───────────────────────────────────────────────────
  { manufacturer: "Hobby", modelPrefix: "Prestige", factor: 1.15 },
  { manufacturer: "Hobby", modelPrefix: "Premium", factor: 1.10 },
  { manufacturer: "Hobby", modelPrefix: "Excellent", factor: 1.05 },
  { manufacturer: "Hobby", modelPrefix: "De Luxe", factor: 1.00 },
  { manufacturer: "Hobby", modelPrefix: "OnTour", factor: 0.90 },
  { manufacturer: "Hobby", modelPrefix: "Beachy", factor: 0.82 },

  // ── Wohnwagen: Fendt ───────────────────────────────────────────────────
  { manufacturer: "Fendt", modelPrefix: "Diamant", factor: 1.25 },
  { manufacturer: "Fendt", modelPrefix: "Saphir", factor: 1.15 },
  { manufacturer: "Fendt", modelPrefix: "Opal", factor: 1.10 },
  { manufacturer: "Fendt", modelPrefix: "Topas", factor: 1.05 },
  { manufacturer: "Fendt", modelPrefix: "Bianco Selection", factor: 1.00 },
  { manufacturer: "Fendt", modelPrefix: "Bianco", factor: 0.95 },
  { manufacturer: "Fendt", modelPrefix: "Apero", factor: 0.90 },

  // ── Wohnwagen: Tabbert ─────────────────────────────────────────────────
  { manufacturer: "Tabbert", modelPrefix: "DA VINCI", factor: 1.25 },
  { manufacturer: "Tabbert", modelPrefix: "ROSSINI", factor: 1.10 },
  { manufacturer: "Tabbert", modelPrefix: "VIVALDI", factor: 1.05 },
  { manufacturer: "Tabbert", modelPrefix: "PUCCINI", factor: 1.00 },
  { manufacturer: "Tabbert", modelPrefix: "PEP", factor: 0.95 },
];

/**
 * Liefert den Modell-Faktor. Matching ist case-insensitive und pruft ob der
 * Input-Modellname mit dem konfigurierten Prefix beginnt.
 * 1.0 = kein Match gefunden (= Marken-Tier allein entscheidet).
 */
export const getModelFactor = (
  manufacturer: string | undefined,
  model: string | undefined,
): number => {
  if (!manufacturer || !model) return 1.0;

  const manLower = manufacturer.trim().toLowerCase();
  const modLower = model.trim().toLowerCase();

  if (!modLower) return 1.0;

  let bestMatch: ModelFactor | null = null;
  let bestPrefixLength = 0;

  for (const mf of MODEL_FACTORS) {
    if (mf.manufacturer.toLowerCase() !== manLower) continue;
    const prefixLower = mf.modelPrefix.toLowerCase();
    if (modLower.startsWith(prefixLower)) {
      if (prefixLower.length > bestPrefixLength) {
        bestMatch = mf;
        bestPrefixLength = prefixLower.length;
      }
    }
  }

  return bestMatch?.factor ?? 1.0;
};
