/**
 * Region aus den ersten beiden PLZ-Ziffern (Leitbereiche), z. B. „30“ → „Hannover“.
 * Eigenes Modul, damit Functions ohne den Funnel-A-Katalog es nutzen können.
 */

const PLZ2_REGIONS: Record<string, string> = {
  "01": "Dresden", "02": "Bautzen & Görlitz", "03": "Cottbus", "04": "Leipzig", "06": "Halle (Saale)",
  "07": "Gera & Jena", "08": "Zwickau & Plauen", "09": "Chemnitz",
  "10": "Berlin", "12": "Berlin", "13": "Berlin", "14": "Potsdam", "15": "Frankfurt (Oder)",
  "16": "Oranienburg & Eberswalde", "17": "Neubrandenburg & Greifswald", "18": "Rostock", "19": "Schwerin",
  "20": "Hamburg", "21": "Hamburg & Lüneburg", "22": "Hamburg", "23": "Lübeck", "24": "Kiel",
  "25": "Schleswig-Holstein West", "26": "Oldenburg & Ostfriesland", "27": "Bremerhaven & Cuxhaven",
  "28": "Bremen", "29": "Celle & Lüneburger Heide",
  "30": "Hannover", "31": "Hildesheim & Hameln", "32": "Herford & Minden", "33": "Bielefeld & Paderborn",
  "34": "Kassel", "35": "Gießen & Marburg", "36": "Fulda", "37": "Göttingen", "38": "Braunschweig",
  "39": "Magdeburg",
  "40": "Düsseldorf", "41": "Mönchengladbach & Neuss", "42": "Wuppertal & Solingen", "44": "Dortmund & Bochum",
  "45": "Essen", "46": "Oberhausen & Bottrop", "47": "Duisburg & Krefeld", "48": "Münster", "49": "Osnabrück",
  "50": "Köln", "51": "Köln & Bergisches Land", "52": "Aachen", "53": "Bonn", "54": "Trier", "55": "Mainz",
  "56": "Koblenz", "57": "Siegen", "58": "Hagen & Sauerland", "59": "Hamm & Soest",
  "60": "Frankfurt am Main", "61": "Taunus & Wetterau", "63": "Offenbach & Hanau", "64": "Darmstadt",
  "65": "Wiesbaden", "66": "Saarbrücken", "67": "Ludwigshafen & Kaiserslautern", "68": "Mannheim",
  "69": "Heidelberg",
  "70": "Stuttgart", "71": "Böblingen & Ludwigsburg", "72": "Tübingen & Reutlingen", "73": "Esslingen & Göppingen",
  "74": "Heilbronn", "75": "Pforzheim", "76": "Karlsruhe", "77": "Offenburg", "78": "Schwarzwald & Konstanz",
  "79": "Freiburg",
  "80": "München", "81": "München", "82": "München Umland", "83": "Rosenheim & Traunstein", "84": "Landshut",
  "85": "Ingolstadt & Freising", "86": "Augsburg", "87": "Allgäu", "88": "Bodensee & Oberschwaben", "89": "Ulm",
  "90": "Nürnberg", "91": "Erlangen & Ansbach", "92": "Amberg & Weiden", "93": "Regensburg", "94": "Passau",
  "95": "Bayreuth & Hof", "96": "Bamberg & Coburg", "97": "Würzburg", "98": "Suhl & Ilmenau", "99": "Erfurt",
};

/** Regionsname zum PLZ-Leitbereich, z. B. 30159 → „Hannover“. */
export function regionForPostalCode(plz: string): string | null {
  if (!/^\d{5}$/.test(plz)) return null;
  return PLZ2_REGIONS[plz.slice(0, 2)] ?? null;
}
