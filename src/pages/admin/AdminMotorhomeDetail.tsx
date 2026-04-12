/**
 * Admin Vehicle Detail Page
 * Comprehensive view of vehicle with photos, specifications, and related data
 */

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  Car,
  User,
  Calendar,
  Gauge,
  Fuel,
  Settings,
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
  Edit,
  Trash2,
  Gavel,
  Image as ImageIcon,
  Mail,
  Phone,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MapPin,
  FileText,
  Euro,
  ExternalLink,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  AdminDetailLayout,
  DetailSection,
  InfoGrid,
  InfoItem,
  StatsCard,
} from "@/components/admin/AdminDetailLayout";
import { VehicleEditDialog } from "@/components/admin/MotorhomeEditDialog";
import { AdminPhotoManager } from "@/components/admin/AdminPhotoManager";
import { SendOwnerEmailDialog } from "@/components/admin/SendOwnerEmailDialog";
import { logger } from "@/lib/logger";

export default function AdminVehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  // Fetch vehicle with all related data
  const { data: vehicle, isLoading, error } = useQuery({
    queryKey: ["adminVehicleDetail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select(`
          *,
          vehicle_photos(id, url, display_order),
          damage_photos(id, photo_url, damage_location, damage_severity, damage_description),
          seller:profiles!left (
            id,
            first_name,
            last_name,
            email,
            phone,
            company_name,
            created_at
          ),
          auctions(
            id,
            status,
            starting_bid,
            current_bid,
            start_time,
            end_time
          ),
          appointments(
            id,
            status,
            appointment_date,
            station:purchase_stations(name, city)
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Delete vehicle mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Wohnmobil erfolgreich gelöscht");
      navigate("/admin/vehicles");
    },
    onError: (error) => {
      logger.error("Delete vehicle error:", error);
      toast.error("Fehler beim Löschen des Wohnmobils");
    },
  });

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-destructive" />
          <h2 className="mt-4 text-lg font-semibold">Wohnmobil nicht gefunden</h2>
          <p className="mt-2 text-muted-foreground">
            Das angeforderte Wohnmobil existiert nicht oder wurde gelöscht.
          </p>
          <Button className="mt-4" onClick={() => navigate("/admin/vehicles")}>
            Zurück zur Übersicht
          </Button>
        </div>
      </div>
    );
  }

  const formatPrice = (price: number | null) => {
    if (!price) return "—";
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
    }).format(price);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return format(new Date(date), "dd.MM.yyyy", { locale: de });
  };

  const formatMonthYear = (date: string | null) => {
    if (!date) return "—";
    return format(new Date(date), "MM/yyyy", { locale: de });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      available: { label: "Verfügbar", variant: "default" },
      pending: { label: "Ausstehend", variant: "secondary" },
      sold: { label: "Verkauft", variant: "outline" },
      reserved: { label: "Reserviert", variant: "secondary" },
    };
    return statusConfig[status] || { label: status, variant: "outline" };
  };

  const getSaleChannelBadge = (channel: string) => {
    const hasInstantBuy = vehicle?.instant_price && Number(vehicle.instant_price) > 0;
    const channelConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      instant_price: { label: "Auktion + Sofortkauf", variant: "default" },
      auction: hasInstantBuy ? { label: "Auktion + Sofortkauf", variant: "default" } : { label: "Auktion", variant: "secondary" },
      station: { label: "Station", variant: "outline" },
    };
    return channelConfig[channel] || { label: channel, variant: "outline" };
  };

  const sortedPhotos = Array.isArray(vehicle?.vehicle_photos)
    ? [...vehicle.vehicle_photos].sort(
        (a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)
      )
    : [];

  // auctions is a single object (not array) because vehicle_id has UNIQUE constraint
  // Supabase may return: object (single match), array (multiple), string (error), or null
  const auctionData = vehicle?.auctions;
  const activeAuction = (() => {
    if (!auctionData || typeof auctionData === 'string') return null;
    if (Array.isArray(auctionData)) {
      return auctionData.find((a: any) => a?.status === 'active') || null;
    }
    if (typeof auctionData === 'object' && auctionData.status === 'active') {
      return auctionData;
    }
    return null;
  })();

  return (
    <AdminDetailLayout
      title={vehicle ? `${vehicle.manufacturer} ${vehicle.model}` : "Wohnmobil"}
      subtitle={vehicle ? `${vehicle.year} • ${vehicle.body_type} • ${vehicle.listing_number || "—"}` : undefined}
      status={vehicle ? getStatusBadge(vehicle.status) : undefined}
      backUrl="/admin/vehicles"
      backLabel="Alle Wohnmobile"
      isLoading={isLoading}
      icon={<Car className="w-6 h-6" />}
      actions={
        vehicle && (
          <div className="flex gap-2">
            {vehicle.seller?.email && (
              <Button variant="outline" size="sm" onClick={() => setShowEmailDialog(true)}>
                <Send className="w-4 h-4 mr-2" />
                E-Mail senden
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Bearbeiten
            </Button>
            {!activeAuction && (vehicle.sale_channel === "auction" || vehicle.sale_channel === "instant_price") && (
              <Button
                size="sm"
                onClick={() => navigate(`/admin/auctions?create=${vehicle.id}`)}
              >
                <Gavel className="w-4 h-4 mr-2" />
                Auktion erstellen
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Löschen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Wohnmobil löschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Diese Aktion kann nicht rückgängig gemacht werden. Alle zugehörigen Fotos
                    und Daten werden ebenfalls gelöscht.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Löschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )
      }
    >
      {vehicle && (
        <div className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard
              label="Preis"
              value={formatPrice(vehicle.instant_price || vehicle.reserve_price)}
              icon={<Euro className="w-5 h-5" />}
            />
            <StatsCard
              label="Kilometerstand"
              value={vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : "—"}
              icon={<Gauge className="w-5 h-5" />}
            />
            <StatsCard
              label="Fotos"
              value={sortedPhotos.length}
              icon={<ImageIcon className="w-5 h-5" />}
            />
            <StatsCard
              label="Verkaufsweg"
              value={getSaleChannelBadge(vehicle.sale_channel).label}
              icon={<Settings className="w-5 h-5" />}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Photo Manager */}
              <AdminPhotoManager
                vehicleId={vehicle.id}
                photos={sortedPhotos}
                queryKey={["adminVehicleDetail", id!]}
              />

              {/* Tabs for Details */}
              <Tabs defaultValue="basic" className="space-y-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="basic">Grunddaten</TabsTrigger>
                  <TabsTrigger value="technical">Technik</TabsTrigger>
                  <TabsTrigger value="interior">Ausstattung</TabsTrigger>
                  <TabsTrigger value="equipment">Extras</TabsTrigger>
                </TabsList>

                <TabsContent value="basic">
                  <DetailSection title="Grundinformationen" icon={<Car className="w-5 h-5" />}>
                    <InfoGrid columns={3}>
                      <InfoItem label="Hersteller" value={vehicle.manufacturer} />
                      <InfoItem label="Modell" value={vehicle.model} />
                      <InfoItem label="Baujahr" value={vehicle.year} />
                      <InfoItem label="Aufbauart" value={vehicle.body_type} />
                      <InfoItem label="Zustand" value={vehicle.condition} />
                      <InfoItem label="Kilometerstand" value={vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : "—"} />
                      <InfoItem label="Fahrgestellnr." value={vehicle.vehicle_identification_number} />
                      <InfoItem label="Kennzeichen" value={vehicle.license_plate} />
                      <InfoItem label="Listennummer" value={vehicle.listing_number} />
                      <InfoItem label="PLZ (Standort)" value={vehicle.postal_code || "—"} />
                      <InfoItem label="Stadt" value={vehicle.city || "—"} />
                    </InfoGrid>
                    {vehicle.description && (
                      <div className="mt-6 p-4 rounded-lg bg-muted/50">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Beschreibung</p>
                        <p className="text-sm whitespace-pre-wrap">{vehicle.description}</p>
                      </div>
                    )}
                  </DetailSection>
                </TabsContent>

                <TabsContent value="technical">
                  <DetailSection title="Technische Daten" icon={<Settings className="w-5 h-5" />}>
                    <InfoGrid columns={3}>
                      <InfoItem label="Kraftstoff" value={vehicle.fuel_type} icon={<Fuel className="w-3 h-3" />} />
                      <InfoItem label="Leistung" value={vehicle.engine_power_hp ? `${vehicle.engine_power_hp} PS` : "—"} />
                      <InfoItem label="Getriebe" value={vehicle.transmission} />
                      <InfoItem label="Abgasnorm" value={vehicle.emission_class} />
                      <InfoItem label="Erstzulassung" value={formatDate(vehicle.first_registration)} icon={<Calendar className="w-3 h-3" />} />
                      <InfoItem label="TÜV bis" value={formatMonthYear(vehicle.tuev_valid_until)} icon={<Calendar className="w-3 h-3" />} />
                      <InfoItem label="Vorbesitzer" value={vehicle.previous_owners?.toString()} />
                    </InfoGrid>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {vehicle.accident_free && (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                          Unfallfrei
                        </Badge>
                      )}
                      {vehicle.non_smoker && (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                          Nichtraucher
                        </Badge>
                      )}
                      {vehicle.service_history_available && (
                        <Badge variant="outline" className="gap-1">
                          <FileText className="w-3 h-3" />
                          Scheckheft
                        </Badge>
                      )}
                    </div>

                    <Separator className="my-6" />

                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <Ruler className="w-4 h-4" />
                      Abmessungen & Gewicht
                    </h4>
                    <InfoGrid columns={4}>
                      <InfoItem label="Länge" value={vehicle.length_m ? `${vehicle.length_m} cm` : "—"} />
                      <InfoItem label="Breite" value={vehicle.width_m ? `${vehicle.width_m} cm` : "—"} />
                      <InfoItem label="Höhe" value={vehicle.height_m ? `${vehicle.height_m} cm` : "—"} />
                      <InfoItem label="Achsen" value={vehicle.number_of_axles?.toString()} />
                      <InfoItem label="Gesamtgewicht" value={vehicle.weight_kg ? `${vehicle.weight_kg} kg` : "—"} icon={<Weight className="w-3 h-3" />} />
                      <InfoItem label="Zuladung" value={vehicle.payload_kg ? `${vehicle.payload_kg} kg` : "—"} />
                      <InfoItem label="Sitzplätze" value={vehicle.seats?.toString()} icon={<Users className="w-3 h-3" />} />
                      <InfoItem label="Schlafplätze" value={vehicle.sleeping_places?.toString()} icon={<Bed className="w-3 h-3" />} />
                    </InfoGrid>
                    {vehicle.beds_description && (
                      <p className="text-sm text-muted-foreground mt-4">
                        <strong>Betten:</strong> {vehicle.beds_description}
                      </p>
                    )}
                  </DetailSection>
                </TabsContent>

                <TabsContent value="interior">
                  <DetailSection title="Innenausstattung" icon={<Bed className="w-5 h-5" />}>
                    <InfoGrid columns={3}>
                      <InfoItem label="Heizung" value={vehicle.heating_type} />
                      <InfoItem label="Klimaanlage" value={vehicle.air_conditioning_type} icon={<Wind className="w-3 h-3" />} />
                      <InfoItem label="Frischwasser" value={vehicle.water_tank_liters ? `${vehicle.water_tank_liters} L` : "—"} icon={<Droplets className="w-3 h-3" />} />
                      <InfoItem label="Grauwasser" value={vehicle.grey_water_capacity_liters ? `${vehicle.grey_water_capacity_liters} L` : "—"} />
                      <InfoItem label="Kühlschrank" value={vehicle.refrigerator_type} />
                    </InfoGrid>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {vehicle.has_kitchen && <Badge variant="outline">Küche</Badge>}
                      {vehicle.has_bathroom && <Badge variant="outline">Bad</Badge>}
                      {vehicle.has_toilet && <Badge variant="outline">Toilette</Badge>}
                      {vehicle.has_shower && <Badge variant="outline">Dusche</Badge>}
                    </div>
                  </DetailSection>
                </TabsContent>

                <TabsContent value="equipment">
                  <DetailSection title="Zusatzausstattung" icon={<Sun className="w-5 h-5" />}>
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
                      <p className="text-sm text-muted-foreground mt-4">
                        <strong>Batterie:</strong> {vehicle.battery_capacity_ah} Ah
                      </p>
                    )}
                    {vehicle.additional_equipment && (
                      <div className="mt-6 p-4 rounded-lg bg-muted/50">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Zusatzausstattung</p>
                        <p className="text-sm whitespace-pre-wrap">{vehicle.additional_equipment}</p>
                      </div>
                    )}
                  </DetailSection>
                </TabsContent>
              </Tabs>

              {/* Damage Photos */}
              {Array.isArray(vehicle.damage_photos) && vehicle.damage_photos.length > 0 && (
                <DetailSection title="Schäden dokumentiert" icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {vehicle.damage_photos.map((damage: any) => (
                      <div key={damage.id} className="rounded-lg border overflow-hidden">
                        <img
                          src={damage.photo_url}
                          alt={damage.damage_location}
                          className="w-full h-32 object-cover"
                        />
                        <div className="p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={damage.damage_severity === "schwer" ? "destructive" : damage.damage_severity === "mittel" ? "secondary" : "outline"}>
                              {damage.damage_severity}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium">{damage.damage_location}</p>
                          {damage.damage_description && (
                            <p className="text-xs text-muted-foreground mt-1">{damage.damage_description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </DetailSection>
              )}
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-6">
              {/* Seller Info */}
              <DetailSection title="Verkäufer" icon={<User className="w-5 h-5" />}>
                {vehicle.seller ? (
                  <div className="space-y-4">
                    <div>
                      <p className="font-semibold text-lg">
                        {vehicle.seller.first_name} {vehicle.seller.last_name}
                      </p>
                      {vehicle.seller.company_name && (
                        <p className="text-sm text-muted-foreground">{vehicle.seller.company_name}</p>
                      )}
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <a
                        href={`mailto:${vehicle.seller.email}`}
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                      >
                        <Mail className="w-4 h-4" />
                        {vehicle.seller.email}
                      </a>
                      {vehicle.seller.phone && (
                        <a
                          href={`tel:${vehicle.seller.phone}`}
                          className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          {vehicle.seller.phone}
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Registriert: {formatDate(vehicle.seller.created_at)}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate(`/admin/users/${vehicle.seller?.id}`)}
                      >
                        Profil anzeigen
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={() => setShowEmailDialog(true)}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        E-Mail
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Kein Verkäufer zugeordnet</p>
                )}
              </DetailSection>

              {/* Active Auction */}
              {activeAuction && (
                <DetailSection title="Aktive Auktion" icon={<Gavel className="w-5 h-5" />}>
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20">
                      <p className="text-sm text-muted-foreground">Aktuelles Gebot</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatPrice(activeAuction.current_bid || activeAuction.starting_bid)}
                      </p>
                    </div>
                    <InfoGrid columns={2}>
                      <InfoItem label="Startgebot" value={formatPrice(activeAuction.starting_bid)} />
                      <InfoItem label="Endet" value={formatDate(activeAuction.end_time)} />
                    </InfoGrid>
                    <Button
                      className="w-full"
                      onClick={() => navigate(`/admin/auctions/${activeAuction.id}`)}
                    >
                      <Gavel className="w-4 h-4 mr-2" />
                      Auktion anzeigen
                    </Button>
                  </div>
                </DetailSection>
              )}

              {/* Appointment Info */}
              {Array.isArray(vehicle.appointments) && vehicle.appointments.length > 0 && (
                <DetailSection title="Termine" icon={<Calendar className="w-5 h-5" />}>
                  <div className="space-y-3">
                    {vehicle.appointments.slice(0, 3).map((appointment: any) => (
                      <div key={appointment.id} className="p-3 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant={appointment.status === "confirmed" ? "default" : "outline"}>
                            {appointment.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(appointment.appointment_date)}
                          </span>
                        </div>
                        {appointment.station && (
                          <p className="text-sm flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {appointment.station.name}, {appointment.station.city}
                          </p>
                        )}
                      </div>
                    ))}
                    {vehicle.appointments.length > 3 && (
                      <p className="text-sm text-muted-foreground text-center">
                        +{vehicle.appointments.length - 3} weitere Termine
                      </p>
                    )}
                  </div>
                </DetailSection>
              )}

              {/* Pricing Info */}
              <DetailSection title="Preisgestaltung" icon={<Euro className="w-5 h-5" />}>
                <div className="space-y-3">
                  <InfoItem label="Verkaufsweg" value={getSaleChannelBadge(vehicle.sale_channel).label} />
                  {vehicle.instant_price && (
                    <InfoItem label="Sofortpreis" value={formatPrice(vehicle.instant_price)} />
                  )}
                  {vehicle.reserve_price && (
                    <InfoItem label="Reservepreis" value={formatPrice(vehicle.reserve_price)} />
                  )}
                </div>
              </DetailSection>

              {/* Meta Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Metadaten</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-mono text-xs">{vehicle.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Erstellt</span>
                    <span>{formatDate(vehicle.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Aktualisiert</span>
                    <span>{formatDate(vehicle.updated_at)}</span>
                  </div>
                  {vehicle.country && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Land</span>
                      <span>{vehicle.country}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {vehicle && (
        <VehicleEditDialog
          vehicle={vehicle}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}

      {/* E-Mail Dialog */}
      {vehicle && vehicle.seller && (
        <SendOwnerEmailDialog
          open={showEmailDialog}
          onOpenChange={setShowEmailDialog}
          seller={{
            id: vehicle.seller.id,
            first_name: vehicle.seller.first_name,
            last_name: vehicle.seller.last_name,
            email: vehicle.seller.email,
            phone: vehicle.seller.phone,
          }}
          vehicle={{
            id: vehicle.id,
            manufacturer: vehicle.manufacturer,
            model: vehicle.model,
            year: vehicle.year,
            listing_number: vehicle.listing_number,
          }}
        />
      )}
    </AdminDetailLayout>
  );
}
