import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { handleValidationError, handleAuthError } from "@/lib/errorLogService";
import { trackUserRegistered, setEnhancedConversionData } from "@/lib/gadsConversionService";
import { Mail, Lock, User, Phone, ArrowRight, CheckCircle2, ShieldCheck, MailCheck } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { passwordSchema, emailSchema } from "@/lib/validation";
import { Checkbox } from "@/components/ui/checkbox";

const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  passwordConfirm: z.string().min(1, "Passwort-Bestätigung erforderlich"),
  firstName: z.string().trim().min(1, "Vorname erforderlich").max(100),
  lastName: z.string().trim().min(1, "Nachname erforderlich").max(100),
  phone: z.string().trim()
    .min(1, "Telefonnummer erforderlich")
    .regex(/^[+]?[\d\s\-()]{8,20}$/, "Ungültige Telefonnummer"),
  companyName: z.string().trim().optional(),
  agbAccepted: z.literal(true, { errorMap: () => ({ message: "Sie müssen die AGB und Datenschutzbestimmungen akzeptieren" }) }),
}).refine((data) => data.password === data.passwordConfirm, {
  message: "Passwörter stimmen nicht überein",
  path: ["passwordConfirm"],
});

const Register = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    firstName: "",
    lastName: "",
    phone: "",
    companyName: "",
    agbAccepted: false as boolean,
  });

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = signUpSchema.parse(formData);
      const redirectUrl = `${window.location.origin}/`;

      const { error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: validated.firstName,
            last_name: validated.lastName,
            phone: validated.phone || null,
            company_name: validated.companyName || null,
          },
        },
      });

      if (error) throw error;

      // Google Ads: Enhanced Conversions + Registrierung
      await setEnhancedConversionData({ email: validated.email, firstName: validated.firstName, lastName: validated.lastName, phone: validated.phone });
      trackUserRegistered('email');

      setRegisteredEmail(validated.email);
      setIsSuccess(true);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const germanMessage = handleValidationError(error, 'Register');
        toast({
          title: "Bitte überprüfen Sie Ihre Eingaben",
          description: germanMessage,
          variant: "destructive",
        });
      } else {
        const germanMessage = handleAuthError(error, 'Register');
        toast({
          title: "Registrierung fehlgeschlagen",
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
      title="Registrieren"
      description="Erstellen Sie ein Konto bei CaravanWert"
      keywords="registrieren, konto erstellen, wohnmobil verkaufen"
      canonicalPath="/register"
      noIndex={true}
    >
      <div className="min-h-screen flex items-center justify-center py-12 px-4 relative overflow-hidden">
        {/* Consistent gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-50/80 via-sky-50/40 to-white" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-cyan-100/30 to-transparent" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        
        <div className="w-full max-w-2xl relative z-10">
          {/* Logo header */}
          <div className="text-center mb-8 animate-fade-in">
            <Link to="/" className="inline-block mb-6 hover:opacity-90 transition-opacity">
              <img src="/logo.png" alt="CaravanWert" className="h-16 w-auto mx-auto" />
            </Link>
            {!isSuccess && (
              <>
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium">Privatkunden-Bereich</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                  Konto erstellen
                </h1>
                <p className="text-muted-foreground text-lg">
                  Starten Sie jetzt und verkaufen Sie Ihr Wohnmobil
                </p>
              </>
            )}
          </div>

          {isSuccess ? (
            /* Erfolgsansicht nach erfolgreicher Registrierung */
            <Card className="p-8 md:p-12 shadow-elegant glass animate-slide-up text-center">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                  <MailCheck className="w-10 h-10 text-green-600" />
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
                Registrierung erfolgreich!
              </h2>
              <p className="text-muted-foreground text-lg mb-6">
                Wir haben eine Bestätigungs-E-Mail an
              </p>
              <div className="bg-primary/5 rounded-lg px-4 py-3 mb-6 inline-block">
                <p className="text-primary font-semibold text-lg">{registeredEmail}</p>
              </div>
              <p className="text-muted-foreground mb-8">
                gesendet. Bitte klicken Sie auf den Link in der E-Mail, um Ihr Konto zu aktivieren.
              </p>

              <div className="bg-muted/50 rounded-lg p-5 mb-8 text-left space-y-3">
                <p className="text-sm font-medium text-foreground">Was Sie jetzt tun sollten:</p>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">1</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Öffnen Sie Ihr E-Mail-Postfach und suchen Sie nach einer E-Mail von CaravanWert
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">2</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Klicken Sie auf den Bestätigungslink in der E-Mail
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-primary">3</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Nach der Bestätigung können Sie sich anmelden und Ihr Wohnmobil bewerten lassen
                  </p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mb-6">
                Keine E-Mail erhalten? Bitte prüfen Sie auch Ihren Spam-Ordner.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/login">
                  <Button className="gradient-hero hover:gradient-hero-hover shadow-glow-sm">
                    Zur Anmeldung
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link to="/">
                  <Button variant="outline">
                    Zur Startseite
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            /* Registrierungsformular */
            <>
              <Card className="p-8 shadow-elegant glass animate-slide-up">
                <form onSubmit={handleSignUp} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="flex items-center gap-2 text-base">
                        <User className="w-4 h-4 text-primary" />
                        Vorname *
                      </Label>
                      <Input
                        id="firstName"
                        placeholder="Max"
                        value={formData.firstName}
                        onChange={(e) =>
                          setFormData({ ...formData, firstName: e.target.value })
                        }
                        className="h-12 text-base"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-base">
                        Nachname *
                      </Label>
                      <Input
                        id="lastName"
                        placeholder="Mustermann"
                        value={formData.lastName}
                        onChange={(e) =>
                          setFormData({ ...formData, lastName: e.target.value })
                        }
                        className="h-12 text-base"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2 text-base">
                      <Mail className="w-4 h-4 text-primary" />
                      E-Mail-Adresse *
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
                      Passwort *
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Ihr sicheres Passwort"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="h-12 text-base"
                    />
                    {/* Passwort-Anforderungen */}
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                      <p className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                        <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                        Passwort-Anforderungen
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-0.5 ml-5">
                        <li className={formData.password.length >= 8 ? "text-green-600" : ""}>
                          • Mindestens 8 Zeichen
                        </li>
                        <li className={/[A-Z]/.test(formData.password) ? "text-green-600" : ""}>
                          • Mindestens ein Großbuchstabe
                        </li>
                        <li className={/[a-z]/.test(formData.password) ? "text-green-600" : ""}>
                          • Mindestens ein Kleinbuchstabe
                        </li>
                        <li className={/[0-9]/.test(formData.password) ? "text-green-600" : ""}>
                          • Mindestens eine Zahl
                        </li>
                        <li className={/[^A-Za-z0-9]/.test(formData.password) ? "text-green-600" : ""}>
                          • Mindestens ein Sonderzeichen (!@#$%^&* etc.)
                        </li>
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="passwordConfirm" className="flex items-center gap-2 text-base">
                      <Lock className="w-4 h-4 text-primary" />
                      Passwort bestätigen *
                    </Label>
                    <Input
                      id="passwordConfirm"
                      type="password"
                      placeholder="Passwort wiederholen"
                      value={formData.passwordConfirm}
                      onChange={(e) =>
                        setFormData({ ...formData, passwordConfirm: e.target.value })
                      }
                      className="h-12 text-base"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-2 text-base">
                      <Phone className="w-4 h-4 text-primary" />
                      Telefon*
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+49 123 456789"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className="h-12 text-base"
                    />
                  </div>

                  {/* AGB Checkbox */}
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="agb"
                      checked={formData.agbAccepted}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, agbAccepted: checked === true })
                      }
                      className="mt-1"
                    />
                    <Label htmlFor="agb" className="text-sm leading-relaxed cursor-pointer">
                      Ich akzeptiere die{" "}
                      <a href="/agb" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        AGB
                      </a>{" "}
                      und{" "}
                      <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Datenschutzbestimmungen
                      </a>{" "}
                      *
                    </Label>
                  </div>

                  {/* Benefits */}
                  <div className="bg-primary/5 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span>Kostenlose Bewertung in 24 Stunden</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span>Zugang zu exklusiven Auktionen</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span>Direkter Kontakt zu Händlern</span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-12 text-base gradient-hero hover:gradient-hero-hover shadow-glow-sm"
                    disabled={isLoading}
                  >
                    {isLoading ? "Wird registriert..." : "Konto erstellen"}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>

                </form>

                <div className="mt-6 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Bereits registriert?{" "}
                    <Link to="/login" className="text-primary hover:underline font-medium">
                      Jetzt anmelden
                    </Link>
                  </p>
                  <div className="h-px bg-border/50" />
                  <p className="text-sm text-muted-foreground">
                    Händler?{" "}
                    <Link to="/register/haendler" className="text-primary hover:underline font-medium">
                      Zur Händler-Registrierung
                    </Link>
                  </p>
                </div>
              </Card>

              {/* Additional help */}
              <div className="mt-6 text-center text-sm text-muted-foreground">
                <p>
                  Fragen?{" "}
                  <Link to="/kontakt" className="text-primary hover:underline">
                    Kontaktieren Sie uns
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default Register;
