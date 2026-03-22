import type { LandingPageConfig } from "./landing-page-types";

export const wohnmobilWert: LandingPageConfig = {
  slug: "was-ist-mein-wohnmobil-wert",
  path: "/was-ist-mein-wohnmobil-wert",
  title: "Was ist mein Wohnmobil wert? Bewertung",
  metaDescription:
    "Erfahren Sie, was Ihr Wohnmobil wert ist: Die wichtigsten Wertfaktoren, Marktdaten und eine kostenlose Bewertung. Jetzt Wohnmobil-Wert ermitteln!",
  keywords:
    "was ist mein wohnmobil wert, wohnmobil wert ermitteln, wohnmobil bewertung kostenlos, was ist mein camper wert, reisemobil wert, wohnmobil restwert",
  h1: "Was ist mein Wohnmobil wert? Bewertung",
  heroSubtitle:
    "Der Wert Ihres Wohnmobils hängt von vielen Faktoren ab. Erfahren Sie, welche Kriterien den Preis bestimmen und lassen Sie Ihr Fahrzeug kostenlos bewerten.",
  primaryCta: { text: "Wert jetzt ermitteln", href: "/wertrechner" },
  secondaryCta: { text: "Expertenbewertung anfordern", href: "/wertermittlung" },
  sections: [
    {
      title: "Die 6 wichtigsten Wertfaktoren für Ihr Wohnmobil",
      content:
        "Der Marktwert eines Wohnmobils wird durch ein Zusammenspiel verschiedener Faktoren bestimmt. Hier erfahren Sie, was Ihren Wohnmobil-Wert am stärksten beeinflusst.",
      items: [
        { title: "Marke & Modell", description: "Premiummarken wie Carthago, Concorde oder Niesmann+Bischoff halten ihren Wert besser als Einsteigermarken. Das Modell und die Baureihe bestimmen die Grundnachfrage." },
        { title: "Baujahr & Alter", description: "Der größte Wertverlust tritt in den ersten 3 Jahren auf (ca. 30-40%). Danach flacht die Kurve ab. Fahrzeuge ab 10 Jahren verlieren nur noch moderat an Wert." },
        { title: "Kilometerstand", description: "Pro 10.000 km sinkt der Wert um ca. 1-2%. Ein Wohnmobil mit 50.000 km ist deutlich mehr wert als eines mit 150.000 km — bei gleichem Alter." },
        { title: "Zustand & Pflege", description: "Regelmäßige Wartung, gepflegter Innenraum und ein schadensfreier Aufbau machen einen enormen Unterschied. Ein Wohnmobil mit lückenlosem Scheckheft erzielt bis zu 20% mehr." },
        { title: "Aufbauart", description: "Integrierte Wohnmobile erzielen die höchsten Preise, gefolgt von Teilintegrierten und Alkovenmobilen. Kastenwagen und Campingbusse haben eine andere Preisentwicklung." },
        { title: "Ausstattung & Extras", description: "Solaranlage, Markise, Rückfahrkamera, Sat-Anlage, Fahrradträger und Winterpaket steigern den Wert. Fehlende Standardausstattung senkt ihn." },
      ],
      ctaText: "Wert jetzt ermitteln",
      ctaHref: "/wertrechner",
    },
    {
      title: "Wertverlust bei Wohnmobilen verstehen",
      content:
        "Wohnmobile verlieren — wie alle Fahrzeuge — mit der Zeit an Wert. Der Wertverlust verläuft jedoch anders als bei PKW und ist oft geringer als erwartet.",
      items: [
        { title: "Jahr 1-3: Stärkster Wertverlust", description: "In den ersten drei Jahren verliert ein Wohnmobil ca. 30-40% seines Neuwerts. Dieser Verlust ist bei Premiummarken tendenziell geringer." },
        { title: "Jahr 4-7: Moderater Rückgang", description: "Der jährliche Wertverlust sinkt auf ca. 5-8%. In dieser Phase bieten Wohnmobile das beste Preis-Leistungs-Verhältnis für Käufer." },
        { title: "Ab Jahr 8: Stabiler Restwert", description: "Gut gepflegte Wohnmobile ab 8 Jahren verlieren nur noch wenig an Wert. Besonders gefragte Modelle können sogar im Wert steigen." },
      ],
      ctaText: "Aktuellen Wert berechnen",
      ctaHref: "/wertrechner",
    },
    {
      title: "So steigern Sie den Wert Ihres Wohnmobils",
      content:
        "Mit einigen gezielten Maßnahmen können Sie den Verkaufswert Ihres Wohnmobils um 10-20% steigern. Diese Investitionen lohnen sich vor dem Verkauf.",
      items: [
        { title: "Professionelle Aufbereitung", description: "Eine gründliche Innen- und Außenreinigung, Politur und ggf. eine Aufbereitung des Lacks kann den Wert um 5-10% steigern." },
        { title: "Kleine Reparaturen durchführen", description: "Defekte Dichtungen, kaputte Schalter oder Kratzer im Innenraum sind günstig zu reparieren, senken aber den Wert unverhältnismäßig." },
        { title: "Dokumentation bereithalten", description: "Lückenlose Wartungsnachweise, TÜV-Berichte und Rechnungen für Reparaturen schaffen Vertrauen und steigern den Preis." },
        { title: "Aktuelle HU durchführen", description: "Ein gültiger TÜV ist ein starkes Verkaufsargument. Die Investition von 80-100€ kann den Verkaufserlös um ein Vielfaches steigern." },
      ],
      ctaText: "Wohnmobil bewerten lassen",
      ctaHref: "/wertermittlung",
    },
    {
      title: "Wohnmobil-Wert nach Marke — Überblick",
      content:
        "Die Marke ist einer der wichtigsten Wertfaktoren. Hier eine Übersicht der Wertentwicklung nach Herstellerklasse.",
      items: [
        { title: "Premium (Carthago, Concorde, Niesmann+Bischoff)", description: "Höchster Restwert — nach 5 Jahren noch ca. 60-70% des Neuwerts. Starke Nachfrage bei Gebrauchtkäufern." },
        { title: "Mittelklasse (Hymer, Dethleffs, Bürstner)", description: "Solide Wertentwicklung — nach 5 Jahren ca. 50-60% des Neuwerts. Breite Käuferbasis." },
        { title: "Einsteiger (Carado, Weinsberg, Sunlight)", description: "Stärkerer Wertverlust in den ersten Jahren, danach stabil — nach 5 Jahren ca. 40-50% des Neuwerts." },
        { title: "Kastenwagen (Pössl, Globecar, Clever Vans)", description: "Besonders wertstabil durch hohe Nachfrage — nach 5 Jahren noch ca. 55-65% des Neuwerts." },
      ],
    },
  ],
  faqItems: [
    { question: "Was bestimmt den Wert meines Wohnmobils am meisten?", answer: "Die drei wichtigsten Faktoren sind Marke/Modell, Baujahr und Zustand. Premiummarken in gutem Zustand halten ihren Wert am besten. Zusätzlich spielen Kilometerstand, Aufbauart und Ausstattung eine wichtige Rolle." },
    { question: "Wie viel ist mein 10 Jahre altes Wohnmobil noch wert?", answer: "Ein 10 Jahre altes Wohnmobil in gutem Zustand hat in der Regel noch 35-50% seines ursprünglichen Neuwerts. Bei Premiummarken kann der Restwert sogar höher liegen." },
    { question: "Verlieren Wohnmobile schneller an Wert als Autos?", answer: "Nein, Wohnmobile verlieren in der Regel langsamer an Wert als PKW. Besonders nach den ersten 3-4 Jahren stabilisiert sich der Wert deutlich, da die Nachfrage nach gebrauchten Wohnmobilen konstant hoch ist." },
    { question: "Steigt mein Wohnmobil-Wert bei Wohnmobil-Knappheit?", answer: "Ja, Angebot und Nachfrage beeinflussen den Marktwert stark. In Zeiten geringer Verfügbarkeit können Gebrauchtpreise deutlich steigen." },
    { question: "Wie genau sind Online-Wertrechner?", answer: "Online-Wertrechner geben eine erste Orientierung mit einer Genauigkeit von ca. ±15%. Für eine präzise Bewertung empfehlen wir eine professionelle Expertenbewertung." },
    { question: "Beeinflusst die Jahreszeit den Wohnmobil-Wert?", answer: "Ja, im Frühjahr (März-Mai) ist die Nachfrage am höchsten, was zu besseren Preisen führt. Im Herbst und Winter sind die Preise tendenziell 5-10% niedriger." },
    { question: "Was ist der Unterschied zwischen Händler- und Privatwert?", answer: "Der Händlereinkaufspreis liegt ca. 10-20% unter dem Privatmarktpreis. Dafür entfallen beim Händlerverkauf Standzeiten, Verhandlungen und Gewährleistungsrisiken." },
    { question: "Senkt ein Unfallschaden den Wert dauerhaft?", answer: "Ein reparierter Unfallschaden senkt den Wert um ca. 10-30%, je nach Schwere. Ein fachgerecht reparierter Bagatellschaden hat geringere Auswirkungen als ein Strukturschaden." },
    { question: "Welche Aufbauart erzielt die höchsten Preise?", answer: "Integrierte Wohnmobile erzielen die höchsten Preise, gefolgt von Teilintegrierten. Kastenwagen haben eine überdurchschnittliche Wertstabilität wegen der hohen Nachfrage." },
    { question: "Wie wirkt sich die Motorisierung auf den Wert aus?", answer: "Stärkere Motoren steigern den Wert, da sie mehr Komfort bieten. Automatikgetriebe ist mittlerweile Standard — ein manuelles Getriebe kann den Wert senken." },
    { question: "Ist mein Wohnmobil mehr wert mit Winterpaket?", answer: "Ja, ein Winterpaket (Heizung, Isolation, beheizter Doppelboden) ist besonders im deutschen Markt gefragt und kann den Wert um 1.000-3.000€ steigern." },
    { question: "Wie wirkt sich eine Solaranlage auf den Wert aus?", answer: "Eine Solaranlage steigert den Wert um ca. 500-2.000€, abhängig von Leistung und Alter. Besonders für autarkes Camping ist sie ein starkes Verkaufsargument." },
    { question: "Wann ist der beste Zeitpunkt zum Verkaufen?", answer: "Der beste Zeitpunkt ist das Frühjahr (März-Mai), wenn die Camping-Saison beginnt. Alternativ ist der September gut, wenn Käufer nach Saisonende-Schnäppchen suchen." },
    { question: "Verliert mein Wohnmobil durch Rauchen an Wert?", answer: "Ja, Raucherfahrzeuge verlieren ca. 5-15% an Wert. Gerüche lassen sich schwer entfernen und schrecken viele Käufer ab. Eine professionelle Ozonbehandlung kann helfen." },
    { question: "Wie beeinflusst der Euro-Standard den Wert?", answer: "Wohnmobile mit Euro 6 oder besser erzielen höhere Preise und sind in mehr Umweltzonen zugelassen. Fahrzeuge mit Euro 3 oder schlechter können durch Fahrverbote an Attraktivität verlieren." },
    { question: "Was ist mein Wohnmobil bei einer Inzahlungnahme wert?", answer: "Bei einer Inzahlungnahme beim Händler erhalten Sie in der Regel 10-25% weniger als beim freien Verkauf. Unser Auktionssystem bietet eine faire Alternative." },
    { question: "Steigert ein Garagen-Stellplatz den Wert?", answer: "Indirekt ja — ein garagen- oder hallengelagertes Wohnmobil zeigt weniger Alterungsspuren, was zu einem höheren Verkaufspreis führt." },
    { question: "Wie wirkt sich die Laufleistung auf den Wert aus?", answer: "Pro 10.000 km sinkt der Wert um ca. 1-2%. Ein Wohnmobil mit 30.000 km ist deutlich wertvoller als eines mit 100.000 km. Der Gesamtzustand ist aber oft wichtiger." },
    { question: "Kann der Wert meines Wohnmobils steigen?", answer: "In Ausnahmefällen ja — bei besonders begehrten Modellen, limitierten Auflagen oder in Zeiten von Neufahrzeug-Engpässen. Generell gilt: Je früher Sie verkaufen, desto höher der Preis." },
    { question: "Wie ermittelt CaravanWert den Wert?", answer: "Wir nutzen eine Kombination aus aktuellen Marktdaten, Vergleichsverkäufen und Experteneinschätzungen. Zusätzlich fließen Zustand, Ausstattung und regionale Nachfrage ein." },
  ],
  relatedSlugs: ["wohnmobil-wertermittlung-kostenlos", "wieviel-ist-mein-wohnmobil-wert", "wohnmobil-verkaufen"],
};
