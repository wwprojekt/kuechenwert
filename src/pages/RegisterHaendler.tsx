import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { handleValidationError, handleAuthError } from "@/lib/errorLogService";
import { logger } from "@/lib/logger";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  MapPin,
  Phone,
  Globe,
  User,
  Mail,
  Lock,
  CheckCircle2,
  ArrowRight,
  Upload,
  File,
  AlertCircle,
  Calendar,
  Scale,
} from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { passwordSchema, emailSchema } from "@/lib/validation";

const LEGAL_FORMS = [
  { value: "Einzelunternehmen", label: "Einzelunternehmen" },
  { value: "GmbH", label: "GmbH" },
  { value: "UG", label: "UG (haftungsbeschränkt)" },
  { value: "GbR", label: "GbR" },
  { value: "KG", label: "KG" },
  { value: "OHG", label: "OHG" },
  { value: "AG", label: "AG" },
  { value: "GmbH & Co. KG", label: "GmbH & Co. KG" },
];

const dealerRegistrationSchema = z.object({
  // Account details
  email: emailSchema,
  password: passwordSchema,
  passwordConfirm: z.string().min(1, "Passwort-Bestätigung erforderlich"),
  // Company details
  companyName: z.string().min(2, "Firmenname erforderlich"),
  companyAddress: z.string().min(5, "Adresse erforderlich"),
  companyPostalCode: z.string().regex(/^\d{5}$/, "Ungültige PLZ (5 Ziffern)"),
  companyCity: z.string().min(2, "Stadt erforderlich"),

  legalForm: z.string().optional(),
  foundedYear: z.string().regex(/^\d{4}$/, "Ungültiges Jahr (4 Ziffern)").optional().or(z.literal("")),
  // Contact person
  contactPersonName: z.string().min(2, "Name erforderlich"),
  contactPersonPosition: z.string().optional(),
  phone: z.string().regex(/^[\d\s\-+()]+$/, "Ungültige Telefonnummer"),
  website: z.string().url("Ungültige URL").optional().or(z.literal("")),

  agbAccepted: z.literal(true, { errorMap: () => ({ message: "Sie müssen die AGB und Datenschutzbestimmungen akzeptieren" }) }),
}).refine((data) => data.password === data.passwordConfirm, {
  message: "Passwörter stimmen nicht überein",
  path: ["passwordConfirm"],
}).refine((data) => {
  if (data.foundedYear && data.foundedYear !== "") {
    const year = parseInt(data.foundedYear);
    return year >= 1900 && year <= new Date().getFullYear();
  }
  return true;
}, {
  message: `Gründungsjahr muss zwischen 1900 und ${new Date().getFullYear()} liegen`,
  path: ["foundedYear"],
});

