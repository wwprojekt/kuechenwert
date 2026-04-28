/**
 * Dialog to view kitchen details in the admin panel
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
import { AdminPriceHistoryCard } from "@/components/admin/AdminPriceHistoryCard";

interface KitchenWithSeller {
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

interface KitchenDetailDialogProps {
  kitchen: KitchenWithSeller | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KitchenDetailDialog({ 
  kitchen, 
  open, 
  onOpenChange 
}: KitchenDetailDialogProps) {
  if (!kitchen) return null;

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("de-DE");
  };

  const formatMonthYear = (date: string | null) => {
    if (!date) return "—";
    const m = /^(\d{4})-(\d{2})/.exec(date);
    if (m) return `${m[2]}.${m[1]}`;
    const d = new Date(date);
    if (isNaN(d.getTime())) return date;
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${mm}.${d.getFullYear()}`;
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
            {kitchen.manufacturer} {kitchen.model}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Basic Info */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Grundinformationen</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InfoItem icon={Car} label="Aufbauart" value={kitchen.body_type} />
                <InfoItem icon={Calendar} label="Baujahr" value={String(kitchen.year)} />
                <InfoItem icon={Gauge} label="Kilometerstand" value={`${kitchen.mileage.toLocaleString()} km`} />
                <InfoItem label="Zustand" value={kitchen.condition} />
                <InfoItem label="Verkaufsweg" value={
                  kitchen.sale_channel === "instant_price"
                    ? "Nur Festpreis"
                    : kitchen.sale_channel === "auction" && kitchen.instant_price
                    ? "Händler-Auktion + Sofortkauf"
                    : kitchen.sale_channel === "auction"
                    ? "Händler-Auktion"
                    : kitchen.sale_channel === "station"
                    ? "Ankaufstation"
                    : kitchen.sale_channel
                } />
                {kitchen.sale_channel === "instant_price" && kitchen.instant_price ? (
                  <InfoItem label="Festpreis" value={formatPrice(kitchen.instant_price)} />
                ) : kitchen.instant_price ? (
                  <InfoItem label="Sofortkauf-Preis" value={formatPrice(kitchen.instant_price)} />
                ) : (
                  <InfoItem label="Mindestpreis" value={formatPrice(kitchen.reserve_price)} />
                )}
              </div>
              {kitchen.description && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground font-medium">Beschreibung:</p>
                  <p className="text-sm mt-1">{kitchen.description}</p>
                </div>
              )}
            </section>

            <Separator />

            <AdminPriceHistoryCard kitchenId={kitchen.id} compact />

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
                  value={kitchen.seller ? `${kitchen.seller.first_name || ''} ${kitchen.seller.last_name || ''}`.trim() || "—" : "—"} 
                />
                <InfoItem label="E-Mail" value={kitchen.seller?.email || "—"} />
              </div>
            </section>

            <Separator />

            {/* Technical Details */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Technische Daten</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InfoItem icon={Fuel} label="Kraftstoff" value={kitchen.fuel_type || "—"} />
                <InfoItem label="Leistung" value={kitchen.engine_power_hp ? `${kitchen.engine_power_hp} PS` : "—"} />
                <InfoItem label="Getriebe" value={kitchen.transmission || "—"} />
                <InfoItem label="Abgasnorm" value={kitchen.emission_class || "—"} />
                <InfoItem label="Erstzulassung" value={formatMonthYear(kitchen.first_registration)} />
                <InfoItem label="TÜV bis" value={formatMonthYear(kitchen.tuev_valid_until)} />
                <InfoItem label="Vorbesitzer" value={kitchen.previous_owners?.toString() || "—"} />
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {kitchen.accident_free && <Badge variant="outline">Unfallfrei</Badge>}
                {kitchen.non_smoker && <Badge variant="outline">Nichtraucher</Badge>}
                {kitchen.service_history_available && <Badge variant="outline">Scheckheft</Badge>}
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
                <InfoItem label="Länge" value={kitchen.length_m ? `${kitchen.length_m} cm` : "—"} />
                <InfoItem label="Breite" value={kitchen.width_m ? `${kitchen.width_m} cm` : "—"} />
                <InfoItem label="Höhe" value={kitchen.height_m ? `${kitchen.height_m} cm` : "—"} />
                <InfoItem icon={Weight} label="Gesamtgewicht" value={kitchen.weight_kg ? `${kitchen.weight_kg} kg` : "—"} />
                <InfoItem label="Zuladung" value={kitchen.payload_kg ? `${kitchen.payload_kg} kg` : "—"} />
                <InfoItem label="Achsen" value={kitchen.number_of_axles?.toString() || "—"} />
                <InfoItem icon={Users} label="Sitzplätze" value={kitchen.seats?.toString() || "—"} />
                <InfoItem icon={Bed} label="Schlafplätze" value={kitchen.sleeping_places?.toString() || "—"} />
              </div>
              {kitchen.beds_description && (
                <p className="text-sm text-muted-foreground mt-2">Betten: {kitchen.beds_description}</p>
              )}
            </section>

            <Separator />

            {/* Interior */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Innenausstattung</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <InfoItem label="Heizung" value={kitchen.heating_type || "—"} />
                <InfoItem icon={Wind} label="Klimaanlage" value={kitchen.air_conditioning_type || "—"} />
                <InfoItem icon={Droplets} label="Frischwasser" value={kitchen.water_tank_liters ? `${kitchen.water_tank_liters} L` : "—"} />
                <InfoItem label="Grauwasser" value={kitchen.grey_water_capacity_liters ? `${kitchen.grey_water_capacity_liters} L` : "—"} />
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {kitchen.has_kitchen && <Badge variant="outline">Küche</Badge>}
                {kitchen.has_bathroom && <Badge variant="outline">Bad</Badge>}
                {kitchen.has_toilet && <Badge variant="outline">Toilette</Badge>}
                {kitchen.has_shower && <Badge variant="outline">Dusche</Badge>}
              </div>
            </section>

            <Separator />

            {/* Equipment */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Ausstattung</h3>
              <div className="flex flex-wrap gap-2">
                {kitchen.has_solar && (
                  <Badge variant="outline" className="gap-1">
                    <Sun className="w-3 h-3" />
                    Solar {kitchen.solar_power_watts ? `(${kitchen.solar_power_watts}W)` : ''}
                  </Badge>
                )}
                {kitchen.has_awning && (
                  <Badge variant="outline">
                    Markise {kitchen.awning_length_m ? `(${kitchen.awning_length_m}cm)` : ''}
                  </Badge>
                )}
                {kitchen.has_awning_tent && (
                  <Badge variant="outline" className="gap-1">
                    <Tent className="w-3 h-3" /> Vorzelt
                  </Badge>
                )}
                {(kitchen.has_roof_ac || kitchen.has_stand_ac) && (
                  <Badge variant="outline" className="gap-1">
                    <Snowflake className="w-3 h-3" /> Dachklima/Standklima
                  </Badge>
                )}
                {kitchen.has_inverter && <Badge variant="outline">Wechselrichter</Badge>}
                {kitchen.has_tv && (
                  <Badge variant="outline" className="gap-1">
                    <Tv className="w-3 h-3" /> TV/SAT
                  </Badge>
                )}
                {kitchen.has_backup_camera && (
                  <Badge variant="outline" className="gap-1">
                    <Camera className="w-3 h-3" /> Rückfahrkamera
                  </Badge>
                )}
                {kitchen.has_parking_sensors && (
                  <Badge variant="outline" className="gap-1">
                    <ParkingCircle className="w-3 h-3" /> Parksensoren
                  </Badge>
                )}
                {kitchen.has_cruise_control && <Badge variant="outline">Tempomat</Badge>}
                {kitchen.has_central_locking && (
                  <Badge variant="outline" className="gap-1">
                    <Lock className="w-3 h-3" /> Zentralverriegelung
                  </Badge>
                )}
                {kitchen.has_bike_rack && (
                  <Badge variant="outline" className="gap-1">
                    <Bike className="w-3 h-3" /> Fahrradträger
                  </Badge>
                )}
                {kitchen.has_garage && (
                  <Badge variant="outline" className="gap-1">
                    <Warehouse className="w-3 h-3" /> Heckgarage
                  </Badge>
                )}
              </div>
              {kitchen.battery_capacity_ah && (
                <p className="text-sm text-muted-foreground mt-2">Batterie: {kitchen.battery_capacity_ah} Ah</p>
              )}
              {kitchen.additional_equipment && (
                <div className="mt-3">
                  <p className="text-sm text-muted-foreground font-medium">Zusatzausstattung:</p>
                  <p className="text-sm mt-1">{kitchen.additional_equipment}</p>
                </div>
              )}
            </section>

            <Separator />

            {/* Meta Info */}
            <section>
              <h3 className="text-lg font-semibold mb-3">Weitere Informationen</h3>
              <div className="grid grid-cols-2 gap-4">
                <InfoItem label="Fahrgestellnr." value={kitchen.vehicle_identification_number || "—"} />
                <InfoItem label="Kennzeichen" value={kitchen.license_plate || "—"} />
                <InfoItem label="Fotos" value={`${kitchen.photos?.[0]?.count || 0} Stück`} />
                <InfoItem label="Erstellt am" value={formatDate(kitchen.created_at)} />
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
