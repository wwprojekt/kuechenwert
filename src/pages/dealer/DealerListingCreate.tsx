import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { withSessionRetry } from "@/lib/sessionGuard";
import {
  popularManufacturers,
  wohnwagenManufacturers,
  manufacturerModels,
  wohnwagenManufacturerModels,
} from "@/lib/vehicle-data";

const BODY_TYPES_WOHNMOBIL = [
  "Teilintegriert", "Alkoven", "Vollintegriert", "Kastenwagen", "Campingbus",
] as const;

const BODY_TYPES_WOHNWAGEN = [
  "Wohnwagen", "Faltcaravan",
] as const;

const CONDITIONS = [
  "Neuwertig", "Sehr gepflegt", "Gepflegt", "Sehr gut", "Gut",
  "Gebrauchsspuren", "Befriedigend", "Reparaturbedürftig",
] as const;

type VehicleType = "Wohnmobil" | "Wohnwagen";

export default function DealerListingCreate() {
  const { user } = useAuth();
  const { primaryRole } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [vehicleType, setVehicleType] = useState<VehicleType>("Wohnmobil");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [year, setYear] = useState("");
  const [mileage, setMileage] = useState("");
  const [condition, setCondition] = useState("");
  const [reservePrice, setReservePrice] = useState("");

  const manufacturers = vehicleType === "Wohnmobil" ? popularManufacturers : wohnwagenManufacturers;
  const modelsMap = vehicleType === "Wohnmobil" ? manufacturerModels : wohnwagenManufacturerModels;
  const models = manufacturer ? (modelsMap[manufacturer] || []) : [];
  const bodyTypes = vehicleType === "Wohnmobil" ? BODY_TYPES_WOHNMOBIL : BODY_TYPES_WOHNWAGEN;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 40 }, (_, i) => currentYear - i);

  const isValid = manufacturer && model && bodyType && year && mileage && condition;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Nicht authentifiziert");
      if (!isValid) throw new Error("Bitte füllen Sie alle Pflichtfelder aus");

      const isDealer = primaryRole === "dealer";

      const insertData = {
        seller_id: user.id,
        account_type: isDealer ? "dealer" : "private",
        manufacturer,
        model,
        body_type: bodyType as any,
        year: Number(year),
        mileage: vehicleType === "Wohnwagen" ? 0 : Number(mileage),
        condition: condition as any,
        sale_channel: "auction" as const,
        reserve_price: reservePrice ? Number(reservePrice) : null,
        status: "available",
        country: "DE",
      };

      const result = await withSessionRetry(async () => {
        const { data, error } = await supabase
          .from("motorhomes")
          .insert(insertData)
          .select("id")
          .single();
        if (error) throw error;
        return data;
      }, "DealerListingCreate.insert");

      // Create draft auction so admin can activate it
      await supabase.from("auctions").insert({
        motorhome_id: result.id,
        starting_bid: 50,
        reserve_price: reservePrice ? Number(reservePrice) : null,
        status: "draft",
      });

      // Notify admin about new dealer listing
      supabase.functions.invoke("send-lead-notification", {
        body: {
          type: "wizard",
          name: user.email || "Händler",
          email: user.email || "",
          manufacturer,
          model,
          country: "DE",
          source: "dealer_dashboard",
        },
      }).catch(() => { /* fire-and-forget */ });

      return result;
    },
    onSuccess: (data) => {
      toast({
        title: "Inserat erstellt",
        description: "Ergänzen Sie jetzt Details und Fotos. Der Admin wird die Auktion nach Prüfung freischalten.",
      });
      navigate(`/dashboard/listings/${data.id}/edit?tab=photos`);
    },
    onError: (error: any) => {
      toast({
        title: "Fehler",
        description: error.message || "Inserat konnte nicht erstellt werden",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard/listings")}
          className="gap-2 mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück zu Inseraten
        </Button>
        <h1 className="text-xl sm:text-2xl font-bold">Neues Inserat erstellen</h1>
        <p className="text-muted-foreground mt-1">
          Geben Sie die Basisdaten ein. Details und Fotos können Sie danach ergänzen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fahrzeugdaten</CardTitle>
          <CardDescription>
            Nach dem Erstellen können Sie im Editor alle weiteren Details, Ausstattung und Fotos ergänzen.
            Der Admin wird die Auktion nach Prüfung freischalten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-5"
          >
            {/* Vehicle Type */}
            <div className="space-y-2">
              <Label>Fahrzeugtyp *</Label>
              <div className="flex gap-3">
                {(["Wohnmobil", "Wohnwagen"] as const).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={vehicleType === type ? "default" : "outline"}
                    onClick={() => {
                      setVehicleType(type);
                      setManufacturer("");
                      setModel("");
                      setBodyType("");
                      setMileage(type === "Wohnwagen" ? "0" : "");
                    }}
                    className="flex-1"
                  >
                    {type}
                  </Button>
                ))}
              </div>
            </div>

            {/* Body Type */}
            <div className="space-y-2">
              <Label>Aufbauart *</Label>
              <Select value={bodyType} onValueChange={setBodyType}>
                <SelectTrigger>
                  <SelectValue placeholder="Aufbauart wählen" />
                </SelectTrigger>
                <SelectContent>
                  {bodyTypes.map((bt) => (
                    <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Manufacturer */}
            <div className="space-y-2">
              <Label>Hersteller *</Label>
              <Select value={manufacturer} onValueChange={(v) => { setManufacturer(v); setModel(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Hersteller wählen" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {manufacturers.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label>Modell *</Label>
              {models.length > 0 ? (
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Modell wählen" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {models.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                    <SelectItem value="__custom">Anderes Modell...</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="z.B. Excellent 560 UL"
                />
              )}
              {model === "__custom" && (
                <Input
                  value=""
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Modellname eingeben"
                  autoFocus
                />
              )}
            </div>

            {/* Year + Mileage */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Baujahr *</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Jahr" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{vehicleType === "Wohnwagen" ? "Kilometerstand" : "Kilometerstand *"}</Label>
                <Input
                  type="number"
                  value={mileage}
                  onChange={(e) => setMileage(e.target.value)}
                  placeholder="z.B. 45000"
                  disabled={vehicleType === "Wohnwagen"}
                />
              </div>
            </div>

            {/* Condition */}
            <div className="space-y-2">
              <Label>Zustand *</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
                  <SelectValue placeholder="Zustand wählen" />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reserve Price (optional) */}
            <div className="space-y-2">
              <Label>Mindestpreis (optional)</Label>
              <Input
                type="number"
                value={reservePrice}
                onChange={(e) => setReservePrice(e.target.value)}
                placeholder="z.B. 25000"
              />
              <p className="text-xs text-muted-foreground">
                Wird nicht verkauft wenn das Höchstgebot unter diesem Preis liegt.
              </p>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={!isValid || createMutation.isPending}
              className="w-full gradient-hero hover:gradient-hero-hover"
              size="lg"
            >
              {createMutation.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Wird erstellt...</>
              ) : (
                <><Plus className="w-4 h-4 mr-2" /> Inserat erstellen</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
