import { useMemo, useEffect } from "react";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { 
  Car, Calendar, Gauge, Bed, Droplets, Sun, Tent, 
  Image as ImageIcon, Tag, CheckCircle2, Fuel, Zap,
  Settings, Ruler, Home, Wrench, Shield, Wind, Battery,
  Tv, Camera, ParkingCircle, Navigation, Lock, FileText
} from "lucide-react";

interface ReviewStepProps {
  formData: WizardFormData;
  onPrivacyAccepted?: (accepted: boolean) => void;
  privacyAccepted?: boolean;
}

export const ReviewStep = ({ formData }: ReviewStepProps) => {
  // Stable object URLs for photo previews to prevent memory leaks
  const photoUrls = useMemo(() => {
    return formData.photos.slice(0, 6).map((photo) => URL.createObjectURL(photo));
  }, [formData.photos]);

  // Revoke old object URLs when photos change or component unmounts
  useEffect(() => {
    return () => {
      photoUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoUrls]);

  const getSaleChannelLabel = (channel: string) => {
    switch (channel) {
      case "instant_price":
        return "Sofortpreis";
      case "auction":
        return "Händler-Auktion";
      case "station":
        return "Ankaufstation";
      default:
        return channel;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-primary" />
          Überprüfung
        </h2>
        <p className="text-muted-foreground">
          Bitte überprüfen Sie Ihre Angaben vor dem Absenden
        </p>
      </div>

      {/* Vehicle Details */}
      <Card className="p-4 md:p-6">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Car className="w-5 h-5 text-primary" />
          Fahrzeugdetails
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Hersteller & Modell</p>
            <p className="font-medium">{formData.manufacturer} {formData.model}</p>
          </div>
          <div>
            <p className="text-muted-foreground flex items-center gap-1">
              <Calendar className="w-4 h-4" /> Baujahr
            </p>
            <p className="font-medium">{formData.year}</p>
          </div>
          <div>
            <p className="text-muted-foreground flex items-center gap-1">
              <Gauge className="w-4 h-4" /> Kilometerstand
            </p>
            <p className="font-medium">{formData.mileage?.toLocaleString()} km</p>
          </div>
          <div>
            <p className="text-muted-foreground">Zustand</p>
            <Badge variant="secondary">{formData.condition}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Aufbauart</p>
            <Badge variant="secondary">{formData.bodyType}</Badge>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-muted-foreground mb-2">Beschreibung</p>
          <p className="text-sm bg-muted/50 p-3 rounded-lg border border-border">
            {formData.description}
          </p>
        </div>
      </Card>

      {/* Technical Details */}
      {(formData.fuel_type || formData.power_kw || formData.transmission) && (
        <Card className="p-4 md:p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            Technische Daten
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {formData.fuel_type && (
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Fuel className="w-4 h-4" /> Kraftstoff
                </p>
                <p className="font-medium">{formData.fuel_type}</p>
              </div>
            )}
            {formData.power_kw && (
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Zap className="w-4 h-4" /> Leistung
                </p>
                <p className="font-medium">{formData.power_kw} kW ({formData.power_ps} PS)</p>
              </div>
            )}
            {formData.transmission && (
              <div>
                <p className="text-muted-foreground">Getriebe</p>
                <p className="font-medium">{formData.transmission}</p>
              </div>
            )}
            {formData.emission_class && (
              <div>
                <p className="text-muted-foreground">Emissionsklasse</p>
                <Badge variant="secondary">{formData.emission_class}</Badge>
              </div>
            )}
            {formData.first_registration && (
              <div>
                <p className="text-muted-foreground">Erstzulassung</p>
                <p className="font-medium">{formData.first_registration}</p>
              </div>
            )}
            {formData.previous_owners !== null && formData.previous_owners !== undefined && (
              <div>
                <p className="text-muted-foreground">Vorbesitzer</p>
                <p className="font-medium">{formData.previous_owners}</p>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {formData.accident_free && (
              <Badge variant="outline" className="gap-1">
                <Shield className="w-3 h-3" /> Unfallfrei
              </Badge>
            )}
            {formData.non_smoker && (
              <Badge variant="outline" className="gap-1">
                <Wind className="w-3 h-3" /> Nichtraucher
              </Badge>
            )}
            {formData.service_history_available && (
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="w-3 h-3" /> Scheckheft
              </Badge>
            )}
          </div>
        </Card>
      )}

      {/* Dimensions */}
      {(formData.length_cm || formData.total_weight_kg || formData.sleeping_places) && (
        <Card className="p-4 md:p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Ruler className="w-5 h-5 text-primary" />
            Maße & Kapazitäten
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {formData.length_cm && (
              <div>
                <p className="text-muted-foreground">Länge × Breite × Höhe</p>
                <p className="font-medium">
                  {(formData.length_cm / 100).toFixed(2)} m × {(formData.width_cm! / 100).toFixed(2)} m × {(formData.height_cm! / 100).toFixed(2)} m
                </p>
              </div>
            )}
            {formData.total_weight_kg && (
              <div>
                <p className="text-muted-foreground">Gesamtgewicht</p>
                <p className="font-medium">{formData.total_weight_kg.toLocaleString()} kg</p>
              </div>
            )}
            {formData.payload_kg && (
              <div>
                <p className="text-muted-foreground">Zuladung</p>
                <p className="font-medium">{formData.payload_kg.toLocaleString()} kg</p>
              </div>
            )}
            {formData.seats_with_seatbelts && (
              <div>
                <p className="text-muted-foreground">Sitzplätze</p>
                <p className="font-medium">{formData.seats_with_seatbelts}</p>
              </div>
            )}
            {formData.sleeping_places && (
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Bed className="w-4 h-4" /> Schlafplätze
                </p>
                <p className="font-medium">{formData.sleeping_places}</p>
              </div>
            )}
            {formData.number_of_axles && (
              <div>
                <p className="text-muted-foreground">Anzahl Achsen</p>
                <p className="font-medium">{formData.number_of_axles}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Interior Features */}
      {(formData.has_kitchen || formData.has_bathroom || formData.heating_type) && (
        <Card className="p-4 md:p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Home className="w-5 h-5 text-primary" />
            Innenausstattung
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {formData.has_kitchen && (
              <div>
                <p className="text-muted-foreground">Küche</p>
                <Badge variant="default">Vorhanden</Badge>
              </div>
            )}
            {formData.refrigerator_type && (
              <div>
                <p className="text-muted-foreground">Kühlschrank</p>
                <p className="font-medium">{formData.refrigerator_type}</p>
              </div>
            )}
            {formData.heating_type && (
              <div>
                <p className="text-muted-foreground">Heizung</p>
                <p className="font-medium">{formData.heating_type}</p>
              </div>
            )}
            {formData.air_conditioning && formData.air_conditioning !== "Keine" && (
              <div>
                <p className="text-muted-foreground">Klimaanlage</p>
                <p className="font-medium">{formData.air_conditioning}</p>
              </div>
            )}
            {formData.fresh_water_capacity_liters && (
              <div>
                <p className="text-muted-foreground flex items-center gap-1">
                  <Droplets className="w-4 h-4" /> Frischwasser
                </p>
                <p className="font-medium">{formData.fresh_water_capacity_liters} L</p>
              </div>
            )}
            {formData.grey_water_capacity_liters && (
              <div>
                <p className="text-muted-foreground">Grauwasser</p>
                <p className="font-medium">{formData.grey_water_capacity_liters} L</p>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {formData.has_bathroom && (
              <Badge variant="outline" className="gap-1">
                <Droplets className="w-3 h-3" /> Badezimmer
              </Badge>
            )}
            {formData.has_toilet && (
              <Badge variant="outline">Toilette</Badge>
            )}
            {formData.has_shower && (
              <Badge variant="outline">Dusche</Badge>
            )}
          </div>
        </Card>
      )}

      {/* Equipment */}
      {(formData.has_solar || formData.has_awning || formData.has_reversing_camera) && (
        <Card className="p-4 md:p-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" />
            Ausstattung & Extras
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {formData.has_solar && (
              <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                <Sun className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs font-medium">Solar</p>
                {formData.solar_power_watts && (
                  <p className="text-xs text-muted-foreground">{formData.solar_power_watts}W</p>
                )}
              </div>
            )}
            {formData.battery_capacity_ah && (
              <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                <Battery className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs font-medium">Batterie</p>
                <p className="text-xs text-muted-foreground">{formData.battery_capacity_ah}Ah</p>
              </div>
            )}
            {formData.has_inverter && (
              <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                <Zap className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs font-medium">Wechselrichter</p>
              </div>
            )}
            {formData.has_awning && (
              <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                <Tent className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs font-medium">Markise</p>
                {formData.awning_length_cm && (
                  <p className="text-xs text-muted-foreground">{formData.awning_length_cm}cm</p>
                )}
              </div>
            )}
            {formData.has_bike_rack && (
              <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                <Wrench className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs font-medium">Fahrradträger</p>
              </div>
            )}
            {formData.has_garage && (
              <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                <Home className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs font-medium">Garage</p>
              </div>
            )}
            {formData.has_tv_sat && (
              <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                <Tv className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs font-medium">TV/SAT</p>
              </div>
            )}
            {formData.has_reversing_camera && (
              <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                <Camera className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs font-medium">Rückfahrkamera</p>
              </div>
            )}
            {formData.has_parking_sensors && (
              <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                <ParkingCircle className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs font-medium">Parksensoren</p>
              </div>
            )}
            {formData.has_cruise_control && (
              <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                <Navigation className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs font-medium">Tempomat</p>
              </div>
            )}
            {formData.has_central_locking && (
              <div className="text-center p-3 bg-primary/10 rounded-lg border border-primary/20">
                <Lock className="w-5 h-5 text-primary mx-auto mb-1" />
                <p className="text-xs font-medium">Zentralverriegelung</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Photos */}
      <Card className="p-4 md:p-6">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary" />
          Fotos
        </h3>
        <div className="flex items-center gap-2 mb-4">
          <Badge variant={formData.photos.length >= 4 ? "default" : "secondary"} className="gap-1">
            {formData.photos.length >= 4 && <CheckCircle2 className="w-3 h-3" />}
            {formData.photos.length} Fotos hochgeladen
          </Badge>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {photoUrls.map((url, index) => (
            <div key={index} className="aspect-square rounded-lg overflow-hidden border border-border">
              <img
                src={url}
                alt={`Preview ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
          {formData.photos.length > 6 && (
            <div className="aspect-square rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
              <p className="text-sm font-medium text-muted-foreground">
                +{formData.photos.length - 6}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Sale Channel */}
      <Card className="p-4 md:p-6">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" />
          Verkaufsweg
        </h3>
        <div className="flex items-center gap-3">
          <Badge className="text-base px-3 py-1">
            {getSaleChannelLabel(formData.saleChannel)}
          </Badge>
          {formData.saleChannel === "auction" && formData.reservePrice && (
            <p className="text-sm text-muted-foreground">
              Mindestpreis: {formData.reservePrice.toLocaleString()} €
            </p>
          )}
        </div>
      </Card>

      {/* Data Privacy Notice */}
      <Card className="p-4 md:p-6 border-2 border-primary/30 bg-primary/5">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Datenutzungserklärung
        </h3>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              Mit dem Absenden dieses Inserats erklären Sie sich damit einverstanden, dass Ihre angegebenen Daten 
              (Fahrzeugdaten, Fotos, Kontaktdaten) zur Vermittlung Ihres Wohnmobils verwendet werden.
            </p>
            <p>
              Ihre Daten werden an registrierte Händler weitergegeben, die an Ihrem Fahrzeug interessiert sein könnten. 
              Die Verarbeitung erfolgt gemäß unserer{" "}
              <Link to="/datenschutz" className="text-primary hover:underline font-medium" target="_blank">
                Datenschutzerklärung
              </Link>{" "}
              und den{" "}
              <Link to="/agb" className="text-primary hover:underline font-medium" target="_blank">
                Allgemeinen Geschäftsbedingungen
              </Link>.
            </p>
            <p>
              Sie können Ihr Inserat jederzeit über Ihr Dashboard deaktivieren oder löschen lassen.
            </p>
          </div>
        </div>
      </Card>

      {/* Submit Notice */}
      <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
        <p className="text-sm text-foreground">
          ℹ️ Nach dem Absenden erhalten Sie eine Bestätigungs-E-Mail. 
          Unser Team wird Ihre Angaben prüfen und Sie innerhalb von 24 Stunden kontaktieren.
        </p>
      </div>
    </div>
  );
};
