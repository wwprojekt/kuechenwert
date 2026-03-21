import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { handleValidationError, handleAuthError } from "@/lib/errorLogService";
import { Mail, Lock, ArrowRight, User } from "lucide-react";
import PageLayout from "@/components/PageLayout";

const signInSchema = z.object({
  email: z.string().trim().email("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
  password: z.string().min(1, "Bitte geben Sie Ihr Passwort ein"),
});

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const { primaryRole, isLoading: roleLoading, refetchRoles } = useUserRole();

  useEffect(() => {
    if (user && !roleLoading && primaryRole) {
      if (primaryRole === 'admin') {
        navigate("/admin", { replace: true });
      } else if (primaryRole === 'dealer') {
        toast({
          title: "Händler-Konto erkannt",
          description: "Sie werden zum Händler-Bereich weitergeleitet.",
        });
        navigate(redirectTo || "/dashboard", { replace: true });
      } else {
        navigate(redirectTo || "/dashboard", { replace: true });
      }
    }
  }, [user, primaryRole, roleLoading, navigate, toast, redirectTo]);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = signInSchema.parse(formData);

      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) throw error;

      toast({
        title: "Anmeldung erfolgreich!",
        description: "Sie werden weitergeleitet...",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const germanMessage = handleValidationError(error, 'Login');
        toast({
          title: "Bitte überprüfen Sie Ihre Eingaben",
          description: germanMessage,
          variant: "destructive",
        });
      } else {
        // Auth-Fehler zentral übersetzen und loggen
        const germanMessage = handleAuthError(error, 'Login');
        toast({
          title: "Anmeldung fehlgeschlagen",
          description: germanMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageLayout
      title="Anmelden"
      description="Melden Sie sich bei CaravanWert an"
      keywords="anmelden, login, wohnmobil"
      canonicalPath="/login"
      noIndex={true}
    >
      <div className="min-h-screen flex items-center justify-center py-12 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-50/80 via-sky-50/40 to-white" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-cyan-100/30 to-transparent" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        
        <div className="w-full max-w-md relative z-10">
          <div className="text-center mb-8 animate-fade-in">
            <Link to="/" className="inline-block mb-6 hover:opacity-90 transition-opacity">
              <img src="/logo.png" alt="CaravanWert" className="h-16 w-auto mx-auto" />
            </Link>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
              <User className="w-4 h-4" />
              <span className="text-sm font-medium">Privatkunden-Bereich</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Willkommen zurück
            </h1>
            <p className="text-muted-foreground text-lg">
              Melden Sie sich mit Ihrem Privatkunden-Konto an
            </p>
          </div>

          <Card className="p-8 shadow-elegant glass animate-slide-up">
            <form onSubmit={handleSignIn} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 text-base">
                  <Mail className="w-4 h-4 text-primary" />
                  E-Mail-Adresse
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="ihre@email.de"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2 text-base">
                  <Lock className="w-4 h-4 text-primary" />
                  Passwort
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="h-12 text-base"
                />
                <div className="flex justify-end">
                  <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                    Passwort vergessen?
                  </Link>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base gradient-hero hover:gradient-hero-hover shadow-glow-sm"
                disabled={isLoading}
              >
                {isLoading ? "Wird angemeldet..." : "Anmelden"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </form>

            <div className="mt-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Noch kein Konto?{" "}
                <Link to="/register" className="text-primary hover:underline font-medium">
                  Jetzt registrieren
                </Link>
              </p>
              <div className="h-px bg-border/50" />
              <p className="text-sm text-muted-foreground">
                Händler?{" "}
                <Link to="/login/haendler" className="text-primary hover:underline font-medium">
                  Zum Händler-Login
                </Link>
              </p>
            </div>
          </Card>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              Probleme beim Anmelden?{" "}
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

export default Login;
