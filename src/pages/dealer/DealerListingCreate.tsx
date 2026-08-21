import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
import { ensureValidRLSSession, invokeWithAuth } from "@/lib/sessionGuard";
import { MARKETING_CONFIG } from "@/lib/marketing-config";
import {
  KITCHEN_FORMS,
  KITCHEN_CONDITIONS,
  DEFAULT_KITCHEN_BRANDS,
  dealerKitchenCreateSchema,
  displayKitchenBrand,
} from "@/lib/kitchen-listing";

export default function DealerListingCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [manufacturer, setManufacturer] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [model, setModel] = useState("");
  const [bodyType, setBodyType] = useState("");
  const [year, setYear] = useState("");
  const [condition, setCondition] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const [mwstAusweisbar, setMwstAusweisbar] = useState(true);

  const { data: catalogBrands } = useQuery({
    queryKey: ["catalogKitchenBrands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalog_kitchen_brands")
        .select("name")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []).map((row) => row.name);
    },
    staleTime: 15 * 60 * 1000,
  });

  const brandOptions = catalogBrands && catalogBrands.length > 0
    ? catalogBrands
    : [...DEFAULT_KITCHEN_BRANDS];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1989 }, (_, i) => currentYear - i);

  const effectiveBrand = manufacturer === "__custom" ? customBrand : manufacturer;
  const reservePriceNum = reservePrice ? Number(reservePrice) : 0;

  const parsed = dealerKitchenCreateSchema.safeParse({
    manufacturer: effectiveBrand,
    model,
    bodyType,
    year: year ? Number(year) : undefined,
    condition,
    reservePrice: reservePriceNum,
    mwstAusweisbar,
  });
  const isValid = parsed.success;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Nicht authentifiziert");
      const check = dealerKitchenCreateSchema.safeParse({
        manufacturer: effectiveBrand,
        model,
        bodyType,
        year: year ? Number(year) : undefined,
        condition,
        reservePrice: reservePriceNum,
        mwstAusweisbar,
      });
      if (!check.success) {
        throw new Error(check.error.issues[0]?.message || "Bitte füllen Sie alle Pflichtfelder aus");
      }
      const values = check.data;

      const sessionOk = await ensureValidRLSSession();
      if (!sessionOk) throw new Error("Sitzung abgelaufen. Bitte neu anmelden.");

      const { data: roleRow, error: roleErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (roleErr) throw roleErr;

      const { data, error } = await supabase
        .from("kitchens")
        .insert({
          seller_id: user.id,
          account_type: roleRow?.role === "dealer" ? "dealer" : "private",
          mwst_ausweisbar: roleRow?.role === "dealer" ? values.mwstAusweisbar : null,
          manufacturer: values.manufacturer,
          model: values.model,
          body_type: values.bodyType,
          year: values.year,
          mileage: 0,
          condition: values.condition,
          sale_channel: "auction" as const,
          reserve_price: values.reservePrice,
          status: "available",
          country: "DE",
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: auctionError } = await supabase.from("auctions").insert({
        kitchen_id: data.id,
        starting_bid: 50,
        reserve_price: values.reservePrice,
        status: "draft",
        seller_initial_reserve: values.reservePrice,
        dynamic_pricing: MARKETING_CONFIG.AUCTION_DYNAMIC_PRICING_DEFAULT,
        auto_relist: true,
      });

      if (auctionError) {
        await supabase.from("kitchens").delete().eq("id", data.id);
        throw new Error("Auktion konnte nicht erstellt werden: " + auctionError.message);
      }

      invokeWithAuth("send-lead-notification", {
        body: {
          type: "wizard",
          name: user.email || "Händler",
          email: user.email || "",
          manufacturer: values.manufacturer,
          model: values.model,
          country: "DE",
          source: "dealer_dashboard",
        },
      }).catch((err) => {
        console.error("[DealerListingCreate] send-lead-notification failed (non-blocking):", err);
      });

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["myListings"] });
      queryClient.invalidateQueries({ queryKey: ["sellerTimeline"] });
      toast({
        title: "Inserat erstellt",
        description: "Ergänzen Sie jetzt Details und Fotos. Der Admin schaltet die Auktion nach Prüfung frei.",
      });
      navigate(`/dashboard/listings/${data.id}/edit?tab=photos`);
    },
    onError: (error: Error) => {
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
        <h1 className="text-xl sm:text-2xl font-bold">Küche inserieren</h1>
        <p className="text-muted-foreground mt-1">
          Basisdaten der Küche. Details und Fotos ergänzen Sie danach.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Küchendaten</CardTitle>
          <CardDescription>
            Nach dem Erstellen können Sie Beschreibung und Fotos ergänzen.
            Der Admin schaltet die Auktion nach Prüfung frei.
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
            <div className="space-y-2">
              <Label>Küchenform *</Label>
              <Select value={bodyType} onValueChange={setBodyType}>
                <SelectTrigger>
                  <SelectValue placeholder="Form wählen" />
                </SelectTrigger>
                <SelectContent>
                  {KITCHEN_FORMS.map((form) => (
                    <SelectItem key={form} value={form}>{form}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Marke *</Label>
              <Select
                value={manufacturer}
                onValueChange={(v) => {
                  setManufacturer(v);
                  if (v !== "__custom") setCustomBrand("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Marke wählen" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {brandOptions.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {displayKitchenBrand(brand)}
                    </SelectItem>
                  ))}
                  <SelectItem value="__custom">Andere Marke…</SelectItem>
                </SelectContent>
              </Select>
              {manufacturer === "__custom" && (
                <Input
                  value={customBrand}
                  onChange={(e) => setCustomBrand(e.target.value)}
                  placeholder="z.B. lokale Manufaktur"
                  autoFocus
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="kitchen-model">Serie / Modell *</Label>
              <Input
                id="kitchen-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="z.B. Easytouch 966"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Produktionsjahr *</Label>
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
                <Label>Zustand *</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger>
                    <SelectValue placeholder="Zustand wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {KITCHEN_CONDITIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-border/80 bg-muted/30 p-4">
              <Checkbox
                id="mwst-ausweisbar"
                checked={mwstAusweisbar}
                onCheckedChange={(c) => setMwstAusweisbar(c === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="mwst-ausweisbar" className="text-sm font-medium leading-none cursor-pointer">
                  Umsatzsteuer auf der Kaufrechnung gesondert ausweisen
                </Label>
                <p className="text-xs text-muted-foreground">
                  Aktivieren bei normaler Umsatzbesteuerung. Deaktivieren z. B. bei
                  Differenzbesteuerung oder Kleinunternehmerregelung.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dealer-reserve-price">
                Mindestpreis in € <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dealer-reserve-price"
                type="text"
                inputMode="numeric"
                value={reservePrice}
                onChange={(e) => setReservePrice(e.target.value.replace(/\D/g, ""))}
                placeholder="z.B. 8500"
                aria-invalid={reservePrice !== "" && reservePriceNum <= 0}
              />
              <p className="text-xs text-muted-foreground">
                Wird nicht verkauft, wenn das Höchstgebot darunter liegt. Pflicht für die
                automatische Preisanpassung (AGB §6.4).
              </p>
            </div>

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
