/**
 * Google-Ads-Sollzustand für KüchenWert (Konto 760-376-7237): Such-Kampagnen,
 * Anzeigengruppen, Keywords, Anzeigen, Ausschlüsse und Assets.
 *
 * kw-google-ads (action "campaigns") gleicht das Konto mit diesem Plan ab:
 * Fehlendes wird angelegt (neue Kampagnen pausiert), Anzeigen mit anderem
 * Text werden ersetzt, Keywords, Ausschlüsse und Asset-Verknüpfungen, die hier
 * nicht (mehr) stehen, entfernt. Kampagnen und Anzeigengruppen werden über
 * ihren Namen gefunden und nie gelöscht: Namen nur hier ändern.
 *
 * Datengrundlage: Keyword-Planer (Deutschland, 29.09.2026). Anzeigentexte
 * sagen nur, was Landingpages und FAQ (src/data/faq.ts) belegen; keine
 * Markennamen Dritter in Anzeigentexten. Bilder liegen unter public/ads/
 * (ohne Text, Logos oder Collagen, wie Google es für Bild-Assets verlangt).
 *
 * Reines Datenmodul ohne Deno-APIs: src/lib/__tests__/google-ads-plan.test.ts
 * prüft es mit validatePlan() und die Bilddateien mit ihren Maßen.
 */

export type MatchType = "EXACT" | "PHRASE" | "BROAD";

export interface Keyword {
  text: string;
  match: MatchType;
}

export interface ResponsiveSearchAd {
  headlines: string[];
  descriptions: string[];
  path1?: string;
  path2?: string;
}

export interface AdGroupPlan {
  name: string;
  finalPath: string;
  keywords: Keyword[];
  ad: ResponsiveSearchAd;
}

export interface SitelinkPlan {
  key: string;
  text: string;
  description1: string;
  description2: string;
  path: string;
}

export interface ImagePlan {
  /** Datei unter public/ads/; zugleich Asset-Name „KüchenWert | <file>“ in Google Ads. */
  file: string;
  format: "landscape" | "square" | "logo";
}

export type Weekday = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

/**
 * Anruf-Asset ohne Conversion-Zählung: Anrufe erscheinen als eigene Kennzahl.
 * Eine telefonisch angelegte Anfrage trägt keine Klick-ID, ihr Umsatz lässt
 * sich keinem Klick zuordnen; primäres Ziel bleibt „Küchenanfrage“.
 */
export interface CallPlan {
  /** Nationale Schreibweise; das Land steht in countryCode. */
  phone: string;
  countryCode: string;
  days: Weekday[];
  startHour: number;
  endHour: number;
}

export type BiddingPlan =
  | { type: "MAXIMIZE_CONVERSIONS"; targetCpaEur?: number }
  | { type: "MAXIMIZE_CLICKS"; cpcCeilingEur: number }
  | { type: "TARGET_IMPRESSION_SHARE"; cpcCeilingEur: number; absoluteTopShare: number };

export interface CampaignPlan {
  key: string;
  name: string;
  /** Nur beim Anlegen; später über action "campaign-settings". */
  dailyBudgetEur: number;
  bidding: BiddingPlan;
  useSharedNegatives: boolean;
  /** In-Market-Segmente zur Beobachtung (schränkt die Reichweite nicht ein). */
  observeAudiences: boolean;
  negatives: Keyword[];
  sitelinks: string[];
  /** Ersetzen für diese Kampagne die Callouts auf Kontoebene. */
  callouts: string[];
  /** Dateien aus AccountPlan.images (Bild-Assets gibt es nur auf Kampagnen- oder Anzeigengruppenebene). */
  images: string[];
  adGroups: AdGroupPlan[];
}

export interface AccountPlan {
  site: string;
  allowedPaths: string[];
  geoTargetConstants: string[];
  languageConstants: string[];
  sharedNegativeList: { name: string; keywords: Keyword[] };
  audienceUserInterestIds: string[];
  /** Kontoebene: für Kampagnen ohne eigene Callouts. */
  callouts: string[];
  snippets: Array<{ header: string; values: string[] }>;
  sitelinks: SitelinkPlan[];
  businessName: string;
  logo: string;
  images: ImagePlan[];
  call: CallPlan;
  campaigns: CampaignPlan[];
}

const e = (text: string): Keyword => ({ text, match: "EXACT" });
const p = (text: string): Keyword => ({ text, match: "PHRASE" });
const b = (text: string): Keyword => ({ text, match: "BROAD" });
/** Exakt und passende Wortgruppe für dieselben Suchbegriffe. */
const ep = (...texts: string[]): Keyword[] => texts.flatMap((t) => [e(t), p(t)]);
const ps = (...texts: string[]): Keyword[] => texts.map(p);
const es = (...texts: string[]): Keyword[] => texts.map(e);
const bs = (...texts: string[]): Keyword[] => texts.map(b);

const OWN_BRAND = bs("küchenwert", "kuechenwert", "küchenwert24", "kuechenwert24");

/** Hersteller: in Planer und Kosten ausgeschlossen, in „Markenküchen“ gebucht. */
const MANUFACTURERS: Keyword[] = [
  ...bs("nobilia", "nolte", "häcker", "haecker", "schüller", "schueller", "bulthaup", "siematic", "ballerina"),
  ...bs("next125", "poggenpohl", "bauformat", "alno", "pino", "sachsenküchen", "rotpunkt", "pronorm"),
  ...ps("leicht küchen", "leicht küche", "burger küchen", "burger küche", "team 7", "express küchen", "impuls küchen"),
];

