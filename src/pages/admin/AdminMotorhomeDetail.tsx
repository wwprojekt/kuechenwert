/**
 * Admin Motorhome Detail Page
 * Comprehensive view of motorhome with photos, specifications, and related data
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
import { MotorhomeEditDialog } from "@/components/admin/MotorhomeEditDialog";
import { logger } from "@/lib/logger";

export default function AdminMotorhomeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Fetch motorhome with all related data
  const { data: motorhome, isLoading, error } = useQuery({
    queryKey: ["adminMotorhomeDetail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorhomes")
        .select(`
          *,
          motorhome_photos(id, url, display_order),
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

  // Delete motorhome mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("motorhomes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Wohnmobil erfolgreich gelöscht");
      navigate("/admin/motorhomes");
    },
    onError: (error) => {
      logger.error("Delete motorhome error:", error);
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
          <Button className="mt-4" onClick={() => navigate("/admin/motorhomes")}>
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
    const channelConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      instant_price: { label: "Sofortpreis", variant: "default" },
      auction: { label: "Auktion", variant: "secondary" },
      station: { label: "Station", variant: "outline" },
    };
    return channelConfig[channel] || { label: channel, variant: "outline" };
  };

  const sortedPhotos = Array.isArray(motorhome?.motorhome_photos)
    ? [...motorhome.motorhome_photos].sort(
        (a: any, b: any) => (a.display_order || 0) - (b.display_order || 0)
      )
    : [];

  // auctions is a single object (not array) because motorhome_id has UNIQUE constraint
  // Supabase may return: object (single match), array (multiple), string (error), or null
  const auctionData = motorhome?.auctions;
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
      title={motorhome ? `${motorhome.manufacturer} ${motorhome.model}` : "Wohnmobil"}
      subtitle={motorhome ? `${motorhome.year} • ${motorhome.body_type} • ${motorhome.listing_number || "—"}` : undefined}
      status={motorhome ? getStatusBadge(motorhome.status) : undefined}
      backUrl="/admin/motorhomes"
      backLabel="Alle Wohnmobile"
      isLoading={isLoading}
      icon={<Car className="w-6 h-6" />}
      actions={
        motorhome && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Bearbeiten
            </Button>
            {!activeAuction && motorhome.sale_channel === "auction" && (
              <Button
                size="sm"
                onClick={() => navigate(`/admin/auctions?create=${motorhome.id}`)}
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
      {motorhome && (
        <div className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatsCard
              label="Preis"
              value={formatPrice(motorhome.instant_price || motorhome.reserve_price)}
              icon={<Euro className="w-5 h-5" />}
            />
            <StatsCard
              label="Kilometerstand"
              value={motorhome.mileage ? `${motorhome.mileage.toLocaleString()} km` : "—"}
              icon={<Gauge className="w-5 h-5" />}
            />
            <StatsCard
              label="Fotos"
              value={sortedPhotos.length}
              icon={<ImageIcon className="w-5 h-5" />}
            />
            <StatsCard
              label="Verkaufsweg"
              value={getSaleChannelBadge(motorhome.sale_channel).label}
              icon={<Settings className="w-5 h-5" />}
            />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Main Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Photo Gallery */}
              <Card>
                <CardContent className="p-4">
                  {sortedPhotos.length > 0 ? (
                    <div className="space-y-4">
                      {/* Main Photo */}
                      <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                        <img
                          src={sortedPhotos[selectedPhotoIndex]?.url}
                          alt={`${motorhome.manufacturer} ${motorhome.model}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {/* Thumbnails */}
                      {sortedPhotos.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {sortedPhotos.map((photo: any, index: number) => (
                            <button
                              key={photo.id}
                              onClick={() => setSelectedPhotoIndex(index)}
                              className={`flex-shrink-0 w-20 h-16 rounded-md overflow-hidden border-2 transition-colors ${
                                index === selectedPhotoIndex
                                  ? "border-primary"
                                  : "border-transparent hover:border-muted-foreground/50"
                              }`}
                            >
                              <img
                                src={photo.url}
                                alt={`Foto ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-video rounded-lg bg-muted flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                        <p>Keine Fotos vorhanden</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

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
                      <InfoItem label="Hersteller" value={motorhome.manufacturer} />
                      <InfoItem label="Modell" value={motorhome.model} />
                      <InfoItem label="Baujahr" value={motorhome.year} />
                      <InfoItem label="Aufbauart" value={motorhome.body_type} />
                      <InfoItem label="Zustand" value={motorhome.condition} />
                      <InfoItem label="Kilometerstand" value={motorhome.mileage ? `${motorhome.mileage.toLocaleString()} km` : "—"} />
                      <InfoItem label="Fahrgestellnr." value={motorhome.vehicle_identification_number} />
                      <InfoItem label="Kennzeichen" value={motorhome.license_plate} />
                      <InfoItem label="Listennummer" value={motorhome.listing_number} />
                      <InfoItem label="PLZ (Standort)" value={motorhome.postal_code || "—"} />
                      <InfoItem label="Stadt" value={motorhome.city || "—"} />
                    </InfoGrid>
                    {motorhome.description && (
                      <div className="mt-6 p-4 rounded-lg bg-muted/50">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Beschreibung</p>
                        <p className="text-sm whitespace-pre-wrap">{motorhome.description}</p>
                      </div>
                    )}
                  </DetailSection>
                </TabsContent>

                <TabsContent value="technical">
                  <DetailSection title="Technische Daten" icon={<Settings className="w-5 h-5" />}>
                    <InfoGrid columns={3}>
                      <InfoItem label="Kraftstoff" value={motorhome.fuel_type} icon={<Fuel className="w-3 h-3" />} />
                      <InfoItem label="Leistung" value={motorhome.engine_power_hp ? `${motorhome.engine_power_hp} PS` : "—"} />
                      <InfoItem label="Getriebe" value={motorhome.transmission} />
                      <InfoItem label="Abgasnorm" value={motorhome.emission_class} />
                      <InfoItem label="Erstzulassung" value={formatDate(motorhome.first_registration)} icon={<Calendar className="w-3 h-3" />} />
                      <InfoItem label="TÜV bis" value={formatDate(motorhome.tuev_valid_until)} icon={<Calendar className="w-3 h-3" />} />
                      <InfoItem label="Vorbesitzer" value={motorhome.previous_owners?.toString()} />
                    </InfoGrid>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {motorhome.accident_free && (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                          Unfallfrei
                        </Badge>
                      )}
                      {motorhome.non_smoker && (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                          Nichtraucher
                        </Badge>
                      )}
                      {motorhome.service_history_available && (
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
                      <InfoItem label="Länge" value={motorhome.length_m ? `${motorhome.length_m} cm` : "—"} />
                      <InfoItem label="Breite" value={motorhome.width_m ? `${motorhome.width_m} cm` : "—"} />
                      <InfoItem label="Höhe" value={motorhome.height_m ? `${motorhome.height_m} cm` : "—"} />
                      <InfoItem label="Achsen" value={motorhome.number_of_axles?.toString()} />
                      <InfoItem label="Gesamtgewicht" value={motorhome.weight_kg ? `${motorhome.weight_kg} kg` : "—"} icon={<Weight className="w-3 h-3" />} />
                      <InfoItem label="Zuladung" value={motorhome.payload_kg ? `${motorhome.payload_kg} kg` : "—"} />
                      <InfoItem label="Sitzplätze" value={motorhome.seats?.toString()} icon={<Users className="w-3 h-3" />} />
                      <InfoItem label="Schlafplätze" value={motorhome.sleeping_places?.toString()} icon={<Bed className="w-3 h-3" />} />
                    </InfoGrid>
                    {motorhome.beds_description && (
                      <p className="text-sm text-muted-foreground mt-4">
                        <strong>Betten:</strong> {motorhome.beds_description}
                      </p>
                    )}
                  </DetailSection>
                </TabsContent>

                <TabsContent value="interior">
                  <DetailSection title="Innenausstattung" icon={<Bed className="w-5 h-5" />}>
                    <InfoGrid columns={3}>
                      <InfoItem label="Heizung" value={motorhome.heating_type} />
                      <InfoItem label="Klimaanlage" value={motorhome.air_conditioning_type} icon={<Wind className="w-3 h-3" />} />
                      <InfoItem label="Frischwasser" value={motorhome.water_tank_liters ? `${motorhome.water_tank_liters} L` : "—"} icon={<Droplets className="w-3 h-3" />} />
                      <InfoItem label="Grauwasser" value={motorhome.grey_water_capacity_liters ? `${motorhome.grey_water_capacity_liters} L` : "—"} />
                      <InfoItem label="Kühlschrank" value={motorhome.refrigerator_type} />
                    </InfoGrid>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {motorhome.has_kitchen && <Badge variant="outline">Küche</Badge>}
                      {motorhome.has_bathroom && <Badge variant="outline">Bad</Badge>}
                      {motorhome.has_toilet && <Badge variant="outline">Toilette</Badge>}
                      {motorhome.has_shower && <Badge variant="outline">Dusche</Badge>}
                    </div>
                  </DetailSection>
                </TabsContent>

                <TabsContent value="equipment">
                  <DetailSection title="Zusatzausstattung" icon={<Sun className="w-5 h-5" />}>
                    <div className="flex flex-wrap gap-2">
                      {motorhome.has_solar && (
                        <Badge variant="outline" className="gap-1">
                          <Sun className="w-3 h-3" />
                          Solar {motorhome.solar_power_watts ? `(${motorhome.solar_power_watts}W)` : ''}
                        </Badge>
                      )}
                      {motorhome.has_awning && (
                        <Badge variant="outline">
                          Markise {motorhome.awning_length_m ? `(${motorhome.awning_length_m}cm)` : ''}
                        </Badge>
                      )}
                      {motorhome.has_inverter && <Badge variant="outline">Wechselrichter</Badge>}
                      {motorhome.has_tv && (
                        <Badge variant="outline" className="gap-1">
                          <Tv className="w-3 h-3" /> TV/SAT
                        </Badge>
                      )}
                      {motorhome.has_backup_camera && (
                        <Badge variant="outline" className="gap-1">
                          <Camera className="w-3 h-3" /> Rückfahrkamera
                        </Badge>
                      )}
                      {motorhome.has_parking_sensors && (
                        <Badge variant="outline" className="gap-1">
                          <ParkingCircle className="w-3 h-3" /> Parksensoren
                        </Badge>
                      )}
                      {motorhome.has_cruise_control && <Badge variant="outline">Tempomat</Badge>}
                      {motorhome.has_central_locking && (
                        <Badge variant="outline" className="gap-1">
                          <Lock className="w-3 h-3" /> Zentralverriegelung
                        </Badge>
                      )}
                      {motorhome.has_bike_rack && (
                        <Badge variant="outline" className="gap-1">
                          <Bike className="w-3 h-3" /> Fahrradträger
                        </Badge>
                      )}
                      {motorhome.has_garage && (
                        <Badge variant="outline" className="gap-1">
                          <Warehouse className="w-3 h-3" /> Heckgarage
                        </Badge>
                      )}
                    </div>
                    {motorhome.battery_capacity_ah && (
                      <p className="text-sm text-muted-foreground mt-4">
                        <strong>Batterie:</strong> {motorhome.battery_capacity_ah} Ah
                      </p>
                    )}
                    {motorhome.additional_equipment && (
                      <div className="mt-6 p-4 rounded-lg bg-muted/50">
                        <p className="text-sm font-medium text-muted-foreground mb-2">Zusatzausstattung</p>
                        <p className="text-sm whitespace-pre-wrap">{motorhome.additional_equipment}</p>
                      </div>
                    )}
                  </DetailSection>
                </TabsContent>
              </Tabs>

              {/* Damage Photos */}
              {Array.isArray(motorhome.damage_photos) && motorhome.damage_photos.length > 0 && (
                <DetailSection title="Schäden dokumentiert" icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {motorhome.damage_photos.map((damage: any) => (
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
                {motorhome.seller ? (
                  <div className="space-y-4">
                    <div>
                      <p className="font-semibold text-lg">
                        {motorhome.seller.first_name} {motorhome.seller.last_name}
                      </p>
                      {motorhome.seller.company_name && (
                        <p className="text-sm text-muted-foreground">{motorhome.seller.company_name}</p>
                      )}
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <a
                        href={`mailto:${motorhome.seller.email}`}
                        className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                      >
                        <Mail className="w-4 h-4" />
                        {motorhome.seller.email}
                      </a>
                      {motorhome.seller.phone && (
                        <a
                          href={`tel:${motorhome.seller.phone}`}
                          className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          {motorhome.seller.phone}
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Registriert: {formatDate(motorhome.seller.created_at)}
                    </p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate(`/admin/users/${motorhome.seller?.id}`)}
                    >
                      Profil anzeigen
                    </Button>
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
              {Array.isArray(motorhome.appointments) && motorhome.appointments.length > 0 && (
                <DetailSection title="Termine" icon={<Calendar className="w-5 h-5" />}>
                  <div className="space-y-3">
                    {motorhome.appointments.slice(0, 3).map((appointment: any) => (
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
                    {motorhome.appointments.length > 3 && (
                      <p className="text-sm text-muted-foreground text-center">
                        +{motorhome.appointments.length - 3} weitere Termine
                      </p>
                    )}
                  </div>
                </DetailSection>
              )}

              {/* Pricing Info */}
              <DetailSection title="Preisgestaltung" icon={<Euro className="w-5 h-5" />}>
                <div className="space-y-3">
                  <InfoItem label="Verkaufsweg" value={getSaleChannelBadge(motorhome.sale_channel).label} />
                  {motorhome.instant_price && (
                    <InfoItem label="Sofortpreis" value={formatPrice(motorhome.instant_price)} />
                  )}
                  {motorhome.reserve_price && (
                    <InfoItem label="Reservepreis" value={formatPrice(motorhome.reserve_price)} />
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
                    <span className="font-mono text-xs">{motorhome.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Erstellt</span>
                    <span>{formatDate(motorhome.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Aktualisiert</span>
                    <span>{formatDate(motorhome.updated_at)}</span>
                  </div>
                  {motorhome.country && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Land</span>
                      <span>{motorhome.country}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {motorhome && (
        <MotorhomeEditDialog
          motorhome={motorhome}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
        />
      )}
    </AdminDetailLayout>
  );
}
