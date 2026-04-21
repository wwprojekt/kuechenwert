import type { LandingPageConfig } from "./landing-page-types";

export const finanziertenWohnwagenVerkaufen: LandingPageConfig = {
  slug: "finanzierten-wohnwagen-verkaufen",
  path: "/finanzierten-wohnwagen-verkaufen",
  title: "Finanzierten Wohnwagen verkaufen — Anleitung",
  metaDescription:
    "Wohnwagen mit laufender Finanzierung verkaufen: Anleitung, Vorfälligkeitsentschädigung, Käufer übernimmt Restschuld — sicher und ohne Risiko abwickeln.",
  keywords:
    "finanzierten wohnwagen verkaufen, wohnwagen mit finanzierung verkaufen, wohnwagen verkaufen kredit, wohnwagen ablösen verkaufen, wohnwagen verkaufen restschuld, wohnwagen kredit verkaufen, finanzierten caravan verkaufen, wohnwagen ablöse verkauf",
  h1: "Finanzierten Wohnwagen verkaufen — so geht's sicher",
  heroSubtitle:
    "Auch bei laufender Finanzierung können Sie Ihren Wohnwagen jederzeit verkaufen. Wir erklären beide möglichen Wege, wie Sie die Vorfälligkeitsentschädigung minimieren und wie der Käufer die Restschuld direkt ablöst — ohne dass Sie das Geld vorstrecken müssen.",
  primaryCta: { text: "Sicher verkaufen — Auktion starten", href: "/verkaufen/wizard" },
  secondaryCta: { text: "Marktwert kostenlos berechnen", href: "/wertrechner" },
  sections: [
    {
      title: "Geht das überhaupt — Wohnwagen mit Finanzierung verkaufen?",
      content:
        "Ja, auf jeden Fall. Anders als bei Immobilien ist der Verkauf eines finanzierten Wohnwagens unkompliziert — wenn man die richtigen Schritte kennt. Hier die wichtigsten Fakten:",
      items: [
        {
          title: "Sie sind in den meisten Fällen Eigentümer",
          description:
            "Bei den meisten Wohnwagen-Krediten (Privatkredite, Konsumkredite) sind Sie als Käufer Eigentümer. Die Bank hat zwar einen Sicherungsanspruch, aber der Wohnwagen gehört Ihnen — Sie können ihn verkaufen.",
        },
        {
          title: "Bei Sicherungsübereignung: Bank-Freigabe nötig",
          description:
            "Manche Kreditverträge enthalten eine Sicherungsübereignung — die Bank ist dann „im Hintergrund\" Eigentümer, bis der Kredit getilgt ist. Verkauf erfordert dann eine Freigabe der Bank (formloser Antrag, meist innerhalb 5–10 Werktagen erteilt).",
        },
        {
          title: "Die Restschuld muss bei Verkauf abgelöst werden",
          description:
            "Egal welche Variante: der Restkredit wird mit dem Verkaufserlös getilgt. Wenn der Verkaufspreis höher ist als die Restschuld → Sie bekommen die Differenz. Wenn niedriger → Sie müssen die Differenz aus eigener Tasche zuzahlen.",
        },
        {
          title: "Vorfälligkeitsentschädigung möglich",
          description:
            "Bei vorzeitiger Tilgung kann die Bank eine Vorfälligkeitsentschädigung verlangen. Für Verbraucherkredite ist diese gesetzlich auf maximal 1 % der Restschuld bzw. 0,5 % bei Restlaufzeit unter 12 Monaten gedeckelt.",
        },
      ],
      ctaText: "Marktwert berechnen",
      ctaHref: "/wertrechner",
    },
    {
      title: "Schritt-für-Schritt: So funktioniert der Verkauf konkret",
      content:
        "Egal ob Sie privat oder über CaravanWert verkaufen — diese 6 Schritte sind identisch:",
      items: [
        {
          title: "Schritt 1: Restschuldanforderung bei der Bank holen",
          description:
            "Anrufen oder online im Kundenportal nachschauen: aktuelle Restschuld auf den voraussichtlichen Verkaufstag, inklusive Vorfälligkeitsentschädigung. Schriftliche Bestätigung anfordern (kostenlos).",
        },
        {
          title: "Schritt 2: Marktwert ermitteln",
          description:
            "CaravanWert-Wertrechner nutzen. Sie sehen sofort, ob Ihr Verkaufserlös über oder unter der Restschuld liegen wird. Bei einer Lücke (Verkaufspreis < Restschuld) müssen Sie planen, wie Sie die Differenz finanzieren.",
        },
        {
          title: "Schritt 3: Bank-Freigabe einholen (falls Sicherungsübereignung)",
          description:
            "Bank um schriftliche Bestätigung bitten, dass sie der Veräußerung zustimmt und die Vorgehensweise (Direktüberweisung der Restschuld vom Käufer) absegnet.",
        },
        {
          title: "Schritt 4: Käufer finden",
          description:
            "Privat (mobile.de, Kleinanzeigen) oder über CaravanWert-Auktion mit 1.500+ Händlern. Beide Wege funktionieren — CaravanWert ist deutlich schneller (24h statt 8–14 Wochen).",
        },
        {
          title: "Schritt 5: Notarielle Abwicklung NICHT nötig",
          description:
            "Anders als bei Immobilien: Wohnwagen-Verkauf erfordert keinen Notar. Schriftlicher Kaufvertrag reicht — wir stellen ein juristisch geprüftes Muster bereit.",
        },
        {
          title: "Schritt 6: Geldfluss organisieren",
          description:
            "Beste Variante: Käufer überweist Restschuld direkt an Bank, Differenzbetrag an Verkäufer. Bank gibt nach Eingang die KFZ-Briefe (falls einbehalten) frei. Übergabe erst nach beiderseitig bestätigtem Geldeingang.",
        },
      ],
    },
    {
      title: "Drei Modelle der Geld-Abwicklung",
      content:
        "Hier die drei in der Praxis funktionierenden Varianten — von einfach (CaravanWert) bis komplexer (Privatverkauf mit Direktüberweisung):",
      items: [
        {
          title: "Modell A: CaravanWert-Auktion mit Käufer-Direktablösung (EMPFOHLEN)",
          description:
            "Käufer (Händler) überweist die Restschuld direkt an Ihre finanzierende Bank, den Differenzbetrag an Sie. Bank quittiert Tilgung und gibt evtl. KFZ-Brief frei. Wir koordinieren den Prozess — Sie müssen nichts vorstrecken. 100 % sicher.",
        },
        {
          title: "Modell B: Privatverkauf mit Käufer-Direktablösung",
          description:
            "Bei Privatkäufer schwieriger, aber möglich: schriftliche Vereinbarung mit Bank, Käufer und Ihnen. Käufer überweist nach klarem Schema — Risiko: ohne Profi-Begleitung manchmal stressig, weil Privatkäufer Bank-Direktüberweisung skeptisch sehen.",
        },
        {
          title: "Modell C: Sie lösen ab und verkaufen frei",
          description:
            "Wenn Sie das Geld vorstrecken können: Kredit komplett ablösen, KFZ-Brief in Empfang nehmen, dann frei verkaufen. Vorteil: einfacher Verkaufsprozess. Nachteil: Sie brauchen die volle Restschuld als Liquidität.",
        },
      ],
      ctaText: "Variante A jetzt nutzen",
      ctaHref: "/verkaufen/wizard",
    },
    {
      title: "Vorfälligkeitsentschädigung — was wirklich anfällt",
      content:
        "Die größte Sorge bei finanzierten Wohnwagen ist die Vorfälligkeitsentschädigung. Hier die nüchternen Fakten — gesetzlich klar geregelt:",
      items: [
        {
          title: "Maximum gesetzlich gedeckelt",
          description:
            "Bei Verbraucherkrediten (typische Wohnwagen-Finanzierung): max. 1 % der Restschuld, bei Restlaufzeit unter 12 Monaten max. 0,5 %. Bei einer Restschuld von 12.000 € sind das also höchstens 60–120 €.",
        },
        {
          title: "Bei manchen Krediten: 0 € möglich",
          description:
            "Online-Banken (z.B. ING, Comdirect, DKB) und Konsumkredit-Portale bieten häufig kostenlose Sondertilgung an. Lesen Sie die AGB Ihres Kreditvertrags — dort steht es schwarz auf weiß.",
        },
        {
          title: "Bei Händler-Finanzierung (Caravan-Bank, Sirius, BANK11): meist 1 %",
          description:
            "Diese spezialisierten Caravan-Banken nutzen meist die volle gesetzliche Entschädigung von 1 %. Trotzdem überschaubar — bei 15.000 € Restschuld sind das 150 €.",
        },
        {
          title: "Verhandeln möglich",
          description:
            "Bei guter Bonität und längerer Kundenbeziehung lassen viele Banken die Vorfälligkeit auf Anfrage fallen oder reduzieren sie deutlich. Einfach nachfragen — kostet nichts.",
        },
      ],
    },
    {
      title: "Über CaravanWert: Verkauf mit eingebauter Bank-Abwicklung",
      content:
        "Wir kennen die Sonderfälle bei finanzierten Wohnwagen. Unser Team begleitet die Bank-Direktüberweisung, dokumentiert sauber und sorgt dafür, dass Sie kein Geld vorstrecken müssen.",
      items: [
        {
          title: "Restschuldanforderung übernehmen wir auf Wunsch",
          description:
            "Sie geben uns die Bank-Daten — wir holen die offizielle Restschuldbestätigung. Spart Ihnen Telefon-Nachfragen und Bürokratie.",
        },
        {
          title: "Käufer-Direktüberweisung an Bank",
          description:
            "Der Auktions-Gewinner überweist die Restschuld direkt an Ihre Bank, den Differenzbetrag an Sie. Erst nach Bank-Bestätigung erfolgt die Übergabe.",
        },
        {
          title: "Übergabe-Protokoll inklusive",
          description:
            "Wir liefern ein juristisch geprüftes Übergabe-Protokoll, das Bank, Käufer und Sie absichert. Inklusive Tilgungs-Bestätigung.",
        },
        {
          title: "Komplette Abwicklung in 5–10 Werktagen",
          description:
            "Ab Auktionsstart bis Geld auf Ihrem Konto: 5–10 Werktage realistisch. Keine monatelangen Bank-Briefwechsel.",
        },
      ],
      ctaText: "Auktion mit Bank-Abwicklung starten",
      ctaHref: "/verkaufen/wizard",
    },
  ],
  faqItems: [
    {
      question: "Kann ich einen Wohnwagen mit laufender Finanzierung wirklich verkaufen?",
      answer:
        "Ja, in praktisch allen Fällen. Bei normalen Verbraucherkrediten gehört der Wohnwagen Ihnen — Sie können verkaufen, müssen aber den Restkredit beim Verkauf ablösen. Bei Sicherungsübereignung ist eine Bank-Freigabe nötig (5–10 Werktage Bearbeitungszeit).",
    },
    {
      question: "Was ist die Vorfälligkeitsentschädigung und wie hoch ist sie?",
      answer:
        "Eine Gebühr der Bank für die vorzeitige Tilgung des Kredits. Gesetzlich gedeckelt auf 1 % der Restschuld (0,5 % bei Restlaufzeit unter 12 Monaten). Bei 15.000 € Restschuld also max. 150 €. Manche Online-Banken verlangen gar keine Vorfälligkeitsentschädigung.",
    },
    {
      question: "Was passiert, wenn der Verkaufspreis niedriger ist als die Restschuld?",
      answer:
        "Sie müssen die Differenz aus eigener Tasche zuzahlen. Vor dem Verkauf prüfen: Wertrechner nutzen, mit aktueller Restschuld vergleichen. Bei Lücke ggf. einen kleinen Kredit aufnehmen oder mit der Bank über Stundung sprechen.",
    },
    {
      question: "Kann der Käufer die Restschuld direkt an meine Bank überweisen?",
      answer:
        "Ja, das ist sogar der empfohlene Weg. Käufer überweist Restschuld an Bank, Differenz an Sie. So müssen Sie nichts vorstrecken. Bei CaravanWert ist dieser Prozess Standard und wird von uns koordiniert.",
    },
    {
      question: "Brauche ich für den Verkauf einen Notar?",
      answer:
        "Nein. Wohnwagen-Verkauf erfordert keinen Notar — anders als bei Immobilien. Ein schriftlicher Kaufvertrag reicht. Wir stellen ein juristisch geprüftes Muster zur Verfügung.",
    },
    {
      question: "Habe ich den KFZ-Brief, wenn der Wohnwagen finanziert ist?",
      answer:
        "Bei den meisten Krediten: ja. Bei Sicherungsübereignung: nein, die Bank verwahrt den Brief. Sie erhalten ihn zurück, sobald die Bank die Tilgung bestätigt.",
    },
    {
      question: "Wie lange dauert die Bank-Freigabe?",
      answer:
        "Typisch 5–10 Werktage. Bei Online-Banken oft schneller (48–72h). Tipp: Bevor Sie inserieren, schon mal die Restschuldanforderung beantragen — spart Zeit im Verkaufsprozess.",
    },
    {
      question: "Kann ich auch mit Wertdifferenz (Verlust) verkaufen?",
      answer:
        "Ja. Sie müssen die Differenz dann aus eigenen Mitteln decken. Praxis-Tipp: Manche Banken bieten an, die Restschuld nach Verkauf in einen kleineren Restkredit umzuwandeln (Restschuldfinanzierung) — das vermeidet die einmalige große Zuzahlung.",
    },
    {
      question: "Was wenn ich noch eine Anschluss-Finanzierung mit der Bank verlängert habe?",
      answer:
        "Bei Anschluss-Finanzierungen kann die Vorfälligkeitsentschädigung höher ausfallen. Lesen Sie den Vertrag — und sprechen Sie ggf. mit der Bank, ob eine Stundung statt Ablösung möglich ist.",
    },
    {
      question: "Muss ich der Bank den Käufer-Namen mitteilen?",
      answer:
        "Bei Sicherungsübereignung: ja. Die Bank will wissen, wer den Wohnwagen übernimmt. Bei normalen Verbraucherkrediten: nein, die Bank interessiert nur die Tilgung.",
    },
    {
      question: "Kann der Käufer die laufende Finanzierung übernehmen?",
      answer:
        "Theoretisch ja, in der Praxis selten. Erfordert eine neue Kreditprüfung des Käufers durch Ihre Bank. Meist einfacher: Käufer löst die Restschuld ab und schließt bei Bedarf einen eigenen neuen Kredit ab.",
    },
    {
      question: "Bekomme ich Steuern zurück?",
      answer:
        "Nein, beim Privatverkauf eines Wohnwagens fallen keine Steuern an (sofern keine gewerbliche Veräußerung) — also gibt es auch nichts zurück. Steuerlich neutral.",
    },
    {
      question: "Wie unterscheidet sich der Prozess bei Caravan-Bank-Krediten?",
      answer:
        "Spezialisierte Caravan-Banken (BANK11, Caravan-Bank, Sirius) sind oft mit dem Käufer-Direktüberweisungs-Modell vertraut und wickeln schnell ab. Vorfälligkeitsentschädigung meist die volle 1 %.",
    },
    {
      question: "Wie schnell kann ich verkaufen, wenn die Bank zustimmt?",
      answer:
        "Über CaravanWert-Auktion: 24–48 Stunden bis zum Höchstgebot, weitere 5–10 Werktage bis komplette Abwicklung. Privat: typisch 6–14 Wochen Such-Zeit, plus 1–2 Wochen Abwicklung.",
    },
    {
      question: "Was wenn der Käufer abspringt nach Bank-Freigabe?",
      answer:
        "Bei CaravanWert-Auktion ist der Käufer rechtlich gebunden — Rücktritt nicht ohne Triftiger Grund möglich. Bei Privatverkauf riskanter, da informelle Vereinbarungen leichter brechen können.",
    },
    {
      question: "Wie schnell läuft die ganze Abwicklung über CaravanWert?",
      answer:
        "Auktion 24h → Käufer-Vertrag binnen 24h → Restschuldanforderung an Bank (sofern noch nicht vorhanden) 24–72h → Käufer überweist 24–48h → Übergabe binnen 5–7 Werktagen. Komplett: 8–14 Werktage realistisch.",
    },
    {
      question: "Was kostet der Service über CaravanWert für finanzierte Wohnwagen?",
      answer:
        "Für Sie als Verkäufer kostenlos — egal ob mit oder ohne Finanzierung. Die Provision zahlt der gewinnende Händler. Auch die Bank-Abwicklungs-Begleitung ist im Service enthalten.",
    },
  ],
  relatedSlugs: [
    "wir-kaufen-dein-wohnmobil",
    "wohnwagen-verkaufspreis",
    "wohnwagen-verkaufen",
    "finanziertes-wohnmobil-verkaufen",
    "wohnwagenpreise-2026",
  ],
};