const SHARED_NEGATIVES: Keyword[] = [
  // Händler und Marktplätze (navigational, eigene Planer und Angebote)
  ...bs("ikea", "metod", "poco", "roller", "otto", "xxxlutz", "xxl", "lutz", "höffner", "hoeffner"),
  ...bs("segmüller", "segmueller", "porta", "mömax", "moemax", "momax", "möbelix", "obi", "hornbach", "bauhaus"),
  ...bs("toom", "hagebau", "lidl", "aldi", "kaufland", "amazon", "ebay", "kleinanzeigen", "wayfair", "home24"),
  ...bs("sconto", "hardeck", "biller", "plana", "küchenatlas", "küchentreff", "küchentester", "reddy", "tchibo"),
  ...bs("rieger", "weko", "ehrmann", "löchle", "respekta", "vicco", "kiveda", "küchenquelle", "preisbombe", "bombe"),
  ...ps("möbel boss", "mann mobilia", "möbel kraft", "möbel martin", "küchen aktuell", "küchen quelle"),
  // Studio- und Möbelhausketten (navigational; „küchenstudio marquardt“ allein 14.800 Suchen/Monat)
  ...bs("marquardt", "xxxl", "ostermann", "inhofer", "zurbrüggen", "hofmeister", "schulenburg", "dodenhof", "tejo"),
  ...bs("musterhaus", "pesch"),
  // Finanzierung (bieten wir nicht an)
  ...bs("finanzierung", "finanzieren", "ratenkauf"),
  ...ps("auf raten", "0 prozent"),
  // Jobs und Ausbildung
  ...bs("job", "jobs", "stellenangebot", "stellenangebote", "stellen", "gehalt", "verdienst", "ausbildung"),
  ...bs("weiterbildung", "umschulung", "beruf", "karriere", "bewerbung", "praktikum", "lehre", "quereinsteiger"),
  ...bs("minijob", "werden"),
  // Gebraucht, Selbstbau, Abverkauf, Billigware
  ...bs("gebraucht", "gebrauchte", "gebrauchten", "verschenken", "abzugeben", "diy", "bauanleitung", "paletten"),
  ...bs("restposten", "abverkauf", "ausstellungsküche", "ausstellungsküchen", "ausstellungsstück"),
  ...bs("ausstellungsstücke", "musterküche", "musterküchen", "werksverkauf", "b-ware", "billig", "billige"),
  ...ps("selber bauen", "selbst bauen", "b ware"),
  // Einzelteile, Möbelstücke und Geräte statt einer Küche
  ...bs("arbeitsplatte", "arbeitsplatten", "küchenarbeitsplatte", "rückwand", "küchenrückwand", "nischenrückwand"),
  ...bs("glasrückwand", "fronten", "küchenfronten", "griffe", "griff", "sockelblende", "scharnier", "scharniere"),
  ...bs("unterschrank", "unterschränke", "oberschrank", "oberschränke", "hängeschrank", "hochschrank"),
  ...bs("spülenunterschrank", "spüle", "armatur", "wasserhahn", "quooker", "spülmaschine", "geschirrspüler"),
  ...bs("kühlschrank", "gefrierschrank", "backofen", "kochfeld", "ceranfeld", "dunstabzugshaube", "dunstabzug"),
  ...bs("abzugshaube", "mikrowelle", "kaffeemaschine", "küchengeräte", "ersatzteile", "ersatzteil", "zubehör"),
  ...bs("küchenwagen", "küchentheke", "thekentisch", "bartresen", "bartheke", "barhocker", "stühle", "esstisch"),
  ...bs("esszimmer", "einzelteile", "leerblock", "küchenleerblock", "küchenblock"),
  // Mini-, Single-, Büro-, Camping-, Outdoor- und Spielküchen
  ...bs("singleküche", "miniküche", "pantry", "pantryküche", "büroküche", "teeküche", "kitchenette"),
  ...bs("campingküche", "camping", "wohnmobil", "wohnwagen", "boot", "gastro", "gastronomie", "gewerbeküche"),
  ...bs("großküche", "outdoor", "outdoorküche", "gartenküche", "sommerküche", "grill", "grillküche"),
  ...bs("kinderküche", "spielküche", "puppenküche", "spielzeug"),
  ...ps("mini küche", "single küche"),
  // Renovieren, Montage bestehender Küchen, Umzug, Reinigung, Deko
  ...bs("renovieren", "renovierung", "küchenrenovierung", "küchenumbau", "aufarbeiten", "folieren", "bekleben"),
  ...bs("lackieren", "streichen", "austauschen", "tauschen", "portas", "reparatur", "reparieren"),
  ...bs("küchenmontage", "monteur", "küchenmonteur", "montageanleitung", "aufbauanleitung", "aufbauservice"),
  ...bs("anleitung", "umzug", "abbauen", "abbau", "entsorgen", "entsorgung", "reinigen", "reinigung", "putzen"),
  ...bs("entkalken", "fliesen", "fliesenspiegel", "tapete", "tapezieren", "lampe", "lampen", "beleuchtung"),
  ...bs("deko", "dekoration", "gardinen"),
  ...ps("aufbau kosten", "aufbauen lassen", "einbauen lassen", "montage kosten"),
  // Verkauf, Ablöse, Wert, Steuern, Miete
  ...bs("verkaufen", "ablöse", "abloese", "zeitwert", "restwert", "wertverlust", "abschreibung", "absetzen"),
  ...bs("steuer", "steuerlich", "mietwohnung", "vermieter", "mieter", "mieten", "miete"),
  // Information, Medien, Spiele
  ...bs("rezept", "rezepte", "kochen", "wikipedia", "definition", "bedeutung", "synonym", "englisch"),
  ...bs("übersetzung", "bilder", "fotos", "pinterest", "wallpaper", "instagram", "youtube", "video", "film"),
  ...bs("serie", "spiel", "game", "sims", "minecraft", "lego", "playmobil", "pdf", "prospekt", "gutschein"),
  // Profi-Software
  ...bs("software", "download", "cad", "sketchup", "autocad", "freeware", "crack", "vollversion", "carat"),
  ...bs("winner", "pcon", "archicad", "revit"),
  ...ps("sweet home"),
];

const HEADLINE_FREE = "Kostenlos & unverbindlich";
const HEADLINE_BRAND_COMPARE = "KüchenWert – Küche vergleichen";
const HEADLINE_PLANNER_BRAND = "KüchenWert Küchenplaner";
const HEADLINE_CALCULATOR_BRAND = "KüchenWert KüchenRechner";
const OFFERS = "Angebote geprüfter Studios";

