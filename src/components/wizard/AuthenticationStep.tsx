/**
 * Authentication step for the motorhome selling wizard
 * Allows users to login or register inline before submitting
 */

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, LogIn, UserPlus, Mail, Lock, User as UserIcon, Loader2, Phone } from "lucide-react";
import { logger } from "@/lib/logger";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { emailSchema, passwordSchema } from "@/lib/validation";

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Passwort erforderlich"),
});

const registerSchema = z.object({
  firstName: z.string().trim().min(1, "Vorname erforderlich"),
  lastName: z.string().trim().min(1, "Nachname erforderlich"),
  email: emailSchema,
  phone: z.string().optional(),
  password: passwordSchema,
  confirmPassword: z.string().min(1, "Passwort-Bestätigung erforderlich"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwörter stimmen nicht überein",
  path: ["confirmPassword"],
});

interface AuthenticationStepProps {
  onAuthenticated: () => void;
  prefillEmail?: string;
  prefillName?: string;
  prefillPhone?: string;
}

export const AuthenticationStep = ({ onAuthenticated, prefillEmail, prefillName, prefillPhone }: AuthenticationStepProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Login form state - prefill email if available from wizard
  const [loginEmail, setLoginEmail] = useState(prefillEmail || "");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form state - prefill from wizard/modal data
  const [registerEmail, setRegisterEmail] = useState(prefillEmail || "");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [registerFirstName, setRegisterFirstName] = useState(prefillName?.split(' ')[0] || "");
  const [registerLastName, setRegisterLastName] = useState(prefillName?.split(' ').slice(1).join(' ') || "");
  const [registerPhone, setRegisterPhone] = useState(prefillPhone || "");

  useEffect(() => {
    // Check if user is already authenticated
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setIsLoading(false);
    };

    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const validated = loginSchema.parse({ email: loginEmail, password: loginPassword });

      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });

      if (error) throw error;

      toast({
        title: "Anmeldung erfolgreich",
        description: "Ihr Inserat wird jetzt abgesendet...",
      });

      onAuthenticated();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Bitte prüfen Sie Ihre Eingaben",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        logger.error("Login error:", error);
        toast({
          title: "Anmeldung fehlgeschlagen",
          description: "Bitte überprüfen Sie Ihre Anmeldedaten.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const validated = registerSchema.parse({
        firstName: registerFirstName,
        lastName: registerLastName,
        email: registerEmail,
        phone: registerPhone,
        password: registerPassword,
        confirmPassword: registerConfirmPassword,
      });

      const { error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          data: {
            first_name: validated.firstName,
            last_name: validated.lastName,
            phone: validated.phone || undefined,
            role: "private",
          },
        },
      });

      if (error) throw error;

      toast({
        title: "Registrierung erfolgreich",
        description: "Ihr Inserat wird jetzt abgesendet...",
      });

      onAuthenticated();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Bitte prüfen Sie Ihre Eingaben",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        logger.error("Register error:", error);
        toast({
          title: "Registrierung fehlgeschlagen",
          description: "Bitte versuchen Sie es erneut oder verwenden Sie eine andere E-Mail-Adresse.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueAsUser = () => {
    onAuthenticated();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // User is already authenticated
  if (user) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-primary" />
            Angemeldet
          </h2>
          <p className="text-muted-foreground">
            Sie sind angemeldet und können Ihr Inserat absenden
          </p>
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserIcon className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-medium">Angemeldet als</p>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <Button 
            className="w-full mt-6 gradient-hero hover:gradient-hero-hover" 
            size="lg"
            onClick={handleContinueAsUser}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Inserat jetzt absenden
          </Button>
        </Card>
      </div>
    );
  }

  // User needs to login or register
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <LogIn className="w-6 h-6 text-primary" />
          Anmeldung & Absenden
        </h2>
        <p className="text-muted-foreground">
          Melden Sie sich an oder erstellen Sie ein Konto, um Ihr Inserat abzusenden
        </p>
      </div>

      <Card className="p-6">
        <Tabs defaultValue={prefillEmail ? "register" : "login"} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login" className="gap-2">
              <LogIn className="w-4 h-4" />
              Anmelden
            </TabsTrigger>
            <TabsTrigger value="register" className="gap-2">
              <UserPlus className="w-4 h-4" />
              Registrieren
            </TabsTrigger>
          </TabsList>

          {/* Login Tab */}
          <TabsContent value="login" className="mt-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">E-Mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="ihre@email.de"
                    className="pl-10"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Passwort</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Anmelden...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Anmelden
                  </>
                )}
              </Button>
            </form>
          </TabsContent>

          {/* Register Tab */}
          <TabsContent value="register" className="mt-6">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="register-firstname">Vorname</Label>
                  <Input
                    id="register-firstname"
                    type="text"
                    placeholder="Max"
                    value={registerFirstName}
                    onChange={(e) => setRegisterFirstName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="register-lastname">Nachname</Label>
                  <Input
                    id="register-lastname"
                    type="text"
                    placeholder="Mustermann"
                    value={registerLastName}
                    onChange={(e) => setRegisterLastName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-email">E-Mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="ihre@email.de"
                    className="pl-10"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-phone">Telefon <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="register-phone"
                    type="tel"
                    placeholder="z.B. 0151 12345678"
                    className="pl-10"
                    value={registerPhone}
                    onChange={(e) => setRegisterPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-password">Passwort</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="register-password"
                    type="password"
                    placeholder="Mind. 8 Zeichen, Groß-/Kleinbuchstabe, Zahl & Sonderzeichen"
                    className="pl-10"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="register-confirm-password">Passwort bestätigen</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="register-confirm-password"
                    type="password"
                    placeholder="Passwort wiederholen"
                    className="pl-10"
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Registrieren...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Konto erstellen
                  </>
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Info Note */}
      <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
        <p className="text-sm text-foreground">
          ℹ️ Ihre eingegebenen Fahrzeugdaten werden gespeichert und gehen nicht verloren. 
          Nach der Anmeldung können Sie Ihr Inserat direkt absenden.
        </p>
      </div>
    </div>
  );
};
