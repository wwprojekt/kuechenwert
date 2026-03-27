import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { trackUserRegistered, setEnhancedConversionData, generateTransactionId } from "@/lib/gadsConversionService";
import { getTrackingData } from "@/lib/clickIdService";
import { z } from "zod";
import {
  Building2,
  Phone,
  Globe,
  User,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Upload,
  File,
  CreditCard,
  Users,
  Calendar,
  Euro,
} from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { withSessionRetry } from "@/lib/sessionGuard";

const dealerApplicationSchema = z.object({
  companyName: z.string().min(2, "Firmenname erforderlich"),
  companyAddress: z.string().min(5, "Adresse erforderlich"),
  companyPostalCode: z.string().regex(/^\d{5}$/, "Ungültige PLZ (5 Ziffern)"),
  companyCity: z.string().min(2, "Stadt erforderlich"),

  contactPersonName: z.string().min(2, "Name erforderlich"),
  contactPersonPosition: z.string().optional(),
  phone: z.string().regex(/^[\d\s\-+()]+$/, "Ungültige Telefonnummer"),
  website: z.string().url("Ungültige URL").optional().or(z.literal("")),

  // New fields
  legalForm: z.enum(["Einzelunternehmen", "GbR", "UG", "GmbH", "AG", "KG", "OHG", "GmbH & Co. KG"], {
    required_error: "Rechtsform erforderlich",
  }),
  foundedYear: z
    .number()
    .min(1900, "Ungültiges Gründungsjahr")
    .max(new Date().getFullYear(), "Gründungsjahr kann nicht in der Zukunft liegen"),
  handelsregisterNumber: z.string().optional().or(z.literal("")),
  employeeCount: z.enum(["1-5", "6-20", "21-50", "50+"], {
    required_error: "Mitarbeiteranzahl erforderlich",
  }),
  annualRevenue: z.enum(["<100k", "100k-500k", "500k-1m", "1m-5m", ">5m"]).optional(),
  iban: z.string().regex(/^DE\d{20}$/, "Ungültige IBAN (Format: DE + 20 Ziffern)"),
  bic: z
    .string()
    .min(8, "BIC muss mindestens 8 Zeichen haben")
    .max(11, "BIC darf maximal 11 Zeichen haben"),
});

