import { Link } from "react-router-dom";
import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { useSettings } from "@/contexts/SettingsContext";
import { useSupportPhone } from "@/hooks/useSupportPhone";
import { BRAND } from "@/lib/brand";

const BREADCRUMBS = [
  { name: "Startseite", path: "/" },
  { name: "Barrierefreiheit", path: "/barrierefreiheit" },
];

const Barrierefreiheit = () => {
  const { settings } = useSettings();
  const phone = useSupportPhone();
  const email = settings?.contact_email || BRAND.supportEmail;

  return (
    <PageLayout
      title="Erklärung zur Barrierefreiheit"
      description={`Erklärung zur Barrierefreiheit von ${BRAND.name}: Stand der Umsetzung, bekannte Einschränkungen und wie Sie uns Barrieren melden.`}
      canonicalPath="/barrierefreiheit"
      breadcrumbs={BREADCRUMBS}
    >
      <PageHero size="sm">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-bold md:text-5xl">Erklärung zur Barrierefreiheit</h1>
          <p className="mt-4 text-lg text-muted-foreground">Stand: September 2026</p>
        </div>
      </PageHero>

      <div className="container max-w-4xl py-12">
        <div className="prose prose-lg max-w-none">
          <p>
            {BRAND.name} ist ein Angebot der {BRAND.legalName}. Wir möchten, dass alle Menschen unsere Website
            nutzen können – unabhängig von Einschränkungen und von den Hilfsmitteln, die sie verwenden. Diese
            Erklärung beschreibt, wie weit wir damit sind.
          </p>

          <h2>Geltungsbereich</h2>
          <p>
            Diese Erklärung gilt für die Website kuechenwert24.de einschließlich der Anfrageformulare, des
            KüchenRechners, der KI-Küchenplanung und des Kundenkontos.
          </p>

          <h2>Unsere Dienstleistung</h2>
          <p>
            Über {BRAND.name} holen Sie kostenlos und unverbindlich Angebote für eine neue Küche ein. Sie können
            ein vorhandenes Angebot von anderen Küchenstudios unterbieten lassen oder Ihre Küche mit KI planen und
            in Ihrem eigenen Raum ansehen. Geprüfte Küchenstudios aus Ihrer Region machen Ihnen Angebote – ob und
            welches Sie annehmen, entscheiden Sie.
          </p>

          <h2>Stand der Vereinbarkeit</h2>
          <p>
            Wir orientieren uns an den Web Content Accessibility Guidelines (WCAG) 2.2, Konformitätsstufe AA, und
            an der europäischen Norm EN 301 549. Unsere Website ist mit diesen Anforderungen{" "}
            <strong>teilweise vereinbar</strong>. Die folgenden Punkte sind noch nicht barrierefrei.
          </p>

          <h2>Bekannte Einschränkungen</h2>
          <ul>
            <li>
              <strong>KI-Visualisierung:</strong> Die Darstellung einer Küche im eigenen Raum setzt ein Foto des
              Raums voraus. Angebote erhalten Sie auch ohne Foto über das Formular{" "}
              <Link to="/formular">„Angebote holen“</Link>. Sie können uns auch anrufen, wir helfen Ihnen gern
              weiter.
            </li>
            <li>
              <strong>Kundenkonto:</strong> Einzelne ältere Seiten im Kundenkonto werden noch überarbeitet und sind
              möglicherweise noch nicht vollständig barrierefrei.
            </li>
          </ul>

          <h2>Erstellung dieser Erklärung</h2>
          <p>
            Diese Erklärung beruht auf einer Selbsteinschätzung. Wir aktualisieren sie, sobald wir Einschränkungen
            beheben oder die Website wesentlich ändern.
          </p>

          <h2>Barrieren melden</h2>
          <p>
            Ist Ihnen eine Barriere aufgefallen oder benötigen Sie Inhalte in einer anderen Form? Schreiben Sie uns
            oder rufen Sie an:
          </p>
          <ul>
            <li>
              E-Mail: <a href={`mailto:${email}`}>{email}</a>
            </li>
            <li>
              Telefon: <a href={phone.href}>{phone.display}</a> (Mo–Fr 10–18 Uhr)
            </li>
            <li>
              Kontaktformular: <Link to="/kontakt">Kontaktseite</Link>
            </li>
          </ul>
          <p>
            Bitte beschreiben Sie kurz, auf welcher Seite und bei welcher Funktion das Problem auftritt. Wir
            bestätigen den Eingang Ihrer Nachricht; unser Ziel ist, Ihnen innerhalb von zwei Wochen inhaltlich zu
            antworten.
          </p>

          <h2>Marktüberwachung und Schlichtung</h2>
          <p>
            Wenn Sie der Meinung sind, dass unser Angebot die Anforderungen des Barrierefreiheitsstärkungsgesetzes
            (BFSG) nicht erfüllt, und wir Ihr Anliegen nicht zufriedenstellend lösen, können Sie sich an die
            zuständige Marktüberwachungsbehörde wenden. Zuständig sind die Marktüberwachungsbehörden der Länder –
            für die {BRAND.legalName} mit Sitz in Niedersachsen die für Niedersachsen zuständige Stelle.
          </p>
          <p>
            Außerdem können Sie ein Schlichtungsverfahren bei der Schlichtungsstelle nach § 16 des
            Behindertengleichstellungsgesetzes (BGG) beantragen.
          </p>
        </div>
      </div>
    </PageLayout>
  );
};

export default Barrierefreiheit;
