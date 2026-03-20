import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { vehicleTypes, popularManufacturers, bodyTypes } from "@/lib/vehicle-data";

interface LandingLeadFormProps {
  className?: string;
}

export function LandingLeadForm({ className = "" }: LandingLeadFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [vehicleType, setVehicleType] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [bodyType, setBodyType] = useState("");

  const handleSubmit = () => {
    const errors: string[] = [];
    if (!vehicleType) errors.push("Fahrzeugtyp");
    if (!manufacturer) errors.push("Marke");
    if (!bodyType) errors.push("Kategorie");

    if (errors.length > 0) {
      toast({
        title: "Pflichtfelder ausfüllen",
        description: `Bitte wählen Sie: ${errors.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    const params = new URLSearchParams();
    if (vehicleType) params.set("vehicleType", vehicleType);
    if (manufacturer) params.set("manufacturer", manufacturer);
    if (bodyType) params.set("bodyType", bodyType);
    navigate(`/verkaufen/wizard?${params.toString()}`);
  };

  return (
    <Card className={`p-6 border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5 ${className}`}>
      <div className="space-y-4">
        <div className="text-center mb-2">
          <h3 className="text-lg font-bold">Kostenlose Fahrzeugbewertung</h3>
          <p className="text-sm text-muted-foreground">In nur 3 Schritten zum besten Preis</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Select value={vehicleType} onValueChange={setVehicleType}>
            <SelectTrigger className="h-11 border-2">
              <SelectValue placeholder="Fahrzeugtyp wählen" />
            </SelectTrigger>
            <SelectContent>
              {vehicleTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={manufacturer} onValueChange={setManufacturer}>
            <SelectTrigger className="h-11 border-2">
              <SelectValue placeholder="Marke wählen" />
            </SelectTrigger>
            <SelectContent>
              {popularManufacturers.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={bodyType} onValueChange={setBodyType}>
            <SelectTrigger className="h-11 border-2">
              <SelectValue placeholder="Kategorie wählen" />
            </SelectTrigger>
            <SelectContent>
              {bodyTypes.map((bt) => (
                <SelectItem key={bt} value={bt}>
                  {bt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleSubmit}
          className="w-full gradient-hero hover:gradient-hero-hover h-12 text-base font-semibold"
          size="lg"
        >
          Kostenlos bewerten lassen
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Unverbindlich & kostenlos — Ergebnis in 2 Minuten
        </p>
      </div>
    </Card>
  );
}
