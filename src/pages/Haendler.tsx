import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import RelatedContent, { haendlerRelatedLinks } from "@/components/RelatedContent";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BellRing, CheckCircle2, FileDown, Handshake, KeyRound, MapPinned, Sparkles, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";
import studioConsultant from "@/assets/studio-consultant.webp";
import { useSettings } from "@/contexts/SettingsContext";
import { BRAND } from "@/lib/brand/config";

const BENEFITS = [
  {
    icon: Sparkles,
    title: "Projekte statt Adressen",
    description:
      "Jedes Projekt kommt mit Raumfoto, Wandmaßen, Grundriss, Wunschkonfiguration, KI-Visualisierung und Preisschätzung – Sie kalkulieren sofort.",
  },
  {
    icon: MapPinned,
    title: "Nur Ihre Region",
    description: "Sie legen PLZ und Umkreis fest und sehen ausschließlich Projekte aus Ihrem Einzugsgebiet.",
  },
  {
    icon: TrendingDown,
    title: "Fairer Wettbewerb",
    description:
      "Sie sehen das aktuell niedrigste Angebot und Ihren Rang. Angebote lassen sich bis zum Ende der Angebotsphase senken, nie erhöhen.",
  },
  {
    icon: Handshake,
    title: "Zahlen bei Erfolg",
    description:
      "Registrierung und Angebote sind kostenlos. Die Provision fällt nur an, wenn die Kund:in Ihr Angebot annimmt.",
  },
];

const SERVICES = [
  {
    title: "Projekt-Börse",
    description: "Alle offenen Kundenprojekte in Ihrem Einzugsgebiet – mit Entfernung, Budget-Rahmen und Restlaufzeit.",
    features: ["Filter: offen, alle, meine Angebote", "E-Mail bei neuen Projekten in Ihrer Region", "Laufzeit 7 Tage, Unterbieten 72 Stunden"],
  },
  {
    title: "Strukturierte Angebote",
    description: "Preis, Lieferzeit, enthaltene Leistungen und eine persönliche Nachricht – in einer Minute abgegeben.",
    features: ["Leistungen: Lieferung, Montage, Geräte, Aufmaß …", "Gültigkeit und Standard-Vorstellungstext", "Senken oder zurückziehen bis Angebotsende"],
  },
  {
    title: "Kontakt freischalten",
    description: "Sie möchten vor der Entscheidung beraten? Schalten Sie die Kontaktdaten frei – höchstens drei Studios pro Projekt.",
    features: ["Preis je nach Projektwert, vor dem Kauf sichtbar", "Einwilligung der Kund:in liegt vor", "Kontakt jederzeit im Dashboard abrufbar"],
  },
  {
    title: "Export für Ihre Planungssoftware",
    description: "Übernehmen Sie Projekte direkt in Ihr Planungsprogramm statt Maße abzutippen.",
    features: ["Planungsbriefing als JSON", "Grundriss als DXF (CARAT, Winner Flex, KPS, pCon …)", "Druckansicht für die Beratung"],
  },
];

const STATS = [
  { number: "Deutschlandweit", label: "Kundenprojekte" },
  { number: "Mit KI-Bild", label: "Raumfoto & Maße" },
  { number: "Kostenlos", label: "Registrierung & Angebote" },
  { number: "Nur bei Zuschlag", label: "Provision" },
];

const PROCESS = [
  {
    step: "1",
    title: "Kostenlos registrieren",
    description: "Online-Registrierung mit Gewerbenachweis und USt-ID – Freischaltung innerhalb von 1–2 Werktagen.",
  },
  {
    step: "2",
    title: "Einzugsgebiet festlegen",
    description: "PLZ und Umkreis wählen – ab dann erhalten Sie passende Projekte per E-Mail und in der Projekt-Börse.",
  },
  {
    step: "3",
    title: "Angebot abgeben",
    description: "Projekt prüfen, Preis und Leistungen eintragen, optional den Kontakt für eine Vorab-Beratung freischalten.",
  },
  {
    step: "4",
    title: "Zuschlag erhalten",
    description: "Die Kund:in wählt Ihr Angebot – Sie erhalten alle Kontaktdaten und vereinbaren Aufmaß und Detailplanung.",
  },
];

const EXTRAS = [
  "E-Mail, sobald ein Projekt in Ihrem Umkreis startet",
  "Benachrichtigung, wenn Sie unterboten wurden",
  "Rechnungen für Kontakte und Provisionen digital im Dashboard",
  "Keine Grundgebühr, keine Mindestabnahme, keine Vertragslaufzeit",
];