const ANGEBOTE: CampaignPlan = {
  key: "angebote",
  name: "Search | Küchenangebote | DE",
  dailyBudgetEur: 50,
  bidding: { type: "MAXIMIZE_CONVERSIONS" },
  useSharedNegatives: true,
  observeAudiences: true,
  negatives: [
    ...OWN_BRAND,
    ...bs("konfigurator", "konfigurieren", "3d", "kosten", "kostet", "rechner"),
    // Schnäppchensuche („günstige küche kaufen“ je 12.100/Monat) sucht Küchenzeilen, keine Studio-Angebote.
    ...bs("günstig", "günstige", "günstigen", "günstiges"),
  ],
  sitelinks: ["planer", "rechner", "unterbieten", "studios", "kontakt", "faq", "so-gehts", "ueber-uns"],
  callouts: [
    HEADLINE_FREE,
    "Geprüfte Küchenstudios",
    "Studios aus Ihrer Region",
    "Nach Preis sortiert",
    "Preise können nur sinken",
    "Anfrage in ca. 3 Minuten",
    "7 Tage Angebotsphase",
    "Ohne Namen an Studios",
    "Kein Kaufzwang",
    "Keine bezahlten Plätze",
  ],
  images: [
    "studio-beratung-quer.jpg",
    "planung-quer.jpg",
    "paar-kueche-quer.jpg",
    "kueche-insel-quer.jpg",
    "studio-beratung-quadrat.jpg",
    "planung-quadrat.jpg",
    "paar-kueche-quadrat.jpg",
    "kueche-insel-quadrat.jpg",
  ],
  adGroups: [
    {
      name: "Küchenangebote vergleichen",
      finalPath: "/formular",
      keywords: [
        ...ep("küchenangebote vergleichen", "küchenangebote", "küchen angebote"),
        ...es("küchenangebot"),
        ...ps(
          "küchenangebote einholen",
          "küche angebote einholen",
          "küchen angebote vergleichen",
          "einbauküche angebot",
          "einbauküchen angebote",
          "neue küche angebot",
          "angebote für küchen",
        ),
      ],
      ad: {
        headlines: [
          "Küchenangebote vergleichen",
          "Küchenangebote einholen",
          OFFERS,
          HEADLINE_FREE,
          "Küchenangebote aus der Region",
          "In ca. 3 Min. zur Anfrage",
          "Angebote werden nur günstiger",
          "Küchenpreise vergleichen",
          "7 Tage Angebote sammeln",
          "Einmal anfragen, vergleichen",
          "Nach Preis sortiert",
          "Ohne Namen an Studios",
          "Kein Kaufzwang",
          HEADLINE_BRAND_COMPARE,
          "Jetzt Küchenangebote holen",
        ],
        descriptions: [
          "Wunschküche in ca. 3 Minuten beschreiben – geprüfte Studios der Region senden Angebote.",
          "Küchenangebote vergleichen, kostenlos und unverbindlich – nach Preis sortiert.",
          "Ihr Projekt geht ohne Namen an geprüfte Studios. Abgegebene Angebote können nur sinken.",
          "Nicht jedes Studio einzeln anfragen: einmal beschreiben, 7 Tage lang Angebote erhalten.",
        ],
        path1: "angebote",
        path2: "vergleichen",
      },
    },
    {
      name: "Küchenpreise vergleichen",
      finalPath: "/formular",
      keywords: [
        ...ep("küchenpreise vergleichen", "küchen preise vergleichen", "küche preisvergleich", "preisvergleich küchen"),
        ...ep("küchen preisvergleich", "küchenvergleich", "küchen vergleich", "küchen vergleichen"),
        ...ps("einbauküche preisvergleich", "preisvergleich einbauküche"),
      ],
      ad: {
        headlines: [
          "Küchenpreise vergleichen",
          "Küchen-Preisvergleich",
          "Küchen vergleichen",
          "Einbauküche im Preisvergleich",
          OFFERS,
          HEADLINE_FREE,
          "Nach Preis sortiert",
          "Angebote werden nur günstiger",
          "Echte Studio-Angebote",
          "Einmal anfragen, vergleichen",
          "In ca. 3 Min. zur Anfrage",
          "Studios aus Ihrer Region",
          "Ohne Namen an Studios",
          "Kein Kaufzwang",
          HEADLINE_BRAND_COMPARE,
        ],
        descriptions: [
          "Küchenpreise vergleichen mit echten Angeboten geprüfter Studios aus Ihrer Region.",
          "Wunschküche in ca. 3 Min. beschreiben – 7 Tage lang Angebote, nach Preis sortiert.",
          "Abgegebene Angebote können nur sinken. Ihr Projekt geht ohne Namen an die Studios.",
          "Kostenlos und unverbindlich: Preise vergleichen, bestes Angebot wählen, kein Kaufzwang.",
        ],
        path1: "küchenpreise",
        path2: "vergleichen",
      },
    },
    {
      name: "Küche kaufen",
      finalPath: "/formular",
      keywords: [
        ...ep("küche kaufen", "küchen kaufen", "einbauküche kaufen", "neue küche kaufen", "küche nach maß"),
        ...es("neue küche"),
        ...ps(
          "küche mit elektrogeräten kaufen",
          "einbauküche mit elektrogeräten",
          "einbauküche mit geräten",
          "küche bestellen",
          "küche mit montage",
          "maßküche",
          "l küche kaufen",
          "u küche kaufen",
          "inselküche kaufen",
          "küche mit insel kaufen",
          "küche mit kochinsel kaufen",
          "landhausküche kaufen",
        ),
      ],
      ad: {
        headlines: [
          "Neue Küche kaufen",
          "Küche kaufen? Erst vergleichen",
          "Einbauküche vom Küchenstudio",
          OFFERS,
          HEADLINE_FREE,
          "Küche nach Maß vom Studio",
          "Einbauküche mit Geräten",
          "Studios aus Ihrer Region",
          "Angebote werden nur günstiger",
          "In ca. 3 Min. zur Anfrage",
          "L-, U- oder Inselküche",
          "Küchenpreise vergleichen",
          "Kein Kaufzwang",
          "Ohne Namen an Studios",
          HEADLINE_BRAND_COMPARE,
        ],
        descriptions: [
          "Vor dem Küchenkauf Angebote geprüfter Studios aus Ihrer Region kostenlos vergleichen.",
          "Neue Küche kaufen: Wunschküche in ca. 3 Min. beschreiben, Studios senden Angebote.",
          "Einbauküche mit oder ohne Geräte: Angebote nach Preis sortiert, ohne Kaufzwang.",
          "Ihr Projekt geht ohne Namen an Studios. Abgegebene Angebote können nur noch sinken.",
        ],
        path1: "küche",
        path2: "kaufen",
      },
    },
    {
      name: "Küchenstudio & Beratung",
      finalPath: "/formular",
      keywords: [
        ...ep(
          "küchenstudio",
          "küchenstudio in der nähe",
          "küchenbauer in der nähe",
          "küchen kaufen in der nähe",
          "küchenberatung",
          "küche planen lassen",
        ),
        ...es("küchenplanung zu hause", "küchenplaner in der nähe"),
        ...ps("küchenstudios", "küchenfachhändler", "küchenfachgeschäft", "küchenstudio in meiner nähe"),
        ...ps("küchenberatung kostenlos", "kostenlose küchenberatung"),
      ],
      ad: {
        headlines: [
          "Küchenstudios in Ihrer Region",
          "Küchenstudio in Ihrer Nähe",
          "Geprüfte Küchenstudios",
          "Beratung & Planung vom Studio",
          "Angebote mehrerer Studios",
          HEADLINE_FREE,
          "Küche planen lassen",
          "Einmal anfragen, vergleichen",
          "Studios vorab geprüft",
          "Ohne Namen an Studios",
          "Kein Kaufzwang",
          "Angebote werden nur günstiger",
          "In ca. 3 Min. zur Anfrage",
          "Nicht jedes Studio abklappern",
          "KüchenWert vermittelt Studios",
        ],
        descriptions: [
          "Geprüfte Küchenstudios aus Ihrer Region machen Ihnen Angebote – kostenlos & unverbindlich.",
          "Nicht jedes Küchenstudio einzeln anfragen: Wunschküche einmal beschreiben, vergleichen.",
          "Jedes Studio wird vor der Freischaltung manuell geprüft. Ihr Projekt geht ohne Namen raus.",
          "Bestes Angebot wählen, Aufmaß und Beratung mit dem Studio – erst danach unterschreiben.",
        ],
        path1: "küchenstudio",
        path2: "region",
      },
    },
    {
      name: "Markenküchen Preise",
      finalPath: "/formular",
      keywords: [
        // Exakt fängt umgestellte Wortfolgen („küche nobilia preise“) ab, die Wortgruppen nicht erreichen.
        ...es(
          "nobilia küchen preise",
          "nolte küchen preise",
          "häcker küchen preise",
          "schüller küchen preise",
          "bulthaup küchen preise",
          "küche nobilia preise",
          "preise nobilia küchen",
          "küche nolte preis",
          "preis nolte küche",
          "küche häcker preis",
          "küche schüller preis",
          "siematic küche preis",
          "nobilia küche angebot",
        ),
        ...ps(
        "nobilia küche preise",
        "nobilia küchen preise",
        "nobilia küche kaufen",
        "nobilia küchen angebote",
        "nobilia küchen in der nähe",
        "nobilia küchenstudio",
        "nolte küchen preise",
        "nolte küche preis",
        "nolte küche kaufen",
        "nolte küchen angebote",
        "häcker küchen preise",
        "häcker küche kaufen",
        "schüller küchen preise",
        "schüller küche kaufen",
        "bulthaup küchen preise",
        "leicht küchen preise",
        "siematic küchen preise",
        "ballerina küchen preise",
        "next125 küchen preise",
        "poggenpohl küche preis",
        "burger küchen preise",
        "bauformat küchen preise",
        ),
      ],
      ad: {
        headlines: [
          "Markenküchen im Vergleich",
          "Preise für Markenküchen",
          "Markenküche: Preis prüfen",
          OFFERS,
          HEADLINE_FREE,
          "Marke im Studio-Angebot",
          "Preise mehrerer Studios",
          "Angebote werden nur günstiger",
          "Einmal anfragen, vergleichen",
          "Kein Kaufzwang",
          "Ohne Namen an Studios",
          "Nach Preis sortiert",
          "Studios aus Ihrer Region",
          HEADLINE_BRAND_COMPARE,
          "In ca. 3 Min. zur Anfrage",
        ],
        descriptions: [
          "Was kostet Ihre Markenküche? Preise im Angebot geprüfter Studios kostenlos vergleichen.",
          "Welche Marken ein Studio anbietet, sehen Sie im Angebot. Nach Preis sortiert.",
          "Wunschküche in ca. 3 Minuten beschreiben – Studios aus Ihrer Region senden Angebote.",
          "Abgegebene Angebote können nur noch sinken. Ihr Projekt geht ohne Namen an die Studios.",
        ],
        path1: "markenküche",
        path2: "preise",
      },
    },
    {
      name: "Angebot unterbieten",
      finalPath: "/funnel/b",
      keywords: [
        ...ep("küchenangebot vergleichen", "küchenangebot prüfen"),
        ...ps(
          "küchenangebot zu teuer",
          "küche zu teuer",
          "küchenpreis verhandeln",
          "küche preis verhandeln",
          "küchen rabatt",
          "rabatt küchen",
          "rabatt auf küchen",
          "küchenstudio preise",
          "küchenangebot zweite meinung",
          "küchenangebot unterbieten",
          "küchenangebot günstiger",
          "zweites küchenangebot",
        ),
      ],
      ad: {
        headlines: [
          "Küchenangebot unterbieten",
          "Küchenangebot prüfen lassen",
          "Angebot 72 Std. unterbieten",
          "Schon ein Küchenangebot?",
          "Küchenangebot zu teuer?",
          "Studios können unterbieten",
          HEADLINE_FREE,
          "Angebot hochladen, abwarten",
          "Mit Angebots-Check am Telefon",
          "Geprüfte Studios der Region",
          "Anonym an andere Studios",
          "Bestes Angebot annehmen",
          "Zweites Angebot für Ihre Küche",
          "Kein Kaufzwang",
          "Gleiche Küche, besserer Preis?",
        ],
        descriptions: [
          "Küchenangebot hochladen: geprüfte Studios aus Ihrer Region können es 72 Std. unterbieten.",
          "Kurzer Angebots-Check am Telefon, dann geht Ihr Angebot ohne Namen an andere Studios.",
          "Günstigeres Angebot für dieselbe oder eine vergleichbare Ausstattung? Sie entscheiden.",
          "Bestes Angebot annehmen oder alle ablehnen – kein Kaufzwang, keine Kosten für Sie.",
        ],
        path1: "angebot",
        path2: "unterbieten",
      },
    },
  ],
};

