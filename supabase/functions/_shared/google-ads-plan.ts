/**
 * Google-Ads-Sollzustand für KüchenWert (Konto 760-376-7237): Such-Kampagnen,
 * Anzeigengruppen, Keywords, Anzeigen, Ausschlüsse und Assets.
 *
 * kw-google-ads (action "campaigns") legt Fehlendes an, neue Kampagnen immer
 * pausiert; Vorhandenes bleibt unverändert. Kampagnen und Anzeigengruppen
 * werden über ihren Namen gefunden: Namen nur hier ändern, nicht im
 * Google-Ads-Konto.
 *
 * Datengrundlage: Keyword-Planer (Deutschland, 29.09.2026). Anzeigentexte
 * sagen nur, was Landingpages und FAQ (src/data/faq.ts) belegen; keine
 * Markennamen Dritter in Anzeigentexten.
 *
 * Reines Datenmodul ohne Deno-APIs: src/lib/__tests__/google-ads-plan.test.ts
 * prüft es mit validatePlan().
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

export type BiddingPlan =
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
  adGroups: AdGroupPlan[];
}

export interface AccountPlan {
  site: string;
  allowedPaths: string[];
  geoTargetConstants: string[];
  languageConstants: string[];
  sharedNegativeList: { name: string; keywords: Keyword[] };
  audienceUserInterestIds: string[];
  callouts: string[];
  snippets: Array<{ header: string; values: string[] }>;
  sitelinks: SitelinkPlan[];
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

const ANGEBOTE: CampaignPlan = {
  key: "angebote",
  name: "Search | Küchenangebote | DE",
  dailyBudgetEur: 30,
  bidding: { type: "MAXIMIZE_CLICKS", cpcCeilingEur: 3.5 },
  useSharedNegatives: true,
  observeAudiences: true,
  negatives: [
    ...OWN_BRAND,
    ...bs("konfigurator", "konfigurieren", "3d", "kosten", "kostet", "rechner"),
  ],
  sitelinks: ["planer", "unterbieten", "rechner", "studios", "faq", "ueber-uns"],
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
          "Angebote geprüfter Studios",
          HEADLINE_FREE,
          "Küchenangebote aus der Region",
          "In ca. 3 Min. zur Anfrage",
          "Angebote werden nur günstiger",
          "Kein Kaufzwang",
          "Ohne Namen an Studios",
          "7 Tage Angebote sammeln",
          "Ihre Wunschküche beschreiben",
          "Einmal anfragen, vergleichen",
          "Nach Preis sortiert",
          HEADLINE_BRAND_COMPARE,
          "Neue Küche? Angebote holen",
          "Einbauküche im Preisvergleich",
        ],
        descriptions: [
          "Wunschküche in ca. 3 Minuten beschreiben – geprüfte Studios der Region senden Angebote.",
          "Kostenlos und unverbindlich: Angebote nach Preis vergleichen und in Ruhe entscheiden.",
          "Ihr Projekt geht ohne Namen an geprüfte Studios. Abgegebene Angebote können nur sinken.",
          "Nicht jedes Studio einzeln anfragen: einmal beschreiben, 7 Tage lang Angebote erhalten.",
        ],
        path1: "angebote",
        path2: "vergleichen",
      },
    },
    {
      name: "Küche kaufen",
      finalPath: "/formular",
      keywords: [
        ...ep("küche kaufen", "küchen kaufen", "einbauküche kaufen", "neue küche kaufen", "küche nach maß"),
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
          "Vor dem Küchenkauf vergleichen",
          "Angebote geprüfter Studios",
          HEADLINE_FREE,
          "Einbauküche mit Geräten",
          "Küche nach Maß vom Studio",
          "Studios aus Ihrer Region",
          "Kein Kaufzwang",
          "Angebote werden nur günstiger",
          "In ca. 3 Min. zur Anfrage",
          "L-, U- oder Inselküche",
          "Ohne Namen an Studios",
          HEADLINE_BRAND_COMPARE,
          "Nach Preis sortiert",
          "Einmal anfragen, vergleichen",
        ],
        descriptions: [
          "Vor dem Küchenkauf Angebote geprüfter Studios aus Ihrer Region kostenlos vergleichen.",
          "Wunschküche in ca. 3 Minuten beschreiben. Studios senden Angebote, Sie entscheiden.",
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
      ],
      ad: {
        headlines: [
          "Küchenstudios in Ihrer Region",
          "Geprüfte Küchenstudios",
          "Angebote mehrerer Studios",
          HEADLINE_FREE,
          "Einmal anfragen, vergleichen",
          "Studios vorab geprüft",
          "Planung & Angebot vom Studio",
          "Ohne Namen an Studios",
          "Kein Kaufzwang",
          "Angebote werden nur günstiger",
          "Wunschküche beschreiben",
          "In ca. 3 Min. zur Anfrage",
          "KüchenWert vermittelt Studios",
          "Nicht jedes Studio abklappern",
          "Nach Preis sortiert",
        ],
        descriptions: [
          "Geprüfte Küchenstudios aus Ihrer Region machen Ihnen Angebote – kostenlos & unverbindlich.",
          "Nicht jedes Studio einzeln anfragen: Wunschküche einmal beschreiben, Angebote vergleichen.",
          "Jedes Studio wird vor der Freischaltung manuell geprüft. Ihr Projekt geht ohne Namen raus.",
          "Bestes Angebot wählen, Aufmaß mit dem Studio – den Kaufvertrag schließen Sie erst danach.",
        ],
        path1: "küchenstudio",
        path2: "region",
      },
    },
    {
      name: "Markenküchen Preise",
      finalPath: "/formular",
      keywords: ps(
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
      ad: {
        headlines: [
          "Markenküchen im Vergleich",
          "Markenküche: Preis prüfen",
          "Angebote geprüfter Studios",
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
          "Wunschküche beschreiben",
        ],
        descriptions: [
          "Was kostet Ihre Markenküche? Angebote geprüfter Studios kostenlos vergleichen.",
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
          "küchen preisvergleich",
          "küchenangebot zweite meinung",
          "küchenangebot unterbieten",
          "küchenangebot günstiger",
          "zweites küchenangebot",
        ),
      ],
      ad: {
        headlines: [
          "Küchenangebot unterbieten",
          "Angebot 72 Std. unterbieten",
          "Schon ein Küchenangebot?",
          "Studios können unterbieten",
          HEADLINE_FREE,
          "Angebot hochladen, abwarten",
          "Küche zu teuer? Vergleichen",
          "Geprüfte Studios der Region",
          "Anonym an andere Studios",
          "Bestes Angebot annehmen",
          "Oder alle ablehnen",
          "Zweites Angebot für Ihre Küche",
          "Küchenpreis prüfen",
          "Kein Kaufzwang",
          "Gleiche Küche, besserer Preis?",
        ],
        descriptions: [
          "Studio-Angebot hochladen: geprüfte Studios aus Ihrer Region können 72 Std. unterbieten.",
          "Ihr Angebot geht ohne Ihren Namen und ohne Studionamen raus. Kostenlos & unverbindlich.",
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
  dailyBudgetEur: 20,
  bidding: { type: "MAXIMIZE_CLICKS", cpcCeilingEur: 2.5 },
  useSharedNegatives: true,
  observeAudiences: true,
  negatives: [
    ...OWN_BRAND,
    ...MANUFACTURERS,
    ...bs("blum", "nähe", "lassen", "küchenstudio", "studio", "beratung", "termin", "kaufen", "angebot"),
    ...bs("angebote", "händler", "fachhändler", "küchenbauer", "kosten", "kostet", "rechner"),
    ...ps("in der nähe", "zu hause", "vor ort"),
  ],
  sitelinks: ["angebote", "rechner", "unterbieten", "studios", "faq", "ueber-uns"],
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
        ),
      ],
      ad: {
        headlines: [
          "Küchenplaner online",
          "KI-Küchenplaner kostenlos",
          "Küche im eigenen Raum sehen",
          "Foto hochladen, Küche planen",
          "Mit Preisschätzung sofort",
          "Fotorealistisch per KI",
          "Varianten mit einem Klick",
          HEADLINE_FREE,
          "Stil, Fronten, Geräte wählen",
          "Angebote geprüfter Studios",
          "Planen, sehen, vergleichen",
          "Küchenkonfigurator mit KI",
          "Auch ohne Raumfoto",
          HEADLINE_PLANNER_BRAND,
          "Traumküche in Ihrem Foto",
        ],
        descriptions: [
          "Foto Ihres Raums hochladen, Küche konfigurieren und per KI sehen, wie sie aussieht.",
          "Mit Preisschätzung, die sich bei jeder Auswahl anpasst. Kostenlos und unverbindlich.",
          "Wände, Fenster und Boden bleiben erhalten – die KI setzt Ihre Wunschküche in Ihr Foto.",
          "Auf Wunsch Angebote geprüfter Küchenstudios aus Ihrer Region. Kein Kaufzwang.",
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
        ),
      ],
      ad: {
        headlines: [
          "Küche online planen",
          "Küche planen mit KI",
          "Küche im eigenen Raum sehen",
          "Foto hochladen, Küche planen",
          "Mit Preisschätzung sofort",
          HEADLINE_FREE,
          "Neue Küche selbst gestalten",
          "Stil, Fronten, Geräte wählen",
          "Fotorealistisch per KI",
          "Varianten mit einem Klick",
          "Angebote geprüfter Studios",
          "Planen, sehen, vergleichen",
          "Auch ohne Raumfoto",
          "Ihre Traumküche planen",
          HEADLINE_PLANNER_BRAND,
        ],
        descriptions: [
          "Küche planen und im eigenen Raum sehen: Foto hochladen, Stil wählen, KI-Bild erhalten.",
          "Preisschätzung aus Laufmetern, Fronten und Geräten – live bei jeder Auswahl. Kostenlos.",
          "Fertig geplant? Geprüfte Studios aus Ihrer Region machen Ihnen auf Wunsch Angebote.",
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
          "Kostenlos Küche planen",
          "Kostenloser KI-Küchenplaner",
          "Komplett kostenlos für Sie",
          "Küche im eigenen Raum sehen",
          "Foto hochladen, Küche planen",
          "Mit Preisschätzung sofort",
          "Fotorealistisch per KI",
          "Ohne versteckte Gebühren",
          "Varianten mit einem Klick",
          "Stil, Fronten, Geräte wählen",
          "Auch ohne Raumfoto",
          "Angebote geprüfter Studios",
          HEADLINE_FREE,
          HEADLINE_PLANNER_BRAND,
        ],
        descriptions: [
          "Kostenloser Küchenplaner mit KI: Raumfoto hochladen und Ihre neue Küche darin sehen.",
          "Konfigurator, KI-Visualisierung und Preisschätzung sind für Sie komplett kostenlos.",
          "Stil, Fronten, Arbeitsplatte, Griffe und Geräte wählen – der Preis passt sich live an.",
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
        ...ep("küche online planen mit preis", "küchenplaner mit preis"),
        ...ps(
          "küche planen online mit preis",
          "küche planen mit preis",
          "küche günstig planen",
          "küche planen günstig",
          "günstige küche planen",
          "küchenplaner preis",
          "küche konfigurieren preis",
        ),
      ],
      ad: {
        headlines: [
          "Küche planen mit Preis",
          "Küchenplaner mit Preis",
          "Preisschätzung live",
          "Preis bei jeder Auswahl",
          "Küche im eigenen Raum sehen",
          "Foto hochladen, Küche planen",
          HEADLINE_FREE,
          "Mit regionalem Preisfaktor",
          "Lieferung & Montage wählbar",
          "Fotorealistisch per KI",
          "Angebote geprüfter Studios",
          "Preis kennen vor dem Studio",
          "Budget im Blick behalten",
          "Stil, Fronten, Geräte wählen",
          HEADLINE_PLANNER_BRAND,
        ],
        descriptions: [
          "Küche online planen und sofort sehen, was sie etwa kostet – mit regionalem Preisfaktor.",
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
          "Küchenform im Raum testen",
          "Küche im eigenen Raum sehen",
          "Foto hochladen, Form wählen",
          "Mit Preisschätzung sofort",
          "Kochinsel oder Küchenzeile?",
          "Fotorealistisch per KI",
          HEADLINE_FREE,
          "Varianten mit einem Klick",
          "6 Küchenformen zur Auswahl",
          "Wandmaße angeben, planen",
          "Angebote geprüfter Studios",
          "Stil, Fronten, Geräte wählen",
          "Ihre Traumküche planen",
          HEADLINE_PLANNER_BRAND,
        ],
        descriptions: [
          "L-, U-, G-Küche, Zeile oder Kochinsel: Form wählen und per KI im eigenen Raum sehen.",
          "Raumfoto hochladen, Wandmaße angeben – die KI zeigt Ihre neue Küche fotorealistisch.",
          "Mit Preisschätzung, die sich bei jeder Auswahl anpasst. Kostenlos und unverbindlich.",
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
          "Foto hochladen, KI-Bild sehen",
          "Fotorealistisch per KI",
          "Wände & Fenster bleiben",
          "KI-Bild meist unter 1 Min.",
          "Varianten mit einem Klick",
          "Mit Preisschätzung sofort",
          HEADLINE_FREE,
          "Stil, Fronten, Geräte wählen",
          "Auch ohne Raumfoto",
          "Angebote geprüfter Studios",
          "Sehen, bevor Sie kaufen",
          HEADLINE_PLANNER_BRAND,
        ],
        descriptions: [
          "Laden Sie ein Raumfoto hoch: Die KI setzt Ihre Wunschküche fotorealistisch hinein.",
          "Wände, Fenster und Boden bleiben erhalten. Neue Varianten erzeugen Sie mit einem Klick.",
          "Mit Preisschätzung zur Orientierung – kostenlos und unverbindlich, ohne Kaufzwang.",
          "Gefällt Ihnen die Küche? Geprüfte Studios aus Ihrer Region machen auf Wunsch Angebote.",
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
  dailyBudgetEur: 10,
  bidding: { type: "MAXIMIZE_CLICKS", cpcCeilingEur: 1.5 },
  useSharedNegatives: true,
  observeAudiences: true,
  negatives: [
    ...OWN_BRAND,
    ...MANUFACTURERS,
    ...bs("planen", "planer", "planung", "küchenplaner", "küchenplanung", "konfigurator", "konfigurieren"),
    ...bs("kaufen", "angebot", "angebote", "küchenstudio", "studio"),
    ...ps("in der nähe"),
  ],
  sitelinks: ["angebote", "planer", "unterbieten", "studios", "faq"],
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
        ),
      ],
      ad: {
        headlines: [
          "Was kostet eine neue Küche?",
          "Küchenkosten in 4 Fragen",
          "Richtwert ohne Kontaktdaten",
          "KüchenRechner kostenlos",
          "Küche kosten: Richtwert",
          "Preisspanne für Ihre Küche",
          "Größe, Ausstattung, Geräte",
          "Region fließt mit ein",
          HEADLINE_FREE,
          "Danach Angebote vergleichen",
          "Budget für die Küche planen",
          "In 4 Fragen zum Richtwert",
          "Marktpreise als Grundlage",
          "KüchenWert KüchenRechner",
          "Einbauküche: Kosten prüfen",
        ],
        descriptions: [
          "4 kurze Fragen zu Größe, Ausstattung, Geräten und Region – und Sie sehen eine Preisspanne.",
          "Ohne Kontaktdaten: Richtwert auf Basis öffentlich verfügbarer Marktpreise. Kostenlos.",
          "Danach auf Wunsch Angebote geprüfter Küchenstudios aus Ihrer Region vergleichen.",
          "Ein Richtwert zur Orientierung – verbindlich ist erst das Studio-Angebot nach Aufmaß.",
        ],
        path1: "küchenrechner",
        path2: "kosten",
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
        ),
      ],
      ad: {
        headlines: [
          "Einbauküche: Was kostet sie?",
          "Küchenpreis kostenlos schätzen",
          "Richtwert in 4 Fragen",
          "Ohne Kontaktdaten",
          "Preisspanne für Ihre Küche",
          "Mit oder ohne Geräte",
          "Größe, Ausstattung, Region",
          "KüchenRechner kostenlos",
          HEADLINE_FREE,
          "Danach Angebote vergleichen",
          "Budget für die Küche planen",
          "Marktpreise als Grundlage",
          "L-, U- oder Inselküche",
          "KüchenWert KüchenRechner",
          "Kosten vorab einschätzen",
        ],
        descriptions: [
          "Was kostet eine Einbauküche? 4 Fragen zu Größe, Ausstattung, Geräten und Region.",
          "Sie sehen eine Preisspanne – ohne Kontaktdaten, auf Basis öffentlicher Marktpreise.",
          "Mit Geräten, mit Insel, groß oder klein: der KüchenRechner gibt Ihnen einen Richtwert.",
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
  dailyBudgetEur: 5,
  bidding: { type: "TARGET_IMPRESSION_SHARE", cpcCeilingEur: 1, absoluteTopShare: 0.95 },
  useSharedNegatives: true,
  observeAudiences: false,
  negatives: [...bs("berechnen", "tabelle", "prozent"), ...ps("wert berechnen")],
  sitelinks: ["angebote", "planer", "unterbieten", "rechner", "faq"],
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
          "Traumküche mit KI planen",
          "Küchenangebote vergleichen",
          "Angebote geprüfter Studios",
          HEADLINE_FREE,
          "Küche im eigenen Raum sehen",
          "Mit Preisschätzung sofort",
          "Studio-Angebot unterbieten",
          "KüchenRechner kostenlos",
          "Kein Kaufzwang",
          "Ohne Namen an Studios",
          "Angebote werden nur günstiger",
          "kuechenwert24.de",
          "Planen, sehen, vergleichen",
          "Studios aus Ihrer Region",
        ],
        descriptions: [
          "Küche per KI im eigenen Raum planen, Preis sehen, Angebote geprüfter Studios vergleichen.",
          "Kostenlos und unverbindlich für Sie – wir finanzieren uns über die teilnehmenden Studios.",
          "Schon ein Angebot? Andere geprüfte Studios können es 72 Stunden lang unterbieten.",
          "Nur einen Richtwert? Der KüchenRechner zeigt ihn nach 4 Fragen – ohne Kontaktdaten.",
        ],
      },
    },
  ],
};

export const KW_ADS_PLAN: AccountPlan = {
  site: "https://kuechenwert24.de",
  allowedPaths: ["/", "/formular", "/funnel/b", "/funnel/c", "/kuechenrechner", "/kuechenstudios", "/faq", "/ueber-uns"],
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
      values: ["KI-Küchenplaner", "Preisschätzung", "Angebotsvergleich", "Angebot unterbieten", "KüchenRechner"],
    },
  ],
  sitelinks: [
    {
      key: "angebote",
      text: "Küchenangebote einholen",
      description1: "Geprüfte Studios der Region",
      description2: "Wunschküche in ca. 3 Minuten",
      path: "/formular",
    },
    {
      key: "planer",
      text: "Traumküche mit KI planen",
      description1: "Küche im eigenen Raum sehen",
      description2: "Mit Preisschätzung sofort",
      path: "/funnel/c",
    },
    {
      key: "unterbieten",
      text: "Angebot unterbieten",
      description1: "Schon ein Studio-Angebot?",
      description2: "72 Stunden unterbieten lassen",
      path: "/funnel/b",
    },
    {
      key: "rechner",
      text: "Was kostet meine Küche?",
      description1: "Richtwert in 4 Fragen",
      description2: "Ohne Kontaktdaten",
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
      key: "faq",
      text: "Häufige Fragen",
      description1: "Ablauf, Kosten, Datenschutz",
      description2: "Alles zur Angebotsphase",
      path: "/faq",
    },
    {
      key: "ueber-uns",
      text: "Über KüchenWert",
      description1: "Wer hinter KüchenWert steht",
      description2: "Eine Marke der WohnWert GmbH",
      path: "/ueber-uns",
    },
  ],
  campaigns: [ANGEBOTE, PLANER, KOSTEN, MARKE],
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
const KEYWORD_MAX = 80;
const KEYWORD_WORDS_MAX = 10;
/** Google-Vorgaben für deutsche Snippet-Überschriften (Auswahl). */
const SNIPPET_HEADERS = new Set(["Typen", "Dienstleistungen", "Marken", "Modelle", "Stile", "Ausstattung"]);

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

