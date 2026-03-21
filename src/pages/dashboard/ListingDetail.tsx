import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Edit,
  Eye,
  Calendar,
  Gauge,
  Bed,
  Droplets,
  Sun,
  Wind,
  TrendingUp,
  Users,
  Clock,
  Fuel,
  Zap,
  Ruler,
  Weight,
  Utensils,
  Thermometer,
  Battery,
  Bike,
  Tv,
  Camera,
  Radio,
  Shield,
} from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export default function ListingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: motorhome, isLoading } = useQuery({
    queryKey: ["motorhomeDetail", id],
    queryFn: async () => {
      if (!id) return null;

      // First try as seller (owner of the listing)
      const { data: sellerData, error: sellerError } = await supabase
        .from("motorhomes")
        .select(`
          *,
          photos:motorhome_photos (
            url,
            display_order
          ),
          auction:auctions (
            id,
            status,
            current_bid,
            starting_bid,
            end_time,
            start_time,
            created_at
          )
        `)
        .eq("id", id)
        .eq("seller_id", user?.id)
        .maybeSingle();

      if (sellerData) return sellerData;

      // If not found as seller, try as buyer (dealer who purchased via auction)
      const { data: buyerData, error: buyerError } = await supabase
        .from("motorhomes")
        .select(`
          *,
          photos:motorhome_photos (
            url,
            display_order
          ),
          auction:auctions (
            id,
            status,
            current_bid,
            starting_bid,
            end_time,
            start_time,
            created_at
          )
        `)
        .eq("id", id)
        .eq("sold_to", user?.id)
        .maybeSingle();

      if (buyerData) return buyerData;

      // Neither seller nor buyer — throw not found
      throw new Error('Motorhome not found or access denied');
    },
    enabled: !!id && !!user,
  });

  const { data: bidStats } = useQuery({
    queryKey: ["bidStats", motorhome?.auction?.[0]?.id],
    queryFn: async () => {
      const auctionId = motorhome?.auction?.[0]?.id;
      if (!auctionId) return null;

      const { data, error } = await supabase
        .from("bids")
        .select("*")
        .eq("auction_id", auctionId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const totalBids = data.length;
      const uniqueBidders = new Set(data.map((bid) => bid.bidder_id)).size;
      const highestBid = data.length > 0 ? Math.max(...data.map((b) => Number(b.amount))) : 0;

      return {
        totalBids,
        uniqueBidders,
        highestBid,
        recentBids: data.slice(0, 5),
      };
    },
    enabled: !!motorhome?.auction?.[0]?.id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Lädt...</p>
        </div>
      </div>
    );
  }

  if (!motorhome) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Inserat nicht gefunden</p>
        <Button onClick={() => navigate("/dashboard/listings")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zu Inseraten
        </Button>
      </div>
    );
  }

  const auction = motorhome.auction?.[0];
  const sortedPhotos = motorhome.photos?.sort((a, b) => a.display_order - b.display_order) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard/listings")}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück zu Inseraten
        </Button>
        <div className="flex gap-2">
          {auction?.id && (
            <Link to={`/auktion/${auction.id}`} target="_blank">
              <Button variant="outline" className="gap-2">
                <Eye className="w-4 h-4" />
                Öffentliche Ansicht
              </Button>
            </Link>
          )}
          <Link to={`/dashboard/listings/${id}/edit`}>
            <Button className="gap-2">
              <Edit className="w-4 h-4" />
              Bearbeiten
            </Button>
          </Link>
        </div>
      </div>

      {/* Title & Status */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">
            {motorhome.manufacturer} {motorhome.model}
          </h1>
          {auction && (
            <Badge
              variant={auction.status === "active" ? "default" : "secondary"}
              className={auction.status === "active" ? "bg-green-500" : ""}
            >
              {auction.status === "active" ? "Aktiv" : auction.status}
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          Erstellt am {format(new Date(motorhome.created_at), "dd. MMMM yyyy", { locale: de })}
        </p>
      </div>

      {/* Photos */}
      {sortedPhotos.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedPhotos.map((photo, index) => (
                <div key={photo.url} className="relative aspect-video overflow-hidden rounded-lg">
                  <img
                    src={photo.url}
                    alt={`${motorhome.manufacturer} ${motorhome.model} - Foto ${index + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      {auction && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-2 hover:border-primary/20 transition-smooth">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Aktuelles Gebot</p>
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <p className="text-3xl font-bold">
                €{Number(auction.current_bid || auction.starting_bid).toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/20 transition-smooth">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Gebote</p>
                <Users className="w-5 h-5 text-primary" />
              </div>
              <p className="text-3xl font-bold">{bidStats?.totalBids || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {bidStats?.uniqueBidders || 0} Bieter
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-primary/20 transition-smooth">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Endet in</p>
                <Clock className="w-5 h-5 text-primary" />
              </div>
              {auction.end_time ? (
                <>
                  <p className="text-xl font-bold">
                    {format(new Date(auction.end_time), "dd.MM.yyyy")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(auction.end_time), "HH:mm", { locale: de })} Uhr
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Nicht gesetzt</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Comprehensive Vehicle Data in Tabs */}
      <Card className="border-2">
        <CardContent className="p-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">Basis</TabsTrigger>
              <TabsTrigger value="technical">Technik</TabsTrigger>
              <TabsTrigger value="dimensions">Maße</TabsTrigger>
              <TabsTrigger value="interior">Innenraum</TabsTrigger>
              <TabsTrigger value="equipment">Ausstattung</TabsTrigger>
            </TabsList>

            {/* Basic Tab */}
            <TabsContent value="basic" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Baujahr</span>
                    </div>
                    <span className="font-semibold">{motorhome.year}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Kilometerstand</span>
                    </div>
                    <span className="font-semibold">{motorhome.mileage.toLocaleString()} km</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Aufbauart</span>
                    <span className="font-semibold">{motorhome.body_type}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bed className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Schlafplätze</span>
                    </div>
                    <span className="font-semibold">{motorhome.sleeping_places}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Zustand</span>
                    <Badge variant="outline">{motorhome.condition}</Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Verkaufsweg</span>
                    <Badge>
                      {motorhome.sale_channel === "auction"
                        ? "Auktion"
                        : motorhome.sale_channel === "instant_price"
                        ? "Sofortpreis"
                        : "Station"}
                    </Badge>
                  </div>
                </div>
              </div>
              {motorhome.description && (
                <>
                  <Separator className="my-6" />
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Beschreibung</h3>
                    <p className="text-foreground whitespace-pre-wrap">{motorhome.description}</p>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Technical Tab */}
            <TabsContent value="technical" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {motorhome.fuel_type && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Fuel className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Kraftstoff</span>
                        </div>
                        <span className="font-semibold">{motorhome.fuel_type}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.transmission && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Getriebe</span>
                        <span className="font-semibold">{motorhome.transmission}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {(motorhome.power_kw || motorhome.engine_power_hp) && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Leistung</span>
                        </div>
                        <span className="font-semibold">
                          {motorhome.power_kw && `${motorhome.power_kw} kW`}
                          {motorhome.power_kw && motorhome.engine_power_hp && " / "}
                          {motorhome.engine_power_hp && `${motorhome.engine_power_hp} PS`}
                        </span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.emission_class && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Schadstoffklasse</span>
                        <Badge variant="secondary">{motorhome.emission_class}</Badge>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.fuel_tank_capacity_liters && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Tankinhalt</span>
                      <span className="font-semibold">{motorhome.fuel_tank_capacity_liters}L</span>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {motorhome.first_registration && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Erstzulassung</span>
                        <span className="font-semibold">
                          {format(new Date(motorhome.first_registration), "MM/yyyy")}
                        </span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.last_tuev_date && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Letzte TÜV/HU</span>
                        <span className="font-semibold">
                          {format(new Date(motorhome.last_tuev_date), "MM/yyyy")}
                        </span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.tuev_valid_until && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Nächste TÜV/HU</span>
                        <span className="font-semibold">
                          {format(new Date(motorhome.tuev_valid_until), "MM/yyyy")}
                        </span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.previous_owners !== null && motorhome.previous_owners !== undefined && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Vorbesitzer</span>
                        <span className="font-semibold">{motorhome.previous_owners}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {motorhome.accident_free && (
                      <Badge variant="secondary" className="gap-1">
                        <Shield className="w-3 h-3" />
                        Unfallfrei
                      </Badge>
                    )}
                    {motorhome.non_smoker && (
                      <Badge variant="secondary">Nichtraucher</Badge>
                    )}
                    {motorhome.service_history_available && (
                      <Badge variant="secondary">Scheckheft</Badge>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Dimensions Tab */}
            <TabsContent value="dimensions" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {(motorhome.length_m || motorhome.width_m || motorhome.height_m) && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Ruler className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Maße (L×B×H)</span>
                        </div>
                        <span className="font-semibold text-sm">
                          {motorhome.length_m && `${(motorhome.length_m / 100).toFixed(2)}m`}
                          {motorhome.width_m && ` × ${(motorhome.width_m / 100).toFixed(2)}m`}
                          {motorhome.height_m && ` × ${(motorhome.height_m / 100).toFixed(2)}m`}
                        </span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.weight_kg && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Weight className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Gesamtgewicht</span>
                        </div>
                        <span className="font-semibold">{motorhome.weight_kg.toLocaleString()} kg</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.payload_kg && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Nutzlast</span>
                      <span className="font-semibold">{motorhome.payload_kg.toLocaleString()} kg</span>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {motorhome.seats && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Sitzplätze</span>
                        </div>
                        <span className="font-semibold">{motorhome.seats}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.number_of_axles && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Achsen</span>
                        <span className="font-semibold">{motorhome.number_of_axles}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.beds_description && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Betten-Beschreibung</p>
                      <p className="text-sm">{motorhome.beds_description}</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Interior Tab */}
            <TabsContent value="interior" className="space-y-4 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {motorhome.has_kitchen && (
                      <Badge variant="secondary" className="gap-1">
                        <Utensils className="w-3 h-3" />
                        Küche
                      </Badge>
                    )}
                    {motorhome.has_bathroom && (
                      <Badge variant="secondary" className="gap-1">
                        <Droplets className="w-3 h-3" />
                        Bad
                      </Badge>
                    )}
                    {motorhome.has_toilet && (
                      <Badge variant="secondary">Toilette</Badge>
                    )}
                    {motorhome.has_shower && (
                      <Badge variant="secondary">Dusche</Badge>
                    )}
                  </div>
                  <Separator />
                  {motorhome.refrigerator_type && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Kühlschrank</span>
                        <span className="font-semibold">{motorhome.refrigerator_type}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.heating_type && (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Thermometer className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Heizung</span>
                        </div>
                        <span className="font-semibold">{motorhome.heating_type}</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.air_conditioning_type && motorhome.air_conditioning_type !== "Keine" && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Klimaanlage</span>
                      <span className="font-semibold">{motorhome.air_conditioning_type}</span>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {motorhome.water_tank_liters && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Frischwasser</span>
                        <span className="font-semibold">{motorhome.water_tank_liters}L</span>
                      </div>
                      <Separator />
                    </>
                  )}
                  {motorhome.grey_water_capacity_liters && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Grauwasser</span>
                      <span className="font-semibold">{motorhome.grey_water_capacity_liters}L</span>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Equipment Tab */}
            <TabsContent value="equipment" className="space-y-6 mt-6">
              {(motorhome.has_solar || motorhome.has_inverter || motorhome.battery_capacity_ah) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Energie & Elektrik</p>
                  <div className="flex flex-wrap gap-2">
                    {motorhome.has_solar && (
                      <Badge variant="secondary" className="gap-1">
                        <Sun className="w-3 h-3" />
                        Solar {motorhome.solar_power_watts && `(${motorhome.solar_power_watts}W)`}
                      </Badge>
                    )}
                    {motorhome.has_inverter && (
                      <Badge variant="secondary" className="gap-1">
                        <Battery className="w-3 h-3" />
                        Wechselrichter
                      </Badge>
                    )}
                    {motorhome.battery_capacity_ah && (
                      <Badge variant="secondary">
                        Batterie {motorhome.battery_capacity_ah}Ah
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              
              {(motorhome.has_awning || motorhome.has_bike_rack || motorhome.has_garage) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Außenausstattung</p>
                  <div className="flex flex-wrap gap-2">
                    {motorhome.has_awning && (
                      <Badge variant="secondary" className="gap-1">
                        <Wind className="w-3 h-3" />
                        Markise {motorhome.awning_length_m && `(${motorhome.awning_length_m}cm)`}
                      </Badge>
                    )}
                    {motorhome.has_bike_rack && (
                      <Badge variant="secondary" className="gap-1">
                        <Bike className="w-3 h-3" />
                        Fahrradträger
                      </Badge>
                    )}
                    {motorhome.has_garage && (
                      <Badge variant="secondary">Garage</Badge>
                    )}
                  </div>
                </div>
              )}

              {(motorhome.has_tv || motorhome.has_backup_camera || motorhome.has_parking_sensors || motorhome.has_cruise_control || motorhome.has_central_locking) && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-3">Komfort & Sicherheit</p>
                  <div className="flex flex-wrap gap-2">
                    {motorhome.has_tv && (
                      <Badge variant="secondary" className="gap-1">
                        <Tv className="w-3 h-3" />
                        TV/SAT
                      </Badge>
                    )}
                    {motorhome.has_backup_camera && (
                      <Badge variant="secondary" className="gap-1">
                        <Camera className="w-3 h-3" />
                        Rückfahrkamera
                      </Badge>
                    )}
                    {motorhome.has_parking_sensors && (
                      <Badge variant="secondary" className="gap-1">
                        <Radio className="w-3 h-3" />
                        Parksensoren
                      </Badge>
                    )}
                    {motorhome.has_cruise_control && (
                      <Badge variant="secondary">Tempomat</Badge>
                    )}
                    {motorhome.has_central_locking && (
                      <Badge variant="secondary">Zentralverriegelung</Badge>
                    )}
                  </div>
                </div>
              )}

              {motorhome.additional_equipment && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Zusätzliche Ausstattung</p>
                  <p className="text-sm whitespace-pre-wrap">{motorhome.additional_equipment}</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Sale Information */}
      {(motorhome.instant_price || motorhome.reserve_price) && (
        <Card className="border-2 hover:border-primary/20 transition-smooth">
          <CardHeader>
            <CardTitle>Verkaufsinformationen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {motorhome.instant_price && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sofortpreis</span>
                  <span className="font-semibold text-xl">
                    €{Number(motorhome.instant_price).toLocaleString()}
                  </span>
                </div>
                <Separator />
              </>
            )}
            {motorhome.reserve_price && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Mindestpreis</span>
                <span className="font-semibold text-lg">
                  €{Number(motorhome.reserve_price).toLocaleString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Bids */}
      {bidStats && bidStats.recentBids.length > 0 && (
        <Card className="border-2 hover:border-primary/20 transition-smooth">
          <CardHeader>
            <CardTitle>Neueste Gebote</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bidStats.recentBids.map((bid: any) => (
                <div
                  key={bid.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-semibold">€{Number(bid.amount).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(bid.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                    </p>
                  </div>
                  {bid.is_autobid && (
                    <Badge variant="outline" className="text-xs">
                      Autobid
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
