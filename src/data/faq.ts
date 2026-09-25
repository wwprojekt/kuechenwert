/**
 * FAQ – einzige Quelle für die sichtbare FAQ (Startseite, /faq) und das
 * Schema.org-FAQPage-Markup. Google wertet Abweichungen zwischen Markup und
 * sichtbarem Text als Spam, deshalb nie an zwei Stellen pflegen.
 *
 * Fristen und Abläufe müssen zu kw_marketplace_settings passen
 * (Ausschreibung 168 h, Unterbieten 72 h, Entscheidung 21 Tage, max. 3 Kontakte).
 */
export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Was kostet mich KüchenWert?",
    answer:
      "Für Sie als Privatkunde ist KüchenWert komplett kostenlos – Konfigurator, KI-Visualisierung, Preisschätzung, Angebotsvergleich und Beratung. Wir finanzieren uns ausschließlich über die Küchenstudios: Diese zahlen für freigeschaltete Kontakte und eine Provision, wenn Sie ihr Angebot annehmen.",
  },
  {
    question: "Wie funktioniert die KI-Visualisierung meiner Küche?",
    answer:
      "Sie laden ein Foto Ihres Raums hoch – am besten frontal und bei Tageslicht – und geben die Wandmaße an. Dann wählen Sie Stil, Fronten, Arbeitsplatte, Griffe und Geräte. Die KI setzt die neue Küche fotorealistisch in Ihr Foto; Wände, Fenster und Boden bleiben erhalten. Das dauert meist unter einer Minute, weitere Varianten erzeugen Sie mit einem Klick. Ohne Foto entsteht eine freie Visualisierung auf Basis Ihrer Angaben.",
  },
  {
    question: "Wie genau ist die Preisschätzung?",
    answer:
      "Die Schätzung berechnet sich aus Laufmetern, Ausstattungslinie, Fronten, Arbeitsplatte, Geräten, Extras und den gewählten Leistungen wie Lieferung und Montage – mit regionalem Preisfaktor. Sie zeigt eine realistische Spanne für Studio-Preise. Verbindlich ist erst das Angebot eines Studios nach dem Aufmaß vor Ort.",
  },
  {
    question: "Wie läuft die Angebotsphase ab?",
    answer:
      "Nach dem Absenden wird Ihr Projekt anonymisiert an geprüfte Studios in Ihrer Region ausgeschrieben – für 7 Tage, beim Unterbieten eines vorhandenen Angebots für 72 Stunden. Studios sehen Maße, Wünsche und Visualisierung, aber weder Ihren Namen noch Ihre Kontaktdaten. Jedes Studio kann ein Angebot abgeben und es danach nur noch senken. Alle Angebote sehen Sie auf Ihrer persönlichen Projektseite; anschließend haben Sie 21 Tage Zeit für Ihre Entscheidung.",
  },
  {
    question: "Was unterscheidet KüchenWert von anderen Küchenportalen?",
    answer:
      "Drei Dinge: 1) Sie sehen Ihre Küche per KI im eigenen Raum, bevor Sie mit einem Studio sprechen – inklusive Preisschätzung. 2) Studios bieten um Ihr Projekt und können ihr Angebot nur senken, statt dass Sie Angebote einzeln einholen. 3) Ein vorhandenes Studio-Angebot lassen Sie in einer 72-Stunden-Auktion unterbieten – nach einem kostenlosen Experten-Check.",
  },
  {
    question: "Wie funktioniert das Unterbieten eines vorhandenen Angebots?",
    answer:
      "Sie laden Ihr Studio-Angebot, ein Bild der geplanten Küche und den Angebotspreis hoch. Unser Team prüft und neutralisiert das Angebot (der Studio-Name wird nicht weitergegeben) und stellt es für 72 Stunden in unser Studio-Netzwerk. Geprüfte Küchenstudios bieten Ihnen einen günstigeren Preis für dieselbe oder eine vergleichbare Ausstattung. Sie nehmen das beste Angebot an – oder lehnen alle ab.",
  },
  {
    question: "Wie werden die Küchenstudios geprüft?",
    answer:
      "Jedes Partner-Studio durchläuft unser KYC/KYB-Verfahren: Gewerbeanmeldung, USt-ID, Handelsregisterauszug und Versicherungsschutz werden geprüft. Laufend überwachen wir Kundenzufriedenheit und Zahlungsmoral. Studios, die negativ auffallen, werden aus dem Netzwerk entfernt.",
  },
  {
    question: "Bin ich zu einem Kauf verpflichtet?",
    answer:
      "Nein. Weder Ihr Projekt noch ein Angebot verpflichtet Sie zu etwas. Nehmen Sie ein Angebot auf der Projektseite an, erhält das Studio Ihre Kontaktdaten und vereinbart mit Ihnen einen Termin für Aufmaß und Detailplanung. Den Kaufvertrag schließen Sie erst danach direkt mit dem Studio.",
  },
  {
    question: "Wie lange dauert es bis zu den ersten Angeboten?",
    answer:
      "Preisschätzung und KI-Vorschau sehen Sie im Konfigurator sofort. Erste Studio-Angebote kommen meist innerhalb von 48 Stunden, die Angebotsphase läuft 7 Tage – beim Unterbieten 72 Stunden. Über jedes neue Angebot informieren wir Sie per E-Mail.",
  },
  {
    question: "Welche Küchenstudios sind im Netzwerk?",
    answer:
      "Unsere Partner umfassen alle Größen: vom inhabergeführten Küchenstudio über regionale Küchenzentren bis zu großen Möbelhäusern. Welche Studios Ihr Projekt sehen, hängt von deren Einzugsgebiet ab. Marken wie Nobilia, Häcker, Nolte, SieMatic, Schüller, Bulthaup u. v. a. sind über unsere Partner erhältlich.",
  },
  {
    question: "Was, wenn ich nur eine ungefähre Preisvorstellung haben will?",
    answer:
      "Dafür gibt es den KüchenRechner: In 30 Sekunden beantworten Sie 4–5 Fragen zu Größe, Stil und Ausstattung und sehen eine realistische Preisspanne – ohne Kontaktdaten. Detaillierter wird es im Konfigurator, der die Preisspanne mit jeder Auswahl live anpasst.",
  },
  {
    question: "Was passiert mit meinen Daten?",
    answer:
      "Ihre Daten werden DSGVO-konform auf Servern in der EU verarbeitet. Studios sehen Ihr Projekt nur anonymisiert: PLZ-Bereich, Maße, Wünsche und Visualisierung. Ihre Kontaktdaten erhalten – nur mit Ihrer Einwilligung – höchstens drei Studios für Rückfragen sowie das Studio, dessen Angebot Sie annehmen. Sie können jederzeit Auskunft oder Löschung verlangen.",
  },
  {
    question: "Wie finde ich mein Projekt und meine Angebote wieder?",
    answer:
      "Nach dem Absenden erhalten Sie per E-Mail einen persönlichen Link zu Ihrer Projektseite. Link verloren? Unter „Mein Projekt“ (kuechenwert24.de/projekt) fordern Sie ihn mit Ihrer E-Mail-Adresse jederzeit neu an.",
  },
];
