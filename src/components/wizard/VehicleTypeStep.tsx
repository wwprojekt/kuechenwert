import { useMemo } from "react";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Car, Caravan, Truck, Bus, CarFront, Users, TrendingUp, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { bodyTypes, wohnwagenBodyTypes, vehicleTypes } from "@/lib/vehicle-data";

interface VehicleTypeStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
}

const WOHNMOBIL_BODY_TYPE_INFO: Record<string, { icon: typeof Car; description: string }> = {
  "Teilintegriert": { icon: Caravan, description: "Aufbau auf Fahrzeugbasis" },
  "Alkoven": { icon: Truck, description: "Schlafbereich über dem Fahrerhaus" },
  "Vollintegriert": { icon: Bus, description: "Vollintegriert mit Fahrerhaus" },
  "Kastenwagen": { icon: CarFront, description: "Kompakt und wendig" },
  "Campingbus": { icon: CarFront, description: "Flexibel und alltagstauglich" },
};

const WOHNWAGEN_BODY_TYPE_INFO: Record<string, { icon: typeof Car; description: string }> = {
  "Wohnwagen": { icon: Caravan, description: "Klassischer Wohnwagen" },
  "Faltcaravan": { icon: Caravan, description: "Zusammenfaltbar, leicht" },
  "Mobilheim": { icon: Bus, description: "Stationäres Wohnheim" },
};

export const VehicleTypeStep = ({ formData, updateFormData }: VehicleTypeStepProps) => {
  const vehicleType = formData.vehicleType || "Wohnmobil";

  const currentBodyTypes = useMemo(() => {
    return vehicleType === "Wohnwagen" ? [...wohnwagenBodyTypes] : [...bodyTypes];
  }, [vehicleType]);

  const currentBodyTypeInfo = useMemo(() => {
    return vehicleType === "Wohnwagen" ? WOHNWAGEN_BODY_TYPE_INFO : WOHNMOBIL_BODY_TYPE_INFO;
  }, [vehicleType]);

  const handleVehicleTypeChange = (value: string) => {
    updateFormData({
      vehicleType: value,
      manufacturer: "",
      model: "",
      bodyType: "",
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Car className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Was m&ouml;chten Sie verkaufen?
        </h2>
        <p className="text-muted-foreground">
          W&auml;hlen Sie Ihren Fahrzeugtyp und die Aufbauart
        </p>
      </div>

      <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-center gap-3">
        <div className="flex items-center gap-1 text-primary">
          <Users className="w-4 h-4" />
          <TrendingUp className="w-4 h-4" />
        </div>
        <p className="text-sm text-foreground">
          <strong>127 H&auml;ndler</strong> suchen aktuell nach {vehicleType === "Wohnwagen" ? "Wohnwagen" : "Wohnmobilen"} in Ihrer Region
        </p>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-semibold text-foreground">Fahrzeugtyp</label>
        <div className="grid grid-cols-2 gap-3">
          {vehicleTypes.map((type) => {
            const isSelected = vehicleType === type.value;
            const Icon = type.value === "Wohnmobil" ? Car : Caravan;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => handleVehicleTypeChange(type.value)}
                className={cn(
                  "flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all duration-200",
                  "hover:border-primary/50 hover:bg-primary/5 hover:shadow-md",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/20"
                    : "border-border bg-background"
                )}
              >
                <Icon className={cn("w-6 h-6", isSelected ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("font-semibold", isSelected ? "text-primary" : "text-foreground")}>
                  {type.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-sm font-semibold text-foreground">
          Aufbauart <span className="text-red-500">*</span>
        </label>
        <div className="grid gap-3">
          {currentBodyTypes.map((type, index) => {
            const info = currentBodyTypeInfo[type] || { icon: Car, description: "" };
            const Icon = info.icon;
            const isSelected = formData.bodyType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => updateFormData({ bodyType: type })}
                className={cn(
                  "p-4 rounded-xl border-2 text-left transition-all duration-200 flex items-center gap-4 group animate-fade-in",
                  "hover:border-primary/50 hover:bg-primary/5 hover:shadow-md",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                    : "border-border bg-background"
                )}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
                  isSelected
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                )}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold block">{type}</span>
                  {info.description && (
                    <span className="text-sm text-muted-foreground">{info.description}</span>
                  )}
                </div>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0",
                  isSelected
                    ? "bg-primary text-white scale-100"
                    : "bg-muted scale-0 group-hover:scale-75"
                )}>
                  <Check className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
        <span className="flex items-center gap-1">&#10003; Kostenlos</span>
        <span className="flex items-center gap-1">&#10003; Unverbindlich</span>
        <span className="flex items-center gap-1">&#10003; In 2 Minuten fertig</span>
      </div>
    </div>
  );
};
