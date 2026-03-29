import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Edit, Trash2, Gavel, Car } from "lucide-react";
import { MotorhomeDetailDialog } from "@/components/admin/MotorhomeDetailDialog";
import { MotorhomeEditDialog } from "@/components/admin/MotorhomeEditDialog";
import { DeleteMotorhomeDialog } from "@/components/admin/DeleteMotorhomeDialog";
import { useNavigate } from "react-router-dom";

interface MotorhomeWithRelations {
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
  length_m: number | null;
  width_m: number | null;
  height_m: number | null;
  weight_kg: number | null;
  payload_kg: number | null;
  number_of_axles: number | null;
  seats: number | null;
  sleeping_places: number | null;
  beds_description: string | null;
  has_kitchen: boolean | null;
  heating_type: string | null;
  air_conditioning_type: string | null;
  has_toilet: boolean | null;
  has_shower: boolean | null;
  has_bathroom: boolean;
  water_tank_liters: number | null;
  grey_water_capacity_liters: number | null;
  has_solar: boolean;
  solar_power_watts: number | null;
  battery_capacity_ah: number | null;
  has_inverter: boolean | null;
  has_awning: boolean;
  awning_length_m: number | null;
  has_bike_rack: boolean | null;
  has_garage: boolean | null;
  has_tv: boolean | null;
  has_backup_camera: boolean | null;
  has_parking_sensors: boolean | null;
  has_cruise_control: boolean | null;
  has_central_locking: boolean | null;
  additional_equipment: string | null;
  vehicle_identification_number: string | null;
  license_plate: string | null;
  created_at: string;
  seller?: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
  motorhome_photos?: Array<{ url: string; display_order: number }>;
}

export default function AdminMotorhomes() {
  const navigate = useNavigate();
  const [selectedMotorhome, setSelectedMotorhome] = useState<MotorhomeWithRelations | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: motorhomes, isLoading } = useQuery({
    queryKey: ["adminMotorhomes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motorhomes")
        .select(`
          *,
          seller:profiles!left (
            first_name,
            last_name,
            email
          ),
          motorhome_photos(url, display_order)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as MotorhomeWithRelations[];
    },
  });

  const getSaleChannelBadge = (motorhome: MotorhomeWithRelations) => {
    const channel = motorhome.sale_channel;
    const hasInstantBuy = motorhome.instant_price && Number(motorhome.instant_price) > 0;
    switch (channel) {
      case "auction":
        return hasInstantBuy
          ? <Badge className="bg-purple-500">Auktion + Sofortkauf</Badge>
          : <Badge className="bg-purple-500">Auktion</Badge>;
      case "instant_price":
        return <Badge className="bg-purple-500">Auktion + Sofortkauf</Badge>;
      case "station":
        return <Badge className="bg-orange-500">Station</Badge>;
      default:
        return <Badge variant="outline">{channel}</Badge>;
    }
  };

  const handleViewDetails = (motorhome: MotorhomeWithRelations) => {
    navigate(`/admin/motorhomes/${motorhome.id}`);
  };

  const handleEdit = (motorhome: MotorhomeWithRelations) => {
    setSelectedMotorhome(motorhome);
    setShowEditDialog(true);
  };

  const handleDelete = (motorhome: MotorhomeWithRelations) => {
    setSelectedMotorhome(motorhome);
    setShowDeleteDialog(true);
  };

  const handleCreateAuction = (motorhome: MotorhomeWithRelations) => {
    // Navigate to auctions page with motorhome context
    navigate(`/admin/auctions?create=${motorhome.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Wohnmobilverwaltung</h1>
          <p className="text-muted-foreground">
            Übersicht aller Wohnmobile auf der Plattform
          </p>
        </div>
      </div>

      <Card className="border-2 hover:border-primary/20 transition-smooth overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Bild</TableHead>
              <TableHead>Fahrzeug</TableHead>
              <TableHead>Verkäufer</TableHead>
              <TableHead>Jahr</TableHead>
              <TableHead>Kilometerstand</TableHead>
              <TableHead>Zustand</TableHead>
              <TableHead>Verkaufsweg</TableHead>
              <TableHead>Fotos</TableHead>
              <TableHead>Ausstattung</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  Lädt...
                </TableCell>
              </TableRow>
            ) : motorhomes?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8">
                  Keine Wohnmobile gefunden
                </TableCell>
              </TableRow>
            ) : (
              motorhomes?.map((motorhome) => {
                const firstPhoto = motorhome.motorhome_photos
                  ?.sort((a, b) => a.display_order - b.display_order)[0]?.url;
                
                return (
                <TableRow key={motorhome.id}>
                  <TableCell>
                    <div className="w-16 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      {firstPhoto ? (
                        <img 
                          src={firstPhoto}
                          alt={`${motorhome.manufacturer} ${motorhome.model}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Car className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {motorhome.manufacturer} {motorhome.model}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {motorhome.body_type}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">
                        {motorhome.seller?.first_name} {motorhome.seller?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {motorhome.seller?.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{motorhome.year}</TableCell>
                  <TableCell>{motorhome.mileage.toLocaleString()} km</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{motorhome.condition}</Badge>
                  </TableCell>
                  <TableCell>{getSaleChannelBadge(motorhome)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {motorhome.motorhome_photos?.length || 0} Fotos
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {motorhome.has_bathroom && (
                        <Badge variant="outline" className="text-xs">
                          Bad
                        </Badge>
                      )}
                      {motorhome.has_solar && (
                        <Badge variant="outline" className="text-xs">
                          Solar
                        </Badge>
                      )}
                      {motorhome.has_awning && (
                        <Badge variant="outline" className="text-xs">
                          Markise
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewDetails(motorhome)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Details anzeigen
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(motorhome)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Bearbeiten
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleCreateAuction(motorhome)}>
                          <Gavel className="w-4 h-4 mr-2" />
                          Auktion erstellen
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(motorhome)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Dialogs */}
      <MotorhomeDetailDialog
        motorhome={selectedMotorhome}
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
      />

      <MotorhomeEditDialog
        motorhome={selectedMotorhome}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />

      <DeleteMotorhomeDialog
        motorhome={selectedMotorhome}
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />
    </div>
  );
}
