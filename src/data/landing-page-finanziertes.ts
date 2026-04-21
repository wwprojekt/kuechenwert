import type { LandingPageConfig } from "./landing-page-types";

export const finanziertesWohnmobilVerkaufen: LandingPageConfig = {
  slug: "finanziertes-wohnmobil-verkaufen",
  path: "/finanziertes-wohnmobil-verkaufen",
  title: "Finanziertes Wohnmobil verkaufen: Ablösung erklärt",
  metaDescription:
    "Wohnmobil mit laufender Finanzierung verkaufen: Anleitung, Vorfälligkeitsentschädigung, Ablösesumme & Käufer übernimmt Restschuld — sicher und ohne Risiko.",
  keywords:
    "finanziertes wohnmobil verkaufen, wohnmobil mit finanzierung verkaufen, wohnmobil verkaufen kredit, wohnmobil ablösen verkaufen, wohnmobil verkaufen restschuld, wohnmobil kredit verkaufen, finanziertes reisemobil verkaufen, wohnmobil ablöse verkauf",
  h1: "Finanziertes Wohnmobil verkaufen — so geht's sicher",
  heroSubtitle:
    "Auch bei laufender Finanzierung können Sie Ihr Wohnmobil jederzeit verkaufen. Wir erklären beide möglichen Wege, wie Sie die Vorfälligkeitsentschädigung minimieren und wie der Käufer die Restschuld direkt ablöst — ohne dass Sie das Geld vorstrecken müssen.",
  primaryCta: { text: "Sicher verkaufen — Auktion starten", href: "/verkaufen/wizard" },
  secondaryCta: { text: "Marktwert kostenlos berechnen", href: "/wertrechner" },
  sections: [
    {
      title: "Verkauf trotz laufender Finanzierung — die Grundlagen",
      content:
        "Etwa 50 % aller Wohnmobil-Käufer finanzieren ihr Fahrzeug. Wenn sich die Lebenssituation ändert (Krankheit, Scheidung, finanzielle Engpässe, Umzug), wollen viele das Wohnmobil verkaufen — sind aber unsicher, ob das überhaupt geht. Die kurze Antwort: Ja, es geht. Hier sind die wichtigsten Fakten.",
      items: [
        {
          title: "Bank ist formal Eigentümer",
          description:
            "Bei einer typischen Wohnmobil-Finanzierung hat die Bank den Fahrzeugbrief (ZB II) als Sicherheit. Sie sind zwar Halter, aber rechtlich nicht voller Eigentümer — das wird die Bank erst nach vollständiger Tilgung.",
        },
        {
          title: "Sie dürfen trotzdem verkaufen",
          description:
            "Der Verkauf ist erlaubt, solange Sie die Finanzierung im Zuge des Verkaufs ablösen. Das geht entweder, indem Sie die Restschuld vorab bezahlen und den Brief abholen, oder indem der Käufer die Restschuld direkt an die Bank überweist.",
        },
        {
          title: "Vorfälligkeitsentschädigung: meist überschaubar",
          description:
            "Bei vorzeitiger Kreditablösung darf die Bank eine Vorfälligkeitsentschädigung berechnen. Bei Konsumkrediten ist diese gesetzlich auf max. 1 % der Restschuld begrenzt — bei einer Restschuld von 30.000 € also maximal 300 €.",
        },
        {
          title: "Negativer Verkaufserlös ist möglich",
          description:
            "Wenn der aktuelle Marktwert unter der Restschuld liegt, müssen Sie die Differenz aus eigener Tasche zahlen. Beispiel: Restschuld 45.000 €, Marktwert 38.000 € = Sie müssen 7.000 € draufzahlen, um den Kredit ablösen zu können.",
        },
      ],
      ctaText: "Aktuelle Restwert-Lücke prüfen",
      ctaHref: "/wertrechner",
    },
    {
      title: "Variante A: Sie lösen den Kredit selbst ab",
      content:
        "Sie zahlen die Restschuld vorab aus eigenen Mitteln, holen den Fahrzeugbrief ab und verkaufen das Wohnmobil dann als Vollvereigentümer. Geeignet, wenn Sie über die nötige Liquidität verfügen.",
      items: [
        {
          title: "Schritt 1: Ablösesumme anfordern",
          description:
            "Schreiben Sie an Ihre Bank: „Bitte teilen Sie mir die Ablösesumme zum Datum X mit.\" Innerhalb von 5–10 Werktagen erhalten Sie ein verbindliches Schreiben mit Ablösebetrag und Stichtag.",
        },
        {
          title: "Schritt 2: Restschuld überweisen",
          description:
            "Sie überweisen den Betrag exakt zum genannten Stichtag. Wichtig: pünktlich, exakt der angegebene Betrag, mit korrektem Verwendungszweck (Kreditnummer).",
        },
        {
          title: "Schritt 3: Fahrzeugbrief abholen",
          description:
            "Nach Geldeingang sendet die Bank den Brief per Einschreiben oder Sie holen ihn vor Ort ab. Empfehlung: persönliche Abholung. Spart 5–7 Tage Wartezeit und Sie haben den Brief sicher in der Hand.",
        },
        {
          title: "Schritt 4: Wohnmobil verkaufen",
          description:
            "Mit Brief in der Hand sind Sie voller Eigentümer und können ohne Einschränkungen verkaufen — privat oder über Auktionsplattform.",
        },
        {
          title: "Vorteil",
          description:
            "Maximal flexibel, schneller Verkaufsprozess danach, klare Eigentumsverhältnisse, alle Verkaufsoptionen offen.",
        },
        {
          title: "Nachteil",
          description:
            "Sie strecken die Restschuld vor und binden bis zum tatsächlichen Verkauf Geld. Wenn der Verkauf länger dauert, kann das zum Liquiditätsproblem werden.",
        },
      ],
    },
    {
      title: "Variante B: Käufer löst den Kredit ab — empfohlen",
      content:
        "Der Käufer überweist die Restschuld direkt an Ihre Bank, den Restbetrag bekommen Sie. Sie müssen nichts vorstrecken. Diese Variante ist bei Auktionsplattformen wie CaravanWert die Standard-Lösung.",
      items: [
        {
          title: "Schritt 1: Ablösesumme anfordern (siehe Variante A)",
          description:
            "Wieder das Schreiben an die Bank mit verbindlicher Ablösesumme. Wichtig: Diese Information brauchen Sie, um dem Käufer (oder der Auktionsplattform) den genauen Betrag zu nennen.",
        },
        {
          title: "Schritt 2: Im Inserat / Auktion offenlegen",
          description:
            "Geben Sie an: „Fahrzeug ist finanziert, Restschuld zum Datum X = Y €\". Das ist Pflicht (verschwiegene Finanzierung kann zur Vertragsanfechtung führen) und schreckt seriöse Käufer nicht ab — Händler kennen das Verfahren.",
        },
        {
          title: "Schritt 3: Käufer überweist 2-fach",
          description:
            "Bei Übergabe: Käufer überweist Restschuldbetrag direkt an Ihre Bank, Differenzbetrag (Verkaufspreis minus Restschuld) direkt an Sie. Beides per Echtzeit-Überweisung — Sie sehen das Geldeingang in Echtzeit auf beiden Konten.",
        },
        {
          title: "Schritt 4: Bank gibt Brief frei",
          description:
            "Sobald die Restschuld bei der Bank eingegangen ist, gibt diese den Fahrzeugbrief frei (meist innerhalb 1–3 Werktage). Bank schickt den Brief direkt an den Käufer oder Sie übermitteln ihn.",
        },
        {
          title: "Vorteil",
          description:
            "Sie strecken nichts vor, kein Liquiditätsrisiko. Sicherer Geldfluss durch Echtzeit-Überweisung. Für den Käufer ein etabliertes Verfahren — Händler beherrschen das routiniert.",
        },
        {
          title: "Nachteil",
          description:
            "Etwas mehr organisatorischer Aufwand bei Übergabe. Setzt vertrauenswürdigen Käufer voraus, der die Übergabe der Bank vertraut. Bei seriösen Plattformen (z.B. CaravanWert) ist das Standard.",
        },
      ],
      ctaText: "Sichere Auktion mit Käufer-Ablöse starten",
      ctaHref: "/verkaufen/wizard",
    },
    {
      title: "Sonderfall: Fahrzeugwert unter Restschuld („Unterwasser-Kredit\")",
      content:
        "Aktuell besonders relevant: Bei Wohnmobilen, die 2021–2022 zu Höchstpreisen finanziert wurden, ist der heutige Marktwert oft 15–25 % unter der Restschuld. Was tun?",
      items: [
        {
          title: "Option 1: Die Differenz aus eigenen Mitteln zahlen",
          description:
            "Sie verkaufen für 40.000 €, Restschuld ist 50.000 € — Sie zahlen die 10.000 € aus eigener Tasche zur Bank. Schmerzhaft, aber rechtlich sauber und beendet das Verlustgeschäft.",
        },
        {
          title: "Option 2: Mit der Bank verhandeln",
          description:
            "In besonderen Härtefällen (Krankheit, Arbeitslosigkeit, Scheidung) lassen sich manchmal Stundungen, Tilgungspausen oder sogar Kompromisse aushandeln. Frühzeitig das Gespräch suchen, schriftlich dokumentieren.",
        },
        {
          title: "Option 3: Restkredit als Konsumkredit umschulden",
          description:
            "Sie tilgen den Wohnmobil-Kredit aus dem Verkaufserlös bis zum Marktwert, der Rest läuft als unbesicherter Konsumkredit weiter. Funktioniert bei guter Bonität, aber meist mit höheren Zinsen.",
        },
        {
          title: "Option 4: Verkauf hinauszögern",
          description:
            "Riskant, da der Markt aktuell weiter fällt. Die Lücke vergrößert sich tendenziell, statt zu schließen. Nur sinnvoll, wenn Sie die Tilgung problemlos weiter bedienen können und das Wohnmobil noch aktiv nutzen.",
        },
      ],
    },
    {
      title: "Sicher verkaufen mit CaravanWert — auch bei Finanzierung",
      content:
        "Unsere Auktionsplattform ist speziell darauf ausgelegt, auch komplexere Fälle wie Finanzierungen reibungslos abzuwickeln. Die teilnehmenden Händler haben Erfahrung mit Bank-Ablösen und übernehmen die Koordination.",
      items: [
        {
          title: "Händler kennen das Verfahren",
          description:
            "Alle 1.500+ teilnehmenden Händler haben routinemäßig mit Bank-Ablösen zu tun. Die Übergabe wird professionell koordiniert: zwei Echtzeit-Überweisungen, Übergabeprotokoll, Bank-Bestätigung.",
        },
        {
          title: "Ablöse-Daten in Inserat angeben",
          description:
            "In unserem Verkaufs-Wizard können Sie die Restschuld direkt angeben. Die Händler bieten dann mit dieser Information — Sie sehen netto-faire Gebote, ohne nachverhandeln zu müssen.",
        },
        {
          title: "Schnelle Abwicklung",
          description:
            "Vom Auktionsende bis zur abgeschlossenen Ablösung und Brief-Freigabe vergehen typischerweise 5–10 Werktage. Deutlich schneller als ein Privatverkauf, der oft an genau dieser Komplexität scheitert.",
        },
      ],
      ctaText: "Verkauf mit Finanzierung starten",
      ctaHref: "/verkaufen/wizard",
    },
  ],
  faqItems: [
    {
      question: "Kann ich mein finanziertes Wohnmobil verkaufen?",
      answer:
        "Ja, jederzeit. Voraussetzung ist, dass die Restschuld im Zuge des Verkaufs vollständig getilgt wird — entweder vorab durch Sie, oder bei Übergabe durch den Käufer (Variante B, empfohlen).",
    },
    {
      question: "Was kostet die vorzeitige Kreditablösung?",
      answer:
        "Die Vorfälligkeitsentschädigung. Bei Konsumkrediten gesetzlich auf max. 1 % der Restschuld begrenzt (0,5 % wenn Restlaufzeit unter 12 Monaten). Bei einer Restschuld von 30.000 € maximal 300 €. Im Vergleich zum Vorteil eines schnellen Verkaufs marginal.",
    },
    {
      question: "Wie erfahre ich die exakte Ablösesumme?",
      answer:
        "Schriftliche Anfrage an die Bank, formloses Schreiben oder Online-Banking-Funktion. Bank antwortet in 5–10 Werktagen mit verbindlicher Ablösesumme zu einem konkreten Stichtag. Wichtig: Stichtag einhalten, da sich die Ablösesumme täglich ändert.",
    },
    {
      question: "Was passiert, wenn der Verkaufserlös unter der Restschuld liegt?",
      answer:
        "Sie müssen die Differenz aus eigenen Mitteln aufbringen, um die Bank vollständig auszulösen und den Brief freizubekommen. Aktuell besonders relevant bei 2021/22 finanzierten Fahrzeugen — Marktwerte sind teils 15–25 % unter der Restschuld.",
    },
    {
      question: "Kann ich mit der Bank über die Restschuld verhandeln?",
      answer:
        "In Härtefällen (Krankheit, Arbeitslosigkeit, Scheidung) durchaus möglich. Stundung, Tilgungspause oder im Extremfall ein Schuldenerlass-Kompromiss. Setzt seriöse, frühzeitige Kommunikation und Dokumentation voraus. Standard ist das aber nicht.",
    },
    {
      question: "Brauche ich für den Verkauf den Fahrzeugbrief?",
      answer:
        "Für die finale Übereignung an den Käufer ja. Ohne Brief gibt es keinen rechtmäßigen Eigentumsübergang. Bei Variante A holen Sie den Brief vorab bei der Bank ab, bei Variante B übermittelt die Bank den Brief direkt nach Tilgungseingang an den Käufer.",
    },
    {
      question: "Wie informiere ich potenzielle Käufer über die Finanzierung?",
      answer:
        "Offen und sofort. Schreiben Sie ins Inserat: „Fahrzeug ist finanziert. Restschuld zum [Datum]: ca. X €. Käufer kann Restschuld direkt an die Bank überweisen, Restbetrag an Verkäufer.\" Verschweigen ist rechtlich riskant (Vertragsanfechtung möglich).",
    },
    {
      question: "Kaufen Händler auch finanzierte Wohnmobile?",
      answer:
        "Ja, sehr häufig sogar. Viele Wohnmobile auf dem Markt sind finanziert, Händler beherrschen die Bank-Ablöse routiniert. Kein Hindernis für den Verkauf, kein Preisabschlag wegen der Finanzierung selbst.",
    },
    {
      question: "Wie lange dauert die Bank-Brief-Freigabe?",
      answer:
        "Nach Eingang der vollständigen Ablösesumme: meist 1–3 Werktage. Bei größeren Banken auch mal 5–7 Werktage. Bei zügiger Verkaufsabwicklung ist diese Wartezeit der häufigste Engpass.",
    },
    {
      question: "Kann der Käufer die Finanzierung übernehmen statt sie abzulösen?",
      answer:
        "Theoretisch ja, praktisch fast nie umsetzbar. Setzt voraus, dass der Käufer die Bonität für genau diesen Kredit hat und die Bank zustimmt. In der Realität ablösen + neuer Kredit beim Käufer ist deutlich einfacher.",
    },
    {
      question: "Was ist mit Leasingverträgen?",
      answer:
        "Anderes Thema. Bei Leasing gehört Ihnen das Fahrzeug nie — die Leasinggesellschaft ist immer Eigentümer. Vorzeitige Beendigung erfordert eine Übernahme des Restwertes oder Verhandlung mit der Leasinggesellschaft. Komplexer als Finanzierung, aber lösbar.",
    },
    {
      question: "Wie wird die Übergabe bei finanziertem Verkauf konkret abgewickelt?",
      answer:
        "Vor Ort beim Verkäufer: 1) Käufer prüft Fahrzeug. 2) Käufer überweist Restschuldbetrag an Bank (Echtzeit-Überweisung). 3) Käufer überweist Differenzbetrag an Verkäufer (Echtzeit-Überweisung). 4) Sie sehen beide Eingänge bestätigt. 5) Schlüsselübergabe und Übergabeprotokoll. 6) Bank schickt Brief in 1–3 Tagen an Käufer.",
    },
    {
      question: "Was ist, wenn die Echtzeit-Überweisung scheitert?",
      answer:
        "Selten, aber möglich. Übliche Lösung: Käufer und Verkäufer fahren gemeinsam zur Bank des Verkäufers, der Käufer überweist klassisch und wartet die manuelle Buchung ab. Dauert 1–2 Stunden statt 30 Sekunden.",
    },
    {
      question: "Sollte ich die Finanzierung erst tilgen und dann verkaufen?",
      answer:
        "Nur wenn Sie die Liquidität haben und den Verkauf zeitnah erwarten. Sonst binden Sie das Geld in einem Vermögenswert, der weiter an Wert verliert. Variante B (Käufer löst ab) ist meist die wirtschaftlich bessere Option.",
    },
    {
      question: "Was kostet der Verkauf über CaravanWert bei Finanzierung?",
      answer:
        "Für Sie als Verkäufer: 0 €. Auch der zusätzliche Aufwand der Bank-Koordination ist im Service inklusive. Die Vermittlungsprovision zahlt der Händler bei erfolgreichem Ankauf.",
    },
    {
      question: "Was passiert mit der Vorfälligkeitsentschädigung?",
      answer:
        "Die wird vom Verkäufer getragen, da sie ein Kostenbestandteil seiner Finanzierung ist. Sie wird in der Ablösesumme der Bank bereits eingerechnet, also automatisch beglichen wenn die Restschuld überwiesen wird.",
    },
    {
      question: "Kann ich auch mit Rest-Finanzierung gleich ein neues Wohnmobil kaufen?",
      answer:
        "Ja, sofern Ihre Bonität es erlaubt. Häufiges Szenario: alter Wohnmobil-Kredit wird abgelöst, gleichzeitig neuer Kredit für das Nachfolgefahrzeug. Bei dieser Konstellation lässt sich ggf. mit der Bank über günstigere Konditionen verhandeln.",
    },
  ],
  relatedSlugs: [
    "wir-kaufen-dein-wohnmobil",
    "wohnmobil-ankauf-ratgeber",
    "wohnmobil-verkaufen",
    "wohnmobil-wertermittlung-kostenlos",
  ],
};
