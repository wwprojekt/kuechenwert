import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { handleValidationError, handleAuthError } from "@/lib/errorLogService";
import { trackUserRegistered, setEnhancedConversionData } from "@/lib/gadsConversionService";
import { trackMetaCompleteRegistration, trackMetaSubmitApplication } from "@/lib/metaPixelService";
import { trackEvent } from "@/lib/analyticsService";
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
  FileText,
  AlertCircle,
  Calendar,
  Scale,
  ShieldCheck,
} from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EU_COUNTRIES, getLegalFormsByCountry, DEFAULT_COUNTRY, getPhonePlaceholder } from "@/lib/euCountries";
import { CountryFlag } from "@/components/CountryFlag";
import { getTranslations, type TranslationKey } from "@/lib/dealerRegistrationTranslations";
import { optimizeImage } from "@/lib/imageOptimization";
import { BRAND } from "@/lib/brand";

/**
 * Creates a Zod validation schema that uses translated error messages
 * based on the currently selected country.
 */
function createDealerSchema(countryCode: string) {
  const tr = getTranslations(countryCode);

  const emailSchema = z
    .string()
    .min(1, tr.errorEmailRequired)
    .email(tr.errorEmailInvalid)
    .max(255, tr.errorEmailTooLong);

  const passwordSchema = z
    .string()
    .min(8, tr.errorPasswordMin)
    .regex(/[A-Z]/, tr.errorPasswordUppercase)
    .regex(/[a-z]/, tr.errorPasswordLowercase)
    .regex(/[0-9]/, tr.errorPasswordNumber)
    .regex(/[^A-Za-z0-9]/, tr.errorPasswordSpecialChar);

  return z.object({
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string().min(1, tr.errorPasswordConfirmRequired),
    companyName: z.string().min(2, tr.errorCompanyNameRequired),
    companyAddress: z.string().min(5, tr.errorAddressRequired),
    companyPostalCode: z.string().regex(/^[A-Za-z0-9\s\-]{3,10}$/, tr.errorPostalCodeInvalid),
    companyCity: z.string().min(2, tr.errorCityRequired),
    country: z.string().min(2, tr.errorCountryRequired),
    legalForm: z.string().optional(),
    foundedYear: z.string().regex(/^\d{4}$/, tr.errorFoundedYearInvalid).optional().or(z.literal("")),
    contactPersonName: z.string().min(2, tr.errorContactNameRequired),
    contactPersonPosition: z.string().optional(),
    phone: z.string().regex(/^[\d\s\-+()]+$/, tr.errorPhoneInvalid),
    vatId: z.string().optional().or(z.literal("")),
    website: z.string().url(tr.errorUrlInvalid).optional().or(z.literal("")),
    agbAccepted: z.literal(true, { errorMap: () => ({ message: tr.errorAgbRequired }) }),
  }).refine((data) => data.password === data.passwordConfirm, {
    message: tr.errorPasswordsMismatch,
    path: ["passwordConfirm"],
  }).refine((data) => {
    if (data.foundedYear && data.foundedYear !== "") {
      const year = parseInt(data.foundedYear);
      return year >= 1900 && year <= new Date().getFullYear();
    }
    return true;
  }, {
    message: tr.errorFoundedYearRange,
    path: ["foundedYear"],
  });
}

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
    country: DEFAULT_COUNTRY,
    legalForm: "",
    foundedYear: "",
    vatId: "",
    contactPersonName: "",
    contactPersonPosition: "",
    phone: "",
    website: "",
    agbAccepted: false as boolean,
  });

  // Get translations based on selected country
  const tr = useMemo(() => getTranslations(formData.country), [formData.country]);

  // Dynamic legal forms based on selected country
  const availableLegalForms = getLegalFormsByCountry(formData.country);

  // Reset legal form when country changes (if current selection is not valid for new country)
  const handleCountryChange = (newCountry: string) => {
    const newLegalForms = getLegalFormsByCountry(newCountry);
    const currentFormStillValid = newLegalForms.some(f => f.value === formData.legalForm);
    setFormData({
      ...formData,
      country: newCountry,
      legalForm: currentFormStillValid ? formData.legalForm : "",
    });
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg", "image/heic", "image/heif"];
    const allowedExtensions = ["pdf", "jpg", "jpeg", "png", "heic", "heif"];
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
      toast({
        title: tr.errorFileTypeInvalid,
        description: tr.errorFileTypeInvalidDesc,
        variant: "destructive",
      });
      return;
    }

    const isImage = file.type.startsWith("image/") || ["jpg", "jpeg", "png", "heic", "heif"].includes(fileExt);
    const maxSize = isImage ? 50 * 1024 * 1024 : 25 * 1024 * 1024;

    if (file.size > maxSize) {
      toast({
        title: tr.errorFileTooLarge,
        description: isImage ? "Max. 50 MB für Bilder." : "Max. 25 MB für PDFs.",
        variant: "destructive",
      });
      return;
    }

    // Auto-compress images > 1MB for fast uploads
    if (isImage && file.size > 1 * 1024 * 1024) {
      try {
        const result = await optimizeImage(file, {
          maxWidth: 2048,
          maxHeight: 2048,
          quality: 0.85,
          format: "jpeg",
        });
        logger.info(`Document auto-compressed: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(result.file.size / 1024 / 1024).toFixed(1)}MB`);
        setDocumentFile(result.file);
        return;
      } catch (err) {
        logger.warn("Image compression failed, using original:", err);
      }
    }

    setDocumentFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Create schema with current country's translations
    const dealerRegistrationSchema = createDealerSchema(formData.country);

    try {
      const validated = dealerRegistrationSchema.parse(formData);

      // Step 1: Register dealer via our custom Edge Function
      // This replaces supabase.auth.signUp() to avoid Supabase's generic confirmation email.
      // The Edge Function creates the user, generates a branded confirmation email,
      // and notifies the admin – all in one atomic operation.
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string;

      const registerPayload = JSON.stringify({
        email: validated.email,
        password: validated.password,
        firstName: validated.contactPersonName.split(" ")[0],
        lastName: validated.contactPersonName.split(" ").slice(1).join(" ") || "",
        phone: validated.phone,
        companyName: validated.companyName,
        companyAddress: validated.companyAddress,
        companyPostalCode: validated.companyPostalCode,
        companyCity: validated.companyCity,
        country: validated.country,
        contactPersonName: validated.contactPersonName,
        contactPersonPosition: validated.contactPersonPosition || null,
        website: validated.website || null,
        legalForm: validated.legalForm || null,
        foundedYear: validated.foundedYear || null,
        vatId: validated.vatId || null,
        agbAccepted: true,
      });

      const doRegisterFetch = async (signal?: AbortSignal) => {
        const resp = await fetch(
          `${supabaseUrl}/functions/v1/register-dealer`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey,
            },
            body: registerPayload,
            signal,
          }
        );
        return resp;
      };

      let registerResponse: Response;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        registerResponse = await doRegisterFetch(controller.signal);
        clearTimeout(timeout);
      } catch (fetchErr: any) {
        const isNetworkError =
          fetchErr?.name === 'AbortError' ||
          fetchErr?.message?.includes('Load failed') ||
          fetchErr?.message?.includes('Failed to fetch') ||
          fetchErr?.message?.includes('NetworkError');
        if (isNetworkError) {
          // Retry once for transient network failures (common on Safari)
          try {
            const retryController = new AbortController();
            const retryTimeout = setTimeout(() => retryController.abort(), 30000);
            registerResponse = await doRegisterFetch(retryController.signal);
            clearTimeout(retryTimeout);
          } catch {
            throw new Error(tr.errorUserCreationFailed);
          }
        } else {
          throw fetchErr;
        }
      }

      let registerResult: any;
      try {
        registerResult = await registerResponse!.json();
      } catch {
        throw new Error(tr.errorUserCreationFailed);
      }

      if (!registerResponse!.ok) {
        if (registerResult.code === 'USER_EXISTS') {
          throw new Error(registerResult.error || tr.errorUserCreationFailed);
        }
        throw new Error(registerResult.error || tr.errorUserCreationFailed);
      }

      const userId = registerResult.userId;
      if (!userId) {
        throw new Error(tr.errorUserCreationFailed);
      }

      // Step 2: Upload document via Edge Function (bypasses RLS)
      // The dealer-document-upload function verifies user_type === 'dealer'
      // in user_metadata and checks the 10-minute registration window.
      if (documentFile) {
        setUploadingDocument(true);
        try {
          const uploadFormData = new FormData();
          uploadFormData.append('file', documentFile);
          uploadFormData.append('user_id', userId);
          uploadFormData.append('file_type', 'trade_license');
          uploadFormData.append('registration_token', 'true');

          const response = await fetch(
            `${supabaseUrl}/functions/v1/dealer-document-upload`,
            {
              method: 'POST',
              headers: {
                'apikey': supabaseAnonKey,
              },
              body: uploadFormData,
            }
          );

          const uploadResult = await response.json();

          if (!response.ok || !uploadResult.success) {
            logger.error("Document upload error:", uploadResult.error || response.statusText);
            toast({
              title: "Dokument-Upload fehlgeschlagen",
              description: "Sie können das Dokument nach dem Login im Dashboard nachreichen.",
              variant: "destructive",
            });
          } else {
            logger.info("Document uploaded successfully:", uploadResult.url);
          }
        } catch (uploadErr) {
          logger.error("Document upload failed:", uploadErr);
          toast({
            title: "Dokument-Upload fehlgeschlagen",
            description: "Sie können das Dokument nach dem Login im Dashboard nachreichen.",
            variant: "destructive",
          });
        } finally {
          setUploadingDocument(false);
        }
      }

      // Google Ads: Enhanced Conversions + Händler-Registrierung
      await setEnhancedConversionData({ email: validated.email, firstName: validated.contactPersonName.split(' ')[0], lastName: validated.contactPersonName.split(' ').slice(1).join(' '), phone: validated.phone, postalCode: validated.companyPostalCode, country: validated.country });
      trackUserRegistered('dealer_registration');
      trackMetaCompleteRegistration({ content_name: 'Haendler-Registrierung' });
      trackMetaSubmitApplication({ content_name: 'Haendler-Bewerbung' });
      trackEvent('dealer_registered', { category: 'business', label: validated.companyName, properties: { country: validated.country } });

      setRegistrationComplete(true);
      toast({
        title: tr.toastRegistrationSuccessTitle,
        description: tr.toastRegistrationSuccessDesc,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        // Show the first validation error in the selected language (already translated via schema)
        const firstIssue = error.issues[0];
        const translatedMessage = firstIssue?.message || tr.toastValidationErrorTitle;
        // Also log via errorLogService for monitoring (always German internally)
        handleValidationError(error, 'RegisterHaendler');
        toast({
          title: tr.toastValidationErrorTitle,
          description: translatedMessage,
          variant: "destructive",
        });
      } else {
        const germanMessage = handleAuthError(error, 'RegisterHaendler');
        toast({
          title: tr.toastRegistrationFailedTitle,
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
            <h1 className="text-2xl font-bold mb-4">{tr.successTitle}</h1>
            <p className="text-muted-foreground mb-6">
              {tr.successMessage}
            </p>
            <Alert className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {tr.successAlertMessage}
              </AlertDescription>
            </Alert>
            <div className="space-y-3">
              <Button
                onClick={() => navigate("/login")}
                className="w-full gradient-hero hover:gradient-hero-hover"
              >
                {tr.successLoginButton}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate("/")}
                className="w-full"
              >
                {tr.successHomeButton}
              </Button>
            </div>
          </Card>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`Händler-Registrierung | ${BRAND.name}`}
      description={`Registrieren Sie sich als Küchen-Händler bei ${BRAND.name} und erhalten Sie qualifizierte Küchen-Leads aus ganz Deutschland.`}
      keywords="küchen händler registrierung, kitchen dealer registration, küchenankauf partner werden, küchen lead marketplace"
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
              <img src="/logo.svg" alt={BRAND.name} className="h-16 w-auto mx-auto" />
            </Link>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
              <Building2 className="w-4 h-4" />
              <span className="text-sm font-medium">{tr.pageBadge}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              {tr.pageTitle}
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {tr.pageSubtitle}
            </p>
          </div>

          {/* Benefits */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {[
              { icon: CheckCircle2, title: tr.benefitExclusiveTitle, desc: tr.benefitExclusiveDesc },
              { icon: Building2, title: tr.benefitNetworkTitle, desc: tr.benefitNetworkDesc },
              { icon: CheckCircle2, title: tr.benefitDirectTitle, desc: tr.benefitDirectDesc },
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
                  {tr.sectionCredentials}
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{tr.labelEmail}</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder={tr.placeholderEmail}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" />
                      {tr.labelPassword}
                    </Label>
                    <Input
                      id="password"
                      name="new-password"
                      type="password"
                      autoComplete="new-password"
                      placeholder={tr.placeholderPassword}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                    {/* Password requirements */}
                    <div className="bg-muted/50 rounded-lg p-3 space-y-1.5">
                      <p className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                        <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                        {tr.passwordRequirements}
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-0.5 ml-5">
                        <li className={formData.password.length >= 8 ? "text-green-600" : ""}>
                          • {tr.passwordMinLength}
                        </li>
                        <li className={/[A-Z]/.test(formData.password) ? "text-green-600" : ""}>
                          • {tr.passwordUppercase}
                        </li>
                        <li className={/[a-z]/.test(formData.password) ? "text-green-600" : ""}>
                          • {tr.passwordLowercase}
                        </li>
                        <li className={/[0-9]/.test(formData.password) ? "text-green-600" : ""}>
                          • {tr.passwordNumber}
                        </li>
                        <li className={/[^A-Za-z0-9]/.test(formData.password) ? "text-green-600" : ""}>
                          • {tr.passwordSpecialChar}
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passwordConfirm" className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" />
                      {tr.labelPasswordConfirm}
                    </Label>
                    <Input
                      id="passwordConfirm"
                      name="passwordConfirm"
                      type="password"
                      autoComplete="new-password"
                      placeholder={tr.placeholderPasswordConfirm}
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
                  {tr.sectionCompanyInfo}
                </h2>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">{tr.labelCompanyName}</Label>
                    <Input
                      id="companyName"
                      name="organization"
                      type="text"
                      autoComplete="organization"
                      autoCapitalize="words"
                      placeholder={tr.placeholderCompanyName}
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyAddress" className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      {tr.labelCompanyAddress}
                    </Label>
                    <Input
                      id="companyAddress"
                      name="street-address"
                      type="text"
                      autoComplete="street-address"
                      autoCapitalize="words"
                      placeholder={tr.placeholderAddress}
                      value={formData.companyAddress}
                      onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                    />
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyPostalCode">{tr.labelPostalCode}</Label>
                      <Input
                        id="companyPostalCode"
                        name="postal-code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        placeholder={tr.placeholderPostalCode}
                        maxLength={10}
                        value={formData.companyPostalCode}
                        onChange={(e) => setFormData({ ...formData, companyPostalCode: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyCity">{tr.labelCity}</Label>
                      <Input
                        id="companyCity"
                        name="address-level2"
                        type="text"
                        autoComplete="address-level2"
                        autoCapitalize="words"
                        placeholder={tr.placeholderCity}
                        value={formData.companyCity}
                        onChange={(e) => setFormData({ ...formData, companyCity: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">{tr.labelCountry}</Label>
                      <Select
                        value={formData.country}
                        onValueChange={handleCountryChange}
                      >
                        <SelectTrigger id="country">
                          <SelectValue placeholder={tr.placeholderCountry} />
                        </SelectTrigger>
                        <SelectContent>
                          {EU_COUNTRIES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              <span className="inline-flex items-center gap-2">
                                <CountryFlag countryCode={c.code} size="sm" />
                                <span>{c.name}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="document" className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-primary" />
                      {tr.labelDocument}
                    </Label>
                    <input
                      ref={documentInputRef}
                      id="document"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif,application/pdf"
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
                      {tr.fileSelectButton}
                    </Button>
                    {documentFile && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <File className="w-4 h-4" />
                        {documentFile.name}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {tr.fileTypeHint}
                    </p>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="legalForm" className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-primary" />
                        {tr.labelLegalForm}
                      </Label>
                      <Select
                        value={formData.legalForm}
                        onValueChange={(value) => setFormData({ ...formData, legalForm: value })}
                      >
                        <SelectTrigger id="legalForm">
                          <SelectValue placeholder={tr.placeholderLegalForm} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableLegalForms.map((form) => (
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
                        {tr.labelFoundedYear}
                      </Label>
                      <Input
                        id="foundedYear"
                        name="foundedYear"
                        type="number"
                        inputMode="numeric"
                        placeholder={tr.placeholderFoundedYear}
                        min={1900}
                        max={new Date().getFullYear()}
                        value={formData.foundedYear}
                        onChange={(e) => setFormData({ ...formData, foundedYear: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* VAT ID (EU) – shown only for non-DE countries */}
                  {formData.country && formData.country !== 'DE' && (
                    <div className="space-y-2">
                      <Label htmlFor="vatId" className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        USt-IdNr. / VAT ID
                        <span className="text-xs text-muted-foreground ml-1">(optional)</span>
                      </Label>
                      <Input
                        id="vatId"
                        name="vatId"
                        type="text"
                        autoCapitalize="characters"
                        spellCheck={false}
                        placeholder={`z.B. ${formData.country}123456789`}
                        value={formData.vatId}
                        onChange={(e) => setFormData({ ...formData, vatId: e.target.value.toUpperCase() })}
                        className="uppercase"
                      />
                      <p className="text-xs text-muted-foreground">
                        Für Reverse-Charge-Rechnungen innerhalb der EU
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Contact Person */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  {tr.sectionContactPerson}
                </h2>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contactPersonName">{tr.labelContactName}</Label>
                      <Input
                        id="contactPersonName"
                        name="name"
                        type="text"
                        autoComplete="name"
                        autoCapitalize="words"
                        placeholder={tr.placeholderContactName}
                        value={formData.contactPersonName}
                        onChange={(e) => setFormData({ ...formData, contactPersonName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactPersonPosition">{tr.labelContactPosition}</Label>
                      <Input
                        id="contactPersonPosition"
                        name="organization-title"
                        type="text"
                        autoComplete="organization-title"
                        autoCapitalize="words"
                        placeholder={tr.placeholderContactPosition}
                        value={formData.contactPersonPosition}
                        onChange={(e) => setFormData({ ...formData, contactPersonPosition: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-primary" />
                        {tr.labelPhone}
                      </Label>
                      <Input
                        id="phone"
                        name="tel"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder={getPhonePlaceholder(formData.country)}
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="website" className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-primary" />
                        {tr.labelWebsite}
                      </Label>
                      <Input
                        id="website"
                        name="url"
                        type="url"
                        inputMode="url"
                        autoComplete="url"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder={tr.placeholderWebsite}
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
                  {tr.infoEmailConfirmation}
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
                  {tr.labelAgb}{" "}
                  <a href="/agb" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {tr.labelAgbLink}
                  </a>{" "}
                  &{" "}
                  <a href="/datenschutz" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {tr.labelPrivacyLink}
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
                  ? tr.buttonUploadingDocument
                  : isLoading
                  ? tr.buttonRegistering
                  : tr.buttonRegister}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                {tr.formOnlyForDealers}
              </p>
            </form>

            <div className="mt-6 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                {tr.alreadyRegistered}{" "}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  {tr.loginLink}
                </Link>
              </p>
              <div className="h-px bg-border/50" />
              <p className="text-sm text-muted-foreground">
                {tr.privateCustomer}{" "}
                <Link to="/register/privat" className="text-primary hover:underline font-medium">
                  {tr.privateRegistrationLink}
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