const PLANER: CampaignPlan = {
  key: "planer",
  name: "Search | Küchenplaner | DE",
  dailyBudgetEur: 50,
  bidding: { type: "MAXIMIZE_CONVERSIONS" },
  useSharedNegatives: true,
  observeAudiences: true,
  negatives: [
    ...OWN_BRAND,
    ...MANUFACTURERS,
    ...bs("blum", "nähe", "lassen", "küchenstudio", "studio", "beratung", "termin", "kaufen", "angebot"),
    ...bs("angebote", "händler", "fachhändler", "küchenbauer", "kosten", "kostet", "rechner"),
    ...ps("in der nähe", "zu hause", "vor ort"),
  ],
  sitelinks: ["angebote", "rechner", "unterbieten", "studios", "kontakt", "faq", "so-gehts", "ueber-uns"],
  callouts: [
    HEADLINE_FREE,
    "KI-Bild im eigenen Raum",
    "Preisschätzung live",
    "Varianten per Klick",
    "Auch ohne Raumfoto",
    "6 Küchenformen",
    "Stil, Fronten & Geräte",
    "Budget im Blick",
    "Geprüfte Küchenstudios",
    "Kein Kaufzwang",
  ],
  images: [
    "ki-vorschau-quer.jpg",
    "kueche-insel-quer.jpg",
    "showroom-quer.jpg",
    "paar-kueche-quer.jpg",
    "ki-vorschau-quadrat.jpg",
    "kueche-insel-quadrat.jpg",
    "showroom-quadrat.jpg",
    "stil-dunkel-quadrat.jpg",
    "stil-industrial-quadrat.jpg",
  ],
  adGroups: [
    {
      name: "Küchenplaner online",
      finalPath: "/funnel/c",
      keywords: [
        ...ep("küchenplaner", "küchenplaner online", "küchenplanung online", "küchenkonfigurator", "küche konfigurieren"),
        ...es("küchen planer"),
        ...ps(
          "online küchenplaner",
          "küchen konfigurator",
          "küche online konfigurieren",
          "küchenplaner app",
          "3d küchenplaner",
          "küchenplaner 3d",
          "küche selbst zusammenstellen",
        ),
      ],
      ad: {
        headlines: [
          "Küchenplaner online",
          "Online-Küchenplaner mit KI",
          "Küchenkonfigurator mit KI",
          "Küche online konfigurieren",
          "Küche im eigenen Raum sehen",
          "Foto hochladen, Küche planen",
          "Preisschätzung live",
          "Fotorealistisch per KI",
          "Varianten mit einem Klick",
          HEADLINE_FREE,
          "Stil, Fronten, Geräte wählen",
          "Auch ohne Raumfoto",
          OFFERS,
          HEADLINE_PLANNER_BRAND,
          "Jetzt Küche online planen",
        ],
        descriptions: [
          "Küchenplaner online: Raumfoto hochladen, Küche konfigurieren und per KI im Raum sehen.",
          "Küchenkonfigurator mit Preisschätzung, die sich bei jeder Auswahl anpasst. Kostenlos.",
          "Wände, Fenster und Boden bleiben erhalten – die KI setzt Ihre Wunschküche in Ihr Foto.",
          "Auf Wunsch Angebote geprüfter Studios aus Ihrer Region. Unverbindlich, kein Kaufzwang.",
        ],
        path1: "küchenplaner",
        path2: "ki",
      },
    },
    {
      name: "Küche planen",
      finalPath: "/funnel/c",
      keywords: [
        ...ep("küche planen", "küche online planen"),
        ...es("küchen planung", "online küche planen", "küchenplanung"),
        ...ps(
          "küche planen online",
          "küche selbst planen",
          "küche selber planen",
          "neue küche planen",
          "einbauküche planen",
          "küche gestalten",
          "küche designen",
          "küche erstellen",
          "küche neu planen",
        ),
      ],
      ad: {
        headlines: [
          "Küche online planen",
          "Küche planen mit KI",
          "Neue Küche selbst planen",
          "Küchenplanung online",
          "Einbauküche planen & sehen",
          "Küche im eigenen Raum sehen",
          "Foto hochladen, Küche planen",
          "Preisschätzung live",
          HEADLINE_FREE,
          "Fotorealistisch per KI",
          "Varianten mit einem Klick",
          OFFERS,
          "Auch ohne Raumfoto",
          "Stil, Fronten, Geräte wählen",
          HEADLINE_PLANNER_BRAND,
        ],
        descriptions: [
          "Küche online planen und im Raum sehen: Foto hochladen, Stil wählen, KI-Bild erhalten.",
          "Preisschätzung aus Laufmetern, Fronten und Geräten – live bei jeder Auswahl. Kostenlos.",
          "Küche selbst planen, dann auf Wunsch Angebote geprüfter Studios aus Ihrer Region erhalten.",
          "Wände, Fenster und Boden bleiben erhalten, nur die Küche ist neu. Varianten per Klick.",
        ],
        path1: "küche",
        path2: "planen",
      },
    },
    {
      name: "Küchenplaner kostenlos",
      finalPath: "/funnel/c",
      keywords: [
        ...ep("küchenplaner kostenlos"),
        ...ps(
          "kostenloser küchenplaner",
          "küchenplaner online kostenlos",
          "online küchenplaner kostenlos",
          "küchenplanung kostenlos",
          "küchenplanung online kostenlos",
          "küche planen kostenlos",
          "küche kostenlos planen",
          "küche online planen kostenlos",
          "3d küchenplaner kostenlos",
          "küchenplaner app kostenlos",
        ),
      ],
      ad: {
        headlines: [
          "Küchenplaner kostenlos",
          "Kostenloser KI-Küchenplaner",
          "Küche kostenlos planen",
          "Küchenplanung kostenlos",
          "Komplett kostenlos für Sie",
          "Küche im eigenen Raum sehen",
          "Foto hochladen, Küche planen",
          "Preisschätzung live",
          "Fotorealistisch per KI",
          "Ohne versteckte Gebühren",
          "Varianten mit einem Klick",
          "Stil, Fronten, Geräte wählen",
          "Auch ohne Raumfoto",
          OFFERS,
          HEADLINE_PLANNER_BRAND,
        ],
        descriptions: [
          "Kostenloser Küchenplaner mit KI: Raumfoto hochladen und Ihre neue Küche darin sehen.",
          "Konfigurator, KI-Visualisierung und Preisschätzung sind für Sie komplett kostenlos.",
          "Küche kostenlos planen: Stil, Fronten, Arbeitsplatte und Geräte wählen, Preis live sehen.",
          "Auf Wunsch Angebote geprüfter Studios aus Ihrer Region. Unverbindlich, kein Kaufzwang.",
        ],
        path1: "küchenplaner",
        path2: "kostenlos",
      },
    },
    {
      name: "Küche planen mit Preis",
      finalPath: "/funnel/c",
      keywords: [
        ...ep("küche online planen mit preis", "küchenplaner mit preis", "küchenkonfigurator mit preis"),
        ...ps(
          "küche planen online mit preis",
          "küche planen mit preis",
          "küche günstig planen",
          "küche planen günstig",
          "günstige küche planen",
          "küchenplaner preis",
          "küche konfigurieren preis",
          "küchen konfigurator mit preis",
          "küchenplaner mit preisberechnung",
          "küchenplanung mit preis",
        ),
      ],
      ad: {
        headlines: [
          "Küche planen mit Preis",
          "Küchenplaner mit Preis",
          "Küchenkonfigurator mit Preis",
          "Preisschätzung live",
          "Preis bei jeder Auswahl",
          "Budget im Blick behalten",
          "Küche im eigenen Raum sehen",
          "Foto hochladen, Küche planen",
          HEADLINE_FREE,
          "Mit regionalem Preisfaktor",
          "Lieferung & Montage wählbar",
          "Preis mit Einzelpositionen",
          OFFERS,
          "Fotorealistisch per KI",
          HEADLINE_PLANNER_BRAND,
        ],
        descriptions: [
          "Küche online planen mit Preis: sofort sehen, was sie etwa kostet – mit regionalem Faktor.",
          "Die Schätzung passt sich bei jeder Auswahl an: Fronten, Arbeitsplatte, Geräte, Montage.",
          "Per KI sehen, wie die Küche in Ihrem Raum aussieht. Kostenlos und unverbindlich.",
          "Auf Wunsch machen geprüfte Studios Angebote – verbindlich erst nach dem Aufmaß vor Ort.",
        ],
        path1: "küche-planen",
        path2: "preis",
      },
    },
    {
      name: "Küchenformen planen",
      finalPath: "/funnel/c",
      keywords: [
        ...es(
          "küche l form",
          "l küche",
          "küche u form",
          "küche mit insel",
          "küche mit kochinsel",
          "inselküche",
          "zweizeilige küche",
          "küche g form",
          "eckküche",
          "winkelküche",
        ),
        ...ps(
          "l küche planen",
          "u küche planen",
          "küche mit insel planen",
          "inselküche planen",
          "küche mit kochinsel planen",
          "küchenzeile planen",
          "zweizeilige küche planen",
          "g küche planen",
          "küche l form planen",
          "küche u form planen",
          "eckküche planen",
        ),
      ],
      ad: {
        headlines: [
          "L-, U- oder Inselküche planen",
          "L-Küche planen",
          "U-Küche planen",
          "Küche mit Insel planen",
          "Küchenform im Raum testen",
          "Kochinsel oder Küchenzeile?",
          "Küche im eigenen Raum sehen",
          "Foto hochladen, Form wählen",
          "Preisschätzung live",
          "6 Küchenformen zur Auswahl",
          "Fotorealistisch per KI",
          HEADLINE_FREE,
          "Wandmaße angeben, planen",
          OFFERS,
          HEADLINE_PLANNER_BRAND,
        ],
        descriptions: [
          "L-Küche, U-Küche, G-Küche, Zeile oder Kochinsel: Form wählen und per KI im Raum sehen.",
          "Raumfoto hochladen, Wandmaße angeben – die KI zeigt Ihre neue Küche fotorealistisch.",
          "Inselküche oder Eckküche planen, mit Preisschätzung bei jeder Auswahl. Kostenlos.",
          "Auf Wunsch Angebote geprüfter Küchenstudios aus Ihrer Region. Kein Kaufzwang.",
        ],
        path1: "küchenform",
        path2: "planen",
      },
    },
    {
      name: "KI-Visualisierung",
      finalPath: "/funnel/c",
      keywords: [
        ...ep("ki küchenplaner", "küche visualisieren"),
        ...es("traumküche"),
        ...ps(
          "küchenplaner mit ki",
          "küchenplaner ki",
          "küche mit ki planen",
          "küche mit foto planen",
          "küche im raum visualisieren",
          "traumküche planen",
          "küchendesign ki",
        ),
      ],
      ad: {
        headlines: [
          "KI-Küchenplaner",
          "Küche per KI visualisieren",
          "Traumküche im eigenen Raum",
          "Küchenplaner mit KI",
          "Traumküche planen mit KI",
          "Foto hochladen, KI-Bild sehen",
          "Fotorealistisch per KI",
          "Wände & Fenster bleiben",
          "KI-Bild meist unter 1 Min.",
          "Varianten mit einem Klick",
          "Preisschätzung live",
          HEADLINE_FREE,
          "Auch ohne Raumfoto",
          "Sehen, bevor Sie kaufen",
          HEADLINE_PLANNER_BRAND,
        ],
        descriptions: [
          "KI-Küchenplaner: Raumfoto hochladen, die KI setzt Ihre Wunschküche fotorealistisch hinein.",
          "Küche visualisieren: Wände, Fenster und Boden bleiben erhalten, Varianten per Klick.",
          "Mit Preisschätzung zur Orientierung – kostenlos und unverbindlich, ohne Kaufzwang.",
          "Gefällt Ihnen die Traumküche? Geprüfte Studios der Region machen auf Wunsch Angebote.",
        ],
        path1: "traumküche",
        path2: "ki",
      },
    },
  ],
};

