import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  Mail,
  Phone,
  ArrowRight,
  RefreshCw,
  Home,
  LogOut,
  FileText,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { SiteLogo } from "@/components/SiteLogo";

interface DealerApplicationStatusProps {
  application: {
    id: string;
    status: string;
    company_name: string;
    company_address?: string;
    company_city?: string;
    company_postal_code?: string;
    contact_person_name?: string;
    phone?: string;
    submitted_at?: string;
    reviewed_at?: string;
    rejection_reason?: string;
    legal_form?: string;
  };
  onRefresh?: () => void;
}

/**
 * Dedizierte Status-Seite für Händler-Bewerber.
 *
 * Wird angezeigt anstatt des Seller-Dashboards, wenn der User eine
 * pending oder rejected Dealer Application hat.
 */
export default function DealerApplicationStatus({
  application,
  onRefresh,
}: DealerApplicationStatusProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const isPending = application.status === "pending";
  const isRejected = application.status === "rejected";

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-50/80 via-sky-50/40 to-white dark:from-gray-900 dark:via-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="hover:opacity-80 transition-opacity">
            <SiteLogo variant="icon-text-compact" linkTo="/" />
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="text-muted-foreground">
              <Home className="w-4 h-4 mr-2" />
              Startseite
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
              <LogOut className="w-4 h-4 mr-2" />
              Abmelden
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Status Card */}
        <Card className="overflow-hidden shadow-xl border-0">
          {/* Status Header */}
          <div
            className={`p-8 text-center ${
              isPending
                ? "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30"
                : "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30"
            }`}
          >
            <div
              className={`mx-auto h-20 w-20 rounded-full flex items-center justify-center mb-6 ${
                isPending
                  ? "bg-amber-100 dark:bg-amber-900/50"
                  : "bg-red-100 dark:bg-red-900/50"
              }`}
            >
              {isPending ? (
                <Clock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
              ) : (
                <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
              )}
            </div>

            <h1 className="text-2xl font-bold mb-2">
              {isPending
                ? "Ihr Händlerantrag wird geprüft"
                : "Ihr Händlerantrag wurde abgelehnt"}
            </h1>

            <p className="text-muted-foreground max-w-md mx-auto">
              {isPending
                ? "Unser Team prüft aktuell Ihre Unterlagen. Sie erhalten eine E-Mail-Benachrichtigung, sobald Ihr Antrag bearbeitet wurde."
                : "Leider konnte Ihr Antrag nicht genehmigt werden. Bitte lesen Sie die Begründung unten."}
            </p>

            {isPending && (
              <Badge
                variant="outline"
                className="mt-4 bg-amber-100/50 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700"
              >
                <Clock className="w-3 h-3 mr-1" />
                In Bearbeitung
              </Badge>
            )}
          </div>

          <CardContent className="p-8 space-y-6">
            {/* Rejection Reason */}
            {isRejected && application.rejection_reason && (
              <Alert variant="destructive" className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="font-medium">
                  <strong>Begründung:</strong> {application.rejection_reason}
                </AlertDescription>
              </Alert>
            )}

            {/* Application Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Antragsdaten
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Building2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Firma</p>
                    <p className="font-medium">{application.company_name}</p>
                    {application.legal_form && (
                      <p className="text-xs text-muted-foreground">{application.legal_form}</p>
                    )}
                  </div>
                </div>

                {application.contact_person_name && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Mail className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Ansprechpartner</p>
                      <p className="font-medium">{application.contact_person_name}</p>
                    </div>
                  </div>
                )}

                {(application.company_address || application.company_city) && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <FileText className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Adresse</p>
                      <p className="font-medium">
                        {application.company_address}
                        {application.company_postal_code && application.company_city
                          ? `, ${application.company_postal_code} ${application.company_city}`
                          : ""}
                      </p>
                    </div>
                  </div>
                )}

                {application.submitted_at && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Calendar className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Eingereicht am</p>
                      <p className="font-medium">
                        {new Date(application.submitted_at).toLocaleDateString("de-DE", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Info Box */}
            {isPending && (
              <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-800 dark:text-blue-300">
                  Die Prüfung dauert in der Regel <strong>1-3 Werktage</strong>. Sie erhalten
                  eine E-Mail an Ihre registrierte Adresse, sobald eine Entscheidung getroffen wurde.
                </AlertDescription>
              </Alert>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              {onRefresh && (
                <Button
                  variant="outline"
                  onClick={onRefresh}
                  className="flex-1"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Status aktualisieren
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => navigate("/kontakt")}
                className="flex-1"
              >
                <Mail className="w-4 h-4 mr-2" />
                Kontakt aufnehmen
              </Button>

              <Button
                onClick={() => navigate("/")}
                className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              >
                <Home className="w-4 h-4 mr-2" />
                Zur Startseite
              </Button>
            </div>

            {isRejected && (
              <div className="text-center pt-2">
                <p className="text-sm text-muted-foreground">
                  Sie können einen neuen Antrag stellen, nachdem Sie die genannten Punkte korrigiert haben.
                  Kontaktieren Sie uns bei Fragen.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* FAQ Section */}
        {isPending && (
          <Card className="mt-6 p-6">
            <h3 className="font-semibold mb-4">Häufige Fragen</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-foreground">Wie lange dauert die Prüfung?</p>
                <p className="text-muted-foreground mt-1">
                  In der Regel bearbeiten wir Anträge innerhalb von 1-3 Werktagen.
                  Bei hohem Aufkommen kann es etwas länger dauern.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Was wird geprüft?</p>
                <p className="text-muted-foreground mt-1">
                  Wir verifizieren Ihre Firmendaten, Gewerbeanmeldung und prüfen, ob alle
                  Voraussetzungen für den Händlerzugang erfüllt sind.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Kann ich den Antrag beschleunigen?</p>
                <p className="text-muted-foreground mt-1">
                  Stellen Sie sicher, dass alle Unterlagen vollständig hochgeladen wurden.
                  Bei Rückfragen kontaktieren wir Sie per E-Mail.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