export function validatePlan(plan: AccountPlan): string[] {
  const errors: string[] = [];
  const allowed = new Set(plan.allowedPaths);
  const sitelinkKeys = new Set(plan.sitelinks.map((s) => s.key));
  const shared = plan.sharedNegativeList.keywords;

  checkTexts("Callouts", plan.callouts, CALLOUT_MAX, 2, 20, errors);
  for (const s of plan.snippets) {
    if (!SNIPPET_HEADERS.has(s.header)) errors.push(`Snippet: Überschrift „${s.header}“ nicht erlaubt`);
    checkTexts(`Snippet ${s.header}`, s.values, SNIPPET_VALUE_MAX, 3, 10, errors);
  }
  for (const s of plan.sitelinks) {
    if (length(s.text) > SITELINK_TEXT_MAX) errors.push(`Sitelink „${s.text}“ zu lang`);
    for (const d of [s.description1, s.description2]) {
      if (length(d) > SITELINK_DESCRIPTION_MAX) errors.push(`Sitelink „${s.text}“: „${d}“ zu lang`);
    }
    if (!allowed.has(s.path)) errors.push(`Sitelink „${s.text}“: Pfad ${s.path} nicht erlaubt`);
  }

  const keywordOwner = new Map<string, string>();
  const campaignNames = new Set<string>();
  for (const c of plan.campaigns) {
    if (campaignNames.has(c.name)) errors.push(`Kampagne „${c.name}“ doppelt`);
    campaignNames.add(c.name);
    if (!(c.dailyBudgetEur > 0) || !(c.bidding.cpcCeilingEur > 0)) errors.push(`${c.name}: Budget/CPC-Deckel fehlt`);
    if (c.sitelinks.length < 4) errors.push(`${c.name}: mindestens 4 Sitelinks`);
    for (const key of c.sitelinks) if (!sitelinkKeys.has(key)) errors.push(`${c.name}: Sitelink „${key}“ unbekannt`);

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
