import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Phone, Mail, ArrowRight, Home, FileText, LayoutDashboard, Inbox, ImageIcon, Loader2, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import { BRAND } from "@/lib/brand";

type PhotoUploadState = "idle" | "uploading" | "success" | "error";

interface PendingWizardPhotos {
  photos: File[];
  sessionId: string;
  anonymousId?: string | null;
}

const VerkaufenDanke = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [uploadState, setUploadState] = useState<PhotoUploadState>("idle");
  const [uploadedCount, setUploadedCount] = useState(0);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const uploadStarted = useRef(false);

  // Hinweis: auto-convert-wizard + send-lead-notification werden NICHT mehr
  // hier auf der Danke-Seite ausgelöst. Sie laufen jetzt VOR navigate() in
  // useWizardForm.submitForm() mit `keepalive: true`, sodass sie auch dann
  // den Server erreichen wenn der User die Seite sofort schließt -- was
  // zuvor (Bug schoenerth@gmx.de, 2026-04-21) den Lead permanent vernichtet
  // hat. Photo-Upload bleibt hier, weil das Body-Limit von keepalive (64 KB)
  // für Foto-Uploads nicht reicht.

  // Photo-Upload auf der Danke-Seite starten.
  // File-Objekte werden über window.__pendingWizardPhotos übergeben,
  // weil sie nicht über React Router state (history.pushState) serialisierbar sind.
  // fire-and-forget fetch() im Wizard wird durch navigate() abgebrochen,
  // deshalb muss der Upload HIER stattfinden.
  useEffect(() => {
    if (uploadStarted.current) return;

    const pending = (window as any).__pendingWizardPhotos as PendingWizardPhotos | undefined;
    if (!pending || !pending.photos || pending.photos.length === 0 || !pending.sessionId) {
      return;
    }

    uploadStarted.current = true;
    const { photos, sessionId, anonymousId } = pending;
    setTotalPhotos(photos.length);
    setUploadState("uploading");

    // Sofort aus window entfernen, damit kein Doppel-Upload bei Re-Render passiert
    delete (window as any).__pendingWizardPhotos;

    const uploadPhotos = async () => {
      try {
        const photoFormData = new FormData();
        photoFormData.append("sessionId", sessionId);
        if (anonymousId) {
          photoFormData.append("anonymousId", anonymousId);
        }
        for (const photo of photos) {
          photoFormData.append("photos", photo);
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
        if (!supabaseUrl) {
          throw new Error("VITE_SUPABASE_URL is not set");
        }

        const response = await fetch(
          `${supabaseUrl}/functions/v1/upload-wizard-photos`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseAnonKey}`,
            },
            body: photoFormData,
          }
        );

        if (response.ok) {
          const result = await response.json();
          const actualCount = typeof result.count === 'number' ? result.count : photos.length;
          if (actualCount === 0) {
            logger.error(`upload-wizard-photos returned count=0 for session ${sessionId}, ${photos.length} photos were sent`);
            setUploadState("error");
          } else {
            setUploadedCount(actualCount);
            setUploadState("success");
            logger.info(
              `Uploaded ${actualCount} wizard photos for session ${sessionId} (Danke-Seite)`
            );
          }
        } else {
          const errorText = await response.text();
          logger.error("Failed to upload wizard photos (Danke-Seite):", errorText);
          setUploadState("error");
        }
      } catch (error) {
        logger.error("Error uploading wizard photos (Danke-Seite):", error);
        setUploadState("error");
      }
    };

    uploadPhotos();
  }, []);

  // beforeunload-Warning: Warnt den User wenn er die Seite verlassen will
  // während Fotos noch hochgeladen werden
  useEffect(() => {
    if (uploadState !== "uploading") return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Moderner Browsers ignorieren custom messages, zeigen aber den Standard-Dialog
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [uploadState]);

  const isUploading = uploadState === "uploading";

  return (
    <PageLayout
      title={`Küche erfolgreich eingereicht – ${BRAND.name}`}
      description="Ihre Küche wurde erfolgreich eingereicht. Prüfen Sie Ihre E-Mails für den Aktivierungslink."
      keywords="küche verkaufen, anfrage gesendet, bewertung, küchenwert"
      canonicalPath="/verkaufen/danke"
      noIndex
    >
      <PageHero size="sm">
        <div className="text-center animate-fade-in max-w-3xl mx-auto">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Küche erfolgreich eingereicht!
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
            Ihre Küche wurde in unser System aufgenommen. Prüfen Sie jetzt Ihr E-Mail-Postfach.
          </p>
        </div>
      </PageHero>

      <div className="py-12 md:py-20 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-8">

            {/* E-Mail-Hinweis - prominent */}
            {!user && (
              <Card className="p-6 md:p-8 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 shadow-elegant">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                    <Inbox className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-amber-800 dark:text-amber-300 mb-2">
                      Prüfen Sie jetzt Ihr E-Mail-Postfach
                    </h2>
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Wir senden Ihnen in Kürze eine E-Mail mit einem <strong>Aktivierungslink</strong>. 
                      Klicken Sie auf den Link, um direkt in Ihr Dashboard zu gelangen 
                      und Ihre Küchen-Anfrage zu verwalten.
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                      Keine E-Mail erhalten? Prüfen Sie Ihren Spam-Ordner oder kontaktieren Sie uns.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Foto-Upload-Status - dynamisch basierend auf Upload-State */}
            {uploadState === "uploading" && (
              <Card className="p-4 md:p-5 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">
                      Fotos werden hochgeladen...
                    </h3>
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      {totalPhotos} {totalPhotos === 1 ? "Foto wird" : "Fotos werden"} gerade hochgeladen. 
                      Bitte lassen Sie diese Seite geöffnet, bis der Upload abgeschlossen ist.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {uploadState === "success" && (
              <Card className="p-4 md:p-5 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-green-800 dark:text-green-300 mb-1">
                      {uploadedCount} {uploadedCount === 1 ? "Foto" : "Fotos"} erfolgreich hochgeladen
                    </h3>
                    <p className="text-xs text-green-700 dark:text-green-400">
                      Ihre Fotos wurden Ihrem Inserat zugeordnet. Sie können diese Seite jetzt verlassen.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {uploadState === "error" && (
              <Card className="p-4 md:p-5 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
                      Foto-Upload fehlgeschlagen
                    </h3>
                    <p className="text-xs text-red-700 dark:text-red-400">
                      Beim Hochladen Ihrer Fotos ist ein Fehler aufgetreten. 
                      Keine Sorge – Sie können die Fotos später in Ihrem Dashboard erneut hochladen.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Kein Upload nötig - idle state (keine Fotos übergeben) */}
            {uploadState === "idle" && (
              <Card className="p-4 md:p-5 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                    <ImageIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">
                      Fotos hinzufügen
                    </h3>
                    <p className="text-xs text-blue-700 dark:text-blue-400">
                      Sie können jederzeit in Ihrem Dashboard Fotos zu Ihrem Inserat hinzufügen. 
                      Inserate mit Fotos erhalten 3x mehr Anfragen.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Was passiert als nächstes */}
            <Card className="p-6 md:p-8 shadow-elegant">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                <Clock className="w-6 h-6 text-primary" />
                So geht es weiter
              </h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Konto aktivieren</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {user 
                        ? "Ihr Konto ist bereits aktiv. Sie können Ihre Küchen-Anfrage direkt im Dashboard verwalten."
                        : "Klicken Sie auf den Aktivierungslink in Ihrer E-Mail, um direkt in Ihr Dashboard zu gelangen. Sie können sich danach jederzeit mit Ihrer E-Mail und dem gewählten Passwort einloggen."
                      }
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Inserat vervollständigen</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Im Dashboard können Sie weitere Fotos hinzufügen, Details ergänzen und Ihr Inserat optimieren. 
                      Inserate mit Fotos erhalten 3x mehr Anfragen.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Händler-Gebote erhalten</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Sobald Ihr Inserat live ist, erhalten Sie Gebote von geprüften Händlern. 
                      Sie können den gesamten Verkaufsprozess bequem über Ihr Dashboard verfolgen.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Kontakt */}
            <Card className="p-6 md:p-8 bg-primary/5 border-primary/20">
              <h2 className="text-lg font-bold mb-4">Haben Sie Fragen?</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Unser Team steht Ihnen jederzeit zur Verfügung.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="tel:+4951151532476"
                  className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                >
                  <Phone className="w-4 h-4" />
                  +49 511 51532476
                </a>
                <a
                  href={`mailto:${BRAND.supportEmail}`}
                  className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  {BRAND.supportEmail}
                </a>
              </div>
            </Card>

            {/* Navigation Buttons - deaktiviert während Upload */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              {user ? (
                <Button
                  size="lg"
                  onClick={() => navigate("/dashboard")}
                  disabled={isUploading}
                  className="gradient-hero hover:gradient-hero-hover group disabled:opacity-50"
                >
                  <LayoutDashboard className="w-5 h-5 mr-2" />
                  Zum Dashboard
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={() => navigate("/")}
                  disabled={isUploading}
                  className="gradient-hero hover:gradient-hero-hover group disabled:opacity-50"
                >
                  <Home className="w-5 h-5 mr-2" />
                  Zur Startseite
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              )}
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/ratgeber")}
                disabled={isUploading}
                className="group disabled:opacity-50"
              >
                <FileText className="w-5 h-5 mr-2" />
                Ratgeber lesen
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default VerkaufenDanke;