const Haendler = () => {
  const { settings } = useSettings();
  const siteName = settings?.site_name || BRAND.name;

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${siteName} Projekt-Börse für Küchenstudios`,
    description:
      "B2B-Plattform für Küchenstudios: Kundenprojekte mit Raumfoto, Maßen, KI-Visualisierung und Preisschätzung aus der eigenen Region, Angebotsabgabe im Wettbewerb und Export für Küchenplanungssoftware.",
    provider: { "@type": "Organization", name: siteName, url: BRAND.baseUrl },
    areaServed: { "@type": "Place", name: "Deutschland" },
    serviceType: "B2B Kitchen Project Marketplace",
  };

  return (
    <PageLayout
      breadcrumbs={true}
      title="Für Küchenstudios – Kundenprojekte mit Maßen & KI-Visualisierung"
      description="Als geprüftes Partner-Studio erhalten Sie Küchenprojekte aus Ihrer Region – mit Raumfoto, Maßen, Wunschkonfiguration und Preisschätzung. Angebot abgeben, Zuschlag erhalten, Provision nur bei Erfolg."
      keywords="Küchenstudio Partner, Küchen Leads, Küchenprojekte, Küchenhändler Kunden gewinnen, Küchen Anfragen, B2B Küchen-Plattform"
      canonicalPath="/haendler"
      structuredData={serviceSchema}
    >
      <PageHero size="lg">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="animate-fade-in">
            <h1 className="mb-6 text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
              Küchenprojekte aus Ihrer Region – <span className="gradient-text">fertig zum Kalkulieren</span>
            </h1>
            <p className="mb-8 text-lg leading-relaxed text-muted-foreground md:text-xl">
              Kund:innen planen bei {siteName} ihre Küche mit Raumfoto, Maßen und KI-Visualisierung. Sie sehen das Projekt,
              geben Ihr Angebot ab und gewinnen den Auftrag – Provision nur bei Zuschlag.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg" className="gradient-hero shadow-lg hover:gradient-hero-hover hover:shadow-glow">
                <Link to="/register/haendler">Kostenlos Partner werden</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login/haendler">Zum Studio-Login</Link>
              </Button>
            </div>
          </div>

          <div className="relative animate-fade-in animate-delay-200">
            <div className="gradient-hero absolute -inset-4 rounded-full opacity-20 blur-3xl" />
            <img
              src={studioConsultant}
              alt="Küchenberaterin in einem Partner-Studio"
              width={1920}
              height={1088}
              className="relative rounded-2xl shadow-premium"
            />
          </div>
        </div>
      </PageHero>

      <section className="bg-secondary py-20 text-secondary-foreground">
        <div className="container">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="gradient-text mb-2 text-3xl font-bold md:text-4xl">{stat.number}</div>
                <div className="text-sm opacity-90 md:text-base">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-2xl font-bold sm:text-3xl md:text-4xl">Ihre Vorteile als Partner-Studio</h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Weniger Akquise, bessere Anfragen: Sie sehen vor dem ersten Gespräch, was die Kund:in möchte und was der Raum hergibt.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((benefit) => (
              <Card key={benefit.title} className="border-2">
                <CardHeader>
                  <div className="gradient-hero mb-4 flex h-14 w-14 items-center justify-center rounded-xl shadow-glow-sm">
                    <benefit.icon className="h-7 w-7 text-primary-foreground" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-xl">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{benefit.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/30 py-20">
        <div className="container">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-2xl font-bold sm:text-3xl md:text-4xl">Ihr Studio-Portal</h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">Alles, was Sie brauchen, um aus Projekten Aufträge zu machen.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            {SERVICES.map((service) => (
              <Card key={service.title}>
                <CardHeader>
                  <CardTitle className="text-2xl">{service.title}</CardTitle>
                  <CardDescription className="text-base">{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {service.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-primary" aria-hidden="true" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-2xl font-bold sm:text-3xl md:text-4xl">In 4 Schritten zum ersten Auftrag</h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">So gewinnen Sie neue Kund:innen über {siteName}.</p>
          </div>
          <ol className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {PROCESS.map((item) => (
              <li key={item.step} className="text-center">
                <div className="gradient-hero mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold text-white shadow-lg">
                  {item.step}
                </div>
                <h3 className="mb-3 text-xl font-bold">{item.title}</h3>
                <p className="leading-relaxed text-muted-foreground">{item.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-secondary py-20 text-secondary-foreground">
        <div className="container">
          <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-2 md:items-center">
            <div>
              <h2 className="mb-4 text-2xl font-bold sm:text-3xl md:text-4xl">Warum {siteName}-Partner werden?</h2>
              <p className="text-lg opacity-90">
                Ihr direkter Draht zu Menschen, die konkret eine neue Küche planen – ohne Werbebudget, ohne Kaltakquise.
              </p>
              <div className="mt-6 grid gap-3 text-sm">
                <p className="flex items-start gap-2">
                  <BellRing className="mt-0.5 h-5 w-5 flex-none text-primary" aria-hidden="true" />
                  Sofort informiert, wenn ein Projekt in Ihrer Region startet.
                </p>
                <p className="flex items-start gap-2">
                  <KeyRound className="mt-0.5 h-5 w-5 flex-none text-primary" aria-hidden="true" />
                  Höchstens drei Studios pro Projekt können den Kontakt vorab freischalten.
                </p>
                <p className="flex items-start gap-2">
                  <FileDown className="mt-0.5 h-5 w-5 flex-none text-primary" aria-hidden="true" />
                  Maße und Grundriss direkt in Ihre Planungssoftware übernehmen.
                </p>
              </div>
            </div>
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl">Das bieten wir Ihnen</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {EXTRAS.map((text) => (
                  <div key={text} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-6 w-6 flex-shrink-0 text-primary" aria-hidden="true" />
                    <p className="text-base">{text}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container">
          <div className="prose prose-lg mx-auto max-w-4xl">
            <h2 className="mb-6 text-2xl font-bold sm:text-3xl">Häufige Fragen von Küchenstudios</h2>

            <h3 className="mb-4 mt-8 text-2xl font-bold">Für wen ist die Plattform geeignet?</h3>
            <p className="mb-6 leading-relaxed text-muted-foreground">
              Für Küchenstudios, Küchen-Fachgeschäfte, Möbelhäuser mit Küchenabteilung sowie Schreinereien, die neue Küchen planen,
              liefern und montieren. Sie entscheiden bei jedem Projekt selbst, ob Sie ein Angebot abgeben.
            </p>

            <h3 className="mb-4 mt-8 text-2xl font-bold">Wie läuft ein Projekt ab?</h3>
            <p className="mb-6 leading-relaxed text-muted-foreground">
              Sobald eine Kund:in ihr Projekt absendet, erscheint es anonymisiert in der Projekt-Börse aller Studios, deren
              Einzugsgebiet die PLZ abdeckt. Sie sehen Maße, Grundriss, Konfiguration, Raumfoto und Visualisierung und geben Ihr
              Angebot ab. Die Angebotsphase dauert 7 Tage, beim Unterbieten eines vorhandenen Angebots 72 Stunden. Danach wählt die
              Kund:in – mit dem Zuschlag erhalten Sie alle Kontaktdaten.
            </p>

            <h3 className="mb-4 mt-8 text-2xl font-bold">Was kostet die Teilnahme?</h3>
            <p className="mb-6 leading-relaxed text-muted-foreground">
              Registrierung, Projekt-Börse und Angebotsabgabe sind kostenlos. Kosten entstehen nur in zwei Fällen: wenn Sie freiwillig
              einen Kontakt vorab freischalten (Preis je nach Projektwert, vor dem Kauf angezeigt) und als Provision, wenn die Kund:in
              Ihr Angebot annimmt. Die Provision ist nach Auftragswert gestaffelt und in Ihrem Dashboard einsehbar.
            </p>

            <h3 className="mb-4 mt-8 text-2xl font-bold">Kann ich Projekte in meine Planungssoftware übernehmen?</h3>
            <p className="mb-6 leading-relaxed text-muted-foreground">
              Ja. Jedes Projekt lässt sich als Planungsbriefing (JSON) und als Grundriss im DXF-Format exportieren. DXF lesen CARAT,
              Winner Flex, KPS, pCon.planner und jedes gängige CAD-Programm – Maße müssen nicht abgetippt werden.
            </p>
          </div>
        </div>
      </section>

      <RelatedContent
        title="Weitere Informationen für Küchenstudios"
        description="Alles, was Sie für eine erfolgreiche Partnerschaft wissen müssen"
        links={haendlerRelatedLinks}
      />

      <section id="partner-werden" className="bg-gradient-to-br from-primary via-primary-light to-primary py-20 text-primary-foreground">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-6 text-2xl font-bold sm:text-3xl md:text-4xl">Jetzt kostenlos registrieren</h2>
            <p className="mb-8 text-xl opacity-95">Registrierung in 2 Minuten – nach der Freischaltung sehen Sie sofort alle Projekte in Ihrer Region.</p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button asChild size="lg" variant="secondary">
                <Link to="/register/haendler">Jetzt registrieren</Link>
              </Button>
              {settings?.support_phone && (
                <Button asChild size="lg" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                  <a href={`tel:${settings.support_phone.replace(/\s/g, "")}`}>Beratung anfordern</a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
};

export default Haendler;
