import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Upload, X, Image as ImageIcon } from "lucide-react";
import { useState, useEffect } from "react";

export default function ListingEdit() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: motorhome, isLoading } = useQuery({
    queryKey: ["motorhomeEdit", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("motorhomes")
        .select("*")
        .eq("id", id)
        .eq("seller_id", user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const { data: photos = [], refetch: refetchPhotos } = useQuery({
    queryKey: ["motorhomePhotos", id],
    queryFn: async () => {
      if (!id) return [];

      const { data, error } = await supabase
        .from("motorhome_photos")
        .select("*")
        .eq("motorhome_id", id)
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
    power_ps: "",
    transmission: "",
    emission_class: "",
    first_registration: "",
    last_tuev_date: "",
    next_tuev_date: "",
    previous_owners: "",
    accident_free: true,
    non_smoker: true,
    service_history_available: false,
    fuel_tank_capacity_liters: "",
    
    // Dimensions
    length_cm: "",
    width_cm: "",
    height_cm: "",
    total_weight_kg: "",
    payload_kg: "",
    number_of_axles: 2,
    seats_with_seatbelts: "",
    sleeping_places: "",
    beds_description: "",
    
    // Interior
    has_kitchen: true,
    refrigerator_type: "",
    heating_type: "",
    air_conditioning: "Keine",
    has_bathroom: false,
    has_toilet: false,
    has_shower: false,
    fresh_water_capacity_liters: "",
    grey_water_capacity_liters: "",
    
    // Equipment
    has_solar: false,
    solar_power_watts: "",
    battery_capacity_ah: "",
    has_inverter: false,
    has_awning: false,
    awning_length_cm: "",
    has_bike_rack: false,
    has_garage: false,
    has_tv_sat: false,
    has_reversing_camera: false,
    has_parking_sensors: false,
    has_cruise_control: false,
    has_central_locking: false,
    
    // Additional
    additional_equipment: "",
    vehicle_identification_number: "",
    license_plate: "",
  });

  useEffect(() => {
    if (motorhome) {
      setFormData({
        description: motorhome.description || "",
        instant_price: motorhome.instant_price?.toString() || "",
        reserve_price: motorhome.reserve_price?.toString() || "",
        
        // Technical
        fuel_type: motorhome.fuel_type || "",
        power_kw: motorhome.power_kw?.toString() || "",
        power_ps: motorhome.power_ps?.toString() || "",
        transmission: motorhome.transmission || "",
        emission_class: motorhome.emission_class || "",
        first_registration: motorhome.first_registration || "",
        last_tuev_date: motorhome.last_tuev_date || "",
        next_tuev_date: motorhome.next_tuev_date || "",
        previous_owners: motorhome.previous_owners?.toString() || "",
        accident_free: motorhome.accident_free ?? true,
        non_smoker: motorhome.non_smoker ?? true,
        service_history_available: motorhome.service_history_available ?? false,
        fuel_tank_capacity_liters: motorhome.fuel_tank_capacity_liters?.toString() || "",
        
        // Dimensions
        length_cm: motorhome.length_cm?.toString() || "",
        width_cm: motorhome.width_cm?.toString() || "",
        height_cm: motorhome.height_cm?.toString() || "",
        total_weight_kg: motorhome.total_weight_kg?.toString() || "",
        payload_kg: motorhome.payload_kg?.toString() || "",
        number_of_axles: motorhome.number_of_axles ?? 2,
        seats_with_seatbelts: motorhome.seats_with_seatbelts?.toString() || "",
        sleeping_places: motorhome.sleeping_places?.toString() || "",
        beds_description: motorhome.beds_description || "",
        
        // Interior
        has_kitchen: motorhome.has_kitchen ?? true,
        refrigerator_type: motorhome.refrigerator_type || "",
        heating_type: motorhome.heating_type || "",
        air_conditioning: motorhome.air_conditioning || "Keine",
        has_bathroom: motorhome.has_bathroom ?? false,
        has_toilet: motorhome.has_toilet ?? false,
        has_shower: motorhome.has_shower ?? false,
        fresh_water_capacity_liters: motorhome.fresh_water_capacity_liters?.toString() || "",
        grey_water_capacity_liters: motorhome.grey_water_capacity_liters?.toString() || "",
        
        // Equipment
        has_solar: motorhome.has_solar ?? false,
        solar_power_watts: motorhome.solar_power_watts?.toString() || "",
        battery_capacity_ah: motorhome.battery_capacity_ah?.toString() || "",
        has_inverter: motorhome.has_inverter ?? false,
        has_awning: motorhome.has_awning ?? false,
        awning_length_cm: motorhome.awning_length_cm?.toString() || "",
        has_bike_rack: motorhome.has_bike_rack ?? false,
        has_garage: motorhome.has_garage ?? false,
        has_tv_sat: motorhome.has_tv_sat ?? false,
        has_reversing_camera: motorhome.has_reversing_camera ?? false,
        has_parking_sensors: motorhome.has_parking_sensors ?? false,
        has_cruise_control: motorhome.has_cruise_control ?? false,
        has_central_locking: motorhome.has_central_locking ?? false,
        
        // Additional
        additional_equipment: motorhome.additional_equipment || "",
        vehicle_identification_number: motorhome.vehicle_identification_number || "",
        license_plate: motorhome.license_plate || "",
      });
    }
  }, [motorhome]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!id || !user) throw new Error("Nicht authentifiziert");

      const updateData: any = {
        description: data.description,
        
        // Technical
        fuel_type: data.fuel_type || null,
        power_kw: data.power_kw ? Number(data.power_kw) : null,
        power_ps: data.power_ps ? Number(data.power_ps) : null,
        transmission: data.transmission || null,
        emission_class: data.emission_class || null,
        first_registration: data.first_registration || null,
        last_tuev_date: data.last_tuev_date || null,
        next_tuev_date: data.next_tuev_date || null,
        previous_owners: data.previous_owners ? Number(data.previous_owners) : null,
        accident_free: data.accident_free,
        non_smoker: data.non_smoker,
        service_history_available: data.service_history_available,
        fuel_tank_capacity_liters: data.fuel_tank_capacity_liters ? Number(data.fuel_tank_capacity_liters) : null,
        
        // Dimensions
        length_cm: data.length_cm ? Number(data.length_cm) : null,
        width_cm: data.width_cm ? Number(data.width_cm) : null,
        height_cm: data.height_cm ? Number(data.height_cm) : null,
        total_weight_kg: data.total_weight_kg ? Number(data.total_weight_kg) : null,
        payload_kg: data.payload_kg ? Number(data.payload_kg) : null,
        number_of_axles: data.number_of_axles,
        seats_with_seatbelts: data.seats_with_seatbelts ? Number(data.seats_with_seatbelts) : null,
        sleeping_places: data.sleeping_places ? Number(data.sleeping_places) : null,
        beds_description: data.beds_description || null,
        
        // Interior
        has_kitchen: data.has_kitchen,
        refrigerator_type: data.refrigerator_type || null,
        heating_type: data.heating_type || null,
        air_conditioning: data.air_conditioning,
        has_bathroom: data.has_bathroom,
        has_toilet: data.has_toilet,
        has_shower: data.has_shower,
        fresh_water_capacity_liters: data.fresh_water_capacity_liters ? Number(data.fresh_water_capacity_liters) : null,
        grey_water_capacity_liters: data.grey_water_capacity_liters ? Number(data.grey_water_capacity_liters) : null,
        
        // Equipment
        has_solar: data.has_solar,
        solar_power_watts: data.solar_power_watts ? Number(data.solar_power_watts) : null,
        battery_capacity_ah: data.battery_capacity_ah ? Number(data.battery_capacity_ah) : null,
        has_inverter: data.has_inverter,
        has_awning: data.has_awning,
        awning_length_cm: data.awning_length_cm ? Number(data.awning_length_cm) : null,
        has_bike_rack: data.has_bike_rack,
        has_garage: data.has_garage,
        has_tv_sat: data.has_tv_sat,
        has_reversing_camera: data.has_reversing_camera,
        has_parking_sensors: data.has_parking_sensors,
        has_cruise_control: data.has_cruise_control,
        has_central_locking: data.has_central_locking,
        
        // Additional
        additional_equipment: data.additional_equipment || null,
        vehicle_identification_number: data.vehicle_identification_number || null,
        license_plate: data.license_plate || null,
      };

      // Only include prices if they have values
      if (data.instant_price) {
        updateData.instant_price = Number(data.instant_price);
      }
      if (data.reserve_price) {
        updateData.reserve_price = Number(data.reserve_price);
      }

      const { error } = await supabase
        .from("motorhomes")
        .update(updateData)
        .eq("id", id)
        .eq("seller_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["motorhomeEdit", id] });
      queryClient.invalidateQueries({ queryKey: ["motorhomeDetail", id] });
      queryClient.invalidateQueries({ queryKey: ["myListings"] });
      toast({
        title: "Erfolgreich gespeichert",
        description: "Ihre Änderungen wurden gespeichert",
      });
      navigate(`/dashboard/listings/${id}`);
    },
    onError: (_error) => {
      toast({
        title: "Fehler",
        description: "Inserat konnte nicht aktualisiert werden",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const deletePhotoMutation = useMutation({
    mutationFn: async (photoId: string) => {
      if (!user) throw new Error("Nicht authentifiziert");

      // Get photo URL before deleting
      const { data: photo } = await supabase
        .from("motorhome_photos")
        .select("photo_url")
        .eq("id", photoId)
        .single();

      if (photo?.photo_url) {
        // Extract file path from URL
        const urlParts = photo.photo_url.split("/");
        const filePath = urlParts.slice(-2).join("/"); // user_id/filename

        // Delete from storage
        await supabase.storage.from("motorhome-photos").remove([filePath]);
      }

      // Delete from database
      const { error } = await supabase
        .from("motorhome_photos")
        .delete()
        .eq("id", photoId);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchPhotos();
      toast({
        title: "Foto gelöscht",
        description: "Das Foto wurde erfolgreich entfernt",
      });
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Foto konnte nicht gelöscht werden",
        variant: "destructive",
      });
    },
  });

  const uploadPhotosMutation = useMutation({
    mutationFn: async (files: FileList) => {
      if (!id || !user) throw new Error("Nicht authentifiziert");

      const photoUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}_${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("motorhome-photos")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("motorhome-photos").getPublicUrl(fileName);

        photoUrls.push(publicUrl);
      }

      // Get current max display order
      const { data: existingPhotos } = await supabase
        .from("motorhome_photos")
        .select("display_order")
        .eq("motorhome_id", id)
        .order("display_order", { ascending: false })
        .limit(1);

      const startOrder = existingPhotos?.[0]?.display_order ?? -1;

      // Insert photo records
      const photoRecords = photoUrls.map((url, index) => ({
        motorhome_id: id,
        photo_url: url,
        display_order: startOrder + index + 1,
      }));

      const { error } = await supabase
        .from("motorhome_photos")
        .insert(photoRecords);

      if (error) throw error;
    },
    onSuccess: () => {
      refetchPhotos();
      toast({
        title: "Fotos hochgeladen",
        description: "Die Fotos wurden erfolgreich hinzugefügt",
      });
    },
    onError: () => {
      toast({
        title: "Fehler",
        description: "Fotos konnten nicht hochgeladen werden",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadPhotosMutation.mutate(e.target.files);
      e.target.value = ""; // Reset input
    }
  };

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
          <h1 className="text-3xl font-bold">Inserat bearbeiten</h1>
          <p className="text-muted-foreground mt-1">
            {motorhome.manufacturer} {motorhome.model}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Bearbeitbare Informationen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="basic">Basis</TabsTrigger>
                <TabsTrigger value="technical">Technik</TabsTrigger>
                <TabsTrigger value="dimensions">Maße</TabsTrigger>
                <TabsTrigger value="interior">Innenraum</TabsTrigger>
                <TabsTrigger value="equipment">Ausstattung</TabsTrigger>
                <TabsTrigger value="photos">Fotos</TabsTrigger>
                <TabsTrigger value="additional">Zusätzlich</TabsTrigger>
              </TabsList>

              {/* Basic Tab */}
              <TabsContent value="basic" className="space-y-6 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="description">Beschreibung</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Beschreiben Sie Ihr Wohnmobil..."
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Eine detaillierte Beschreibung erhöht die Chancen auf erfolgreichen Verkauf
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="instant_price">Sofortpreis (optional)</Label>
                    <Input
                      id="instant_price"
                      type="number"
                      value={formData.instant_price}
                      onChange={(e) => setFormData({ ...formData, instant_price: e.target.value })}
                      placeholder="z.B. 45000"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reserve_price">Mindestpreis (optional)</Label>
                    <Input
                      id="reserve_price"
                      type="number"
                      value={formData.reserve_price}
                      onChange={(e) => setFormData({ ...formData, reserve_price: e.target.value })}
                      placeholder="z.B. 40000"
                    />
                  </div>
                </div>
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
                    <Label htmlFor="power_ps">Leistung (PS)</Label>
                    <Input id="power_ps" type="number" value={formData.power_ps} onChange={(e) => setFormData({ ...formData, power_ps: e.target.value })} placeholder="z.B. 130" />
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

                  <div className="space-y-2">
                    <Label htmlFor="first_registration">Erstzulassung</Label>
                    <Input id="first_registration" type="date" value={formData.first_registration} onChange={(e) => setFormData({ ...formData, first_registration: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="last_tuev_date">Letzte TÜV/HU</Label>
                    <Input id="last_tuev_date" type="date" value={formData.last_tuev_date} onChange={(e) => setFormData({ ...formData, last_tuev_date: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="next_tuev_date">Nächste TÜV/HU</Label>
                    <Input id="next_tuev_date" type="date" value={formData.next_tuev_date} onChange={(e) => setFormData({ ...formData, next_tuev_date: e.target.value })} />
                  </div>

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
                    <Label htmlFor="length_cm">Länge (cm)</Label>
                    <Input id="length_cm" type="number" value={formData.length_cm} onChange={(e) => setFormData({ ...formData, length_cm: e.target.value })} placeholder="z.B. 650" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="width_cm">Breite (cm)</Label>
                    <Input id="width_cm" type="number" value={formData.width_cm} onChange={(e) => setFormData({ ...formData, width_cm: e.target.value })} placeholder="z.B. 230" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height_cm">Höhe (cm)</Label>
                    <Input id="height_cm" type="number" value={formData.height_cm} onChange={(e) => setFormData({ ...formData, height_cm: e.target.value })} placeholder="z.B. 280" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="total_weight_kg">Gesamtgewicht (kg)</Label>
                    <Input id="total_weight_kg" type="number" value={formData.total_weight_kg} onChange={(e) => setFormData({ ...formData, total_weight_kg: e.target.value })} placeholder="z.B. 3500" />
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
                    <Label htmlFor="seats_with_seatbelts">Sitzplätze mit Gurten</Label>
                    <Input id="seats_with_seatbelts" type="number" value={formData.seats_with_seatbelts} onChange={(e) => setFormData({ ...formData, seats_with_seatbelts: e.target.value })} placeholder="z.B. 4" />
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
                    <Select value={formData.refrigerator_type} onValueChange={(value) => setFormData({ ...formData, refrigerator_type: value })}>
                      <SelectTrigger><SelectValue placeholder="Wählen Sie..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Kompressor">Kompressor</SelectItem>
                        <SelectItem value="Absorber">Absorber</SelectItem>
                        <SelectItem value="Keine">Keine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="heating_type">Heizung</Label>
                    <Select value={formData.heating_type} onValueChange={(value) => setFormData({ ...formData, heating_type: value })}>
                      <SelectTrigger><SelectValue placeholder="Wählen Sie..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Gas">Gas</SelectItem>
                        <SelectItem value="Diesel">Diesel</SelectItem>
                        <SelectItem value="Elektro">Elektro</SelectItem>
                        <SelectItem value="Keine">Keine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="air_conditioning">Klimaanlage</Label>
                    <Select value={formData.air_conditioning} onValueChange={(value) => setFormData({ ...formData, air_conditioning: value })}>
                      <SelectTrigger><SelectValue placeholder="Wählen Sie..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Fahrerhaus">Fahrerhaus</SelectItem>
                        <SelectItem value="Wohnbereich">Wohnbereich</SelectItem>
                        <SelectItem value="Beide">Beide</SelectItem>
                        <SelectItem value="Keine">Keine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fresh_water_capacity_liters">Frischwasser (Liter)</Label>
                    <Input id="fresh_water_capacity_liters" type="number" value={formData.fresh_water_capacity_liters} onChange={(e) => setFormData({ ...formData, fresh_water_capacity_liters: e.target.value })} placeholder="z.B. 120" />
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
                    <Checkbox id="has_bike_rack" checked={formData.has_bike_rack} onCheckedChange={(checked) => setFormData({ ...formData, has_bike_rack: checked as boolean })} />
                    <label htmlFor="has_bike_rack" className="text-sm font-medium">Fahrradträger</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_garage" checked={formData.has_garage} onCheckedChange={(checked) => setFormData({ ...formData, has_garage: checked as boolean })} />
                    <label htmlFor="has_garage" className="text-sm font-medium">Garage</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_tv_sat" checked={formData.has_tv_sat} onCheckedChange={(checked) => setFormData({ ...formData, has_tv_sat: checked as boolean })} />
                    <label htmlFor="has_tv_sat" className="text-sm font-medium">TV/SAT-Anlage</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="has_reversing_camera" checked={formData.has_reversing_camera} onCheckedChange={(checked) => setFormData({ ...formData, has_reversing_camera: checked as boolean })} />
                    <label htmlFor="has_reversing_camera" className="text-sm font-medium">Rückfahrkamera</label>
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
                    <Label htmlFor="awning_length_cm">Markisenlänge (cm)</Label>
                    <Input id="awning_length_cm" type="number" value={formData.awning_length_cm} onChange={(e) => setFormData({ ...formData, awning_length_cm: e.target.value })} placeholder="z.B. 400" />
                  </div>
                </div>
              </TabsContent>

              {/* Photos Tab */}
              <TabsContent value="photos" className="space-y-6 mt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Fotos verwalten</h3>
                      <p className="text-sm text-muted-foreground">
                        Aktuell: {photos.length} Foto(s)
                      </p>
                    </div>
                    <label htmlFor="photo-upload">
                      <Button type="button" variant="outline" className="gap-2" asChild>
                        <span>
                          <Upload className="w-4 h-4" />
                          Fotos hinzufügen
                        </span>
                      </Button>
                      <input
                        id="photo-upload"
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={uploadPhotosMutation.isPending}
                      />
                    </label>
                  </div>

                  {uploadPhotosMutation.isPending && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      Fotos werden hochgeladen...
                    </div>
                  )}

                  {photos.length === 0 ? (
                    <div className="border-2 border-dashed rounded-lg p-12 text-center">
                      <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-muted-foreground mb-4">
                        Keine Fotos vorhanden
                      </p>
                      <label htmlFor="photo-upload-empty">
                        <Button type="button" variant="outline" className="gap-2" asChild>
                          <span>
                            <Upload className="w-4 h-4" />
                            Erste Fotos hochladen
                          </span>
                        </Button>
                        <input
                          id="photo-upload-empty"
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleFileChange}
                          disabled={uploadPhotosMutation.isPending}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {photos.map((photo) => (
                        <div
                          key={photo.id}
                          className="relative group aspect-square rounded-lg overflow-hidden border-2 bg-muted"
                        >
                          <img
                            src={photo.photo_url}
                            alt="Motorhome"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="gap-2"
                              onClick={() => deletePhotoMutation.mutate(photo.id)}
                              disabled={deletePhotoMutation.isPending}
                            >
                              <X className="w-4 h-4" />
                              Löschen
                            </Button>
                          </div>
                          {photo.display_order === 0 && (
                            <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                              Hauptfoto
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Tipp: Das erste Foto wird als Hauptbild verwendet. Sie können bis zu
                    30 Fotos hochladen.
                  </p>
                </div>
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

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-6">
              <Button type="button" variant="outline" onClick={() => navigate(`/dashboard/listings/${id}`)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} className="gap-2">
                <Save className="w-4 h-4" />
                {updateMutation.isPending ? "Speichert..." : "Änderungen speichern"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

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
