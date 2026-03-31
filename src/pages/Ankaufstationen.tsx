import { useEffect, useState, useMemo } from "react";
import PageLayout from "@/components/PageLayout";
import PageHero from "@/components/PageHero";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  Building2,
  ArrowRight,
  ArrowLeft,
  Send,
  Car,
  Euro,
  User,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { trackBeratungRequested, setEnhancedConversionFromForm, generateTransactionId } from "@/lib/gadsConversionService";
import { getTrackingData } from "@/lib/clickIdService";
import { useSettings } from "@/contexts/SettingsContext";
import { useToast } from "@/hooks/use-toast";
import {
  popularManufacturers,
  manufacturerModels,
  wohnwagenManufacturers,
  wohnwagenManufacturerModels,
  bodyTypes,
  wohnwagenBodyTypes,
  vehicleTypes,
} from "@/lib/vehicle-data";
import {
  generateServiceSchema,
  generateBreadcrumbSchema,
  getBreadcrumbsFromPath,
} from "@/lib/seo";

interface PurchaseStation {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  phone: string;
  email: string;
  manager_name: string | null;
  accepts_cash_payment: boolean;
  accepts_sepa_instant: boolean;
  opening_hours: any;
}

const CONDITIONS = [
  { value: "new", label: "Neu / Wie neu" },
  { value: "excellent", label: "Ausgezeichnet" },
  { value: "good", label: "Gut" },
  { value: "fair", label: "Befriedigend" },
  { value: "poor", label: "Renovierungsbedürftig" },
];

