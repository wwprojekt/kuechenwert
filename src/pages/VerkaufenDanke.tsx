import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, Phone, Mail, ArrowRight, Home, FileText, LayoutDashboard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const VerkaufenDanke = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <PageLayout
      title="Anfrage erfolgreich – CaravanWert"
      description="Ihre Wohnmobil-Bewertungsanfrage wurde erfolgreich gesendet. Wir melden uns innerhalb von 24 Stunden bei Ihnen."
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
            Vielen Dank für Ihre Anfrage!
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
            Wir haben Ihre Daten erfolgreich erhalten und bearbeiten Ihre Anfrage.
          </p>
        </div>
      </PageHero>

      <div className="py-12 md:py-20 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto space-y-8">
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
                    <h3 className="font-semibold text-foreground">Prüfung Ihrer Daten</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Unser Expertenteam prüft Ihre Fahrzeugdaten und erstellt eine marktgerechte Bewertung.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Kontaktaufnahme innerhalb von 24 Stunden</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Wir melden uns per E-Mail oder Telefon bei Ihnen, um das weitere Vorgehen zu besprechen.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Ihr Angebot erhalten</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Sie erhalten ein unverbindliches Angebot basierend auf der Auktion oder dem Sofortpreis – je nach Ihrem gewählten Verkaufsweg.
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
