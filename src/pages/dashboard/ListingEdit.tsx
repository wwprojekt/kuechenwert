import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Lock, FileText, Mail, Clock } from "lucide-react";
import { withSessionRetry } from "@/lib/sessionGuard";
import { useUserRole } from "@/hooks/useUserRole";
import { SellerPhotoManager } from "@/components/dashboard/SellerPhotoManager";
import { PriceChangeRequestDialog } from "@/components/dashboard/PriceChangeRequestDialog";
import { BRAND } from "@/lib/brand";
import { useState, useEffect } from "react";

const VALID_TABS = ["basic", "technical", "dimensions", "interior", "equipment", "photos", "additional"];

export default function ListingEdit() {
  const { id } = useParams();
  const { user } = useAuth();
  const { isDealer } = useUserRole();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Allow direct navigation to a specific tab via URL parameter (e.g., ?tab=photos)
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "basic";

  const { data: kitchen, isLoading } = useQuery({
    queryKey: ["kitchenEdit", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("kitchens")
        .select("*")
        .eq("id", id)
        .eq("seller_id", user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  // ── Auction status query: check if auction is live ──
  // Wir holen explizit auch reserve_price + seller_initial_reserve, damit der
  // PriceChangeRequestDialog den AKTUELLEN (potenziell durch dynamic_pricing
  // reduzierten) Reserve und den ORIGINAL-Wunsch des Verkaeufers anzeigen
  // kann. kitchens.reserve_price wird vom Cron NICHT mit-reduziert, daher
  // ist dieser Wert NICHT die korrekte "Aktuell"-Anzeige fuer Live-Auktionen.
  const { data: auctionData } = useQuery({
    queryKey: ["kitchenAuction", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("auctions")
        .select("id, status, reserve_price, seller_initial_reserve, seller_initial_instant_price")
        .eq("kitchen_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const isAuctionLive = auctionData?.status === 'active' || auctionData?.status === 'kaufchance';
  const hasAuction = !!auctionData;
  // Im 'draft'-Status (vor Admin-Approval) darf der Verkäufer Preise selbst
  // ändern. Die RPC update_listing_prices_in_draft synchronisiert atomar
  // kitchens + auctions (siehe Migration 20260420600000). Sobald die Auktion
  // einen anderen Status hat (active/kaufchance/ended/sold/cancelled), ist
  // Self-Service-Editing gesperrt; Verkäufer nutzt dann den
  // PriceChangeRequestDialog (Option C).
  const isDraftAuction = auctionData?.status === 'draft';
  const canEditPricesSelf = !hasAuction || isDraftAuction;
  const isAuctionListing = kitchen?.sale_channel === 'auction';

  const { data: pendingPriceRequest } = useQuery({
    queryKey: ['pendingPriceRequest', id],
    queryFn: async () => {
      if (!id || !user) return null;
      const { data, error } = await supabase
        .from('price_change_requests')
        .select('id, requested_reserve, requested_instant, reason, created_at, status')
        .eq('kitchen_id', id)
        .eq('seller_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const [priceRequestDialogOpen, setPriceRequestDialogOpen] = useState(false);

  const { data: photos = [], refetch: refetchPhotos } = useQuery({
    queryKey: ["kitchenPhotos", id],
    queryFn: async () => {
      if (!id) return [];

      const { data, error } = await supabase
        .from("kitchen_photos")
        .select("*")
        .eq("kitchen_id", id)
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const [formData, setFormData] = useState({
    description: "",
    instant_price: "",
    reserve_price: "",
    
    // Technical
    fuel_type: "",
    power_kw: "",
    engine_power_hp: "",
    transmission: "",
    emission_class: "",
    first_registration: "",
    last_tuev_date: "",
    tuev_valid_until: "",
    previous_owners: "",
    accident_free: true,
    non_smoker: true,
    service_history_available: false,
    fuel_tank_capacity_liters: "",
    
    // Dimensions
    length_m: "",
    width_m: "",
    height_m: "",
    weight_kg: "",
    payload_kg: "",
    number_of_axles: 2,
    seats: "",
    sleeping_places: "",
    beds_description: "",
    
    // Interior
    has_kitchen: true,
    refrigerator_type: "",
    heating_type: "",
    air_conditioning_type: "Keine",
    has_bathroom: false,
    has_toilet: false,
    has_shower: false,
    water_tank_liters: "",
    grey_water_capacity_liters: "",
    
    // Equipment
    has_solar: false,
    solar_power_watts: "",
    battery_capacity_ah: "",
    has_inverter: false,
    has_awning: false,
    awning_length_m: "",
    has_awning_tent: false,
    has_roof_ac: false,
    has_stand_ac: false,
    has_bike_rack: false,
    has_garage: false,
    has_tv: false,
    has_backup_camera: false,
    has_parking_sensors: false,
    has_cruise_control: false,
    has_central_locking: false,
    
    // Additional
    additional_equipment: "",
    vehicle_identification_number: "",
    license_plate: "",
    mwst_ausweisbar: true,
  });

  useEffect(() => {
    if (kitchen) {
      setFormData({
        description: kitchen.description || "",
        instant_price: kitchen.instant_price?.toString() || "",
        reserve_price: kitchen.reserve_price?.toString() || "",
        
        // Technical
        fuel_type: kitchen.fuel_type || "",
        power_kw: kitchen.power_kw?.toString() || "",
        engine_power_hp: kitchen.engine_power_hp?.toString() || "",
        transmission: kitchen.transmission || "",
        emission_class: kitchen.emission_class || "",
        first_registration: kitchen.first_registration ? kitchen.first_registration.substring(0, 7) : "",
        last_tuev_date: kitchen.last_tuev_date ? kitchen.last_tuev_date.substring(0, 7) : "",
        tuev_valid_until: kitchen.tuev_valid_until ? kitchen.tuev_valid_until.substring(0, 7) : "",
        previous_owners: kitchen.previous_owners?.toString() || "",
        accident_free: kitchen.accident_free ?? true,
        non_smoker: kitchen.non_smoker ?? true,
        service_history_available: kitchen.service_history_available ?? false,
        fuel_tank_capacity_liters: kitchen.fuel_tank_capacity_liters?.toString() || "",
        
        // Dimensions
        length_m: kitchen.length_m?.toString() || "",
        width_m: kitchen.width_m?.toString() || "",
        height_m: kitchen.height_m?.toString() || "",
        weight_kg: kitchen.weight_kg?.toString() || "",
        payload_kg: kitchen.payload_kg?.toString() || "",
        number_of_axles: kitchen.number_of_axles ?? 2,
        seats: kitchen.seats?.toString() || "",
        sleeping_places: kitchen.sleeping_places?.toString() || "",
        beds_description: kitchen.beds_description || "",
        
        // Interior
        has_kitchen: kitchen.has_kitchen ?? true,
        refrigerator_type: kitchen.refrigerator_type || "",
        heating_type: kitchen.heating_type || "",
        air_conditioning_type: kitchen.air_conditioning_type || "Keine",
        has_bathroom: kitchen.has_bathroom ?? false,
        has_toilet: kitchen.has_toilet ?? false,
        has_shower: kitchen.has_shower ?? false,
        water_tank_liters: kitchen.water_tank_liters?.toString() || "",
        grey_water_capacity_liters: kitchen.grey_water_capacity_liters?.toString() || "",
        
        // Equipment
        has_solar: kitchen.has_solar ?? false,
        solar_power_watts: kitchen.solar_power_watts?.toString() || "",
        battery_capacity_ah: kitchen.battery_capacity_ah?.toString() || "",
        has_inverter: kitchen.has_inverter ?? false,
        has_awning: kitchen.has_awning ?? false,
        awning_length_m: kitchen.awning_length_m?.toString() || "",
        has_awning_tent: (kitchen as any).has_awning_tent ?? false,
        has_roof_ac: (kitchen as any).has_roof_ac ?? false,
        has_stand_ac: (kitchen as any).has_stand_ac ?? false,
        has_bike_rack: kitchen.has_bike_rack ?? false,
        has_garage: kitchen.has_garage ?? false,
        has_tv: kitchen.has_tv ?? false,
        has_backup_camera: kitchen.has_backup_camera ?? false,
        has_parking_sensors: kitchen.has_parking_sensors ?? false,
        has_cruise_control: kitchen.has_cruise_control ?? false,
        has_central_locking: kitchen.has_central_locking ?? false,
        
        // Additional
        additional_equipment: kitchen.additional_equipment || "",
        vehicle_identification_number: kitchen.vehicle_identification_number || "",
        license_plate: kitchen.license_plate || "",
        mwst_ausweisbar:
          kitchen.account_type === "dealer"
            ? (kitchen.mwst_ausweisbar ?? true)
            : false,
      });
    }
  }, [kitchen]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!id || !user) throw new Error("Nicht authentifiziert");

      // Safety check: prevent edits while auction is live
      if (isAuctionLive) {
        throw new Error("Bearbeitung gesperrt: Die Auktion ist aktiv. Nutzen Sie die Nachtrag-Funktion.");
      }

      // Mindestpreis-Pflicht für Auktions-Inserate ohne Sofortkauf.
      // Greift solange Verkäufer die Preise selbst editieren darf (kein hasAuction
      // ODER auctionData.status === 'draft'). Bei Sofortkauf wird
      // reserve_price = instant_price gesetzt.
      if (canEditPricesSelf && isAuctionListing && !data.instant_price && !data.reserve_price) {
        throw new Error("Mindestpreis ist Pflicht für Auktions-Inserate (AGB §6.4 c).");
      }
      // Pflicht-Sofortpreis fuer Sofortkauf-Inserate (sale_channel='instant_price').
      // Ohne diesen Guard koennte ein Verkaeufer im Draft das Feld leeren und
      // sein Listing waere preislos. Server-seitig wuerde die RPC mit ERRCODE
      // 23514 fehlschlagen; dieser Guard liefert dem Nutzer aber sofort eine
      // verstaendliche Meldung im UI.
      const isInstantPriceListing = kitchen?.sale_channel === 'instant_price';
      if (canEditPricesSelf && isInstantPriceListing && !data.instant_price) {
        throw new Error("Sofortkauf-Preis ist Pflicht für Sofortkauf-Inserate.");
      }

      // Preise duerfen nur gesenkt, nicht erhoeht werden. Der Server (RPC
      // update_listing_prices_in_draft) erzwingt das ebenfalls – hier fuer
      // sofortiges UI-Feedback. Vergleich jeweils gegen kitchens.*_price
      // (also den zuletzt bestaetigten Wert).
      if (canEditPricesSelf) {
        const newReserveCandidate = data.reserve_price ? Number(data.reserve_price) : null;
        const newInstantCandidate = data.instant_price ? Number(data.instant_price) : null;
        const oldReserve = kitchen?.reserve_price != null ? Number(kitchen.reserve_price) : null;
        const oldInstant = kitchen?.instant_price != null ? Number(kitchen.instant_price) : null;
        if (newReserveCandidate != null && oldReserve != null && newReserveCandidate > oldReserve) {
          throw new Error(
            `Der Mindestpreis kann nur gesenkt, nicht erhöht werden (aktuell ${oldReserve.toLocaleString("de-DE")} €).`,
          );
        }
        if (newInstantCandidate != null && oldInstant != null && newInstantCandidate > oldInstant) {
          throw new Error(
            `Der Sofortkauf-Preis kann nur gesenkt, nicht erhöht werden (aktuell ${oldInstant.toLocaleString("de-DE")} €).`,
          );
        }
      }

      const updateData: any = {
        description: data.description,
        
        // Technical
        fuel_type: data.fuel_type || null,
        power_kw: data.power_kw ? Number(data.power_kw) : null,
        engine_power_hp: data.engine_power_hp ? Number(data.engine_power_hp) : null,
        transmission: data.transmission || null,
        emission_class: data.emission_class || null,
        first_registration: data.first_registration ? `${data.first_registration}-01` : null,
        last_tuev_date: data.last_tuev_date ? `${data.last_tuev_date}-01` : null,
        tuev_valid_until: data.tuev_valid_until ? `${data.tuev_valid_until}-01` : null,
        previous_owners: data.previous_owners ? Number(data.previous_owners) : null,
        accident_free: data.accident_free,
        non_smoker: data.non_smoker,
        service_history_available: data.service_history_available,
        fuel_tank_capacity_liters: data.fuel_tank_capacity_liters ? Number(data.fuel_tank_capacity_liters) : null,
        
        // Dimensions
        length_m: data.length_m ? Number(data.length_m) : null,
        width_m: data.width_m ? Number(data.width_m) : null,
        height_m: data.height_m ? Number(data.height_m) : null,
        weight_kg: data.weight_kg ? Number(data.weight_kg) : null,
        payload_kg: data.payload_kg ? Number(data.payload_kg) : null,
        number_of_axles: data.number_of_axles,
        seats: data.seats ? Number(data.seats) : null,
        sleeping_places: data.sleeping_places ? Number(data.sleeping_places) : null,
        beds_description: data.beds_description || null,
        
        // Interior
        has_kitchen: data.has_kitchen,
        refrigerator_type: data.refrigerator_type || null,
        heating_type: data.heating_type || null,
        air_conditioning_type: data.air_conditioning_type,
        has_bathroom: data.has_bathroom,
        has_toilet: data.has_toilet,
        has_shower: data.has_shower,
        water_tank_liters: data.water_tank_liters ? Number(data.water_tank_liters) : null,
        grey_water_capacity_liters: data.grey_water_capacity_liters ? Number(data.grey_water_capacity_liters) : null,
        
        // Equipment
        has_solar: data.has_solar,
        solar_power_watts: data.solar_power_watts ? Number(data.solar_power_watts) : null,
        battery_capacity_ah: data.battery_capacity_ah ? Number(data.battery_capacity_ah) : null,
        has_inverter: data.has_inverter,
        has_awning: data.has_awning,
        awning_length_m: data.awning_length_m ? Number(data.awning_length_m) : null,
        has_awning_tent: data.has_awning_tent,
        has_roof_ac: data.has_roof_ac,
        has_stand_ac: data.has_stand_ac,
        has_bike_rack: data.has_bike_rack,
        has_garage: data.has_garage,
        has_tv: data.has_tv,
        has_backup_camera: data.has_backup_camera,
        has_parking_sensors: data.has_parking_sensors,
        has_cruise_control: data.has_cruise_control,
        has_central_locking: data.has_central_locking,
        
        // Additional
        additional_equipment: data.additional_equipment || null,
        vehicle_identification_number: data.vehicle_identification_number || null,
        license_plate: data.license_plate || null,
      };

      const canEditMwst = isDealer || kitchen.account_type === "dealer";
      if (canEditMwst) {
        updateData.mwst_ausweisbar = data.mwst_ausweisbar;
      }

      // Preis-Sync:
      // - Ohne Auktion: direkter kitchens-Update (nur kitchens-Felder).
      // - Auktion = draft: RPC update_listing_prices_in_draft, die kitchens
      //   UND auctions atomar synchronisiert (reserve_price,
      //   seller_initial_reserve, seller_initial_instant_price).
      // - Auktion live (active/kaufchance): kein Preis-Sync hier; Verkäufer
      //   nutzt den PriceChangeRequestDialog.
      const newInstant = data.instant_price ? Number(data.instant_price) : null;
      const newReserveRaw = data.reserve_price ? Number(data.reserve_price) : null;
      const effectiveReserve = newInstant ?? newReserveRaw;

      if (!hasAuction) {
        if (newInstant != null) {
          updateData.instant_price = newInstant;
          updateData.reserve_price = effectiveReserve;
        } else if (newReserveRaw != null) {
          updateData.reserve_price = newReserveRaw;
        }
      }

      await withSessionRetry(async () => {
        const { error } = await supabase
          .from("kitchens")
          .update(updateData)
          .eq("id", id)
          .eq("seller_id", user.id);
        if (error) throw error;
      }, 'ListingEdit.update');

      if (isDraftAuction) {
        await withSessionRetry(async () => {
          const { error: rpcErr } = await supabase.rpc(
            'update_listing_prices_in_draft',
            {
              p_kitchen_id: id,
              p_new_reserve: newReserveRaw,
              p_new_instant: newInstant,
            },
          );
          if (rpcErr) throw rpcErr;
        }, 'ListingEdit.syncDraftPrices');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchenEdit", id] });
      queryClient.invalidateQueries({ queryKey: ["kitchenDetail", id] });
      queryClient.invalidateQueries({ queryKey: ["myListings"] });
      toast({
        title: "Erfolgreich gespeichert",
        description: "Ihre Änderungen wurden gespeichert",
      });
      navigate(`/dashboard/listings/${id}`);
    },
    onError: (error: unknown) => {
      // Kein `console.error(...)` hier: Der globale console.error-Interceptor
      // in errorLogService.ts wuerde den Fehler als CONSOLE_ERROR loggen BEVOR
      // der Toast unten die Dedup-Marker setzen kann → doppelter Eintrag in
      // error_logs pro Save-Fehler (siehe Fehlerprotokoll 2026-04-25). Der
      // Toast-Pfad uebernimmt das Logging (als TOAST_ERROR oder, bei Business-
      // Events wie "Mindestpreis ist Pflicht", korrekt gefiltert).
      const err = error as { message?: string; code?: string } | null;
      const rawMsg = err?.message?.trim();
      // Preserve our own explicit thrown messages (e.g. "Bearbeitung gesperrt: …")
      // so the seller knows WHY the save failed; fall back to a generic text for
      // low-level Postgres / network errors that would only confuse the user.
      const isUserFacingMessage =
        !!rawMsg &&
        !rawMsg.startsWith('duplicate key') &&
        !rawMsg.startsWith('new row violates') &&
        !rawMsg.toLowerCase().includes('fetch') &&
        !rawMsg.toLowerCase().includes('network');
      toast({
        title: "Fehler",
        description: isUserFacingMessage
          ? rawMsg
          : "Inserat konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  // Photo management is now handled by SellerPhotoManager component

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

  if (!kitchen) {
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

  return (
    <div className="space-y-6 max-w-4xl animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            onClick={() => navigate(`/dashboard/listings/${id}`)}
            className="gap-2 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Zurück
          </Button>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Inserat bearbeiten</h1>
          <p className="text-muted-foreground mt-1">
            {kitchen.manufacturer} {kitchen.model}
          </p>
        </div>
      </div>

      {/* Auction Lock Banner */}
      {isAuctionLive && (
        <Card className="border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-shrink-0 p-3 rounded-full bg-orange-100 dark:bg-orange-900/30">
                <Lock className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-orange-800 dark:text-orange-200 mb-1">
                  Bearbeitung gesperrt
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  Während die Auktion aktiv ist, können Sie das Inserat nicht direkt bearbeiten.
                  Stattdessen können Sie einen öffentlichen Nachtrag hinzufügen oder eine
                  Preisanpassung beim {BRAND.name}-Team anfragen.
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="border-orange-500 text-orange-700 hover:bg-orange-100 dark:text-orange-300 dark:hover:bg-orange-900/30 flex-1 sm:flex-initial"
                onClick={() => navigate(`/dashboard/listings/${id}`)}
              >
                <FileText className="w-4 h-4 mr-2" />
                Nachtrag hinzufügen
              </Button>
              {pendingPriceRequest ? (
                <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 flex-1">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    Preisanfrage in Bearbeitung (eingegangen {new Date(pendingPriceRequest.created_at).toLocaleDateString('de-DE')})
                  </span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="border-orange-500 text-orange-700 hover:bg-orange-100 dark:text-orange-300 dark:hover:bg-orange-900/30 flex-1 sm:flex-initial"
                  onClick={() => setPriceRequestDialogOpen(true)}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Preisanpassung anfragen
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card className={`border-2 ${isAuctionLive ? 'opacity-60 pointer-events-none select-none' : ''}`}>
          <CardHeader>
            <CardTitle>{isAuctionLive ? 'Inserat (gesperrt)' : 'Bearbeitbare Informationen'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
          <fieldset disabled={isAuctionLive}>
            <Tabs defaultValue={initialTab} className="w-full">
              <TabsList className="flex w-full overflow-x-auto sm:grid sm:grid-cols-7 h-auto">
                <TabsTrigger value="basic" className="text-xs sm:text-sm px-2.5 sm:px-3 py-2 whitespace-nowrap">Basis</TabsTrigger>
                <TabsTrigger value="technical" className="text-xs sm:text-sm px-2.5 sm:px-3 py-2 whitespace-nowrap">Technik</TabsTrigger>
                <TabsTrigger value="dimensions" className="text-xs sm:text-sm px-2.5 sm:px-3 py-2 whitespace-nowrap">Maße</TabsTrigger>
                <TabsTrigger value="interior" className="text-xs sm:text-sm px-2.5 sm:px-3 py-2 whitespace-nowrap">Innenraum</TabsTrigger>
                <TabsTrigger value="equipment" className="text-xs sm:text-sm px-2.5 sm:px-3 py-2 whitespace-nowrap">Ausstattung</TabsTrigger>
                <TabsTrigger value="photos" className="text-xs sm:text-sm px-2.5 sm:px-3 py-2 whitespace-nowrap">Fotos</TabsTrigger>
                <TabsTrigger value="additional" className="text-xs sm:text-sm px-2.5 sm:px-3 py-2 whitespace-nowrap">Zusätzlich</TabsTrigger>
              </TabsList>

              {/* Basic Tab */}
              <TabsContent value="basic" className="space-y-6 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="description">Beschreibung</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Beschreiben Sie Ihre Küche..."
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Eine detaillierte Beschreibung erhöht die Chancen auf erfolgreichen Verkauf
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="instant_price">Sofortkauf-Preis (optional)</Label>
                    <Input
                      id="instant_price"
                      type="text"
                      inputMode="numeric"
                      value={formData.instant_price}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setFormData({ ...formData, instant_price: val, ...(val ? { reserve_price: val } : {}) });
                      }}
                      placeholder="z.B. 45000"
                      disabled={!canEditPricesSelf}
                    />
                    {formData.instant_price && (
                      <p className="text-xs text-muted-foreground">Der Mindestpreis wird automatisch auf den Sofortkauf-Preis gesetzt.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reserve_price" className="flex items-center gap-1">
                      Mindestpreis
                      {isAuctionListing && !formData.instant_price && (
                        <span className="text-red-500" aria-hidden="true">*</span>
                      )}
                      {!isAuctionListing && (
                        <span className="text-muted-foreground text-xs ml-1">(optional)</span>
                      )}
                    </Label>
                    <Input
                      id="reserve_price"
                      type="text"
                      inputMode="numeric"
                      value={formData.reserve_price}
                      onChange={(e) => setFormData({ ...formData, reserve_price: e.target.value.replace(/\D/g, '') })}
                      placeholder="z.B. 40000"
                      disabled={!!formData.instant_price || !canEditPricesSelf}
                      aria-invalid={
                        isAuctionListing && !formData.instant_price && canEditPricesSelf && !formData.reserve_price
                      }
                    />
                    {isDraftAuction && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                        Inserat ist noch im Entwurf – Preis kann selbst geändert werden. Sobald der Admin freigibt, läuft die Anpassung über das {BRAND.name}-Team.
                      </p>
                    )}
                    {canEditPricesSelf && (
                      <p className="text-xs text-muted-foreground">
                        Hinweis: Preise können nur gesenkt, nicht erhöht werden (AGB §6.4 c).
                      </p>
                    )}
                    {hasAuction && !isDraftAuction && (
                      <p className="text-xs text-amber-600 font-medium">
                        Der Mindestpreis kann nur über das {BRAND.name}-Team geändert werden, sobald die Auktion läuft (siehe Lock-Banner oben).
                      </p>
                    )}
                    {!hasAuction && isAuctionListing && !formData.instant_price && (
                      <p className="text-xs text-muted-foreground">
                        Pflichtfeld bei Auktions-Inseraten. Wird nicht verkauft, wenn das Höchstgebot unter diesem Preis liegt (AGB §6.4).
                      </p>
                    )}
                  </div>
                </div>

                {(isDealer || kitchen.account_type === "dealer") && (
                  <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-muted/30 p-4">
                    <Checkbox
                      id="mwst_ausweisbar"
                      checked={formData.mwst_ausweisbar}
                      onCheckedChange={(c) =>
                        setFormData({ ...formData, mwst_ausweisbar: c === true })
                      }
                    />
                    <div className="space-y-1">
                      <Label htmlFor="mwst_ausweisbar" className="text-sm font-medium leading-none cursor-pointer">
                        Umsatzsteuer auf der Kaufrechnung gesondert ausweisen
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Für gewerbliche Verkäufer: aktivieren, wenn die MwSt. auf der Fahrzeugrechnung ausgewiesen wird;
                        deaktivieren z. B. bei Differenzbesteuerung oder Kleinunternehmerregelung.
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Technical Tab */}
              <TabsContent value="technical" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fuel_type">Kraftstoffart</Label>
                    <Select value={formData.fuel_type} onValueChange={(value) => setFormData({ ...formData, fuel_type: value })}>
                      <SelectTrigger><SelectValue placeholder="Wählen Sie..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Diesel">Diesel</SelectItem>
                        <SelectItem value="Benzin">Benzin</SelectItem>
                        <SelectItem value="Elektro">Elektro</SelectItem>
                        <SelectItem value="Hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="transmission">Getriebe</Label>
                    <Select value={formData.transmission} onValueChange={(value) => setFormData({ ...formData, transmission: value })}>
                      <SelectTrigger><SelectValue placeholder="Wählen Sie..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Schaltgetriebe">Schaltgetriebe</SelectItem>
                        <SelectItem value="Automatik">Automatik</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="power_kw">Leistung (kW)</Label>
                    <Input id="power_kw" type="number" value={formData.power_kw} onChange={(e) => setFormData({ ...formData, power_kw: e.target.value })} placeholder="z.B. 96" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="engine_power_hp">Leistung (PS)</Label>
                    <Input id="engine_power_hp" type="number" value={formData.engine_power_hp} onChange={(e) => setFormData({ ...formData, engine_power_hp: e.target.value })} placeholder="z.B. 130" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emission_class">Schadstoffklasse</Label>
                    <Select value={formData.emission_class} onValueChange={(value) => setFormData({ ...formData, emission_class: value })}>
                      <SelectTrigger><SelectValue placeholder="Wählen Sie..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Euro 6d">Euro 6d</SelectItem>
                        <SelectItem value="Euro 6d-TEMP">Euro 6d-TEMP</SelectItem>
                        <SelectItem value="Euro 6c">Euro 6c</SelectItem>
                        <SelectItem value="Euro 6">Euro 6</SelectItem>
                        <SelectItem value="Euro 5">Euro 5</SelectItem>
                        <SelectItem value="Euro 4">Euro 4</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fuel_tank_capacity_liters">Tankinhalt (Liter)</Label>
                    <Input id="fuel_tank_capacity_liters" type="number" value={formData.fuel_tank_capacity_liters} onChange={(e) => setFormData({ ...formData, fuel_tank_capacity_liters: e.target.value })} placeholder="z.B. 90" />
                  </div>

                  <MonthYearPicker
                    id="first_registration"
                    label="Erstzulassung"
                    value={formData.first_registration}
                    onChange={(val) => setFormData({ ...formData, first_registration: val })}
                  />

                  <MonthYearPicker
                    id="last_tuev_date"
                    label="Letzte TÜV/HU"
                    value={formData.last_tuev_date}
                    onChange={(val) => setFormData({ ...formData, last_tuev_date: val })}
                  />

                  <MonthYearPicker
                    id="tuev_valid_until"
                    label="Nächste TÜV/HU"
                    value={formData.tuev_valid_until}
                    onChange={(val) => setFormData({ ...formData, tuev_valid_until: val })}
                  />

                  <div className="space-y-2">
                    <Label htmlFor="previous_owners">Vorbesitzer</Label>
                    <Input id="previous_owners" type="number" value={formData.previous_owners} onChange={(e) => setFormData({ ...formData, previous_owners: e.target.value })} placeholder="z.B. 1" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="accident_free" checked={formData.accident_free} onCheckedChange={(checked) => setFormData({ ...formData, accident_free: checked as boolean })} />
                    <label htmlFor="accident_free" className="text-sm font-medium">Unfallfrei</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="non_smoker" checked={formData.non_smoker} onCheckedChange={(checked) => setFormData({ ...formData, non_smoker: checked as boolean })} />
                    <label htmlFor="non_smoker" className="text-sm font-medium">Nichtraucherfahrzeug</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="service_history_available" checked={formData.service_history_available} onCheckedChange={(checked) => setFormData({ ...formData, service_history_available: checked as boolean })} />
                    <label htmlFor="service_history_available" className="text-sm font-medium">Scheckheftgepflegt</label>
                  </div>
                </div>
              </TabsContent>

              {/* Dimensions Tab */}
              <TabsContent value="dimensions" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="length_m">Länge (cm)</Label>
                    <Input id="length_m" type="number" value={formData.length_m} onChange={(e) => setFormData({ ...formData, length_m: e.target.value })} placeholder="z.B. 650" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="width_m">Breite (cm)</Label>
                    <Input id="width_m" type="number" value={formData.width_m} onChange={(e) => setFormData({ ...formData, width_m: e.target.value })} placeholder="z.B. 230" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height_m">Höhe (cm)</Label>
                    <Input id="height_m" type="number" value={formData.height_m} onChange={(e) => setFormData({ ...formData, height_m: e.target.value })} placeholder="z.B. 280" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight_kg">Gesamtgewicht (kg)</Label>
                    <Input id="weight_kg" type="number" value={formData.weight_kg} onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })} placeholder="z.B. 3500" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payload_kg">Nutzlast (kg)</Label>
                    <Input id="payload_kg" type="number" value={formData.payload_kg} onChange={(e) => setFormData({ ...formData, payload_kg: e.target.value })} placeholder="z.B. 500" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="number_of_axles">Anzahl Achsen</Label>
                    <Input id="number_of_axles" type="number" value={formData.number_of_axles} onChange={(e) => setFormData({ ...formData, number_of_axles: Number(e.target.value) })} placeholder="z.B. 2" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="seats">Sitzplätze mit Gurten</Label>
                    <Input id="seats" type="number" value={formData.seats} onChange={(e) => setFormData({ ...formData, seats: e.target.value })} placeholder="z.B. 4" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sleeping_places">Schlafplätze</Label>
                    <Input id="sleeping_places" type="number" value={formData.sleeping_places} onChange={(e) => setFormData({ ...formData, sleeping_places: e.target.value })} placeholder="z.B. 4" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="beds_description">Betten-Beschreibung</Label>
                  <Textarea id="beds_description" value={formData.beds_description} onChange={(e) => setFormData({ ...formData, beds_description: e.target.value })} placeholder="z.B. 1x Hubbett, 1x Einzelbett" rows={3} />
                </div>
              </TabsContent>

              {/* Interior Tab */}
              <TabsContent value="interior" className="space-y-6 mt-6">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_kitchen" checked={formData.has_kitchen} onCheckedChange={(checked) => setFormData({ ...formData, has_kitchen: checked as boolean })} />
                    <label htmlFor="has_kitchen" className="text-sm font-medium">Küche vorhanden</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_bathroom" checked={formData.has_bathroom} onCheckedChange={(checked) => setFormData({ ...formData, has_bathroom: checked as boolean })} />
                    <label htmlFor="has_bathroom" className="text-sm font-medium">Badezimmer vorhanden</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_toilet" checked={formData.has_toilet} onCheckedChange={(checked) => setFormData({ ...formData, has_toilet: checked as boolean })} />
                    <label htmlFor="has_toilet" className="text-sm font-medium">Toilette vorhanden</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_shower" checked={formData.has_shower} onCheckedChange={(checked) => setFormData({ ...formData, has_shower: checked as boolean })} />
                    <label htmlFor="has_shower" className="text-sm font-medium">Dusche vorhanden</label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="refrigerator_type">Kühlschrank</Label>
                    <Select
                      value={formData.refrigerator_type || "__none__"}
                      onValueChange={(value) => setFormData({ ...formData, refrigerator_type: value === "__none__" ? "" : value })}
                    >
                      <SelectTrigger><SelectValue placeholder="Wählen Sie..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Keine Angabe</SelectItem>
                        <SelectItem value="Kompressor">Kompressor</SelectItem>
                        <SelectItem value="Absorber">Absorber</SelectItem>
                        <SelectItem value="Thermoelektrisch">Thermoelektrisch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="heating_type">Heizung</Label>
                    <Select
                      value={formData.heating_type || "__none__"}
                      onValueChange={(value) => setFormData({ ...formData, heating_type: value === "__none__" ? "" : value })}
                    >
                      <SelectTrigger><SelectValue placeholder="Wählen Sie..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Keine Angabe</SelectItem>
                        <SelectItem value="Gas">Gas</SelectItem>
                        <SelectItem value="Diesel">Diesel</SelectItem>
                        <SelectItem value="Elektrisch">Elektrisch</SelectItem>
                        <SelectItem value="Kombiniert">Kombiniert</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="air_conditioning_type">Klimaanlage</Label>
                    <Select value={formData.air_conditioning_type} onValueChange={(value) => setFormData({ ...formData, air_conditioning_type: value })}>
                      <SelectTrigger><SelectValue placeholder="Wählen Sie..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Fahrerhaus">Fahrerhaus</SelectItem>
                        <SelectItem value="Wohnraum">Wohnraum</SelectItem>
                        <SelectItem value="Beides">Beides</SelectItem>
                        <SelectItem value="Keine">Keine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="water_tank_liters">Frischwasser (Liter)</Label>
                    <Input id="water_tank_liters" type="number" value={formData.water_tank_liters} onChange={(e) => setFormData({ ...formData, water_tank_liters: e.target.value })} placeholder="z.B. 120" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="grey_water_capacity_liters">Grauwasser (Liter)</Label>
                    <Input id="grey_water_capacity_liters" type="number" value={formData.grey_water_capacity_liters} onChange={(e) => setFormData({ ...formData, grey_water_capacity_liters: e.target.value })} placeholder="z.B. 100" />
                  </div>
                </div>
              </TabsContent>

              {/* Equipment Tab */}
              <TabsContent value="equipment" className="space-y-6 mt-6">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_solar" checked={formData.has_solar} onCheckedChange={(checked) => setFormData({ ...formData, has_solar: checked as boolean })} />
                    <label htmlFor="has_solar" className="text-sm font-medium">Solaranlage</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_inverter" checked={formData.has_inverter} onCheckedChange={(checked) => setFormData({ ...formData, has_inverter: checked as boolean })} />
                    <label htmlFor="has_inverter" className="text-sm font-medium">Wechselrichter</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_awning" checked={formData.has_awning} onCheckedChange={(checked) => setFormData({ ...formData, has_awning: checked as boolean })} />
                    <label htmlFor="has_awning" className="text-sm font-medium">Markise</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_awning_tent" checked={formData.has_awning_tent} onCheckedChange={(checked) => setFormData({ ...formData, has_awning_tent: checked as boolean })} />
                    <label htmlFor="has_awning_tent" className="text-sm font-medium">Vorzelt</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_roof_ac" checked={formData.has_roof_ac} onCheckedChange={(checked) => setFormData({ ...formData, has_roof_ac: checked as boolean, has_stand_ac: checked as boolean })} />
                    <label htmlFor="has_roof_ac" className="text-sm font-medium">Dachklima/Standklima</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_bike_rack" checked={formData.has_bike_rack} onCheckedChange={(checked) => setFormData({ ...formData, has_bike_rack: checked as boolean })} />
                    <label htmlFor="has_bike_rack" className="text-sm font-medium">Fahrradträger</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_garage" checked={formData.has_garage} onCheckedChange={(checked) => setFormData({ ...formData, has_garage: checked as boolean })} />
                    <label htmlFor="has_garage" className="text-sm font-medium">Garage</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_tv" checked={formData.has_tv} onCheckedChange={(checked) => setFormData({ ...formData, has_tv: checked as boolean })} />
                    <label htmlFor="has_tv" className="text-sm font-medium">TV/SAT-Anlage</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_backup_camera" checked={formData.has_backup_camera} onCheckedChange={(checked) => setFormData({ ...formData, has_backup_camera: checked as boolean })} />
                    <label htmlFor="has_backup_camera" className="text-sm font-medium">Rückfahrkamera</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_parking_sensors" checked={formData.has_parking_sensors} onCheckedChange={(checked) => setFormData({ ...formData, has_parking_sensors: checked as boolean })} />
                    <label htmlFor="has_parking_sensors" className="text-sm font-medium">Parksensoren</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_cruise_control" checked={formData.has_cruise_control} onCheckedChange={(checked) => setFormData({ ...formData, has_cruise_control: checked as boolean })} />
                    <label htmlFor="has_cruise_control" className="text-sm font-medium">Tempomat</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_central_locking" checked={formData.has_central_locking} onCheckedChange={(checked) => setFormData({ ...formData, has_central_locking: checked as boolean })} />
                    <label htmlFor="has_central_locking" className="text-sm font-medium">Zentralverriegelung</label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="solar_power_watts">Solarleistung (Watt)</Label>
                    <Input id="solar_power_watts" type="number" value={formData.solar_power_watts} onChange={(e) => setFormData({ ...formData, solar_power_watts: e.target.value })} placeholder="z.B. 200" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="battery_capacity_ah">Batteriekapazität (Ah)</Label>
                    <Input id="battery_capacity_ah" type="number" value={formData.battery_capacity_ah} onChange={(e) => setFormData({ ...formData, battery_capacity_ah: e.target.value })} placeholder="z.B. 150" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="awning_length_m">Markisenlänge (cm)</Label>
                    <Input id="awning_length_m" type="number" value={formData.awning_length_m} onChange={(e) => setFormData({ ...formData, awning_length_m: e.target.value })} placeholder="z.B. 400" />
                  </div>
                </div>
              </TabsContent>

              {/* Photos Tab */}
              <TabsContent value="photos" className="space-y-6 mt-6">
                <SellerPhotoManager
                  kitchenId={id!}
                  photos={photos}
                  queryKey={["kitchenPhotos", id!]}
                  disabled={isAuctionLive}
                />
              </TabsContent>

              {/* Additional Tab */}
              <TabsContent value="additional" className="space-y-6 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="additional_equipment">Zusätzliche Ausstattung</Label>
                  <Textarea id="additional_equipment" value={formData.additional_equipment} onChange={(e) => setFormData({ ...formData, additional_equipment: e.target.value })} placeholder="Weitere Ausstattungsmerkmale..." rows={4} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vehicle_identification_number">Fahrzeug-Identifizierungsnummer (FIN)</Label>
                    <Input id="vehicle_identification_number" value={formData.vehicle_identification_number} onChange={(e) => setFormData({ ...formData, vehicle_identification_number: e.target.value })} placeholder="z.B. WDB12345..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="license_plate">Kennzeichen</Label>
                    <Input id="license_plate" value={formData.license_plate} onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })} placeholder="z.B. B-AB 1234" />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Submit Button - hidden when auction is live */}
            {!isAuctionLive && (
              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-6">
                <Button type="button" variant="outline" onClick={() => navigate(`/dashboard/listings/${id}`)}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} className="gap-2">
                  <Save className="w-4 h-4" />
                  {updateMutation.isPending ? "Speichert..." : "Änderungen speichern"}
                </Button>
              </div>
            )}
          </fieldset>
          </CardContent>
        </Card>
      </form>

      {kitchen && id && (
        <PriceChangeRequestDialog
          open={priceRequestDialogOpen}
          onOpenChange={setPriceRequestDialogOpen}
          kitchenId={id}
          saleChannel={kitchen.sale_channel}
          // Aktueller (live) Reserve = auctions.reserve_price (vom Cron
          // potenziell reduziert). Fallback auf kitchens.reserve_price wenn
          // (noch) keine Auktions-Row existiert.
          currentReserve={auctionData?.reserve_price ?? kitchen.reserve_price ?? null}
          currentInstant={kitchen.instant_price ?? null}
          // seller_initial_reserve = der vom Verkaeufer urspruenglich
          // eingetragene Wunsch-Mindestpreis (vor Dynamic Pricing).
          // Nur anzeigen wenn er sich vom aktuellen Reserve unterscheidet,
          // damit der Verkaeufer transparent sieht, was bereits reduziert
          // wurde.
          initialReserve={auctionData?.seller_initial_reserve ?? null}
        />
      )}

      {/* Non-editable info card */}
      <Card className="bg-muted/50 border-2">
        <CardHeader>
          <CardTitle className="text-base">Hinweis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Grundlegende Fahrzeugdaten wie Hersteller, Modell, Baujahr und Kilometerstand können
            nicht nachträglich geändert werden. Bei Fragen wenden Sie sich bitte an den Support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