const Ankaufstationen = () => {
  const [stations, setStations] = useState<PurchaseStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<PurchaseStation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { settings } = useSettings();
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    vehicleType: "Wohnmobil" as string,
    manufacturer: "",
    model: "",
    year: "",
    mileage: "",
    bodyType: "",
    condition: "",
    priceExpectation: "",
    description: "",
  });

  useEffect(() => {
    fetchStations();
  }, []);

  const fetchStations = async () => {
    try {
      const { data, error } = await supabase
        .from("purchase_stations")
        .select("*")
        .eq("is_active", true)
        .order("city");

      if (error) throw error;
      setStations(data || []);
    } catch (error) {
      logger.error("Error fetching stations:", error);
    } finally {
      setLoading(false);
    }
  };

  // Dynamic manufacturer/model lists based on vehicle type
  const manufacturers = useMemo(() => {
    return formData.vehicleType === "Wohnwagen"
      ? wohnwagenManufacturers
      : popularManufacturers;
  }, [formData.vehicleType]);

  const models = useMemo(() => {
    if (!formData.manufacturer) return [];
    const modelMap =
      formData.vehicleType === "Wohnwagen"
        ? wohnwagenManufacturerModels
        : manufacturerModels;
    return modelMap[formData.manufacturer] || [];
  }, [formData.vehicleType, formData.manufacturer]);

  const bodyTypeOptions = useMemo(() => {
    return formData.vehicleType === "Wohnwagen"
      ? [...wohnwagenBodyTypes]
      : [...bodyTypes];
  }, [formData.vehicleType]);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Reset dependent fields
      if (field === "vehicleType") {
        updated.manufacturer = "";
        updated.model = "";
        updated.bodyType = "";
      }
      if (field === "manufacturer") {
        updated.model = "";
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStation) return;

    // Validation
    if (!formData.customerName || !formData.customerEmail) {
      toast({
        title: "Pflichtfelder ausfüllen",
        description: "Bitte geben Sie mindestens Ihren Namen und Ihre E-Mail-Adresse ein.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // 1. Save inquiry to database
      const { error: insertError } = await supabase
        .from("purchase_inquiries")
        .insert({
          station_id: selectedStation.id,
          customer_name: formData.customerName,
          customer_email: formData.customerEmail,
          customer_phone: formData.customerPhone || null,
          vehicle_type: formData.vehicleType,
          manufacturer: formData.manufacturer || null,
          model: formData.model || null,
          year: formData.year ? parseInt(formData.year) : null,
          mileage: formData.mileage ? parseInt(formData.mileage) : null,
          body_type: formData.bodyType || null,
          price_expectation: formData.priceExpectation
            ? parseFloat(formData.priceExpectation)
            : null,
          condition: formData.condition || null,
          description: formData.description || null,
        });

      if (insertError) {
        logger.error("Failed to save purchase inquiry:", insertError);
        // Continue anyway – email is more important
      }

      // 2. Send email notifications via Edge Function
      const trackingData = getTrackingData();
      const txId = generateTransactionId('ankaufstation');
      await supabase.functions.invoke("send-purchase-inquiry-notification", {
        body: {
          customerName: formData.customerName,
          customerEmail: formData.customerEmail,
          customerPhone: formData.customerPhone,
          vehicleType: formData.vehicleType,
          manufacturer: formData.manufacturer,
          model: formData.model,
          year: formData.year,
          mileage: formData.mileage,
          bodyType: formData.bodyType,
          condition: formData.condition
            ? CONDITIONS.find((c) => c.value === formData.condition)?.label || formData.condition
            : "",
          priceExpectation: formData.priceExpectation,
          description: formData.description,
          stationName: selectedStation.name,
          stationCity: selectedStation.city,
          stationEmail: selectedStation.email,
          stationPhone: selectedStation.phone,
          stationManagerName: selectedStation.manager_name,
          // Google Ads Tracking-Daten
          gclid: trackingData.gclid,
          gbraid: trackingData.gbraid,
          wbraid: trackingData.wbraid,
          ga4ClientId: trackingData.ga4ClientId,
          transactionId: txId,
        },
      });

      setSubmitted(true);

      // Google Ads: Enhanced Conversions + Ankaufstation-Anfrage
      await setEnhancedConversionFromForm({ customerEmail: formData.customerEmail, customerName: formData.customerName, customerPhone: formData.customerPhone });
      trackBeratungRequested('ankaufstation');

      toast({
        title: "Anfrage gesendet",
        description: `Ihre Anfrage wurde an ${selectedStation.name} gesendet. Sie erhalten eine Bestätigung per E-Mail.`,
      });
    } catch (error) {
      logger.error("Error submitting purchase inquiry:", error);
      toast({
        title: "Fehler",
        description: "Die Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedStation(null);
    setSubmitted(false);
    setFormData({
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      vehicleType: "Wohnmobil",
      manufacturer: "",
      model: "",
      year: "",
      mileage: "",
      bodyType: "",
      condition: "",
      priceExpectation: "",
      description: "",
    });
  };

  // Generate year options (current year down to 1980)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: currentYear - 1979 }, (_, i) =>
    String(currentYear - i)
  );

  return (
    <PageLayout
      breadcrumbs={true}
      title="Ankaufstationen – Wohnmobil vor Ort verkaufen"
      description="Finden Sie eine CaravanWert-Ankaufstation in Ihrer Nähe. Fahrzeugdaten eingeben, Preisvorstellung angeben und direkt vom Händler kontaktiert werden."
      keywords="ankaufstation, wohnmobil verkaufen, wohnmobil ankauf, wohnwagen verkaufen, abgabestelle"
      canonicalPath="/ankaufstationen"
      structuredData={[
        generateServiceSchema(
          "Wohnmobil-Ankaufstation",
          "Persönliche Übergabe Ihres Wohnmobils an einer unserer Ankaufstationen mit sofortiger Barzahlung."
        ),
        generateBreadcrumbSchema(getBreadcrumbsFromPath("/ankaufstationen")),
      ]}
    >
      <PageHero size="md">
        <div className="text-center animate-fade-in">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4 flex items-center justify-center gap-3">
            <Building2 className="w-10 h-10 text-primary" />
            Unsere Ankaufstationen
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {selectedStation
              ? `Anfrage an ${selectedStation.name} in ${selectedStation.city}`
              : "Wählen Sie eine Ankaufstation und senden Sie uns Ihre Fahrzeugdaten"}
          </p>
        </div>
      </PageHero>

      <div className="py-12 md:py-20">
        <div className="container mx-auto px-4">
          {/* ── Success State ─────────────────────────────────────── */}
          {submitted && selectedStation ? (
            <div className="max-w-2xl mx-auto text-center">
              <Card className="p-8 md:p-12">
                <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-6" />
                <h2 className="text-2xl font-bold mb-4">Anfrage erfolgreich gesendet!</h2>
                <p className="text-muted-foreground mb-2">
                  Ihre Ankauf-Anfrage wurde an <strong>{selectedStation.name}</strong> in{" "}
                  {selectedStation.city} gesendet.
                </p>
                <p className="text-muted-foreground mb-6">
                  Sie erhalten in Kürze eine Bestätigung per E-Mail an{" "}
                  <strong>{formData.customerEmail}</strong>. Der Händler wird sich
                  schnellstmöglich bei Ihnen melden.
                </p>
                <Button onClick={handleReset} size="lg">
                  Neue Anfrage stellen
                </Button>
              </Card>
            </div>
          ) : selectedStation ? (
            /* ── Inquiry Form ─────────────────────────────────────── */
            <div className="max-w-3xl mx-auto">
              {/* Selected station info bar */}
              <Card className="mb-8 border-primary/30 bg-primary/5">
                <CardContent className="py-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Building2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-semibold">{selectedStation.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedStation.address}, {selectedStation.postal_code}{" "}
                          {selectedStation.city}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedStation(null)}
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Andere Station
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <form onSubmit={handleSubmit}>
                {/* Contact Data */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <User className="w-5 h-5 text-primary" />
                      Ihre Kontaktdaten
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="customerName">
                          Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="customerName"
                          placeholder="Max Mustermann"
                          value={formData.customerName}
                          onChange={(e) => updateField("customerName", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customerEmail">
                          E-Mail <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="customerEmail"
                          type="email"
                          placeholder="max@beispiel.de"
                          value={formData.customerEmail}
                          onChange={(e) => updateField("customerEmail", e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerPhone">Telefon (optional)</Label>
                      <Input
                        id="customerPhone"
                        type="tel"
                        placeholder="+49 123 456789"
                        value={formData.customerPhone}
                        onChange={(e) => updateField("customerPhone", e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Vehicle Data */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Car className="w-5 h-5 text-primary" />
                      Fahrzeugdaten
                    </CardTitle>
                    <CardDescription>
                      Geben Sie die Daten Ihres Fahrzeugs ein, damit der Händler Ihnen ein
                      Angebot machen kann.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Vehicle Type */}
                    <div className="space-y-2">
                      <Label>Fahrzeugtyp</Label>
                      <Select
                        value={formData.vehicleType}
                        onValueChange={(val) => updateField("vehicleType", val)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicleTypes.map((vt) => (
                            <SelectItem key={vt.value} value={vt.value}>
                              {vt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Manufacturer */}
                      <div className="space-y-2">
                        <Label>Hersteller</Label>
                        <Select
                          value={formData.manufacturer}
                          onValueChange={(val) => updateField("manufacturer", val)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Hersteller wählen" />
                          </SelectTrigger>
                          <SelectContent>
                            {manufacturers.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                            <SelectItem value="Sonstige">Sonstige</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Model */}
                      <div className="space-y-2">
                        <Label>Modell</Label>
                        {models.length > 0 ? (
                          <Select
                            value={formData.model}
                            onValueChange={(val) => updateField("model", val)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Modell wählen" />
                            </SelectTrigger>
                            <SelectContent>
                              {models.map((m) => (
                                <SelectItem key={m} value={m}>
                                  {m}
                                </SelectItem>
                              ))}
                              <SelectItem value="Sonstige">Sonstige</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            placeholder="Modell eingeben"
                            value={formData.model}
                            onChange={(e) => updateField("model", e.target.value)}
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Year */}
                      <div className="space-y-2">
                        <Label>Baujahr</Label>
                        <Select
                          value={formData.year}
                          onValueChange={(val) => updateField("year", val)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Baujahr" />
                          </SelectTrigger>
                          <SelectContent>
                            {yearOptions.map((y) => (
                              <SelectItem key={y} value={y}>
                                {y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Mileage */}
                      <div className="space-y-2">
                        <Label>Kilometerstand</Label>
                        <Input
                          type="number"
                          placeholder="z.B. 45000"
                          value={formData.mileage}
                          onChange={(e) => updateField("mileage", e.target.value)}
                          min="0"
                        />
                      </div>

                      {/* Body Type */}
                      <div className="space-y-2">
                        <Label>Aufbauart</Label>
                        <Select
                          value={formData.bodyType}
                          onValueChange={(val) => updateField("bodyType", val)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Aufbauart" />
                          </SelectTrigger>
                          <SelectContent>
                            {bodyTypeOptions.map((bt) => (
                              <SelectItem key={bt} value={bt}>
                                {bt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Condition */}
                    <div className="space-y-2">
                      <Label>Zustand</Label>
                      <Select
                        value={formData.condition}
                        onValueChange={(val) => updateField("condition", val)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Zustand wählen" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITIONS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Price Expectation */}
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Euro className="w-5 h-5 text-primary" />
                      Preisvorstellung
                    </CardTitle>
                    <CardDescription>
                      Geben Sie Ihre Preisvorstellung an. Der Händler wird Ihnen auf Basis
                      der Fahrzeugdaten ein konkretes Angebot unterbreiten.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="priceExpectation">Preisvorstellung in Euro</Label>
                      <div className="relative">
                        <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="priceExpectation"
                          type="number"
                          placeholder="z.B. 35000"
                          className="pl-9"
                          value={formData.priceExpectation}
                          onChange={(e) => updateField("priceExpectation", e.target.value)}
                          min="0"
                          step="100"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">
                        Zusätzliche Informationen (optional)
                      </Label>
                      <Textarea
                        id="description"
                        placeholder="Besondere Ausstattung, bekannte Mängel, Wartungshistorie..."
                        value={formData.description}
                        onChange={(e) => updateField("description", e.target.value)}
                        rows={4}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Submit */}
                <div className="flex justify-end gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedStation(null)}
                  >
                    Abbrechen
                  </Button>
                  <Button type="submit" size="lg" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Wird gesendet...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Anfrage senden
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            /* ── Station Selection ────────────────────────────────── */
            <>
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
                  <p className="text-muted-foreground">Lade Stationen...</p>
                </div>
              ) : stations.length === 0 ? (
                <Card className="p-12 text-center">
                  <p className="text-muted-foreground">
                    Derzeit sind keine Ankaufstationen verfügbar.
                  </p>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {stations.map((station) => (
                    <Card
                      key={station.id}
                      className="hover-lift shadow-elegant cursor-pointer transition-all hover:border-primary/50"
                      onClick={() => setSelectedStation(station)}
                    >
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-primary" />
                          {station.name}
                        </CardTitle>
                        <CardDescription>{station.city}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Address */}
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div>
                            <p>{station.address}</p>
                            <p>
                              {station.postal_code} {station.city}
                            </p>
                          </div>
                        </div>

                        {/* Contact */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <span>{station.phone}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span>{station.email}</span>
                          </div>
                        </div>

                        {/* Manager */}
                        {station.manager_name && (
                          <div className="text-sm text-muted-foreground">
                            Ansprechpartner: {station.manager_name}
                          </div>
                        )}

                        {/* Payment Methods */}
                        <div className="pt-4 border-t">
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Zahlungsmethoden:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {station.accepts_cash_payment && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                                <CheckCircle2 className="w-3 h-3" />
                                Barzahlung
                              </span>
                            )}
                            {station.accepts_sepa_instant && (
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                                <CheckCircle2 className="w-3 h-3" />
                                SEPA Instant
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Opening Hours */}
                        {station.opening_hours && (
                          <div className="pt-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Öffnungszeiten
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {typeof station.opening_hours === "string"
                                ? station.opening_hours
                                : "Mo-Fr: 9-18 Uhr"}
                            </p>
                          </div>
                        )}

                        <Button className="w-full mt-4">
                          <span>Anfrage stellen</span>
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Info Section */}
              <div className="mt-16 grid md:grid-cols-3 gap-6">
                <Card className="p-6">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    Schnelle Abwicklung
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Übergabe und Bezahlung erfolgen direkt vor Ort innerhalb von 30
                    Minuten
                  </p>
                </Card>
                <Card className="p-6">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    Sichere Zahlung
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Wählen Sie zwischen Barzahlung oder sofortiger SEPA-Überweisung
                  </p>
                </Card>
                <Card className="p-6">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    Professionelle Übergabe
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Vollständige Dokumentation mit digitalem Übergabeprotokoll
                  </p>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default Ankaufstationen;
