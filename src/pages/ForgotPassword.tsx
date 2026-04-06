/**
 * Forgot Password page - allows users to request a password reset email
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { handleValidationError } from "@/lib/errorLogService";
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import PageLayout from "@/components/PageLayout";

const emailSchema = z.object({
  email: z.string().trim().email("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
});

const ForgotPassword = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = emailSchema.parse({ email });

      const redirectUrl = `${window.location.origin}/reset-password`;
      logger.info("Password reset request:", { email: validated.email, redirectTo: redirectUrl });
      
      const { error, data } = await supabase.auth.resetPasswordForEmail(
        validated.email,
        {
          redirectTo: redirectUrl,
        }
      );

      logger.info("Password reset response:", { error, data, redirectTo: redirectUrl });
      
      if (error) throw error;

      setIsSuccess(true);
      toast({
        title: "E-Mail gesendet",
        description: "Bitte überprüfen Sie Ihr Postfach.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const germanMessage = handleValidationError(error, 'ForgotPassword');
        toast({
          title: "Bitte überprüfen Sie Ihre Eingabe",
          description: germanMessage,
          variant: "destructive",
        });
      } else {
        logger.error("Password reset error:", error);
        // Don't reveal if email exists or not for security
        setIsSuccess(true);
        toast({
          title: "E-Mail gesendet",
          description: "Falls ein Konto mit dieser E-Mail existiert, haben wir Ihnen einen Link zum Zurücksetzen gesendet.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageLayout
      title="Passwort vergessen"
      description="Setzen Sie Ihr Passwort zurück"
      keywords="passwort vergessen, passwort zurücksetzen, caravanwert"
      canonicalPath="/forgot-password"
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
              Passwort vergessen?
            </h1>
            <p className="mt-2 text-muted-foreground">
              Geben Sie Ihre E-Mail-Adresse ein, um einen Link zum Zurücksetzen
              zu erhalten
            </p>
          </div>

          <Card className="p-8 shadow-elegant">
            {isSuccess ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">E-Mail gesendet</h2>
                <p className="text-muted-foreground">
                  Falls ein Konto mit der E-Mail-Adresse{" "}
                  <strong>{email}</strong> existiert, haben wir Ihnen einen Link
                  zum Zurücksetzen Ihres Passworts gesendet.
                </p>
                <p className="text-sm text-muted-foreground">
                  Bitte überprüfen Sie auch Ihren Spam-Ordner.
                </p>
                <div className="pt-4">
                  <Link to="/login">
                    <Button variant="outline" className="w-full">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Zurück zur Anmeldung
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail-Adresse</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="ihre@email.de"
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full gradient-hero hover:gradient-hero-hover"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Wird gesendet...
                    </>
                  ) : (
                    "Link zum Zurücksetzen senden"
                  )}
                </Button>

                <div className="text-center">
                  <Link
                    to="/login"
                    className="text-sm text-primary hover:underline inline-flex items-center"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Zurück zur Anmeldung
                  </Link>
                </div>
              </form>
            )}
          </Card>

          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Noch kein Konto?{" "}
              <Link to="/register" className="text-primary hover:underline">
                Jetzt registrieren
              </Link>
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default ForgotPassword;
