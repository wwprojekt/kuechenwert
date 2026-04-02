import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { User, Building2, ArrowRight, CheckCircle2 } from "lucide-react";
import PageLayout from "@/components/PageLayout";

const RegisterChoice = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  return (
    <PageLayout
      title="Registrieren"
      description="Registrieren Sie sich bei CaravanWert – als Privatkunde oder Händler"
      keywords="registrieren, konto erstellen, wohnmobil verkaufen, händler registrierung"
      canonicalPath="/register"
      noIndex={true}
    >
      <div className="min-h-screen flex items-center justify-center py-12 px-4 relative overflow-hidden">
        {/* Consistent gradient background – identisch mit Register.tsx */}
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-50/80 via-sky-50/40 to-white" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-cyan-100/30 to-transparent" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }} />

        <div className="w-full max-w-3xl relative z-10">
          {/* Logo header */}
          <div className="text-center mb-8 animate-fade-in">
            <Link to="/" className="inline-block mb-6 hover:opacity-90 transition-opacity">
              <img src="/logo.png" alt="CaravanWert" className="h-16 w-auto mx-auto" />
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Wie möchten Sie sich registrieren?
            </h1>
            <p className="text-muted-foreground text-lg">
              Bitte wählen Sie Ihren Kontotyp
            </p>
          </div>

          {/* Zwei Kacheln */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
            {/* Privatkunde */}
            <Link to="/register/privat" className="group block">
              <Card className="p-6 md:p-8 shadow-elegant glass h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/30 cursor-pointer">
                <div className="flex flex-col items-center text-center h-full">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors duration-300">
                    <User className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">
                    Privatkunde
                  </h2>
                  <span className="inline-block text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full mb-4">
                    100 % kostenlos
                  </span>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    Verkaufen Sie Ihr Wohnmobil oder Ihren Caravan – komplett kostenlos und unverbindlich
                  </p>
                  <div className="space-y-2.5 text-left w-full mb-6">
                    <div className="flex items-center gap-2.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>Kostenlose Bewertung in 24h</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>Keine Gebühren – auch nicht beim Verkauf</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>Zugang zu exklusiven Händler-Auktionen</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>Direkter Kontakt zu geprüften Händlern</span>
                    </div>
                  </div>
                  <div className="mt-auto w-full">
                    <div className="w-full h-12 rounded-md gradient-hero flex items-center justify-center text-white font-medium group-hover:gradient-hero-hover shadow-[var(--shadow-glow-sm)] transition-all duration-300">
                      Kostenlos registrieren
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                    </div>
                  </div>
                </div>
              </Card>
            </Link>

            {/* Händler */}
            <Link to="/register/haendler" className="group block">
              <Card className="p-6 md:p-8 shadow-elegant glass h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/30 cursor-pointer">
                <div className="flex flex-col items-center text-center h-full">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors duration-300">
                    <Building2 className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3">
                    Händler
                  </h2>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    Ich bin gewerblicher Händler und möchte auf Auktionen bieten
                  </p>
                  <div className="space-y-2.5 text-left w-full mb-6">
                    <div className="flex items-center gap-2.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>Auf Auktionen bieten</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>Sofortkauf-Option nutzen</span>
                    </div>
                    <div className="flex items-center gap-2.5 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>Händler-Dashboard & Benachrichtigungen</span>
                    </div>
                  </div>
                  <div className="mt-auto w-full">
                    <div className="w-full h-12 rounded-md bg-foreground flex items-center justify-center text-background font-medium group-hover:bg-foreground/90 transition-all duration-300">
                      Als Händler registrieren
                      <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-300" />
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          </div>

          {/* Footer-Links */}
          <div className="mt-8 text-center space-y-3 animate-fade-in">
            <p className="text-sm text-muted-foreground">
              Bereits registriert?{" "}
              <Link to="/login" className="text-primary hover:underline font-medium">
                Jetzt anmelden
              </Link>
            </p>
            <p className="text-sm text-muted-foreground">
              Fragen?{" "}
              <Link to="/kontakt" className="text-primary hover:underline">
                Kontaktieren Sie uns
              </Link>
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default RegisterChoice;
