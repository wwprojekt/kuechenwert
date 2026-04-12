/**
 * Dialog to view vehicle details in the admin panel
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Car, 
  User, 
  Calendar, 
  Gauge, 
  Fuel, 
  Ruler, 
  Weight,
  Bed,
  Users,
  Droplets,
  Sun,
  Wind,
  Tv,
  Camera,
  ParkingCircle,
  Lock,
  Bike,
  Warehouse,
  Snowflake,
  Tent
} from "lucide-react";

interface MotorhomeWithSeller {
  id: string;
  manufacturer: string;
  model: string;
  year: number;
  mileage: number;
  condition: string;
  body_type: string;
  description: string | null;
  sale_channel: string;
  instant_price: number | null;
  reserve_price: number | null;
  // Technical
  fuel_type: string | null;
  power_kw: number | null;
  engine_power_hp: number | null;
  transmission: string | null;
  emission_class: string | null;
  first_registration: string | null;
  tuev_valid_until: string | null;
  previous_owners: number | null;
  accident_free: boolean | null;
  non_smoker: boolean | null;
  service_history_available: boolean | null;
  // Dimensions
  length_m: number | null;
  width_m: number | null;
  height_m: number | null;
  weight_kg: number | null;
  payload_kg: number | null;
  number_of_axles: number | null;
  seats: number | null;
  sleeping_places: number | null;
  beds_description: string | null;
  // Interior
  has_kitchen: boolean | null;
  heating_type: string | null;
  air_conditioning_type: string | null;
  has_toilet: boolean | null;
  has_shower: boolean | null;
  has_bathroom: boolean;
  water_tank_liters: number | null;
  grey_water_capacity_liters: number | null;
  // Equipment
  has_solar: boolean;
  solar_power_watts: number | null;
  battery_capacity_ah: number | null;
  has_inverter: boolean | null;
  has_awning: boolean;
  awning_length_m: number | null;
  has_awning_tent: boolean | null;
  has_roof_ac: boolean | null;
  has_stand_ac: boolean | null;
  has_bike_rack: boolean | null;
  has_garage: boolean | null;
  has_tv: boolean | null;
  has_backup_camera: boolean | null;
  has_parking_sensors: boolean | null;
  has_cruise_control: boolean | null;
  has_central_locking: boolean | null;
  // Additional
  additional_equipment: string | null;
  vehicle_identification_number: string | null;
  license_plate: string | null;
  created_at: string;
  // Relations
  seller?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
  photos?: Array<{ count: number }>;
}

interface VehicleDetailDialogProps {
  vehicle: MotorhomeWithSeller | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VehicleDetailDialog({ 
  vehicle, 
  open, 
  onOpenChange 
}: VehicleDetailDialogProps) {
  if (!vehicle) return null;

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("de-DE");
  };

  const formatMonthYear = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("de-DE", { month: "2-digit", year: "numeric" });
  };

  const formatPrice = (price: number | null) => {
    if (price == null) return "—";
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            {vehicle.manufacturer} {vehicle.model}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Basic Info */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Grundinformationen</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InfoItem icon={Car} label="Aufbauart" value={vehicle.body_type} />
                <InfoItem icon={Calendar} label="Baujahr" value={String(vehicle.year)} />
                <InfoItem icon={Gauge} label="Kilometerstand" value={`${vehicle.mileage.toLocaleString()} km`} />
                <InfoItem label="Zustand" value={vehicle.condition} />
                <InfoItem label="Verkaufsweg" value={
                  vehicle.sale_channel === "auction" && vehicle.instant_price
                    ? "Händler-Auktion + Sofortkauf"
                    : vehicle.sale_channel === "auction"
                    ? "Händler-Auktion"
                    : vehicle.sale_channel === "station"
                    ? "Ankaufstation"
                    : vehicle.sale_channel
                } />
                {vehicle.instant_price ? (
                  <InfoItem label="Sofortkauf-Preis" value={formatPrice(vehicle.instant_price)} />
                ) : (
                  <InfoItem label="Mindestpreis" value={formatPrice(vehicle.reserve_price)} />
                )}
              </div>
              {vehicle.description && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground font-medium">Beschreibung:</p>
                  <p className="text-sm mt-1">{vehicle.description}</p>
                </div>
              )}
            </section>

            <Separator />

            {/* Seller Info */}
            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <User className="w-4 h-4" />
                Verkäufer
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InfoItem 
                  label="Name" 
                  value={vehicle.seller ? `${vehicle.seller.first_name || ''} ${vehicle.seller.last_name || ''}`.trim() || "—" : "—"} 
                />
                <InfoItem label="E-Mail" value={vehicle.seller?.email || "—"} />
              </div>
            </section>

            <Separator />

            {/* Technical Details */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Technische Daten</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InfoItem icon={Fuel} label="Kraftstoff" value={vehicle.fuel_type || "—"} />
                <InfoItem label="Leistung" value={vehicle.engine_power_hp ? `${vehicle.engine_power_hp} PS` : "—"} />
                <InfoItem label="Getriebe" value={vehicle.transmission || "—"} />
                <InfoItem label="Abgasnorm" value={vehicle.emission_class || "—"} />
                <InfoItem label="Erstzulassung" value={formatDate(vehicle.first_registration)} />
                <InfoItem label="TÜV bis" value={formatMonthYear(vehicle.tuev_valid_until)} />
                <InfoItem label="Vorbesitzer" value={vehicle.previous_owners?.toString() || "—"} />
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {vehicle.accident_free && <Badge variant="outline">Unfallfrei</Badge>}
                {vehicle.non_smoker && <Badge variant="outline">Nichtraucher</Badge>}
                {vehicle.service_history_available && <Badge variant="outline">Scheckheft</Badge>}
              </div>
            </section>

            <Separator />

            {/* Dimensions */}
            <section>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Ruler className="w-4 h-4" />
                Abmessungen & Kapazität
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InfoItem label="Länge" value={vehicle.length_m ? `${vehicle.length_m} cm` : "—"} />
                <InfoItem label="Breite" value={vehicle.width_m ? `${vehicle.width_m} cm` : "—"} />
                <InfoItem label="Höhe" value={vehicle.height_m ? `${vehicle.height_m} cm` : "—"} />
                <InfoItem icon={Weight} label="Gesamtgewicht" value={vehicle.weight_kg ? `${vehicle.weight_kg} kg` : "—"} />
                <InfoItem label="Zuladung" value={vehicle.payload_kg ? `${vehicle.payload_kg} kg` : "—"} />
                <InfoItem label="Achsen" value={vehicle.number_of_axles?.toString() || "—"} />
                <InfoItem icon={Users} label="Sitzplätze" value={vehicle.seats?.toString() || "—"} />
                <InfoItem icon={Bed} label="Schlafplätze" value={vehicle.sleeping_places?.toString() || "—"} />
              </div>
              {vehicle.beds_description && (
                <p className="text-sm text-muted-foreground mt-2">Betten: {vehicle.beds_description}</p>
              )}
            </section>

            <Separator />

            {/* Interior */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Innenausstattung</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InfoItem label="Heizung" value={vehicle.heating_type || "—"} />
                <InfoItem icon={Wind} label="Klimaanlage" value={vehicle.air_conditioning_type || "—"} />
                <InfoItem icon={Droplets} label="Frischwasser" value={vehicle.water_tank_liters ? `${vehicle.water_tank_liters} L` : "—"} />
                <InfoItem label="Grauwasser" value={vehicle.grey_water_capacity_liters ? `${vehicle.grey_water_capacity_liters} L` : "—"} />
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {vehicle.has_kitchen && <Badge variant="outline">Küche</Badge>}
                {vehicle.has_bathroom && <Badge variant="outline">Bad</Badge>}
                {vehicle.has_toilet && <Badge variant="outline">Toilette</Badge>}
                {vehicle.has_shower && <Badge variant="outline">Dusche</Badge>}
              </div>
            </section>

            <Separator />

            {/* Equipment */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Ausstattung</h3>
              <div className="flex flex-wrap gap-2">
                {vehicle.has_solar && (
                  <Badge variant="outline" className="gap-1">
                    <Sun className="w-3 h-3" />
                    Solar {vehicle.solar_power_watts ? `(${vehicle.solar_power_watts}W)` : ''}
                  </Badge>
                )}
                {vehicle.has_awning && (
                  <Badge variant="outline">
                    Markise {vehicle.awning_length_m ? `(${vehicle.awning_length_m}cm)` : ''}
                  </Badge>
                )}
                {vehicle.has_awning_tent && (
                  <Badge variant="outline" className="gap-1">
                    <Tent className="w-3 h-3" /> Vorzelt
                  </Badge>
                )}
                {(vehicle.has_roof_ac || vehicle.has_stand_ac) && (
                  <Badge variant="outline" className="gap-1">
                    <Snowflake className="w-3 h-3" /> Dachklima/Standklima
                  </Badge>
                )}
                {vehicle.has_inverter && <Badge variant="outline">Wechselrichter</Badge>}
                {vehicle.has_tv && (
                  <Badge variant="outline" className="gap-1">
                    <Tv className="w-3 h-3" /> TV/SAT
                  </Badge>
                )}
                {vehicle.has_backup_camera && (
                  <Badge variant="outline" className="gap-1">
                    <Camera className="w-3 h-3" /> Rückfahrkamera
                  </Badge>
                )}
                {vehicle.has_parking_sensors && (
                  <Badge variant="outline" className="gap-1">
                    <ParkingCircle className="w-3 h-3" /> Parksensoren
                  </Badge>
                )}
                {vehicle.has_cruise_control && <Badge variant="outline">Tempomat</Badge>}
                {vehicle.has_central_locking && (
                  <Badge variant="outline" className="gap-1">
                    <Lock className="w-3 h-3" /> Zentralverriegelung
                  </Badge>
                )}
                {vehicle.has_bike_rack && (
                  <Badge variant="outline" className="gap-1">
                    <Bike className="w-3 h-3" /> Fahrradträger
                  </Badge>
                )}
                {vehicle.has_garage && (
                  <Badge variant="outline" className="gap-1">
                    <Warehouse className="w-3 h-3" /> Heckgarage
                  </Badge>
                )}
              </div>
              {vehicle.battery_capacity_ah && (
                <p className="text-sm text-muted-foreground mt-2">Batterie: {vehicle.battery_capacity_ah} Ah</p>
              )}
              {vehicle.additional_equipment && (
                <div className="mt-3">
                  <p className="text-sm text-muted-foreground font-medium">Zusatzausstattung:</p>
                  <p className="text-sm mt-1">{vehicle.additional_equipment}</p>
                </div>
              )}
            </section>

            <Separator />

            {/* Meta Info */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Weitere Informationen</h3>
              <div className="grid grid-cols-2 gap-4">
                <InfoItem label="Fahrgestellnr." value={vehicle.vehicle_identification_number || "—"} />
                <InfoItem label="Kennzeichen" value={vehicle.license_plate || "—"} />
                <InfoItem label="Fotos" value={`${vehicle.photos?.[0]?.count || 0} Stück`} />
                <InfoItem label="Erstellt am" value={formatDate(vehicle.created_at)} />
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({ 
  icon: Icon, 
  label, 
  value 
}: { 
  icon?: React.ComponentType<{ className?: string }>;
  label: string; 
  value: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
