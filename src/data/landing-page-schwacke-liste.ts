import type { LandingPageConfig } from "./landing-page-types";

export const schwackeListeWohnmobil: LandingPageConfig = {
  slug: "schwacke-liste-wohnmobil",
  path: "/schwacke-liste-wohnmobil",
  title: "Schwacke Liste Wohnmobil — kostenlose Bewertung als Alternative",
  metaDescription:
    "Wohnmobil-Wert ohne Schwacke Liste ermitteln: Privatpersonen haben keinen Zugang zu Schwacke. Nutzen Sie unseren kostenlosen Wertrechner — Ergebnis in 2 Minuten, professionelle Marktdaten.",
  keywords:
    "schwacke liste wohnmobil, schwacke wohnmobil, wohnmobil schwacke, schwacke liste reisemobil, schwackeliste wohnmobil kostenlos, wohnmobil verkaufen schwacke, schwacke alternative wohnmobil, wohnmobil bewerten ohne schwacke",
  h1: "Schwacke Liste Wohnmobil — kostenlose Alternative für Verbraucher",
  heroSubtitle:
    "Die Schwacke Liste ist für Privatpersonen nicht zugänglich und für Reisemobile oft ungenau. Mit dem Wertrechner von CaravanWert ermitteln Sie den aktuellen Marktwert Ihres Wohnmobils kostenlos in 2 Minuten — basierend auf hunderten realer Verkaufsdaten.",
  primaryCta: { text: "Jetzt Wohnmobil-Wert berechnen", href: "/wertrechner" },
  secondaryCta: { text: "Expertenbewertung anfordern", href: "/wertermittlung" },
  sections: [
    {
      title: "Was ist die Schwacke Liste?",
      content:
        "Die Schwacke Liste ist ein deutschlandweit bekanntes Bewertungssystem für Gebrauchtfahrzeuge, herausgegeben von der Schwacke GmbH (heute Teil von J.D. Power). Sie liefert Restwert-Tabellen für PKW, Transporter, Motorräder — und auch für Wohnmobile und Wohnwagen. Versicherungen, Leasinggesellschaften, Banken und Händler greifen täglich darauf zurück, um Fahrzeugwerte zu kalkulieren, Beleihungsgrenzen festzulegen oder Eintauschpreise zu kalkulieren.",
      items: [
        {
          title: "Datengrundlage",
          description:
            "Schwacke wertet Verkaufsdaten von Händlern, Auktionen und Inseraten aus und veröffentlicht daraus monatlich Durchschnitts-Restwerte je Modell, Baujahr und Laufleistung.",
        },
        {
          title: "Zielgruppe",
          description:
            "Hauptkunden sind Banken, Versicherungen, Leasinggeber und Autohäuser — also der professionelle B2B-Markt. Für diese Zielgruppe sind die Listen kostenpflichtig im Abonnement.",
        },
        {
          title: "Wohnmobil-Abdeckung",
          description:
            "Schwacke führt die gängigen Hersteller wie Hymer, Knaus, Dethleffs oder Bürstner. Bei selteneren Marken, Sonderaufbauten oder Eigenausbauten gibt es jedoch häufig keine oder nur ungenaue Datensätze.",
        },
      ],
    },
    {
      title: "Schwacke Liste für Privatpersonen — leider keine Option",
      content:
        "Wer als Privatperson sein Wohnmobil verkaufen will und nach „Schwacke Liste Wohnmobil kostenlos\" sucht, wird enttäuscht: Schwacke verkauft seine Daten ausschließlich an gewerbliche Abnehmer im Jahresabo (mehrere hundert bis über tausend Euro pro Lizenz). Eine Einzelabfrage für ein einziges Fahrzeug ist nicht vorgesehen.",
      items: [
        {
          title: "Kein öffentlicher Online-Rechner",
          description:
            "Schwacke betreibt keine kostenlose Wertermittlung für Endkunden. Anbieter, die mit „Schwacke-Bewertung\" werben, nutzen meist eigene Algorithmen oder lizenzierte Rohdaten, die mit der echten Schwacke-Liste wenig zu tun haben.",
        },
        {
          title: "Keine Einzelabfragen",
          description:
            "Auch der Versuch, eine einmalige Bewertung zu kaufen, scheitert: Schwacke verkauft keine Einzel-Reports an Verbraucher, sondern nur Datenbankzugänge an Geschäftskunden.",
        },
        {
          title: "Händler nutzen Schwacke gegen Sie",
          description:
            "Wenn ein Händler Ihnen ein Inzahlungnahme-Angebot macht, stützt er sich oft auf den Schwacke-Einkaufspreis (EK) — den niedrigsten der drei Schwacke-Werte. Sie als Privatverkäufer sehen nur das Ergebnis, nie die Berechnung.",
        },
      ],
      ctaText: "Wert kostenlos selbst berechnen",
      ctaHref: "/wertrechner",
    },
    {
      title: "4 Gründe, warum Schwacke für Wohnmobile an Grenzen stößt",
      content:
        "Selbst wenn Sie als Verbraucher Zugang zu Schwacke hätten — für die Wohnmobil-Bewertung wäre das Ergebnis oft enttäuschend. Reisemobile haben Eigenheiten, die ein klassisches PKW-Bewertungssystem nur schwer abbildet.",
      items: [
        {
          title: "1. Ausstattung wird kaum berücksichtigt",
          description:
            "Eine Markise, Solaranlage, Mover, Sat-Anlage, Fahrradträger oder Lithium-Bordbatterie können den Wert eines Wohnmobils um 5.000 € bis 15.000 € beeinflussen. Schwacke arbeitet aber mit Standard-Konfigurationen — Ihre individuelle Ausstattung fließt nur pauschal ein.",
        },
        {
          title: "2. Regionale Nachfrage fehlt",
          description:
            "Schwacke gibt einen bundesweiten Durchschnittswert. Tatsächlich werden Wohnmobile in Bayern, Baden-Württemberg und NRW deutlich teurer gehandelt als in Mecklenburg-Vorpommern oder Sachsen-Anhalt — Unterschiede von 8 % bis 12 % sind normal.",
        },
        {
          title: "3. Saisonalität wird ignoriert",
          description:
            "Im Februar verkauftes Wohnmobil = bis zu 15 % weniger Erlös als im April. Schwacke veröffentlicht statische Monats-Durchschnitte und reagiert nur verzögert auf Marktverschiebungen wie 2023/2024.",
        },
        {
          title: "4. Zustand & Pflege fließen nicht ein",
          description:
            "Ein scheckheftgepflegtes Wohnmobil mit lückenloser Service-Historie, frischem TÜV und Garage-Standzeit ist deutlich mehr wert als ein vergleichbares Modell mit Standschäden. Schwacke kennt nur „normaler Zustand\".",
        },
      ],
    },
    {
      title: "CaravanWert — die kostenlose Schwacke-Alternative für Verbraucher",
      content:
        "Wir haben unseren Wertrechner speziell für Wohnmobil- und Wohnwagen-Besitzer entwickelt. Er ist kostenlos, ohne Registrierung nutzbar und liefert in unter zwei Minuten eine fundierte Markteinschätzung — basierend auf realen Verkaufsdaten und einer KI-gestützten Marktanalyse.",
      items: [
        {
          title: "Aktuelle Marktdaten",
          description:
            "Wir analysieren laufend hunderte aktiver Inserate und kürzlich abgeschlossener Verkäufe in Deutschland — keine Tabellenwerte vom letzten Quartal, sondern Live-Marktrealität.",
        },
        {
          title: "Ausstattung wird bewertet",
          description:
            "Markise, Solaranlage, Mover, Klimaanlage, Sat-Schüssel, Fahrradträger — jedes Extra fließt mit eigenem Aufpreis ein und macht Ihr Ergebnis spürbar genauer als jeder Schwacke-Pauschalwert.",
        },
        {
          title: "Regional & saisonal kalibriert",
          description:
            "PLZ-genaue Nachfrage-Multiplikatoren plus saisonale Korrektur. Sie wissen sofort, ob Sie aktuell verkaufen sollten oder ob 6 Wochen Wartezeit mehrere tausend Euro Mehrerlös bringen.",
        },
        {
          title: "100 % kostenlos, keine versteckten Kosten",
          description:
            "Kein Abo, keine Zwangsanmeldung, keine Telefon-Spam-Gefahr. Sie geben Ihre Daten ein und erhalten Ihren Wert — was Sie damit machen, ist allein Ihre Entscheidung.",
        },
      ],
      ctaText: "Jetzt kostenlos Wert berechnen",
      ctaHref: "/wertrechner",
    },
    {
      title: "So funktioniert die Bewertung bei CaravanWert",
      content:
        "Drei Schritte zur Marktwert-Einschätzung — komplett online, ohne Termin, ohne Anruf eines Aufkäufers.",
      items: [
        {
          title: "1. Fahrzeug auswählen",
          description:
            "Wählen Sie Fahrzeugtyp, Hersteller und Modell aus unserer Datenbank mit über 1.400 Wohnmobil- und Wohnwagen-Varianten. Anschließend Baujahr, Laufleistung und Aufbauart angeben.",
        },
        {
          title: "2. Ausstattung & Zustand erfassen",
          description:
            "Klicken Sie Ihre Sonderausstattung an und beschreiben Sie den Pflegezustand. Je mehr Angaben, desto präziser die Bewertung — alles in unter 2 Minuten erledigt.",
        },
        {
          title: "3. Wert direkt erhalten",
          description:
            "Sie sehen sofort eine Spanne mit Mindestwert, realistischem Marktwert und Bestpreis. Optional schalten wir auf Wunsch eine Auktion mit über 1.500 verifizierten Händlern frei — Sie verkaufen am Ende nur, wenn Ihr Mindestpreis erreicht wird.",
        },
      ],
      ctaText: "Wertrechner starten",
      ctaHref: "/wertrechner",
    },
  ],
  faqItems: [
    {
      question: "Kann ich als Privatperson die Schwacke Liste kostenlos nutzen?",
      answer:
        "Nein. Schwacke verkauft seine Daten ausschließlich im Jahresabo an gewerbliche Kunden wie Banken, Versicherungen und Autohäuser. Einzelabfragen für Privatpersonen sind nicht vorgesehen. Als kostenlose Alternative empfehlen wir unseren Wertrechner, der speziell für Verbraucher entwickelt wurde.",
    },
    {
      question: "Was kostet ein Schwacke-Abo für Wohnmobile?",
      answer:
        "Schwacke-Lizenzen für Geschäftskunden beginnen bei mehreren hundert Euro pro Jahr und reichen bei vollem Datenzugang in den vierstelligen Bereich. Für eine einmalige Wohnmobil-Bewertung lohnt sich das niemals. Unser Wertrechner liefert das Ergebnis kostenlos in 2 Minuten.",
    },
    {
      question: "Wie genau ist die Schwacke Liste für Wohnmobile?",
      answer:
        "Schwacke arbeitet mit Standard-Konfigurationen und Bundes-Durchschnitten. Bei beliebten Modellen wie Hymer ML-T oder Knaus Sky Ti ist die Datengrundlage solide, bei seltenen Marken, Sonderaufbauten oder besonderer Ausstattung weichen die Werte oft 10–20 % vom realen Marktpreis ab.",
    },
    {
      question: "Ist der Wertrechner von CaravanWert wirklich kostenlos?",
      answer:
        "Ja, zu 100 %. Keine versteckten Kosten, kein Abo, keine Pflicht zur Anmeldung. Sie geben die Fahrzeugdaten ein und erhalten Ihre Bewertung sofort. Auch eine spätere Verkaufsauktion über CaravanWert kostet Verkäufer nichts — wir finanzieren uns über die Käuferseite.",
    },
    {
      question: "Welche Daten brauche ich für die Bewertung?",
      answer:
        "Hersteller, Modell, Baujahr, Erstzulassung, Kilometerstand, Aufbauart und Ihre Sonderausstattung. Für eine erste Schätzung reichen die Pflichtfelder, je mehr Details Sie angeben, desto enger wird die Werte-Spanne.",
    },
    {
      question: "Was ist der Unterschied zwischen Schwacke und DAT?",
      answer:
        "Schwacke und DAT (Deutsche Automobil Treuhand) sind die zwei großen Bewertungs-Anbieter in Deutschland. Beide arbeiten ähnlich, haben unterschiedliche Datenquellen und kommen oft zu leicht abweichenden Werten. Beide sind für Verbraucher nur indirekt zugänglich.",
    },
    {
      question: "Wie genau ist die CaravanWert-Bewertung im Vergleich zu Schwacke?",
      answer:
        "Unser Wertrechner basiert auf aktuellen Marktdaten und liefert eine Spanne mit ±10–15 % Genauigkeit. Für eine noch präzisere Einschätzung empfehlen wir zusätzlich unsere kostenlose Expertenbewertung — diese erreicht ±5–8 % Genauigkeit, vergleichbar mit professionellen Schwacke-Reports.",
    },
    {
      question: "Gibt der Schwacke-Wert den Verkaufspreis oder den Händler-Einkaufspreis an?",
      answer:
        "Schwacke veröffentlicht drei Werte: Händler-Einkaufspreis (EK), Händler-Verkaufspreis (VK) und Privatmarkt-Wert. Wenn ein Händler Ihnen ein Angebot macht, orientiert er sich am EK — dem niedrigsten Wert. Bei einem Privatverkauf oder einer Händler-Auktion erzielen Sie deutlich mehr.",
    },
    {
      question: "Berücksichtigt die Bewertung auch ältere Wohnmobile?",
      answer:
        "Ja. Wir bewerten Wohnmobile aller Baujahre — vom Klassiker aus den 90ern bis zum aktuellen Modell. Bei älteren Fahrzeugen werden Faktoren wie Originalsubstanz, dokumentierte Wartung und H-Kennzeichen-Tauglichkeit berücksichtigt.",
    },
    {
      question: "Was, wenn mein Wohnmobil nicht in der Schwacke Liste auftaucht?",
      answer:
        "Bei seltenen Modellen, Importfahrzeugen oder Eigenausbauten liefert Schwacke häufig keine Werte. Unser Algorithmus arbeitet auch dann zuverlässig, da wir vergleichbare Modelle und individuelle Ausstattungsdaten heranziehen. Für absolute Sondersfälle bieten wir die Expertenbewertung mit manueller Recherche.",
    },
    {
      question: "Wird mein TÜV-Status berücksichtigt?",
      answer:
        "Ja. Frischer TÜV (1–2 Jahre Restlaufzeit) bringt typischerweise 800 € bis 2.000 € Mehrerlös. Abgelaufener TÜV oder gravierende Mängel werden entsprechend wertmindernd berücksichtigt — geben Sie das ehrlich an, das verbessert die Genauigkeit erheblich.",
    },
    {
      question: "Kann ich auch ein Wohnwagen über die Schwacke-Alternative bewerten?",
      answer:
        "Ja. Unser Wertrechner deckt Wohnmobile (Vollintegrierte, Teilintegrierte, Alkoven, Kastenwagen, Campingbusse) und Wohnwagen (inkl. Faltcaravan und Mobilheim) gleichermaßen ab. Wählen Sie einfach beim Start den passenden Fahrzeugtyp.",
    },
    {
      question: "Werden meine Daten an Schwacke oder Dritte weitergegeben?",
      answer:
        "Nein. Wir geben Ihre Daten nicht an Schwacke, DAT oder andere Drittanbieter weiter. Die Bewertung erfolgt vollständig auf unseren Servern in der EU, DSGVO-konform. Sie können jederzeit die Löschung Ihrer Daten beantragen.",
    },
    {
      question: "Wie oft werden die Marktdaten aktualisiert?",
      answer:
        "Unsere Datenbasis wird wöchentlich aktualisiert. Schwacke liefert seinen Geschäftskunden monatlich Updates. In einem volatilen Markt wie 2023–2026 macht das einen spürbaren Unterschied bei der Genauigkeit aktueller Bewertungen.",
    },
    {
      question: "Was mache ich nach der Bewertung?",
      answer:
        "Sie haben drei Optionen: (1) Den Wert nur zur Information nutzen — komplett unverbindlich. (2) Eine kostenlose Expertenbewertung anfordern für eine präzisere Einschätzung. (3) Ihr Wohnmobil über unsere Auktionsplattform an über 1.500 verifizierte Händler verkaufen — Sie setzen Ihren Mindestpreis und entscheiden am Ende selbst.",
    },
    {
      question: "Ist die Bewertung als Gutachten rechtlich verwendbar?",
      answer:
        "Nein, weder unsere Bewertung noch eine Schwacke-Auskunft sind ein offizielles Gutachten. Für rechtliche Zwecke (Erbschaft, Scheidung, Versicherungsschaden) brauchen Sie einen zertifizierten Sachverständigen. Für den Verkauf reicht unsere Marktwert-Einschätzung in der Regel vollkommen aus.",
    },
    {
      question: "Wie unterscheidet sich CaravanWert vom Schwacke-Restwert?",
      answer:
        "Der Schwacke-Restwert prognostiziert den theoretischen Wert eines Fahrzeugs in einem zukünftigen Zeitpunkt — relevant für Leasing-Kalkulationen. Wir liefern den aktuellen Marktwert, also was Sie heute realistisch beim Verkauf erzielen würden. Für Privatverkäufer ist der Marktwert die einzig wirklich relevante Zahl.",
    },
  ],
  relatedSlugs: [
    "wohnmobil-verkaufspreis",
    "wohnmobilpreise-2026",
    "wohnmobil-wertermittlung-kostenlos",
    "was-ist-mein-wohnmobil-wert",
    "wohnmobil-verkaufen",
  ],
};