const RegisterHaendler = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    companyName: "",
    companyAddress: "",
    companyPostalCode: "",
    companyCity: "",

    legalForm: "",
    foundedYear: "",
    contactPersonName: "",
    contactPersonPosition: "",
    phone: "",
    website: "",

    agbAccepted: false as boolean,
  });

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Datei zu groß",
        description: "Die Datei darf maximal 10 MB groß sein",
        variant: "destructive",
      });
      return;
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Ungültiger Dateityp",
        description: "Nur PDF, JPG und PNG Dateien sind erlaubt",
        variant: "destructive",
      });
      return;
    }

    setDocumentFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validated = dealerRegistrationSchema.parse(formData);
      const redirectUrl = `${window.location.origin}/login`;

      // Step 1: Create user account with email confirmation
      // All dealer data is passed as user_metadata so the handle_new_user
      // database trigger can create the dealer_application automatically
      // (the trigger runs with SECURITY DEFINER, bypassing RLS)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            first_name: validated.contactPersonName.split(" ")[0],
            last_name: validated.contactPersonName.split(" ").slice(1).join(" ") || "",
            phone: validated.phone,
            company_name: validated.companyName,
            company_address: validated.companyAddress,
            company_postal_code: validated.companyPostalCode,
            company_city: validated.companyCity,
            contact_person_name: validated.contactPersonName,
            contact_person_position: validated.contactPersonPosition || null,
            website: validated.website || null,
            legal_form: validated.legalForm || null,
            founded_year: validated.foundedYear || null,
            is_dealer: true,
            user_type: 'dealer',
          },
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Benutzer konnte nicht erstellt werden");
      }

      // Step 2: Upload document via Edge Function (bypasses RLS)
      // The Edge Function uses service_role to upload to storage and
      // update the dealer_application with the document URL.
      if (documentFile) {
        setUploadingDocument(true);
        try {
          const uploadFormData = new FormData();
          uploadFormData.append('file', documentFile);
          uploadFormData.append('user_id', authData.user.id);
          uploadFormData.append('file_type', 'trade_license');

          const { data: uploadResult, error: uploadError } = await supabase.functions.invoke(
            'dealer-document-upload',
            { body: uploadFormData }
          );

          if (uploadError) {
            logger.error("Document upload error:", uploadError);
            // Continue without document - not critical for registration
          } else {
            logger.info("Document uploaded successfully:", uploadResult?.url);
          }
        } catch (uploadErr) {
          logger.error("Document upload failed:", uploadErr);
          // Continue - document can be uploaded later
        } finally {
          setUploadingDocument(false);
        }
      }

      // Role and dealer_application are created by the handle_new_user trigger automatically

      setRegistrationComplete(true);
      toast({
        title: "Registrierung erfolgreich!",
        description: "Bitte bestätigen Sie Ihre E-Mail-Adresse.",
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const germanMessage = handleValidationError(error, 'RegisterHaendler');
        toast({
          title: "Bitte überprüfen Sie Ihre Eingaben",
          description: germanMessage,
          variant: "destructive",
        });
      } else {
        const germanMessage = handleAuthError(error, 'RegisterHaendler');
        toast({
          title: "Registrierung fehlgeschlagen",
          description: germanMessage,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
      setUploadingDocument(false);
    }
  };

  // Success screen after registration
  if (registrationComplete) {
    return (
      <PageLayout
        title="Registrierung erfolgreich"
        description="Bestätigen Sie Ihre E-Mail-Adresse"
        canonicalPath="/register/haendler"
        noIndex={true}
      >
        <div className="min-h-screen flex items-center justify-center py-12 px-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-50/80 via-sky-50/40 to-white" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
          
          <Card className="p-8 max-w-lg w-full relative z-10 text-center">
            <div className="mx-auto h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold mb-4">Registrierung erfolgreich!</h1>
            <p className="text-muted-foreground mb-6">
              Wir haben Ihnen eine Bestätigungs-E-Mail gesendet. Bitte klicken Sie auf den Link in der E-Mail, um Ihr Konto zu aktivieren.
            </p>
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nach der E-Mail-Bestätigung können Sie sich einloggen und den Status Ihres Händlerantrags einsehen. Ihr Antrag wird von unserem Team geprüft und innerhalb von 1-3 Werktagen bearbeitet.
              </AlertDescription>
            </Alert>
            <div className="space-y-3">
              <Button
                onClick={() => navigate("/login")}
                className="w-full gradient-hero hover:gradient-hero-hover"
              >
                Zum Händler-Login
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate("/")}
                className="w-full"
              >
                Zurück zur Startseite
              </Button>
            </div>
          </Card>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Händler-Registrierung"
      description="Registrieren Sie sich als Händler bei CaravanWert"
      keywords="händler registrierung, dealer registration, wohnmobil händler werden"
      canonicalPath="/register/haendler"
      noIndex={true}
    >
      <div className="min-h-screen py-12 px-4 relative overflow-hidden">
        {/* Consistent gradient background */}
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-50/80 via-sky-50/40 to-white" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-cyan-100/30 to-transparent" />
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        
        <div className="container max-w-4xl relative z-10">
          {/* Header */}
          <div className="text-center mb-8 animate-fade-in">
            <Link to="/" className="inline-block mb-6 hover:opacity-90 transition-opacity">
              <img src="/logo.png" alt="CaravanWert" className="h-16 w-auto mx-auto" />
            </Link>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
              <Building2 className="w-4 h-4" />
              <span className="text-sm font-medium">Händler-Registrierung</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Als Händler registrieren
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Werden Sie Teil unseres Händlernetzwerks und profitieren Sie von exklusiven Auktionen
            </p>
          </div>

          {/* Benefits */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {[
              { icon: CheckCircle2, title: "Exklusiver Zugang", desc: "Zugriff auf Händler-Auktionen" },
              { icon: Building2, title: "B2B Netzwerk", desc: "Kontakte zu anderen Händlern" },
              { icon: CheckCircle2, title: "Direkte Registrierung", desc: "Sofortiger Zugang nach E-Mail-Bestätigung" },
            ].map((benefit, idx) => (
              <Card key={idx} className="p-4 text-center animate-fade-in" style={{ animationDelay: `${idx * 0.1}s` }}>
                <benefit.icon className="w-8 h-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold mb-1">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.desc}</p>
              </Card>
            ))}
          </div>

          {/* Form */}
          <Card className="p-8 shadow-elegant animate-slide-up">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Account Information */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  Zugangsdaten
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-Mail-Adresse *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="ihre@firma.de"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" />
                      Passwort *
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mind. 8 Zeichen, Groß-/Kleinbuchstabe, Zahl & Sonderzeichen"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passwordConfirm" className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" />
                      Passwort bestätigen *
                    </Label>
                    <Input
                      id="passwordConfirm"
                      type="password"
                      placeholder="Passwort wiederholen"
                      value={formData.passwordConfirm}
                      onChange={(e) => setFormData({ ...formData, passwordConfirm: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Company Information */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  Unternehmensinformationen
                </h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Firmenname *</Label>
                    <Input
                      id="companyName"
                      placeholder="Ihr Autohaus GmbH"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyAddress" className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      Firmenadresse *
                    </Label>
                    <Input
                      id="companyAddress"
                      placeholder="Musterstraße 123"
                      value={formData.companyAddress}
                      onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyPostalCode">PLZ *</Label>
                      <Input
                        id="companyPostalCode"
                        placeholder="12345"
                        maxLength={5}
                        value={formData.companyPostalCode}
                        onChange={(e) => setFormData({ ...formData, companyPostalCode: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyCity">Stadt *</Label>
                      <Input
                        id="companyCity"
                        placeholder="Berlin"
                        value={formData.companyCity}
                        onChange={(e) => setFormData({ ...formData, companyCity: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="document" className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-primary" />
                      Gewerbeschein hochladen (optional)
                    </Label>
                    <input
                      ref={documentInputRef}
                      id="document"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleDocumentUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => documentInputRef.current?.click()}
                      className="w-full justify-start gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      Datei auswählen
                    </Button>
                    {documentFile && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <File className="w-4 h-4" />
                        {documentFile.name}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      PDF, JPG oder PNG (max. 10 MB)
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="legalForm" className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-primary" />
                        Rechtsform
                      </Label>
                      <Select
                        value={formData.legalForm}
                        onValueChange={(value) => setFormData({ ...formData, legalForm: value })}
                      >
                        <SelectTrigger id="legalForm">
                          <SelectValue placeholder="Rechtsform auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEGAL_FORMS.map((form) => (
                            <SelectItem key={form.value} value={form.value}>
                              {form.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="foundedYear" className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        Gründungsjahr
                      </Label>
                      <Input
                        id="foundedYear"
                        type="number"
                        placeholder="z.B. 2010"
                        min={1900}
                        max={new Date().getFullYear()}
                        value={formData.foundedYear}
                        onChange={(e) => setFormData({ ...formData, foundedYear: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Person */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Ansprechpartner
                </h2>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contactPersonName">Name *</Label>
                      <Input
                        id="contactPersonName"
                        placeholder="Max Mustermann"
                        value={formData.contactPersonName}
                        onChange={(e) => setFormData({ ...formData, contactPersonName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactPersonPosition">Position (optional)</Label>
                      <Input
                        id="contactPersonPosition"
                        placeholder="Geschäftsführer"
                        value={formData.contactPersonPosition}
                        onChange={(e) => setFormData({ ...formData, contactPersonPosition: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-primary" />
                        Telefon *
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+49 123 456789"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website" className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-primary" />
                        Website (optional)
                      </Label>
                      <Input
                        id="website"
                        type="url"
                        placeholder="https://ihr-autohaus.de"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      />
                    </div>
                  </div>


                </div>
              </div>

              {/* Info Box */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nach der Registrierung erhalten Sie eine E-Mail zur Bestätigung Ihrer Adresse. 
                  Nach der Bestätigung können Sie sich sofort als Händler anmelden.
                </AlertDescription>
              </Alert>

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

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-12 text-base gradient-hero hover:gradient-hero-hover shadow-glow-sm"
                disabled={isLoading || uploadingDocument}
              >
                {uploadingDocument
                  ? "Dokument wird hochgeladen..."
                  : isLoading
                  ? "Wird registriert..."
                  : "Als Händler registrieren"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Dieses Formular ist ausschließlich für gewerbliche Händler bestimmt.
              </p>
            </form>

            <div className="mt-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Bereits registriert?{" "}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  Zum Händler-Login
                </Link>
              </p>
              <div className="h-px bg-border/50" />
              <p className="text-sm text-muted-foreground">
                Privatkunde?{" "}
                <Link to="/register" className="text-primary hover:underline font-medium">
                  Zur Privatkunden-Registrierung
                </Link>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
};

export default RegisterHaendler;
