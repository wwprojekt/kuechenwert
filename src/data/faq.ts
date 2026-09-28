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
    question: "Wie verdient KüchenWert Geld?",
    answer:
      "Nicht an Ihnen: Für Privatkunden ist KüchenWert kostenlos und unverbindlich. Küchenstudios zahlen eine optionale Gebühr, wenn sie Ihre Kontaktdaten für Rückfragen freischalten, und eine Provision, wenn Sie ihr Angebot annehmen. Die Angebote auf Ihrer Projektseite sind nach Preis sortiert – bezahlte Platzierungen gibt es nicht.",
  },
  {
    question: "Wie funktioniert die KI-Visualisierung meiner Küche?",
    answer:
      "Sie laden ein Foto Ihres Raums hoch – am besten frontal und bei Tageslicht – und geben die Wandmaße an. Dann wählen Sie Stil, Fronten, Arbeitsplatte, Griffe und Geräte. Die KI setzt die neue Küche fotorealistisch in Ihr Foto; Wände, Fenster und Boden bleiben erhalten. Das dauert meist unter einer Minute, weitere Varianten erzeugen Sie mit einem Klick. Für die Berechnung übermitteln wir das Foto an einen KI-Dienst mit Sitz in den USA. Ohne Foto entsteht eine freie Visualisierung auf Basis Ihrer Angaben.",
  },
  {
    question: "Wie genau ist die Preisschätzung?",
    answer:
      "Die Schätzung berechnet sich aus Laufmetern, Ausstattungslinie, Fronten, Arbeitsplatte, Geräten, Extras und den gewählten Leistungen wie Lieferung und Montage – mit regionalem Preisfaktor. Sie ist ein Richtwert zur Orientierung, keine verbindliche Preisauskunft. Verbindlich ist erst das Angebot eines Studios nach dem Aufmaß vor Ort.",
  },
  {
    question: "Wie läuft die Angebotsphase ab?",
    answer:
      "Nach dem Absenden stellen wir Ihr Projekt ohne Ihren Namen geprüften Studios in Ihrer Region vor – für 7 Tage, beim Unterbieten eines vorhandenen Angebots für 72 Stunden. Studios sehen zunächst nur PLZ-Bereich, Maße, Wünsche und Visualisierung. Jedes Studio kann ein Angebot abgeben und es danach nur noch senken. Alle Angebote sehen Sie auf Ihrer persönlichen Projektseite; anschließend haben Sie 21 Tage Zeit für Ihre Entscheidung.",
  },
  {
    question: "Was unterscheidet KüchenWert von anderen Küchenportalen?",
    answer:
      "Drei Dinge: 1) Sie sehen Ihre Küche per KI im eigenen Raum, bevor Sie mit einem Studio sprechen – inklusive Preisschätzung. 2) Studios machen Ihnen Angebote und können ein abgegebenes Angebot nur noch senken – Sie müssen nicht jedes Studio einzeln anfragen. 3) Ein vorhandenes Studio-Angebot können andere Studios 72 Stunden lang unterbieten – nach einem kurzen, kostenlosen Telefonat mit unserem Team.",
  },
  {
    question: "Wie funktioniert das Unterbieten eines vorhandenen Angebots?",
    answer:
      "Sie laden Ihr Studio-Angebot, ein Bild der geplanten Küche und den Angebotspreis hoch. Nach einem kurzen Telefonat mit unserem Team stellen wir das Angebot ohne Ihren Namen und ohne den Namen des Studios 72 Stunden lang geprüften Küchenstudios aus Ihrer Region vor. Diese können Ihnen ein günstigeres Angebot für dieselbe oder eine vergleichbare Ausstattung machen. Sie nehmen das beste Angebot an – oder lehnen alle ab.",
  },
  {
    question: "Wie prüfen Sie die Küchenstudios?",
    answer:
      "Jedes Küchenstudio wird vor der Freischaltung von unserem Team manuell geprüft – erst dann sieht es Projekte. Dabei prüfen wir die Angaben zum Unternehmen und fordern bei Bedarf Nachweise wie einen Gewerbenachweis an. Eine Garantie für die Arbeit eines Studios ist das nicht: Den Kaufvertrag schließen Sie direkt mit dem Studio.",
  },
  {
    question: "Bin ich zu einem Kauf verpflichtet?",
    answer:
      "Nein. Weder Ihr Projekt noch ein Angebot verpflichtet Sie zu etwas. Nehmen Sie ein Angebot auf der Projektseite an, erhält das Studio Ihre Kontaktdaten und vereinbart mit Ihnen einen Termin für Aufmaß und Detailplanung. Den Kaufvertrag schließen Sie erst danach direkt mit dem Studio.",
  },
  {
    question: "Wann bekomme ich die ersten Angebote?",
    answer:
      "Preisschätzung und KI-Vorschau sehen Sie im Konfigurator sofort. Studio-Angebote können während der gesamten Angebotsphase eingehen: 7 Tage bei einer neuen Anfrage, 72 Stunden beim Unterbieten eines vorhandenen Angebots. Über jedes neue Angebot informieren wir Sie per E-Mail. Nehmen in Ihrer Region noch keine Studios teil, melden wir uns persönlich bei Ihnen.",
  },
  {
    question: "Welche Küchenstudios machen mit?",
    answer:
      "Mitmachen können Küchenstudios und Küchenfachhändler, die sich bei uns registrieren und nach der Prüfung durch unser Team freigeschaltet werden. Unser Studio-Netzwerk wächst regional: Welche Studios Ihr Projekt sehen, hängt von deren Einzugsgebiet ab. Welche Marken ein Studio anbietet, sehen Sie in seinem Angebot.",
  },
  {
    question: "Was, wenn ich nur eine ungefähre Preisvorstellung haben will?",
    answer:
      "Dafür gibt es den KüchenRechner: Sie beantworten 4 kurze Fragen zu Größe, Ausstattung, Geräten und Region und sehen eine Preisspanne – ohne Kontaktdaten. Die Werte sind Richtwerte auf Basis öffentlich verfügbarer Marktpreise, keine verbindliche Preisauskunft. Detaillierter wird es im Konfigurator, der die Preisspanne mit jeder Auswahl live anpasst.",
  },
  {
    question: "Was passiert mit meinen Daten?",
    answer:
      "Ihre Anfrage liegt in einer Datenbank in Frankfurt (EU). Für einzelne Dienste wie die KI-Visualisierung, den E-Mail-Versand und den Bot-Schutz setzen wir Anbieter mit Sitz in den USA ein – Details in der Datenschutzerklärung. Studios sehen Ihr Projekt zunächst ohne Ihren Namen: PLZ-Bereich, Maße, Wünsche und Visualisierung. Ihre Kontaktdaten erhalten höchstens drei Studios für Rückfragen sowie das Studio, dessen Angebot Sie annehmen. Sie können jederzeit Auskunft oder Löschung verlangen.",
  },
  {
    question: "Wie finde ich mein Projekt und meine Angebote wieder?",
    answer:
      "Nach dem Absenden erhalten Sie per E-Mail einen persönlichen Link zu Ihrer Projektseite. Link verloren? Unter „Mein Projekt“ (kuechenwert24.de/projekt) fordern Sie ihn mit Ihrer E-Mail-Adresse jederzeit neu an.",
  },
];
