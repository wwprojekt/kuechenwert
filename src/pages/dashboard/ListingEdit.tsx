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
import { ArrowLeft, Save, Upload, X, Image as ImageIcon, AlertCircle, CheckCircle2 } from "lucide-react";
import { withSessionRetry } from "@/lib/sessionGuard";
import { handleAndLogError } from "@/lib/errorLogService";
import { useState, useEffect, useCallback, useRef } from "react";

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
        engine_power_hp: motorhome.engine_power_hp?.toString() || "",
        transmission: motorhome.transmission || "",
        emission_class: motorhome.emission_class || "",
        first_registration: motorhome.first_registration || "",
        last_tuev_date: motorhome.last_tuev_date || "",
        tuev_valid_until: motorhome.tuev_valid_until || "",
        previous_owners: motorhome.previous_owners?.toString() || "",
        accident_free: motorhome.accident_free ?? true,
        non_smoker: motorhome.non_smoker ?? true,
        service_history_available: motorhome.service_history_available ?? false,
        fuel_tank_capacity_liters: motorhome.fuel_tank_capacity_liters?.toString() || "",
        
        // Dimensions
        length_m: motorhome.length_m?.toString() || "",
        width_m: motorhome.width_m?.toString() || "",
        height_m: motorhome.height_m?.toString() || "",
        weight_kg: motorhome.weight_kg?.toString() || "",
        payload_kg: motorhome.payload_kg?.toString() || "",
        number_of_axles: motorhome.number_of_axles ?? 2,
        seats: motorhome.seats?.toString() || "",
        sleeping_places: motorhome.sleeping_places?.toString() || "",
        beds_description: motorhome.beds_description || "",
        
        // Interior
        has_kitchen: motorhome.has_kitchen ?? true,
        refrigerator_type: motorhome.refrigerator_type || "",
        heating_type: motorhome.heating_type || "",
        air_conditioning_type: motorhome.air_conditioning_type || "Keine",
        has_bathroom: motorhome.has_bathroom ?? false,
        has_toilet: motorhome.has_toilet ?? false,
        has_shower: motorhome.has_shower ?? false,
        water_tank_liters: motorhome.water_tank_liters?.toString() || "",
        grey_water_capacity_liters: motorhome.grey_water_capacity_liters?.toString() || "",
        
        // Equipment
        has_solar: motorhome.has_solar ?? false,
        solar_power_watts: motorhome.solar_power_watts?.toString() || "",
        battery_capacity_ah: motorhome.battery_capacity_ah?.toString() || "",
        has_inverter: motorhome.has_inverter ?? false,
        has_awning: motorhome.has_awning ?? false,
        awning_length_m: motorhome.awning_length_m?.toString() || "",
        has_bike_rack: motorhome.has_bike_rack ?? false,
        has_garage: motorhome.has_garage ?? false,
        has_tv: motorhome.has_tv ?? false,
        has_backup_camera: motorhome.has_backup_camera ?? false,
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
        engine_power_hp: data.engine_power_hp ? Number(data.engine_power_hp) : null,
        transmission: data.transmission || null,
        emission_class: data.emission_class || null,
        first_registration: data.first_registration || null,
        last_tuev_date: data.last_tuev_date || null,
        tuev_valid_until: data.tuev_valid_until || null,
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

      // Only include prices if they have values
      if (data.instant_price) {
        updateData.instant_price = Number(data.instant_price);
      }
      if (data.reserve_price) {
        updateData.reserve_price = Number(data.reserve_price);
      }

      await withSessionRetry(async () => {
        const { error } = await supabase
          .from("motorhomes")
          .update(updateData)
          .eq("id", id)
          .eq("seller_id", user.id);
        if (error) throw error;
      }, 'ListingEdit.update');
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
        .select("url")
        .eq("id", photoId)
        .single();

      if (photo?.url) {
        // Extract file path from URL
        const urlParts = photo.url.split("/");
        const filePath = urlParts.slice(-2).join("/"); // user_id/filename

        // Delete from storage
        await supabase.storage.from("motorhome-photos").remove([filePath]);
      }

      // Delete from database
      await withSessionRetry(async () => {
        const { error } = await supabase
          .from("motorhome_photos")
          .delete()
          .eq("id", photoId);
        if (error) throw error;
      }, 'ListingEdit.deletePhoto');
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

  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [uploadedCount, setUploadedCount] = useState<number>(0);
  const [totalUploadCount, setTotalUploadCount] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const uploadPhotosMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (!id || !user) throw new Error("Nicht authentifiziert");

      const totalFiles = files.length;
      setTotalUploadCount(totalFiles);
      setUploadedCount(0);

      console.log(`[PhotoUpload] Starting upload of ${totalFiles} file(s) for motorhome ${id}, user ${user.id}`);

      // Step 1: Validate session is active before attempting upload
      setUploadProgress("Sitzung wird überprüft...");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('[PhotoUpload] No active session found');
        // Try to refresh session
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          throw new Error("Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an und versuchen Sie es dann nochmal.");
        }
        console.log('[PhotoUpload] Session refreshed successfully');
      } else {
        console.log(`[PhotoUpload] Session valid, expires at: ${session.expires_at}`);
      }

      // Step 2: Verify the motorhome belongs to this user
      setUploadProgress("Berechtigung wird geprüft...");
      const { data: motorhomeCheck, error: motorhomeCheckError } = await supabase
        .from("motorhomes")
        .select("id, seller_id")
        .eq("id", id)
        .eq("seller_id", user.id)
        .single();

      if (motorhomeCheckError || !motorhomeCheck) {
        console.error('[PhotoUpload] Motorhome ownership check failed:', motorhomeCheckError);
        throw new Error("Dieses Inserat gehört nicht zu Ihrem Konto. Bitte melden Sie sich erneut an.");
      }
      console.log(`[PhotoUpload] Motorhome ownership verified: ${motorhomeCheck.id}`);

      const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
      const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

      // Step 3: Validate files before uploading
      setUploadProgress("Dateien werden überprüft...");
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`[PhotoUpload] File ${i + 1}: name=${file.name}, size=${file.size}, type=${file.type || 'unknown'}`);
        
        if (file.size === 0) {
          throw new Error(`Die Datei "${file.name}" ist leer (0 Bytes). Bitte wählen Sie eine gültige Datei.`);
        }
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(`Die Datei "${file.name}" ist zu groß (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximal 100 MB erlaubt.`);
        }
        // Be more lenient with type checking - some browsers don't set MIME type for HEIC
        const fileType = file.type || '';
        const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        const isImageByType = ALLOWED_TYPES.includes(fileType) || fileType.startsWith('image/');
        const isImageByExt = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'tiff', 'tif'].includes(fileExt);
        
        if (!isImageByType && !isImageByExt) {
          throw new Error(`Die Datei "${file.name}" hat ein nicht unterstütztes Format (${fileType || 'unbekannt'}). Erlaubt: JPEG, PNG, WebP, HEIC.`);
        }
      }

      // Step 4: Upload files to storage one by one
      const photoUrls: string[] = [];
      const uploadedPaths: string[] = [];

      for (let i = 0; i < totalFiles; i++) {
        const file = files[i];
        const fileExt = file.name.split(".").pop()?.toLowerCase() || 'jpg';
        const fileName = `${user.id}/${Date.now()}_${i}.${fileExt}`;

        setUploadProgress(`Foto ${i + 1} von ${totalFiles} wird hochgeladen...`);
        setUploadedCount(i);
        console.log(`[PhotoUpload] Uploading file ${i + 1}/${totalFiles}: ${fileName} (${(file.size / 1024).toFixed(0)} KB)`);

        try {
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("motorhome-photos")
            .upload(fileName, file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadError) {
            console.error(`[PhotoUpload] Storage upload error for file ${i + 1}:`, JSON.stringify(uploadError));
            throw new Error(`Fehler beim Hochladen von "${file.name}": ${uploadError.message}`);
          }

          if (!uploadData?.path) {
            console.error(`[PhotoUpload] Upload returned no path for file ${i + 1}:`, JSON.stringify(uploadData));
            throw new Error(`Fehler beim Hochladen von "${file.name}": Keine Bestätigung vom Server erhalten.`);
          }

          console.log(`[PhotoUpload] File ${i + 1} uploaded successfully: ${uploadData.path}`);
          uploadedPaths.push(uploadData.path);

          const {
            data: { publicUrl },
          } = supabase.storage.from("motorhome-photos").getPublicUrl(fileName);

          photoUrls.push(publicUrl);
        } catch (err) {
          // If some files were already uploaded, clean them up
          if (uploadedPaths.length > 0) {
            console.warn(`[PhotoUpload] Cleaning up ${uploadedPaths.length} already uploaded files after error`);
            await supabase.storage.from("motorhome-photos").remove(uploadedPaths);
          }
          throw err;
        }
      }

      // Step 5: Verify files exist in storage
      setUploadProgress("Upload wird verifiziert...");
      console.log(`[PhotoUpload] Verifying ${uploadedPaths.length} uploaded files in storage...`);
      
      for (const path of uploadedPaths) {
        const { data: fileData, error: listError } = await supabase.storage
          .from("motorhome-photos")
          .list(path.split('/').slice(0, -1).join('/'), {
            search: path.split('/').pop(),
          });
        
        if (listError || !fileData || fileData.length === 0) {
          console.error(`[PhotoUpload] Verification failed for ${path}:`, listError);
          throw new Error(`Upload-Verifizierung fehlgeschlagen: Die Datei konnte nicht im Speicher gefunden werden. Bitte versuchen Sie es erneut.`);
        }
        console.log(`[PhotoUpload] Verified file exists: ${path} (${fileData[0]?.metadata?.size || 'unknown'} bytes)`);
      }

      // Step 6: Insert photo records into database
      setUploadProgress("Fotos werden in der Datenbank gespeichert...");
      console.log(`[PhotoUpload] All ${totalFiles} files uploaded and verified. Inserting DB records...`);

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
        url: url,
        display_order: startOrder + index + 1,
      }));

      console.log(`[PhotoUpload] Inserting ${photoRecords.length} photo records into motorhome_photos...`);
      console.log(`[PhotoUpload] Records:`, JSON.stringify(photoRecords));

      let insertedData: any[] | null = null;

      await withSessionRetry(async () => {
        const { data, error } = await supabase
          .from("motorhome_photos")
          .insert(photoRecords)
          .select();
        
        if (error) {
          console.error('[PhotoUpload] DB insert error:', JSON.stringify(error));
          throw error;
        }
        if (!data || data.length === 0) {
          console.error('[PhotoUpload] DB insert returned no data - possible RLS silent rejection');
          throw new Error('Fotos konnten nicht in der Datenbank gespeichert werden. Möglicherweise fehlt die Berechtigung. Bitte melden Sie sich erneut an.');
        }
        insertedData = data;
        console.log(`[PhotoUpload] Successfully inserted ${data.length} photo records:`, JSON.stringify(data.map(d => d.id)));
      }, 'ListingEdit.uploadPhotos');

      // Step 7: Final verification - read back from DB
      setUploadProgress("Abschließende Überprüfung...");
      const { data: verifyPhotos, error: verifyError } = await supabase
        .from("motorhome_photos")
        .select("id, url")
        .eq("motorhome_id", id)
        .order("created_at", { ascending: false })
        .limit(totalFiles);

      if (verifyError) {
        console.warn('[PhotoUpload] Verification query failed:', verifyError);
      } else {
        console.log(`[PhotoUpload] Final verification: found ${verifyPhotos?.length || 0} recent photos in DB`);
      }

      setUploadedCount(totalFiles);
      setUploadProgress("");
      return totalFiles;
    },
    onSuccess: (count) => {
      setUploadProgress("");
      setUploadedCount(0);
      setTotalUploadCount(0);
      refetchPhotos();
      toast({
        title: "Fotos erfolgreich hochgeladen",
        description: `${count} Foto(s) wurden erfolgreich hinzugefügt und verifiziert.`,
      });
    },
    onError: (error: Error) => {
      setUploadProgress("");
      setUploadedCount(0);
      setTotalUploadCount(0);

      // Log the error correctly
      handleAndLogError(error, {
        componentName: 'ListingEdit.uploadPhotos',
        category: 'api',
        severity: 'high',
        metadata: {
          motorhomeId: id,
          userId: user?.id,
        },
      });

      console.error('[PhotoUpload] Upload failed:', error.message, error.stack);

      // Show user-friendly error message
      const message = error.message?.includes('Sitzung') || error.message?.includes('abgelaufen')
        ? error.message
        : error.message?.includes('zu groß')
        ? error.message
        : error.message?.includes('Format') || error.message?.includes('nicht unterstützt')
        ? error.message
        : error.message?.includes('leer')
        ? error.message
        : error.message?.includes('gehört nicht')
        ? error.message
        : error.message?.includes('Bestätigung')
        ? error.message
        : error.message?.includes('Berechtigung')
        ? error.message
        : error.message?.includes('Verifizierung')
        ? error.message
        : error.message?.includes('Payload too large')
        ? 'Die Datei ist zu groß. Maximal 100 MB pro Foto erlaubt.'
        : error.message?.includes('mime')
        ? 'Das Dateiformat wird nicht unterstützt. Erlaubt: JPEG, PNG, WebP, HEIC.'
        : error.message?.includes('security') || error.message?.includes('policy')
        ? 'Keine Berechtigung zum Hochladen. Bitte melden Sie sich erneut an.'
        : error.message?.includes('Duplicate')
        ? 'Diese Datei wurde bereits hochgeladen.'
        : error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')
        ? 'Netzwerkfehler beim Hochladen. Bitte prüfen Sie Ihre Internetverbindung und versuchen Sie es erneut.'
        : `Fotos konnten nicht hochgeladen werden: ${error.message}`;

      toast({
        title: "Fehler beim Foto-Upload",
        description: message,
        variant: "destructive",
      });
    },
  });

  const processFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length > 0) {
      // Filter only image files
      const imageFiles = files.filter(f => {
        const ext = f.name.split('.').pop()?.toLowerCase() || '';
        return f.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp'].includes(ext);
      });
      
      if (imageFiles.length === 0) {
        toast({
          title: "Keine Bilddateien",
          description: "Bitte wählen Sie nur Bilddateien aus (JPEG, PNG, WebP, HEIC).",
          variant: "destructive",
        });
        return;
      }

      if (imageFiles.length !== files.length) {
        toast({
          title: "Hinweis",
          description: `${files.length - imageFiles.length} Datei(en) wurden übersprungen, da sie keine Bilddateien sind.`,
        });
      }

      uploadPhotosMutation.mutate(imageFiles);
    }
  }, [uploadPhotosMutation, toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = ""; // Reset input
    }
  };

  // Drag & Drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the drop zone entirely
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

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

                  <div className="space-y-2">
                    <Label htmlFor="first_registration">Erstzulassung</Label>
                    <Input id="first_registration" type="date" value={formData.first_registration} onChange={(e) => setFormData({ ...formData, first_registration: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="last_tuev_date">Letzte TÜV/HU</Label>
                    <Input id="last_tuev_date" type="date" value={formData.last_tuev_date} onChange={(e) => setFormData({ ...formData, last_tuev_date: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tuev_valid_until">Nächste TÜV/HU</Label>
                    <Input id="tuev_valid_until" type="date" value={formData.tuev_valid_until} onChange={(e) => setFormData({ ...formData, tuev_valid_until: e.target.value })} />
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
                    <Label htmlFor="air_conditioning_type">Klimaanlage</Label>
                    <Select value={formData.air_conditioning_type} onValueChange={(value) => setFormData({ ...formData, air_conditioning_type: value })}>
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Fotos verwalten</h3>
                      <p className="text-sm text-muted-foreground">
                        Aktuell: {photos.length} Foto(s)
                      </p>
                    </div>
                    <label htmlFor="photo-upload">
                      <Button type="button" variant="outline" className="gap-2" asChild disabled={uploadPhotosMutation.isPending}>
                        <span>
                          <Upload className="w-4 h-4" />
                          Fotos hinzufügen
                        </span>
                      </Button>
                      <input
                        id="photo-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                        disabled={uploadPhotosMutation.isPending}
                      />
                    </label>
                  </div>

                  {/* Upload Progress */}
                  {uploadPhotosMutation.isPending && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                        <span className="flex-1">{uploadProgress || "Fotos werden hochgeladen..."}</span>
                        {totalUploadCount > 0 && (
                          <span className="font-medium">{uploadedCount}/{totalUploadCount}</span>
                        )}
                      </div>
                      {totalUploadCount > 1 && (
                        <div className="w-full bg-blue-100 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(5, (uploadedCount / totalUploadCount) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Upload Error */}
                  {uploadPhotosMutation.isError && (
                    <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">Upload fehlgeschlagen</p>
                        <p className="mt-1">
                          {(uploadPhotosMutation.error as Error)?.message || 'Bitte versuchen Sie es erneut.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Upload Success (shown briefly after successful upload) */}
                  {uploadPhotosMutation.isSuccess && !uploadPhotosMutation.isPending && (
                    <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span>Fotos wurden erfolgreich hochgeladen und verifiziert.</span>
                    </div>
                  )}

                  {/* Drag & Drop Zone / Photo Grid */}
                  {photos.length === 0 ? (
                    <div 
                      ref={dropZoneRef}
                      className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                        isDragging 
                          ? 'border-primary bg-primary/5' 
                          : 'border-muted-foreground/25 hover:border-primary/50'
                      }`}
                      onDragEnter={handleDragEnter}
                      onDragLeave={handleDragLeave}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                    >
                      <ImageIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      {isDragging ? (
                        <p className="text-primary font-medium mb-4">
                          Lassen Sie die Fotos hier los
                        </p>
                      ) : (
                        <>
                          <p className="text-muted-foreground mb-2">
                            Keine Fotos vorhanden
                          </p>
                          <p className="text-sm text-muted-foreground mb-4">
                            Ziehen Sie Fotos hierher oder klicken Sie auf den Button
                          </p>
                        </>
                      )}
                      <label htmlFor="photo-upload-empty">
                        <Button type="button" variant="outline" className="gap-2" asChild disabled={uploadPhotosMutation.isPending}>
                          <span>
                            <Upload className="w-4 h-4" />
                            Erste Fotos hochladen
                          </span>
                        </Button>
                        <input
                          id="photo-upload-empty"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
                          multiple
                          className="hidden"
                          onChange={handleFileChange}
                          disabled={uploadPhotosMutation.isPending}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Drag & Drop hint area */}
                      <div 
                        ref={dropZoneRef}
                        className={`border-2 border-dashed rounded-lg p-4 text-center text-sm transition-colors ${
                          isDragging 
                            ? 'border-primary bg-primary/5 text-primary' 
                            : 'border-muted-foreground/20 text-muted-foreground'
                        }`}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                      >
                        {isDragging 
                          ? 'Lassen Sie die Fotos hier los'
                          : 'Weitere Fotos hierher ziehen oder oben auf "Fotos hinzufügen" klicken'
                        }
                      </div>

                      {/* Photo Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {photos.map((photo) => (
                          <div
                            key={photo.id}
                            className="relative group aspect-square rounded-lg overflow-hidden border-2 bg-muted"
                          >
                            <img
                              src={photo.url}
                              alt="Motorhome"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Show broken image placeholder
                                (e.target as HTMLImageElement).style.display = 'none';
                                const parent = (e.target as HTMLImageElement).parentElement;
                                if (parent) {
                                  const placeholder = document.createElement('div');
                                  placeholder.className = 'w-full h-full flex items-center justify-center bg-muted';
                                  placeholder.innerHTML = '<span class="text-xs text-muted-foreground">Bild nicht verfügbar</span>';
                                  parent.appendChild(placeholder);
                                }
                              }}
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
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Tipp: Das erste Foto wird als Hauptbild verwendet. Sie können bis zu
                    30 Fotos hochladen. Unterstützte Formate: JPEG, PNG, WebP, HEIC.
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