const KOSTEN: CampaignPlan = {
  key: "kosten",
  name: "Search | Küchenkosten | DE",
  dailyBudgetEur: 50,
  bidding: { type: "MAXIMIZE_CONVERSIONS" },
  useSharedNegatives: true,
  observeAudiences: true,
  negatives: [
    ...OWN_BRAND,
    ...MANUFACTURERS,
    ...bs("planen", "planer", "planung", "küchenplaner", "küchenplanung", "konfigurator", "konfigurieren"),
    ...bs("kaufen", "angebot", "angebote", "küchenstudio", "studio", "vergleichen", "vergleich", "preisvergleich"),
    // Nur Aufbau- oder Montagekosten, keine neue Küche
    ...bs("montage", "aufbau", "aufbauen", "einbauen"),
    ...ps("in der nähe"),
  ],
  sitelinks: ["angebote", "planer", "unterbieten", "studios", "kontakt", "faq", "so-gehts", "ueber-uns"],
  callouts: [
    HEADLINE_FREE,
    "Budget-Check in 30 Sek.",
    "Nur 4 kurze Fragen",
    "Ohne Kontaktdaten",
    "Preisspanne sofort",
    "Richtwert nach Marktpreis",
    "Region fließt mit ein",
    "Danach Angebote holen",
    "Geprüfte Küchenstudios",
    "Kein Kaufzwang",
  ],
  images: [
    "planung-quer.jpg",
    "kueche-insel-quer.jpg",
    "ki-vorschau-quer.jpg",
    "paar-kueche-quer.jpg",
    "planung-quadrat.jpg",
    "kueche-insel-quadrat.jpg",
    "ki-vorschau-quadrat.jpg",
    "paar-kueche-quadrat.jpg",
  ],
  adGroups: [
    {
      name: "Was kostet eine Küche",
      finalPath: "/kuechenrechner",
      keywords: [
        ...ep("was kostet eine küche", "was kostet eine neue küche", "küche kosten", "neue küche kosten"),
        ...ps(
          "was kostet küche",
          "was kostet neue küche",
          "wieviel kostet eine küche",
          "wie viel kostet eine küche",
          "was kostet eine gute küche",
          "was kostet eine küche mit geräten",
          "kosten küche",
          "kosten für eine küche",
          "kosten einer küche",
          "kosten neue küche",
          "küche kosten faustregel",
          "küche kosten rechner",
          "was darf eine küche kosten",
          "wie viel darf eine küche kosten",
        ),
      ],
      ad: {
        headlines: [
          "Was kostet eine neue Küche?",
          "Küche Kosten: Richtwert",
          "Neue Küche: Kosten prüfen",
          "Budget-Check in 4 Fragen",
          "KüchenRechner kostenlos",
          "Budget in 30 Sek. checken",
          "Richtwert ohne Kontaktdaten",
          "Preisspanne für Ihre Küche",
          "Größe, Ausstattung, Geräte",
          "Region fließt mit ein",
          HEADLINE_FREE,
          "Marktpreise als Grundlage",
          "Danach Angebote vergleichen",
          "Was darf eine Küche kosten?",
          HEADLINE_CALCULATOR_BRAND,
        ],
        descriptions: [
          "Was kostet eine Küche? 4 Fragen zu Größe, Ausstattung, Geräten und Region, dann Richtwert.",
          "Budget-Check ohne Kontaktdaten: Richtwert auf Basis öffentlich verfügbarer Marktpreise.",
          "Danach auf Wunsch Angebote geprüfter Küchenstudios aus Ihrer Region vergleichen.",
          "Ein Richtwert zur Orientierung – verbindlich ist erst das Studio-Angebot nach Aufmaß.",
        ],
        path1: "küchenrechner",
        path2: "kosten",
      },
    },
    {
      name: "KüchenRechner & Budget-Check",
      finalPath: "/kuechenrechner",
      keywords: [
        ...ep("küchenrechner", "küche preis rechner", "küchen preisrechner", "küche budget", "budget küche"),
        ...ps("küchen rechner", "küchenkostenrechner", "küche preis berechnen", "küchenkosten berechnen"),
        ...ps("küche kosten berechnen"),
      ],
      ad: {
        headlines: [
          "KüchenRechner kostenlos",
          "KüchenRechner: Budget-Check",
          "Küchen-Preisrechner",
          "Küchenkosten berechnen",
          "Budget-Check in 4 Fragen",
          "Budget in 30 Sek. checken",
          "Küche: Budget prüfen",
          "Richtwert ohne Kontaktdaten",
          "Preisspanne sofort sehen",
          "Größe, Ausstattung, Geräte",
          "Region fließt mit ein",
          "Marktpreise als Grundlage",
          HEADLINE_FREE,
          "Danach Angebote vergleichen",
          HEADLINE_CALCULATOR_BRAND,
        ],
        descriptions: [
          "Der KüchenRechner zeigt nach 4 Fragen eine Preisspanne für Ihre neue Küche – kostenlos.",
          "Budget-Check ohne Kontaktdaten: Größe, Ausstattung, Geräte und Region angeben, fertig.",
          "Richtwerte auf Basis öffentlich verfügbarer Marktpreise, inklusive Lieferung und Montage.",
          "Danach auf Wunsch Angebote geprüfter Studios aus Ihrer Region vergleichen.",
        ],
        path1: "küchenrechner",
        path2: "budget",
      },
    },
    {
      name: "Einbauküche Kosten & Preise",
      finalPath: "/kuechenrechner",
      keywords: [
        ...ep("einbauküche kosten", "was kostet eine einbauküche", "küche preis"),
        ...ps(
          "kosten einbauküche",
          "was kostet einbauküche",
          "einbauküche preis",
          "was kostet eine einbauküche mit geräten",
          "küchen preise",
          "küchenpreise",
          "preise für küchen",
          "küchen mit preisen",
          "preis küche",
          "l küche kosten",
          "u küche kosten",
          "küche mit insel kosten",
          "küche preis pro meter",
          "küche vom schreiner kosten",
          "schreinerküche kosten",
        ),
      ],
      ad: {
        headlines: [
          "Einbauküche: Was kostet sie?",
          "Einbauküche Kosten prüfen",
          "Küchenpreise kostenlos prüfen",
          "Küchenpreis schätzen lassen",
          "Budget-Check in 4 Fragen",
          "Richtwert ohne Kontaktdaten",
          "Preisspanne für Ihre Küche",
          "Mit oder ohne Geräte",
          "Größe, Ausstattung, Region",
          "KüchenRechner kostenlos",
          HEADLINE_FREE,
          "Danach Angebote vergleichen",
          "Marktpreise als Grundlage",
          "L-, U- oder Inselküche",
          HEADLINE_CALCULATOR_BRAND,
        ],
        descriptions: [
          "Was kostet eine Einbauküche? 4 Fragen zu Größe, Ausstattung, Geräten und Region.",
          "Küchenpreise einschätzen: Preisspanne ohne Kontaktdaten, nach öffentlichen Marktpreisen.",
          "Mit Geräten, mit Insel, groß oder klein: Der KüchenRechner gibt Ihnen einen Richtwert.",
          "Danach auf Wunsch Angebote geprüfter Studios vergleichen. Kostenlos und unverbindlich.",
        ],
        path1: "einbauküche",
        path2: "kosten",
      },
    },
  ],
};

