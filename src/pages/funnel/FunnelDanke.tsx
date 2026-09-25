import { CheckCircle2, FolderOpen, Mail, Phone } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { FunnelSeo } from "@/components/funnel/funnel-seo";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/contexts/SettingsContext";
import { BRAND } from "@/lib/brand";

interface Variant {
  title: string;
  subtitle: string;
  steps: Array<{ title: string; text: string }>;
}

const PROJECT_LINK_STEP = {
  title: "E-Mail prüfen",
  text: "Wir haben Ihnen den Link zu Ihrer persönlichen Projektseite geschickt – bitte auch im Spam-Ordner nachsehen.",
};

const VARIANTS: Record<string, Variant> = {
  a: {
    title: "Danke für Ihre Anfrage!",
    subtitle:
      "Ihr Projekt ist angelegt. Geprüfte Küchenstudios aus Ihrer Region können jetzt Angebote abgeben – die ersten kommen meist innerhalb von 48 Stunden.",
    steps: [
      PROJECT_LINK_STEP,
      { title: "Angebote vergleichen", text: "Studios geben 7 Tage lang Angebote ab. Alle sehen Sie übersichtlich auf Ihrer Projektseite." },
      { title: "Studio wählen", text: "Nehmen Sie das beste Angebot an – das Studio meldet sich für Aufmaß und Detailplanung." },
    ],
  },
  b: {
    title: "Ihr Angebot ist eingegangen!",
    subtitle:
      "Wir prüfen Ihr Studio-Angebot und melden uns kurz telefonisch. Danach bieten geprüfte Studios 72 Stunden lang, um Ihr Angebot zu unterbieten.",
    steps: [
      { title: "Experten-Check", text: "Kurzer Rückruf zu Ihrem Angebot – meist innerhalb von 24 Stunden (Mo–Fr)." },
      { title: "72-Stunden-Auktion", text: "Geprüfte Studios bieten für dieselbe oder eine vergleichbare Küche. Neue Angebote melden wir per E-Mail." },
      { title: "Sie entscheiden", text: "Auf Ihrer Projektseite nehmen Sie das beste Angebot an – oder keines." },
    ],
  },
};

const FALLBACK: Variant = {
  title: "Danke für Ihre Nachricht!",
  subtitle: "Wir haben Ihre Angaben erhalten und melden uns in Kürze bei Ihnen.",
  steps: [PROJECT_LINK_STEP],
};

/**
 * Danke-Seite nach Funnel A (Angebote einholen) und B (Unterbieten).
 * Beide legen ein Projekt mit Ausschreibung an; der Projektlink kommt per
 * E-Mail (kw-market-worker, Event project_created). Funnel C leitet direkt
 * auf die Projektseite weiter.
 */
export default function FunnelDanke() {
  const [searchParams] = useSearchParams();
  const { settings } = useSettings();
  const content = VARIANTS[searchParams.get("funnel") ?? ""] ?? FALLBACK;
  const phone = settings?.support_phone || "+49 511 51532476";
  const email = settings?.contact_email || BRAND.supportEmail;

  return (
    <div className="min-h-screen bg-background">
      <FunnelSeo
        title="Danke für Ihre Anfrage"
        description="Wir haben Ihre Küchenanfrage erhalten. Geprüfte Studios aus Ihrer Region geben jetzt Angebote ab."
        canonicalPath="/funnel/danke"
        noIndex
      />
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-20">
        <div className="mb-8 flex justify-center">
          <CheckCircle2 className="h-20 w-20 text-primary" strokeWidth={1.5} aria-hidden="true" />
        </div>

        <h1 className="mb-4 text-center text-3xl font-bold tracking-tight sm:text-4xl">{content.title}</h1>
        <p className="mb-10 text-center text-lg leading-relaxed text-muted-foreground">{content.subtitle}</p>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Wie geht es weiter?</h2>
          <ol className="space-y-3 text-sm">
            {content.steps.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <span>
                  <strong>{step.title}:</strong> {step.text}
                </span>
              </li>
            ))}
          </ol>
          <Button asChild variant="outline" className="mt-5 w-full sm:w-auto">
            <Link to="/projekt">
              <FolderOpen className="mr-2 h-4 w-4" />
              Keine E-Mail erhalten? Link neu anfordern
            </Link>
          </Button>
        </div>

        <div className="mt-8 rounded-2xl border border-dashed bg-muted/30 p-5">
          <p className="mb-3 text-sm font-medium">Fragen oder etwas vergessen?</p>
          <div className="flex flex-col gap-2 text-sm">
            <a href={`mailto:${email}`} className="inline-flex items-center gap-2 text-primary hover:underline">
              <Mail className="h-4 w-4" aria-hidden="true" />
              {email}
            </a>
            <a href={`tel:${phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 text-primary hover:underline">
              <Phone className="h-4 w-4" aria-hidden="true" />
              {phone} (Mo–Fr 10–18 Uhr)
            </a>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link to="/" className="text-sm text-muted-foreground hover:text-primary hover:underline">
            Zurück zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}
