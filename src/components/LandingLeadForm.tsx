import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, CheckCircle, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { vehicleTypes, popularManufacturers, wohnwagenManufacturers, bodyTypes, wohnwagenBodyTypes } from "@/lib/vehicle-data";
import { trackLandingPageLead } from "@/lib/gadsConversionService";
import { cn } from "@/lib/utils";

/** Mapping von vehicle-data.ts bodyTypes (Display-Labels) zu Wertrechner BODY_TYPES (interne values) */
const BODY_TYPE_MAP: Record<string, string> = {
  "Vollintegriert": "integriert",
  "Teilintegriert": "teilintegriert",
  "Alkoven": "alkoven",
  "Kastenwagen": "kastenwagen",
  "Campingbus": "campingbus",
  "Wohnwagen": "wohnwagen",
  "Faltcaravan": "faltcaravan",
  "Mobilheim": "mobilheim",
};

interface LandingLeadFormProps {
  className?: string;
  defaultManufacturer?: string;
}

export function LandingLeadForm({ className = "", defaultManufacturer }: LandingLeadFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [vehicleType, setVehicleType] = useState("");
  const [manufacturer, setManufacturer] = useState(defaultManufacturer || "");
  const [bodyType, setBodyType] = useState("");

  const isWohnwagen = vehicleType === "Wohnwagen";
  const currentManufacturers = isWohnwagen ? wohnwagenManufacturers : popularManufacturers;
  const currentBodyTypes = isWohnwagen ? wohnwagenBodyTypes : bodyTypes;

  const handleStartWertrechner = async () => {
    const errors: string[] = [];
    if (!vehicleType) errors.push("Fahrzeugtyp");
    if (!manufacturer) errors.push("Marke");
    if (!bodyType) errors.push("Kategorie");

    if (errors.length > 0) {
      toast({
        title: "Pflichtfelder ausfüllen",
        description: `Bitte wählen Sie: ${errors.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    // bodyType-Label auf Wertrechner-internen Wert mappen
    const mappedBodyType = BODY_TYPE_MAP[bodyType] || bodyType.toLowerCase();

    // Google Ads: Landing Page Lead Conversion (Sekundär – Micro-Conversion)
    // Trackt den Einstieg in den Wertrechner-Funnel von einer Google Ads Landing Page
    await trackLandingPageLead(
      window.location.pathname,
      `${manufacturer} ${bodyType}`
    );

    // Zum Wertrechner navigieren mit vorausgefüllten Daten
    const params = new URLSearchParams();
    params.set("bodyType", mappedBodyType);
    params.set("manufacturer", manufacturer);
    params.set("vehicleType", vehicleType);
    params.set("from", "landing");

    navigate(`/wertrechner?${params.toString()}`);
  };

  return (
    <Card className={`p-6 border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5 ${className}`}>
      <div className="space-y-4">
        <div className="text-center mb-2">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 mb-2">
            <Calculator className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-lg font-bold">Kostenlose Fahrzeugbewertung</h3>
          <p className="text-sm text-muted-foreground">Sofort-Ergebnis in nur 2 Minuten</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Select value={vehicleType} onValueChange={(val) => {
              setVehicleType(val);
              // Reset Hersteller und Kategorie bei Wechsel der Fahrzeugkategorie
              setManufacturer("");
              setBodyType("");
            }}>
            <SelectTrigger className="h-11 border-2">
              <SelectValue placeholder="Fahrzeugtyp wählen" />
            </SelectTrigger>
            <SelectContent>
              {vehicleTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={manufacturer} onValueChange={setManufacturer}>
            <SelectTrigger className="h-11 border-2">
              <SelectValue placeholder="Marke wählen" />
            </SelectTrigger>
            <SelectContent>
              {currentManufacturers.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={bodyType} onValueChange={setBodyType}>
            <SelectTrigger className="h-11 border-2">
              <SelectValue placeholder="Kategorie wählen" />
            </SelectTrigger>
            <SelectContent>
              {currentBodyTypes.map((bt) => (
                <SelectItem key={bt} value={bt}>
                  {bt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleStartWertrechner}
          className="w-full gradient-hero hover:gradient-hero-hover h-12 text-base font-semibold"
          size="lg"
        >
          Wert berechnen
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>

        {/* Trust indicators */}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            Kostenlos
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            Unverbindlich
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            Sicher
          </span>
        </div>
      </div>
    </Card>
  );
}