const MARKE: CampaignPlan = {
  key: "marke",
  name: "Search | Marke KüchenWert | DE",
  dailyBudgetEur: 50,
  bidding: { type: "TARGET_IMPRESSION_SHARE", cpcCeilingEur: 1, absoluteTopShare: 0.95 },
  useSharedNegatives: true,
  observeAudiences: false,
  // „küchenwert rechner“/„… berechnen“ meint den Restwert einer gebrauchten Küche, nicht uns.
  negatives: [...bs("berechnen", "rechner", "tabelle", "prozent"), ...ps("wert berechnen")],
  sitelinks: ["angebote", "planer", "rechner", "unterbieten", "studios", "kontakt", "faq", "ueber-uns"],
  callouts: [
    HEADLINE_FREE,
    "KI-Küchenplaner",
    "KüchenRechner",
    "Budget-Check",
    "Preisvergleich",
    "Angebot unterbieten",
    "Geprüfte Küchenstudios",
    "Ohne Namen an Studios",
    "Kein Kaufzwang",
    "Keine bezahlten Plätze",
  ],
  images: [
    "kueche-insel-quer.jpg",
    "ki-vorschau-quer.jpg",
    "studio-beratung-quer.jpg",
    "paar-kueche-quer.jpg",
    "kueche-insel-quadrat.jpg",
    "ki-vorschau-quadrat.jpg",
    "studio-beratung-quadrat.jpg",
    "paar-kueche-quadrat.jpg",
  ],
  adGroups: [
    {
      name: "KüchenWert",
      finalPath: "/",
      keywords: [
        ...ep("küchenwert", "küchenwert24"),
        ...es("kuechenwert", "kuechenwert24", "küchenwert 24", "küchenwert24 de"),
      ],
      ad: {
        headlines: [
          "KüchenWert – Offizielle Seite",
          HEADLINE_BRAND_COMPARE,
          "Traumküche mit KI planen",
          "Küchenangebote vergleichen",
          "Küchenpreise vergleichen",
          "KüchenRechner & Budget-Check",
          OFFERS,
          HEADLINE_FREE,
          "Küche im eigenen Raum sehen",
          "Preisschätzung live",
          "Studio-Angebot unterbieten",
          "Angebote werden nur günstiger",
          "Ohne Namen an Studios",
          "kuechenwert24.de",
          "Kein Kaufzwang",
        ],
        descriptions: [
          "Küche per KI im eigenen Raum planen, Preis sehen, Angebote geprüfter Studios vergleichen.",
          "KüchenRechner: Budget-Check in 4 Fragen, ohne Kontaktdaten. Kostenlos und unverbindlich.",
          "Schon ein Angebot? Andere geprüfte Studios können es 72 Stunden lang unterbieten.",
          "Kostenlos für Sie – wir finanzieren uns über die teilnehmenden Küchenstudios.",
        ],
      },
    },
  ],
};

/**
 * Test ab 29.09.2026 (Betreiber-Entscheidung): Suchen nach Vermittlungsportalen
 * und Online-Küchenhändlern. Nur exakte Keywords, eigenes kleines Budget, keine
 * fremden Marken im Anzeigentext (EuGH „Google France“/„Interflora“). Ohne
 * gemeinsame Ausschlussliste, weil diese die Namen für die Hauptkampagnen
 * ausschließt; exakte Keywords brauchen sie nicht. Nie Studio-Ketten oder
 * -Verbünde (mögliche Partner). Auswertung: project.md.
 */
const WETTBEWERBER: CampaignPlan = {
  key: "wettbewerber",
  name: "Search | Wettbewerber | DE",
  dailyBudgetEur: 10,
  bidding: { type: "MAXIMIZE_CONVERSIONS" },
  useSharedNegatives: false,
  observeAudiences: true,
  negatives: [],
  sitelinks: ["angebote", "planer", "rechner", "unterbieten", "studios", "kontakt", "faq", "ueber-uns"],
  callouts: [
    HEADLINE_FREE,
    "Geprüfte Küchenstudios",
    "Studios aus Ihrer Region",
    "Ohne Namen an Studios",
    "Keine bezahlten Plätze",
    "Nach Preis sortiert",
    "Preise können nur sinken",
    "KI-Bild im eigenen Raum",
    "Preisschätzung live",
    "Kein Kaufzwang",
  ],
  images: [
    "studio-beratung-quer.jpg",
    "planung-quer.jpg",
    "ki-vorschau-quer.jpg",
    "kueche-insel-quer.jpg",
    "studio-beratung-quadrat.jpg",
    "planung-quadrat.jpg",
    "ki-vorschau-quadrat.jpg",
    "kueche-insel-quadrat.jpg",
  ],
  adGroups: [
    {
      name: "Vergleichsportale",
      finalPath: "/formular",
      keywords: es("aroundhome", "aroundhome erfahrungen", "aroundhome küche", "küchentester", "küchenportal", "küchen portal"),
      ad: {
        headlines: [
          "Küchenangebote vergleichen",
          "Küchen-Vergleich mit Studios",
          "Geprüfte Studios der Region",
          HEADLINE_FREE,
          "Ohne Namen an Studios",
          "Keine bezahlten Plätze",
          "Angebote nach Preis sortiert",
          "Angebote werden nur günstiger",
          "In ca. 3 Min. zur Anfrage",
          "7 Tage Angebote sammeln",
          "Kein Kaufzwang",
          "Küchenstudios vergleichen",
          "Mit KI-Küchenplaner",
          HEADLINE_BRAND_COMPARE,
          "Einmal anfragen, vergleichen",
        ],
        descriptions: [
          "Angebote geprüfter Studios aus Ihrer Region vergleichen – kostenlos und unverbindlich.",
          "Ihr Projekt geht ohne Namen an die Studios. Abgegebene Angebote können nur sinken.",
          "Keine bezahlten Plätze: Angebote erscheinen nach Preis sortiert. Sie entscheiden in Ruhe.",
          "Wunschküche in ca. 3 Minuten beschreiben, 7 Tage lang Angebote erhalten. Kein Kaufzwang.",
        ],
        path1: "küchen",
        path2: "vergleich",
      },
    },
    {
      name: "Online-Küchenhändler",
      finalPath: "/funnel/c",
      keywords: es("küchenatlas", "küchen atlas", "küchenquelle", "küchen quelle"),
      ad: {
        headlines: [
          "Küche online planen mit Preis",
          "Küchenplaner mit Preis",
          "Preisschätzung live",
          "Küche im eigenen Raum sehen",
          "Foto hochladen, Küche planen",
          HEADLINE_FREE,
          OFFERS,
          "Studios aus Ihrer Region",
          "Aufmaß vor Ort vom Studio",
          "Lieferung & Montage wählbar",
          "Fotorealistisch per KI",
          "Preis mit Einzelpositionen",
          "Kein Kaufzwang",
          "Online planen, vor Ort kaufen",
          HEADLINE_PLANNER_BRAND,
        ],
        descriptions: [
          "Küche online planen und sofort den Preis sehen – dann Angebote geprüfter Studios vor Ort.",
          "Raumfoto hochladen: Die KI zeigt Ihre neue Küche im eigenen Raum. Kostenlos.",
          "Die Schätzung passt sich bei jeder Auswahl an: Fronten, Arbeitsplatte, Geräte, Montage.",
          "Verbindlich erst nach dem Aufmaß vor Ort – bis dahin unverbindlich, kein Kaufzwang.",
        ],
        path1: "küche",
        path2: "online-planen",
      },
    },
  ],
};

