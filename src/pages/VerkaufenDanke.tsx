import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Phone, Mail, ArrowRight, Home, FileText, LayoutDashboard, Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const VerkaufenDanke = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <PageLayout
      title="Fahrzeug erfolgreich eingereicht – CaravanWert"
      description="Ihr Wohnmobil wurde erfolgreich eingereicht. Pr\u00fcfen Sie Ihre E-Mails f\u00fcr den Aktivierungslink."
      keywords="wohnmobil verkaufen, anfrage gesendet, bewertung"
      canonicalPath="/verkaufen/danke"
      noIndex
    >
      <PageHero size="sm">
        <div className="text-center animate-fade-in max-w-3xl mx-auto">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            Fahrzeug erfolgreich eingereicht!
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
            Ihr Wohnmobil wurde in unser System aufgenommen. Pr\u00fcfen Sie jetzt Ihr E-Mail-Postfach.
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
                      Pr\u00fcfen Sie jetzt Ihr E-Mail-Postfach
                    </h2>
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      Wir haben Ihnen eine E-Mail mit einem <strong>Aktivierungslink</strong> gesendet. 
                      Klicken Sie auf den Link, um Ihr Konto zu aktivieren, ein Passwort festzulegen 
                      und Ihr Fahrzeug im Dashboard zu verwalten.
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                      Keine E-Mail erhalten? Pr\u00fcfen Sie Ihren Spam-Ordner oder kontaktieren Sie uns.
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Was passiert als n\u00e4chstes */}
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
                        ? "Ihr Konto ist bereits aktiv. Sie k\u00f6nnen Ihr Fahrzeug direkt im Dashboard verwalten."
                        : "Klicken Sie auf den Aktivierungslink in Ihrer E-Mail, um Ihr Konto einzurichten und ein Passwort festzulegen."
                      }
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Fotos hochladen</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Laden Sie Fotos Ihres Wohnmobils hoch, um die Chancen auf einen schnellen Verkauf deutlich zu erh\u00f6hen. 
                      Inserate mit Fotos erhalten 3x mehr Anfragen.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">H\u00e4ndler-Gebote erhalten</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Sobald Ihr Inserat live ist, erhalten Sie Gebote von gepr\u00fcften H\u00e4ndlern. 
                      Sie k\u00f6nnen den gesamten Verkaufsprozess bequem \u00fcber Ihr Dashboard verfolgen.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Kontakt */}
            <Card className="p-6 md:p-8 bg-primary/5 border-primary/20">
              <h2 className="text-lg font-bold mb-4">Haben Sie Fragen?</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Unser Team steht Ihnen jederzeit zur Verf\u00fcgung.
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
                  href="mailto:kontakt@caravanwert.de"
                  className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  kontakt@caravanwert.de
                </a>
              </div>
            </Card>

            {/* Navigation Buttons - Modern Design */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              {user ? (
                <Button
                  size="lg"
                  onClick={() => navigate("/dashboard")}
                  className="gradient-hero hover:gradient-hero-hover group"
                >
                  <LayoutDashboard className="w-5 h-5 mr-2" />
                  Zum Dashboard
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              ) : (
                <Button
                  size="lg"
                  onClick={() => navigate("/")}
                  className="gradient-hero hover:gradient-hero-hover group"
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
                className="group"
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
