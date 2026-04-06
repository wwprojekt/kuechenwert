/**
 * Reset Password page - allows users to set a new password after clicking the reset link
 */

import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { handleValidationError, handleAuthError } from "@/lib/errorLogService";
import { Lock, Loader2, CheckCircle2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import PageLayout from "@/components/PageLayout";

const passwordSchema = z.object({
  password: z.string()
    .min(8, "Passwort muss mindestens 8 Zeichen lang sein")
    .regex(/[A-Z]/, "Passwort muss mindestens einen Großbuchstaben enthalten")
    .regex(/[a-z]/, "Passwort muss mindestens einen Kleinbuchstaben enthalten")
    .regex(/[0-9]/, "Passwort muss mindestens eine Zahl enthalten"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwörter stimmen nicht überein",
  path: ["confirmPassword"],
});

const ResetPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Check if user has a valid reset session
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // User should have a session after clicking the reset link
      if (session) {
        setIsValidSession(true);
      } else {
        setIsValidSession(false);
      }
    };

    checkSession();

    // Listen for auth state changes (when user clicks the reset link)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setIsValidSession(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = passwordSchema.parse({ password, confirmPassword });

      const { error } = await supabase.auth.updateUser({
        password: validated.password,
      });

      if (error) throw error;

      setIsSuccess(true);
      toast({
        title: "Passwort geändert",
        description: "Ihr Passwort wurde erfolgreich aktualisiert.",
      });

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const germanMessage = handleValidationError(error, 'ResetPassword');
        toast({
          title: "Bitte überprüfen Sie Ihre Eingabe",
          description: germanMessage,
          variant: "destructive",
        });
      } else {
        logger.error("Password update error:", error);
        const germanMessage = handleAuthError(error, 'ResetPassword');
        toast({
          title: "Passwortänderung fehlgeschlagen",
          description: germanMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Password strength indicator
  const getPasswordStrength = (pwd: string) => {
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[a-z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(password);
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
  const strengthLabels = ['Sehr schwach', 'Schwach', 'Mittel', 'Stark', 'Sehr stark'];

  return (
    <PageLayout
      title="Passwort zurücksetzen"
      description="Setzen Sie ein neues Passwort für Ihr Konto"
      keywords="passwort zurücksetzen, neues passwort, caravanwert"
      canonicalPath="/reset-password"
      noIndex={true}
    >
      <div className="min-h-screen flex items-center justify-center py-12 px-4 bg-gradient-to-br from-background via-primary/5 to-background">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Header */}
          <div className="text-center">
            <Link to="/" className="inline-block mb-8">
              <img
                src="/logo.png"
                alt="CaravanWert"
                className="h-16 w-auto mx-auto"
              />
            </Link>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
              Neues Passwort festlegen
            </h1>
            <p className="mt-2 text-muted-foreground">
              Geben Sie Ihr neues Passwort ein
            </p>
          </div>

          <Card className="p-8 shadow-elegant">
            {isValidSession === null ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                <p className="mt-4 text-muted-foreground">Wird geladen...</p>
              </div>
            ) : !isValidSession ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                  <Lock className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-xl font-semibold">Ungültiger Link</h2>
                <p className="text-muted-foreground">
                  Dieser Link zum Zurücksetzen des Passworts ist ungültig oder
                  abgelaufen. Bitte fordern Sie einen neuen Link an.
                </p>
                <div className="pt-4">
                  <Link to="/forgot-password">
                    <Button className="w-full">
                      Neuen Link anfordern
                    </Button>
                  </Link>
                </div>
              </div>
            ) : isSuccess ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Passwort geändert!</h2>
                <p className="text-muted-foreground">
                  Ihr Passwort wurde erfolgreich aktualisiert. Sie werden in
                  Kürze zur Anmeldung weitergeleitet.
                </p>
                <div className="pt-4">
                  <Link to="/login">
                    <Button className="w-full">
                      Jetzt anmelden
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="password">Neues Passwort</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mindestens 8 Zeichen"
                      className="pl-10 pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  
                  {/* Password strength indicator */}
                  {password.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i < passwordStrength ? strengthColors[passwordStrength - 1] : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Passwortstärke: {strengthLabels[passwordStrength - 1] || 'Sehr schwach'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Passwort wiederholen"
                      className="pl-10 pr-10"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <p className="text-xs text-destructive">
                      Passwörter stimmen nicht überein
                    </p>
                  )}
                </div>

                {/* Password requirements */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    Passwort-Anforderungen
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li className={password.length >= 8 ? "text-green-600" : ""}>
                      • Mindestens 8 Zeichen
                    </li>
                    <li className={/[A-Z]/.test(password) ? "text-green-600" : ""}>
                      • Mindestens ein Großbuchstabe
                    </li>
                    <li className={/[a-z]/.test(password) ? "text-green-600" : ""}>
                      • Mindestens ein Kleinbuchstabe
                    </li>
                    <li className={/[0-9]/.test(password) ? "text-green-600" : ""}>
                      • Mindestens eine Zahl
                    </li>
                    <li className={/[^A-Za-z0-9]/.test(password) ? "text-green-600" : ""}>
                      • Mindestens ein Sonderzeichen (!@#$%^&* etc.)
                    </li>
                  </ul>
                </div>

                <Button
                  type="submit"
                  className="w-full gradient-hero hover:gradient-hero-hover"
                  size="lg"
                  disabled={isLoading || password !== confirmPassword || passwordStrength < 4}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Wird gespeichert...
                    </>
                  ) : (
                    "Passwort speichern"
                  )}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </PageLayout>
  );
};

export default ResetPassword;