export const KW_ADS_PLAN: AccountPlan = {
  site: "https://kuechenwert24.de",
  allowedPaths: [
    "/",
    "/formular",
    "/funnel/b",
    "/funnel/c",
    "/kuechenrechner",
    "/kuechenstudios",
    "/kontakt",
    "/faq",
    "/ueber-uns",
  ],
  geoTargetConstants: ["geoTargetConstants/2276"],
  languageConstants: ["languageConstants/1001"],
  sharedNegativeList: { name: "Negativ | KüchenWert Allgemein", keywords: SHARED_NEGATIVES },
  // In-Market: Kitchen & Dining Room, Kitchen & Bathroom Cabinets, Kitchen &
  // Bathroom Counters, Home Improvement, Home Furnishings, Moving & Relocation
  audienceUserInterestIds: ["80249", "80266", "80267", "80241", "80240", "80403"],
  callouts: [
    HEADLINE_FREE,
    "Geprüfte Küchenstudios",
    "Studios aus Ihrer Region",
    "Kein Kaufzwang",
    "Ohne Namen an Studios",
    "Nach Preis sortiert",
    "Keine bezahlten Plätze",
    "KI-Visualisierung",
    "Preisschätzung sofort",
  ],
  snippets: [
    { header: "Typen", values: ["L-Küche", "U-Küche", "G-Küche", "Küche mit Kochinsel", "Küchenzeile", "Zweizeilige Küche"] },
    {
      header: "Dienstleistungen",
      values: [
        "KI-Küchenplaner",
        "KüchenRechner",
        "Budget-Check",
        "Preisvergleich",
        "Angebotsvergleich",
        "Angebot unterbieten",
        "Preisschätzung",
        "Küchenberatung",
      ],
    },
    { header: "Stile", values: ["Modern", "Grifflos", "Landhaus", "Skandinavisch", "Industrial", "Klassisch"] },
  ],
  sitelinks: [
    {
      key: "angebote",
      text: "Küchenpreise vergleichen",
      description1: "Angebote geprüfter Studios",
      description2: "Anfrage in ca. 3 Minuten",
      path: "/formular",
    },
    {
      key: "planer",
      text: "Traumküche mit KI planen",
      description1: "Küche im eigenen Raum sehen",
      description2: "Mit Preisschätzung live",
      path: "/funnel/c",
    },
    {
      key: "unterbieten",
      text: "Angebot unterbieten",
      description1: "Schon ein Studio-Angebot?",
      description2: "Studios können 72 Std. unterbieten",
      path: "/funnel/b",
    },
    {
      key: "rechner",
      text: "Küchen-Budget-Check",
      description1: "KüchenRechner mit 4 Fragen",
      description2: "Richtwert ohne Kontaktdaten",
      path: "/kuechenrechner",
    },
    {
      key: "studios",
      text: "Geprüfte Küchenstudios",
      description1: "Vor der Freischaltung geprüft",
      description2: "Regional wachsendes Netzwerk",
      path: "/kuechenstudios",
    },
    {
      key: "kontakt",
      text: "Kostenlose Beratung",
      description1: "Telefon Mo–Fr 10–18 Uhr",
      description2: "Oder per E-Mail und Formular",
      path: "/kontakt",
    },
    {
      key: "faq",
      text: "Häufige Fragen",
      description1: "Ablauf, Kosten, Datenschutz",
      description2: "Alles zur Angebotsphase",
      path: "/faq",
    },
    {
      key: "so-gehts",
      text: "So funktioniert es",
      description1: "3 Wege zur neuen Küche",
      description2: "Kostenlos und unverbindlich",
      path: "/",
    },
    {
      key: "ueber-uns",
      text: "Über KüchenWert",
      description1: "Wer hinter KüchenWert steht",
      description2: "Eine Marke der WohnWert GmbH",
      path: "/ueber-uns",
    },
  ],
  businessName: "KüchenWert",
  logo: "logo.png",
  images: [
    { file: "logo.png", format: "logo" },
    { file: "kueche-insel-quer.jpg", format: "landscape" },
    { file: "ki-vorschau-quer.jpg", format: "landscape" },
    { file: "showroom-quer.jpg", format: "landscape" },
    { file: "paar-kueche-quer.jpg", format: "landscape" },
    { file: "planung-quer.jpg", format: "landscape" },
    { file: "studio-beratung-quer.jpg", format: "landscape" },
    { file: "kueche-insel-quadrat.jpg", format: "square" },
    { file: "ki-vorschau-quadrat.jpg", format: "square" },
    { file: "showroom-quadrat.jpg", format: "square" },
    { file: "paar-kueche-quadrat.jpg", format: "square" },
    { file: "planung-quadrat.jpg", format: "square" },
    { file: "studio-beratung-quadrat.jpg", format: "square" },
    { file: "stil-dunkel-quadrat.jpg", format: "square" },
    { file: "stil-industrial-quadrat.jpg", format: "square" },
  ],
  // Telefonzeiten wie auf /kontakt (Mo–Fr 10–18 Uhr); außerhalb erscheint kein Anruf-Button.
  call: {
    phone: "0511 51532476",
    countryCode: "DE",
    days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
    startHour: 10,
    endHour: 18,
  },
  campaigns: [ANGEBOTE, PLANER, KOSTEN, MARKE, WETTBEWERBER],
};

// ---------------------------------------------------------------------------
// Prüfung
// ---------------------------------------------------------------------------

const HEADLINE_MAX = 30;
const DESCRIPTION_MAX = 90;
const PATH_MAX = 15;
const SITELINK_TEXT_MAX = 25;
const SITELINK_DESCRIPTION_MAX = 35;
const CALLOUT_MAX = 25;
const SNIPPET_VALUE_MAX = 25;
const BUSINESS_NAME_MAX = 25;
const KEYWORD_MAX = 80;
const KEYWORD_WORDS_MAX = 10;
const IMAGES_PER_CAMPAIGN_MAX = 20;
/** Google-Vorgaben für deutsche Snippet-Überschriften (Auswahl). */
const SNIPPET_HEADERS = new Set(["Typen", "Dienstleistungen", "Marken", "Modelle", "Stile", "Ausstattung"]);

/** Seitenverhältnis und Mindestgröße (Pixel) je Bildformat, laut Google-Vorgaben für Such-Bild-Assets und Logos. */
export const IMAGE_SPECS: Record<ImagePlan["format"], { ratio: number; minWidth: number; minHeight: number }> = {
  landscape: { ratio: 1.91, minWidth: 600, minHeight: 314 },
  square: { ratio: 1, minWidth: 300, minHeight: 300 },
  logo: { ratio: 1, minWidth: 128, minHeight: 128 },
};
export const IMAGE_MAX_BYTES = 5_120 * 1024;

const length = (s: string) => [...s].length;
export const words = (s: string) => s.toLowerCase().split(/\s+/).filter(Boolean);

/** Ob ein Ausschluss eine Suchanfrage (hier: ein gebuchtes Keyword) blockiert. */
export function negativeBlocks(negative: Keyword, query: string): boolean {
  const q = words(query);
  const n = words(negative.text);
  if (negative.match === "EXACT") return q.join(" ") === n.join(" ");
  if (negative.match === "BROAD") return n.every((w) => q.includes(w));
  for (let i = 0; i + n.length <= q.length; i++) {
    if (n.every((w, j) => q[i + j] === w)) return true;
  }
  return false;
}