const DealerRegister = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [existingApplication, setExistingApplication] = useState<any>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    // Check for existing application
    const checkExistingApplication = async () => {
      const { data } = await supabase
        .from("dealer_applications")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setExistingApplication(data);
      }
    };

    checkExistingApplication();
  }, [user, navigate]);

  const [formData, setFormData] = useState({
    companyName: "",
    companyAddress: "",
    companyPostalCode: "",
    companyCity: "",

    contactPersonName: "",
    contactPersonPosition: "",
    phone: "",
    website: "",

    // New fields
    legalForm: "" as "Einzelunternehmen" | "GbR" | "UG" | "GmbH" | "AG" | "KG" | "OHG" | "GmbH & Co. KG" | "",
    foundedYear: "" as number | "",
    handelsregisterNumber: "",
    employeeCount: "" as "1-5" | "6-20" | "21-50" | "50+" | "",
    annualRevenue: "" as "<100k" | "100k-500k" | "500k-1m" | "1m-5m" | ">5m" | "",
    iban: "",
    bic: "",
  });

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Datei zu groß",
        description: "Die Datei darf maximal 10 MB groß sein",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
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
      const validated = dealerApplicationSchema.parse(formData);

      let documentUrl = null;

      // Upload document if provided
      if (documentFile) {
        setUploadingDocument(true);
        const fileExt = documentFile.name.split(".").pop();
        const fileName = `${user!.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("dealer-documents")
          .upload(fileName, documentFile);

        if (uploadError) throw uploadError;

        const { data: signedData, error: signedError } = await supabase.storage
          .from("dealer-documents")
          .createSignedUrl(fileName, 10 * 365 * 24 * 60 * 60); // 10 years

        if (signedError) throw signedError;
        documentUrl = signedData.signedUrl;
        setUploadingDocument(false);
      }

      await withSessionRetry(async () => {
        const { error } = await supabase.from("dealer_applications").insert({
          user_id: user!.id,
          company_name: validated.companyName,
          company_address: validated.companyAddress,
          company_postal_code: validated.companyPostalCode,
          company_city: validated.companyCity,

          contact_person_name: validated.contactPersonName,
          contact_person_position: validated.contactPersonPosition || null,
          phone: validated.phone,
          website: validated.website || null,

          trade_license_document_url: documentUrl,
          legal_form: validated.legalForm,
          founded_year: validated.foundedYear,
          handelsregister_number: validated.handelsregisterNumber || null,
          employee_count: validated.employeeCount,
          annual_revenue: validated.annualRevenue || null,
          iban: validated.iban,
          bic: validated.bic,
        });
        if (error) throw error;
      }, 'DealerRegister.insert');

      // Send email notification to admin + confirmation to dealer
      try {
        const trackingData = getTrackingData();
        // Transaction ID für Deduplizierung über alle 3 Tracking-Schichten
        const transactionId = generateTransactionId('dealer');
        (window as any).__lastTransactionId = transactionId;
        await supabase.functions.invoke("send-lead-notification", {
          body: {
            type: "dealer",
            name: validated.contactPersonName,
            email: user!.email || "",
            phone: validated.phone || undefined,
            companyName: validated.companyName,
            gclid: trackingData.gclid,
            gbraid: trackingData.gbraid,
            wbraid: trackingData.wbraid,
            ga4ClientId: trackingData.ga4ClientId,
            transactionId,
          },
        });
      } catch (emailError) {
        console.error("Failed to send dealer notification:", emailError);
      }

      // Google Ads: Enhanced Conversions + Händler-Antrag eingereicht
      await setEnhancedConversionData({ email: user!.email || '', firstName: validated.contactPersonName.split(' ')[0], lastName: validated.contactPersonName.split(' ').slice(1).join(' '), phone: validated.phone });
      const txId = (window as any).__lastTransactionId || generateTransactionId('dealer');
      trackUserRegistered('dealer_application', txId);

      toast({
        title: "Antrag erfolgreich eingereicht!",
        description:
          "Wir werden Ihre Unterlagen prüfen und uns innerhalb von 2-3 Werktagen bei Ihnen melden. Sie erhalten in Kürze eine Bestätigung per E-Mail.",
      });

      navigate("/");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validierungsfehler",
          description: error.errors[0].message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Fehler beim Einreichen",
          description: error.message || "Ein Fehler ist aufgetreten",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
      setUploadingDocument(false);
    }
  };

  if (!user) {
    return null;
  }

  if (existingApplication) {
    return (
      <PageLayout
        title="Händler-Antrag"
        description="Status Ihrer Händler-Bewerbung"
        canonicalPath="/dealer-register"
        noIndex={true}
      >
        <div className="min-h-screen flex items-center justify-center py-12 px-4 relative overflow-hidden">
          {/* Consistent gradient background */}
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-50/80 via-sky-50/40 to-white" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-cyan-100/30 to-transparent" />
          
          <Card className="p-8 max-w-2xl w-full relative z-10">
            <div className="text-center space-y-6">
              {existingApplication.status === "pending" && (
                <>
                  <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold mb-2">
                      Antrag wird geprüft
                    </h1>
                    <p className="text-muted-foreground">
                      Wir prüfen aktuell Ihre Unterlagen. Sie erhalten eine
                      E-Mail, sobald Ihr Antrag bearbeitet wurde.
                    </p>
                  </div>
                  <Alert>
                    <AlertDescription>
                      Eingereicht am:{" "}
                      {new Date(
                        existingApplication.submitted_at
                      ).toLocaleDateString("de-DE")}
                    </AlertDescription>
                  </Alert>
                </>
              )}

              {existingApplication.status === "approved" && (
                <>
                  <div className="mx-auto h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold mb-2">
                      Antrag genehmigt!
                    </h1>
                    <p className="text-muted-foreground">
                      Ihr Händler-Zugang wurde aktiviert. Sie haben nun Zugriff
                      auf alle Händler-Features.
                    </p>
                  </div>
                  <Button
                    onClick={() => navigate("/dashboard")}
                    className="gradient-hero hover:gradient-hero-hover"
                  >
                    Zum Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              )}

              {existingApplication.status === "rejected" && (
                <>
                  <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-destructive" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold mb-2">Antrag abgelehnt</h1>
                    <p className="text-muted-foreground mb-4">
                      Ihr Antrag konnte leider nicht genehmigt werden.
                    </p>
                    {existingApplication.rejection_reason && (
                      <Alert variant="destructive">
                        <AlertDescription>
                          Grund: {existingApplication.rejection_reason}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <Link to="/kontakt">
                    <Button variant="outline">Kontakt aufnehmen</Button>
                  </Link>
                </>
              )}

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
      title="Händler werden"
      description="Registrieren Sie sich als Händler bei CaravanWert"
      keywords="händler werden, händler registrierung, b2b wohnmobil"
      canonicalPath="/dealer-register"
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
            <Link
              to="/"
              className="inline-block mb-6 hover:opacity-90 transition-opacity"
            >
              <img src="/logo.png" alt="CaravanWert" className="h-16 w-auto mx-auto" />
            </Link>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Händler-Bewerbung
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Werden Sie Teil unseres Händlernetzwerks und profitieren Sie von
              exklusiven Auktionen und direktem Zugang zu Verkäufern
            </p>
          </div>

          {/* Benefits */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {[
              {
                icon: CheckCircle2,
                title: "Exklusiver Zugang",
                desc: "Zugriff auf Händler-Auktionen",
              },
              {
                icon: Briefcase,
                title: "B2B Netzwerk",
                desc: "Kontakte zu anderen Händlern",
              },
              {
                icon: Building2,
                title: "Priorisierung",
                desc: "Bevorzugte Behandlung",
              },
            ].map((benefit, idx) => (
              <Card
                key={idx}
                className="p-4 text-center animate-fade-in"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <benefit.icon className="w-8 h-8 text-primary mx-auto mb-2" />
                <h3 className="font-semibold mb-1">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground">{benefit.desc}</p>
              </Card>
            ))}
          </div>

          {/* Form */}
          <Card className="p-8 shadow-elegant animate-slide-up">
            <form onSubmit={handleSubmit} className="space-y-8">
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
                      onChange={(e) =>
                        setFormData({ ...formData, companyName: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyAddress">Firmenadresse *</Label>
                    <Input
                      id="companyAddress"
                      placeholder="Musterstraße 123"
                      value={formData.companyAddress}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          companyAddress: e.target.value,
                        })
                      }
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
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            companyPostalCode: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="companyCity">Stadt *</Label>
                      <Input
                        id="companyCity"
                        placeholder="Berlin"
                        value={formData.companyCity}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            companyCity: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="document" className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-primary" />
                      Gewerbeschein hochladen (optional)
                    </Label>
                    <div className="relative">
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
                        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                          <File className="w-4 h-4" />
                          {documentFile.name}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      PDF, JPG oder PNG (max. 10 MB)
                    </p>
                  </div>
                </div>
              </div>

              {/* Additional Business Information */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Euro className="w-5 h-5 text-primary" />
                  Unternehmensdaten
                </h2>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="legalForm">Rechtsform *</Label>
                      <Select
                        value={formData.legalForm}
                        onValueChange={(value: "Einzelunternehmen" | "GbR" | "UG" | "GmbH" | "AG" | "KG" | "OHG" | "GmbH & Co. KG") =>
                          setFormData({ ...formData, legalForm: value })
                        }
                      >
                        <SelectTrigger id="legalForm">
                          <SelectValue placeholder="Rechtsform wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Einzelunternehmen">Einzelunternehmen</SelectItem>
                          <SelectItem value="GbR">GbR</SelectItem>
                          <SelectItem value="UG">UG (haftungsbeschränkt)</SelectItem>
                          <SelectItem value="GmbH">GmbH</SelectItem>
                          <SelectItem value="AG">AG</SelectItem>
                          <SelectItem value="KG">KG</SelectItem>
                          <SelectItem value="OHG">OHG</SelectItem>
                          <SelectItem value="GmbH & Co. KG">GmbH & Co. KG</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="foundedYear" className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        Gründungsjahr *
                      </Label>
                      <Input
                        id="foundedYear"
                        type="number"
                        placeholder="2010"
                        min={1900}
                        max={new Date().getFullYear()}
                        value={formData.foundedYear}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            foundedYear: e.target.value ? parseInt(e.target.value, 10) : "",
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="handelsregisterNumber">
                        Handelsregisternummer
                        {(formData.legalForm === "GmbH" || formData.legalForm === "AG" || formData.legalForm === "GmbH & Co. KG") && " *"}
                      </Label>
                      <Input
                        id="handelsregisterNumber"
                        placeholder="HRB 12345"
                        value={formData.handelsregisterNumber}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            handelsregisterNumber: e.target.value,
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Erforderlich für GmbH und AG
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="employeeCount" className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        Anzahl Mitarbeiter *
                      </Label>
                      <Select
                        value={formData.employeeCount}
                        onValueChange={(value: "1-5" | "6-20" | "21-50" | "50+") =>
                          setFormData({ ...formData, employeeCount: value })
                        }
                      >
                        <SelectTrigger id="employeeCount">
                          <SelectValue placeholder="Mitarbeiter auswählen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-5">1-5 Mitarbeiter</SelectItem>
                          <SelectItem value="6-20">6-20 Mitarbeiter</SelectItem>
                          <SelectItem value="21-50">21-50 Mitarbeiter</SelectItem>
                          <SelectItem value="50+">Mehr als 50 Mitarbeiter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="annualRevenue">Jahresumsatz (ca.)</Label>
                    <Select
                      value={formData.annualRevenue}
                      onValueChange={(value: "<100k" | "100k-500k" | "500k-1m" | "1m-5m" | ">5m") =>
                        setFormData({ ...formData, annualRevenue: value })
                      }
                    >
                      <SelectTrigger id="annualRevenue">
                        <SelectValue placeholder="Umsatzbereich auswählen (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="<100k">Unter 100.000 €</SelectItem>
                        <SelectItem value="100k-500k">100.000 - 500.000 €</SelectItem>
                        <SelectItem value="500k-1m">500.000 - 1 Mio. €</SelectItem>
                        <SelectItem value="1m-5m">1 - 5 Mio. €</SelectItem>
                        <SelectItem value=">5m">Über 5 Mio. €</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Banking Information */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Bankverbindung
                </h2>
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="iban">IBAN *</Label>
                      <Input
                        id="iban"
                        placeholder="DE89 3704 0044 0532 0130 00"
                        value={formData.iban}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            iban: e.target.value.replace(/\s/g, "").toUpperCase(),
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Deutsche IBAN (DE + 20 Ziffern)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bic">BIC/SWIFT *</Label>
                      <Input
                        id="bic"
                        placeholder="COBADEFFXXX"
                        value={formData.bic}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            bic: e.target.value.toUpperCase(),
                          })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        8-11 Zeichen
                      </p>
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
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contactPersonName: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contactPersonPosition">
                        Position (optional)
                      </Label>
                      <Input
                        id="contactPersonPosition"
                        placeholder="Geschäftsführer"
                        value={formData.contactPersonPosition}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            contactPersonPosition: e.target.value,
                          })
                        }
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
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
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
                        onChange={(e) =>
                          setFormData({ ...formData, website: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>


              {/* Info Box */}
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nach Einreichung prüfen wir Ihre Unterlagen innerhalb von 2-3
                  Werktagen. Sie erhalten eine E-Mail mit dem Ergebnis.
                </AlertDescription>
              </Alert>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-12 text-base gradient-hero hover:gradient-hero-hover shadow-glow-sm"
                disabled={isLoading || uploadingDocument}
              >
                {uploadingDocument
                  ? "Dokument wird hochgeladen..."
                  : isLoading
                  ? "Wird eingereicht..."
                  : "Antrag einreichen"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Mit der Einreichung bestätigen Sie, dass alle Angaben korrekt
                und vollständig sind.
              </p>
            </form>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
};

export default DealerRegister;
