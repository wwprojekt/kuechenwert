import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, Phone, Mail } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { FunnelSeo } from "@/components/funnel/funnel-seo";

/**
 * Danke-Seite nach erfolgreichem Funnel-Abschluss.
 *
 * Route: /funnel/danke?funnel=a  (bzw. ?funnel=b, ?funnel=traumkueche)
 *
 * Zeigt eine freundliche Bestätigung + Next-Steps.
 * Telefon-Rueckruf wird je nach Funnel leicht unterschiedlich formuliert.
 */
export default function FunnelDanke() {
  const [searchParams] = useSearchParams();
  const funnel = searchParams.get("funnel") ?? "";

  const funnelSpecific: Record<string, { title: string; subtitle: string }> = {
    a: {
      title: "Danke fuer Ihre Anfrage!",
      subtitle:
        "Wir pruefen Ihre Angaben und leiten sie an bis zu 3 passende Kuechenstudios in Ihrer Region weiter. Die Studios melden sich in den naechsten 1-2 Werktagen bei Ihnen.",
    },
    b: {
      title: "Angebot-Vergleich gestartet!",
      subtitle:
        "Wir holen fuer Sie vergleichbare Angebote ein. Sobald die ersten eingehen, erhalten Sie eine E-Mail.",
    },
    traumkueche: {
      title: "Ihre Traumkueche wird gerendert!",
      subtitle:
        "Die KI-Generierung dauert ein paar Sekunden. Sie werden automatisch weitergeleitet, sobald Ihre Kueche fertig ist.",
    },
  };

  const content = funnelSpecific[funnel] ?? {
    title: "Danke fuer Ihre Nachricht!",
    subtitle: "Wir melden uns in Kuerze bei Ihnen.",
  };

  return (
    <div className="min-h-screen bg-background">
      <FunnelSeo
        title="Danke für Ihre Anfrage"
        description="Wir haben Ihre Küchenanfrage erhalten und leiten sie an passende Studios weiter."
        canonicalPath="/funnel/danke"
        noIndex
      />
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-20">
        <div className="mb-8 flex justify-center">
          <CheckCircle2 className="h-20 w-20 text-primary" strokeWidth={1.5} />
        </div>

        <h1 className="mb-4 text-center text-3xl font-bold tracking-tight sm:text-4xl">
          {content.title}
        </h1>

        <p className="mb-10 text-center text-lg leading-relaxed text-muted-foreground">
          {content.subtitle}
        </p>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Wie geht es weiter?</h2>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                1
              </span>
              <span>
                <strong>Pruefung:</strong> Wir schauen uns Ihre Angaben an.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                2
              </span>
              <span>
                <strong>Kontakt:</strong> Ein passendes Kuechenstudio meldet sich per Telefon oder E-Mail.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                3
              </span>
              <span>
                <strong>Beratung:</strong> Sie erhalten ein unverbindliches Angebot oder einen Beratungstermin.
              </span>
            </li>
          </ul>
        </div>

        <div className="mt-8 rounded-2xl border border-dashed bg-muted/30 p-5">
          <p className="mb-3 text-sm font-medium">Fragen oder etwas vergessen?</p>
          <div className="space-y-2 text-sm">
            <a
              href={`mailto:${BRAND.supportEmail}`}
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              <Mail className="h-4 w-4" />
              {BRAND.supportEmail}
            </a>
            <br />
            <a
              href="tel:+4900000000"
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              <Phone className="h-4 w-4" />
              Telefon-Support
            </a>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/"
            className="text-sm text-muted-foreground hover:text-primary hover:underline"
          >
            Zurueck zur Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}