/** Ob Maße zum Format passen (1 % Toleranz beim Seitenverhältnis). */
export function imageFits(format: ImagePlan["format"], width: number, height: number): boolean {
  const spec = IMAGE_SPECS[format];
  return width >= spec.minWidth && height >= spec.minHeight && Math.abs(width / height / spec.ratio - 1) <= 0.01;
}

function checkTexts(where: string, texts: string[], max: number, min: number, most: number, errors: string[]) {
  if (texts.length < min || texts.length > most) errors.push(`${where}: ${texts.length} Einträge, erlaubt ${min}–${most}`);
  const seen = new Set<string>();
  for (const t of texts) {
    if (length(t) > max) errors.push(`${where}: „${t}“ hat ${length(t)} Zeichen (max. ${max})`);
    if (t !== t.trim() || /\s{2}/.test(t)) errors.push(`${where}: „${t}“ hat überzählige Leerzeichen`);
    const key = t.toLowerCase();
    if (seen.has(key)) errors.push(`${where}: „${t}“ doppelt`);
    seen.add(key);
  }
}

function checkAssets(plan: AccountPlan, errors: string[]) {
  const images = new Map(plan.images.map((i) => [i.file, i]));
  if (images.size !== plan.images.length) errors.push("Bilder: Datei doppelt");
  for (const i of plan.images) {
    if (!/^[a-z0-9-]+\.(jpg|png)$/.test(i.file)) errors.push(`Bild „${i.file}“: Dateiname ungültig`);
  }
  if (images.get(plan.logo)?.format !== "logo") errors.push(`Logo „${plan.logo}“ fehlt oder ist kein Logo`);
  if (length(plan.businessName) > BUSINESS_NAME_MAX || !plan.businessName.trim()) errors.push("Firmenname ungültig");

  const c = plan.call;
  const days = new Set(c.days);
  if (!/^0[1-9][0-9 ]{5,14}$/.test(c.phone) || !/^[A-Z]{2}$/.test(c.countryCode)) errors.push("Anruf: Nummer ungültig");
  if (days.size === 0 || days.size !== c.days.length) errors.push("Anruf: Wochentage leer oder doppelt");
  if (!(Number.isInteger(c.startHour) && Number.isInteger(c.endHour) && c.startHour >= 0 && c.endHour <= 24 && c.startHour < c.endHour)) {
    errors.push("Anruf: Uhrzeiten ungültig");
  }

  for (const camp of plan.campaigns) {
    checkTexts(`${camp.name} Callouts`, camp.callouts, CALLOUT_MAX, 2, 20, errors);
    const own = camp.images.map((f) => images.get(f));
    if (own.some((i) => !i || i.format === "logo")) errors.push(`${camp.name}: unbekanntes Bild`);
    if (new Set(camp.images).size !== camp.images.length || camp.images.length > IMAGES_PER_CAMPAIGN_MAX) {
      errors.push(`${camp.name}: Bilder doppelt oder mehr als ${IMAGES_PER_CAMPAIGN_MAX}`);
    }
    const formats = new Set(own.map((i) => i?.format));
    if (!formats.has("square") || !formats.has("landscape")) errors.push(`${camp.name}: je ein quadratisches und ein Querformat-Bild nötig`);
  }
}

export function validatePlan(plan: AccountPlan): string[] {
  const errors: string[] = [];
  const allowed = new Set(plan.allowedPaths);
  const sitelinks = new Map(plan.sitelinks.map((s) => [s.key, s]));
  const shared = plan.sharedNegativeList.keywords;

  checkTexts("Callouts", plan.callouts, CALLOUT_MAX, 2, 20, errors);
  for (const s of plan.snippets) {
    if (!SNIPPET_HEADERS.has(s.header)) errors.push(`Snippet: Überschrift „${s.header}“ nicht erlaubt`);
    checkTexts(`Snippet ${s.header}`, s.values, SNIPPET_VALUE_MAX, 3, 10, errors);
  }
  if (sitelinks.size !== plan.sitelinks.length) errors.push("Sitelinks: Schlüssel doppelt");
  for (const s of plan.sitelinks) {
    if (length(s.text) > SITELINK_TEXT_MAX) errors.push(`Sitelink „${s.text}“ zu lang`);
    for (const d of [s.description1, s.description2]) {
      if (length(d) > SITELINK_DESCRIPTION_MAX) errors.push(`Sitelink „${s.text}“: „${d}“ zu lang`);
    }
    if (!allowed.has(s.path)) errors.push(`Sitelink „${s.text}“: Pfad ${s.path} nicht erlaubt`);
  }
  checkAssets(plan, errors);

  const keywordOwner = new Map<string, string>();
  const campaignNames = new Set<string>();
  for (const c of plan.campaigns) {
    if (campaignNames.has(c.name)) errors.push(`Kampagne „${c.name}“ doppelt`);
    campaignNames.add(c.name);
    const cpcOk = c.bidding.type === "MAXIMIZE_CONVERSIONS" ? (c.bidding.targetCpaEur ?? 1) > 0 : c.bidding.cpcCeilingEur > 0;
    if (!(c.dailyBudgetEur > 0) || !cpcOk) errors.push(`${c.name}: Budget/CPC-Deckel fehlt`);
    if (c.sitelinks.length < 4 || c.sitelinks.length > 20) errors.push(`${c.name}: 4 bis 20 Sitelinks`);
    const sitelinkPaths = new Set<string>();
    for (const key of c.sitelinks) {
      const s = sitelinks.get(key);
      if (!s) {
        errors.push(`${c.name}: Sitelink „${key}“ unbekannt`);
        continue;
      }
      if (sitelinkPaths.has(s.path)) errors.push(`${c.name}: zwei Sitelinks auf ${s.path}`);
      sitelinkPaths.add(s.path);
    }

    const negatives = [...c.negatives, ...(c.useSharedNegatives ? shared : [])];
    const agNames = new Set<string>();
    for (const ag of c.adGroups) {
      const where = `${c.name} › ${ag.name}`;
      if (agNames.has(ag.name)) errors.push(`${where}: Name doppelt`);
      agNames.add(ag.name);
      if (!allowed.has(ag.finalPath)) errors.push(`${where}: Pfad ${ag.finalPath} nicht erlaubt`);
      checkTexts(`${where} Headlines`, ag.ad.headlines, HEADLINE_MAX, 3, 15, errors);
      checkTexts(`${where} Beschreibungen`, ag.ad.descriptions, DESCRIPTION_MAX, 2, 4, errors);
      for (const h of ag.ad.headlines) if (h.includes("!")) errors.push(`${where}: „${h}“ mit Ausrufezeichen`);
      for (const path of [ag.ad.path1, ag.ad.path2]) {
        if (path !== undefined && (length(path) > PATH_MAX || /[\s/]/.test(path))) errors.push(`${where}: Pfad „${path}“ ungültig`);
      }
      if (ag.keywords.length === 0) errors.push(`${where}: keine Keywords`);
      for (const k of ag.keywords) {
        const id = `${k.text}|${k.match}`;
        if (k.text !== k.text.trim().toLowerCase() || length(k.text) > KEYWORD_MAX || words(k.text).length > KEYWORD_WORDS_MAX) {
          errors.push(`${where}: Keyword „${k.text}“ ungültig`);
        }
        const owner = keywordOwner.get(id);
        if (owner) errors.push(`${where}: Keyword „${k.text}“ (${k.match}) schon in ${owner}`);
        keywordOwner.set(id, where);
        const blocker = negatives.find((n) => negativeBlocks(n, k.text));
        if (blocker) errors.push(`${where}: Keyword „${k.text}“ wird von Ausschluss „${blocker.text}“ blockiert`);
      }
    }

    const seenNeg = new Set<string>();
    for (const n of c.negatives) {
      const id = `${n.text}|${n.match}`;
      if (seenNeg.has(id)) errors.push(`${c.name}: Ausschluss „${n.text}“ doppelt`);
      seenNeg.add(id);
    }
  }
  const seenShared = new Set<string>();
  for (const n of shared) {
    const id = `${n.text}|${n.match}`;
    if (seenShared.has(id)) errors.push(`Liste: Ausschluss „${n.text}“ doppelt`);
    seenShared.add(id);
    if (n.text !== n.text.toLowerCase()) errors.push(`Liste: Ausschluss „${n.text}“ nicht kleingeschrieben`);
  }
  return errors;
}
