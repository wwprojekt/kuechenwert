/**
 * Baujahr-Plausibilitaet pro Modell.
 *
 * Verhindert dass User "Hymer B-Klasse MasterLine 1995" angibt (Modell gibts erst ab 2019).
 * Wenn ein Modell nicht in der Liste ist -> kein Check (nicht blockierend).
 * Wenn das Jahr ausserhalb der Range ist -> nicht-blockierende Warnung im UI und
 * Hinweis im KI-Prompt.
 *
 * Matching: case-insensitive, startsWith (wie modelFactors).
 */

export interface ModelYearRange {
  manufacturer: string;
  modelPrefix: string;
  firstYear: number;
  /** Nicht gesetzt = aktuelles Modell, noch in Produktion. */
  lastYear?: number;
}

export const MODEL_YEAR_RANGES: ModelYearRange[] = [
  // Hymer
  { manufacturer: "Hymer", modelPrefix: "B-Klasse MasterLine", firstYear: 2019 },
  { manufacturer: "Hymer", modelPrefix: "B-Klasse ModernComfort", firstYear: 2015 },
  { manufacturer: "Hymer", modelPrefix: "B-Klasse White Line", firstYear: 2016 },
  { manufacturer: "Hymer", modelPrefix: "B-Klasse SL", firstYear: 2010 },
  { manufacturer: "Hymer", modelPrefix: "Grand Canyon S", firstYear: 2018 },
  { manufacturer: "Hymer", modelPrefix: "Grand Canyon", firstYear: 2013 },
  { manufacturer: "Hymer", modelPrefix: "Exsis", firstYear: 2008 },
  { manufacturer: "Hymer", modelPrefix: "ML-T", firstYear: 2014 },
  { manufacturer: "Hymer", modelPrefix: "Free", firstYear: 2018 },
  { manufacturer: "Hymer", modelPrefix: "Venture S", firstYear: 2021 },

  // Carthago
  { manufacturer: "Carthago", modelPrefix: "liner-for-two", firstYear: 2018 },
  { manufacturer: "Carthago", modelPrefix: "highliner", firstYear: 2010 },
  { manufacturer: "Carthago", modelPrefix: "chic e-line", firstYear: 2008 },
  { manufacturer: "Carthago", modelPrefix: "chic s-plus", firstYear: 2012 },
  { manufacturer: "Carthago", modelPrefix: "chic c-line", firstYear: 2009 },
  { manufacturer: "Carthago", modelPrefix: "c-tourer", firstYear: 2013 },
  { manufacturer: "Carthago", modelPrefix: "c-compactline", firstYear: 2015 },

  // Bürstner
  { manufacturer: "Bürstner", modelPrefix: "Signature", firstYear: 2019 },
  { manufacturer: "Bürstner", modelPrefix: "Lyseo Gallery", firstYear: 2020 },
  { manufacturer: "Bürstner", modelPrefix: "Lyseo Harmony", firstYear: 2018 },
  { manufacturer: "Bürstner", modelPrefix: "Lyseo", firstYear: 2010 },
  { manufacturer: "Bürstner", modelPrefix: "Ixeo", firstYear: 2007 },
  { manufacturer: "Bürstner", modelPrefix: "Nexxo", firstYear: 2008 },
  { manufacturer: "Bürstner", modelPrefix: "Campeo", firstYear: 2019 },
  { manufacturer: "Bürstner", modelPrefix: "Copa", firstYear: 2016 },

  // Dethleffs
  { manufacturer: "Dethleffs", modelPrefix: "Alpa", firstYear: 2014 },
  { manufacturer: "Dethleffs", modelPrefix: "Esprit", firstYear: 2010 },
  { manufacturer: "Dethleffs", modelPrefix: "Globetrotter", firstYear: 2005 },
  { manufacturer: "Dethleffs", modelPrefix: "Globebus", firstYear: 2004 },
  { manufacturer: "Dethleffs", modelPrefix: "Globeline", firstYear: 2019 },
  { manufacturer: "Dethleffs", modelPrefix: "Globevan", firstYear: 2018 },
  { manufacturer: "Dethleffs", modelPrefix: "Pulse", firstYear: 2013 },
  { manufacturer: "Dethleffs", modelPrefix: "Advantage", firstYear: 2014 },
  { manufacturer: "Dethleffs", modelPrefix: "c-joy", firstYear: 2019 },
  { manufacturer: "Dethleffs", modelPrefix: "c-go", firstYear: 2021 },
  { manufacturer: "Dethleffs", modelPrefix: "Just", firstYear: 2021 },

  // Knaus
  { manufacturer: "Knaus", modelPrefix: "Sun Liner", firstYear: 2008 },
  { manufacturer: "Knaus", modelPrefix: "Sun I", firstYear: 2010 },
  { manufacturer: "Knaus", modelPrefix: "Sun TI", firstYear: 2010 },
  { manufacturer: "Knaus", modelPrefix: "Sky I", firstYear: 2011 },
  { manufacturer: "Knaus", modelPrefix: "Sky TI", firstYear: 2011 },
  { manufacturer: "Knaus", modelPrefix: "Van TI Plus", firstYear: 2019 },
  { manufacturer: "Knaus", modelPrefix: "Van TI", firstYear: 2013 },
  { manufacturer: "Knaus", modelPrefix: "L!VE", firstYear: 2018 },
  { manufacturer: "Knaus", modelPrefix: "BoxStar", firstYear: 2011 },
  { manufacturer: "Knaus", modelPrefix: "BoxLife", firstYear: 2018 },
  { manufacturer: "Knaus", modelPrefix: "BoxDrive", firstYear: 2019 },

  // Volkswagen
  { manufacturer: "Volkswagen", modelPrefix: "Grand California", firstYear: 2019 },
  { manufacturer: "Volkswagen", modelPrefix: "California Ocean", firstYear: 2015 },
  { manufacturer: "Volkswagen", modelPrefix: "California Coast", firstYear: 2015 },
  { manufacturer: "Volkswagen", modelPrefix: "California Beach", firstYear: 2015 },
  { manufacturer: "Volkswagen", modelPrefix: "California", firstYear: 1988 },
  { manufacturer: "Volkswagen", modelPrefix: "Transporter T6.1", firstYear: 2019 },
  { manufacturer: "Volkswagen", modelPrefix: "Transporter T6", firstYear: 2015, lastYear: 2019 },
  { manufacturer: "Volkswagen", modelPrefix: "Transporter T5", firstYear: 2003, lastYear: 2015 },
  { manufacturer: "Volkswagen", modelPrefix: "Transporter T4", firstYear: 1990, lastYear: 2003 },
  { manufacturer: "Volkswagen", modelPrefix: "T4 California", firstYear: 1990, lastYear: 2003 },
  { manufacturer: "Volkswagen", modelPrefix: "T5 California", firstYear: 2003, lastYear: 2015 },
  { manufacturer: "Volkswagen", modelPrefix: "T6 California", firstYear: 2015, lastYear: 2019 },
  { manufacturer: "Volkswagen", modelPrefix: "T6.1 California", firstYear: 2019 },
  { manufacturer: "Volkswagen", modelPrefix: "Multivan", firstYear: 2003 },
  { manufacturer: "Volkswagen", modelPrefix: "ID. Buzz", firstYear: 2022 },

  // Pössl
  { manufacturer: "Pössl", modelPrefix: "Summit Prime", firstYear: 2020 },
  { manufacturer: "Pössl", modelPrefix: "Summit Shine", firstYear: 2019 },
  { manufacturer: "Pössl", modelPrefix: "Summit", firstYear: 2015 },
  { manufacturer: "Pössl", modelPrefix: "Roadcruiser", firstYear: 2014 },
  { manufacturer: "Pössl", modelPrefix: "2Win", firstYear: 2013 },

  // Wohnwagen
  { manufacturer: "Hobby", modelPrefix: "Prestige", firstYear: 2010 },
  { manufacturer: "Hobby", modelPrefix: "Premium", firstYear: 2005 },
  { manufacturer: "Hobby", modelPrefix: "Excellent", firstYear: 2005 },
  { manufacturer: "Hobby", modelPrefix: "Beachy", firstYear: 2021 },
  { manufacturer: "Fendt", modelPrefix: "Apero", firstYear: 2019 },
  { manufacturer: "Fendt", modelPrefix: "Bianco", firstYear: 2000 },
  { manufacturer: "Tabbert", modelPrefix: "DA VINCI", firstYear: 2015 },
  { manufacturer: "Tabbert", modelPrefix: "ROSSINI", firstYear: 2010 },
];

export interface YearCheckResult {
  ok: boolean;
  firstYear?: number;
  lastYear?: number;
}

export const checkYearRange = (
  manufacturer: string | undefined,
  model: string | undefined,
  year: number | undefined,
): YearCheckResult => {
  if (!manufacturer || !model || !year) return { ok: true };

  const manLower = manufacturer.trim().toLowerCase();
  const modLower = model.trim().toLowerCase();
  if (!modLower) return { ok: true };

  let bestMatch: ModelYearRange | null = null;
  let bestPrefixLength = 0;
  for (const mr of MODEL_YEAR_RANGES) {
    if (mr.manufacturer.toLowerCase() !== manLower) continue;
    const prefixLower = mr.modelPrefix.toLowerCase();
    if (modLower.startsWith(prefixLower) && prefixLower.length > bestPrefixLength) {
      bestMatch = mr;
      bestPrefixLength = prefixLower.length;
    }
  }

  if (!bestMatch) return { ok: true };

  const afterStart = year >= bestMatch.firstYear;
  const beforeEnd = bestMatch.lastYear === undefined || year <= bestMatch.lastYear;
  return {
    ok: afterStart && beforeEnd,
    firstYear: bestMatch.firstYear,
    lastYear: bestMatch.lastYear,
  };
};
