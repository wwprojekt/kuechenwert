/**
 * VehicleTypeStep - Step 1 des Wizards
 * 
 * Zeigt interaktive Kacheln für Fahrzeugtyp (Wohnmobil/Wohnwagen) und Aufbauart.
 * Aufbauarten werden in einem 2-spaltigen Grid mit realistischen SVG-Silhouetten
 * der jeweiligen Aufbauart dargestellt.
 */

import { useMemo } from "react";
import type { ComponentType, SVGProps } from "react";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Car, Caravan, Users, TrendingUp, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { bodyTypes, wohnwagenBodyTypes, vehicleTypes } from "@/lib/vehicle-data";
import {
  TeilintegriertIcon,
  AlkovenIcon,
  VollintegriertIcon,
  KastenwagenIcon,
  CampingbusIcon,
  WohnwagenIcon,
  FaltcaravanIcon,
  MobilheimIcon,
} from "./VehicleIcons";

interface VehicleTypeStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
  fieldErrors?: Record<string, string>;
}

type SvgIconComponent = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

interface BodyTypeInfo {
  icon: SvgIconComponent;
  description: string;
}

const WOHNMOBIL_BODY_TYPE_INFO: Record<string, BodyTypeInfo> = {
  "Teilintegriert": { icon: TeilintegriertIcon, description: "Aufbau auf Fahrzeugbasis" },
  "Alkoven": { icon: AlkovenIcon, description: "Schlafbereich über dem Fahrerhaus" },
  "Vollintegriert": { icon: VollintegriertIcon, description: "Durchgehende Karosserie" },
  "Kastenwagen": { icon: KastenwagenIcon, description: "Kompakt und wendig" },
  "Campingbus": { icon: CampingbusIcon, description: "Flexibel mit Aufstelldach" },
};

const WOHNWAGEN_BODY_TYPE_INFO: Record<string, BodyTypeInfo> = {
  "Wohnwagen": { icon: WohnwagenIcon, description: "Klassischer Wohnwagen" },
  "Faltcaravan": { icon: FaltcaravanIcon, description: "Zusammenfaltbar, leicht" },
  "Mobilheim": { icon: MobilheimIcon, description: "Stationäres Wohnheim" },
};

export const VehicleTypeStep = ({ formData, updateFormData, fieldErrors = {} }: VehicleTypeStepProps) => {
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
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl md:text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
          <Car className="w-5 h-5 md:w-6 md:h-6 text-primary" />
          Was möchten Sie verkaufen?
        </h2>
        <p className="text-sm text-muted-foreground">
          Wählen Sie Ihren Fahrzeugtyp und die Aufbauart
        </p>
      </div>

      {/* FOMO-Element */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-2.5 flex items-center gap-2.5">
        <div className="flex items-center gap-1 text-primary">
          <Users className="w-4 h-4" />
          <TrendingUp className="w-4 h-4" />
        </div>
        <p className="text-sm text-foreground">
          <strong>127 Händler</strong> suchen aktuell nach {vehicleType === "Wohnwagen" ? "Wohnwagen" : "Wohnmobilen"}
        </p>
      </div>

      {/* Fahrzeugtyp-Auswahl */}
      <div className="space-y-2">
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
                  "flex items-center justify-center gap-2.5 p-3 rounded-xl border-2 transition-all duration-200",
                  "hover:border-primary/50 hover:bg-primary/5 hover:shadow-md",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/20"
                    : "border-border bg-background"
                )}
              >
                <Icon className={cn("w-5 h-5", isSelected ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("font-semibold text-sm", isSelected ? "text-primary" : "text-foreground")}>
                  {type.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Aufbauart-Auswahl - 2-spaltig */}
      <div className="space-y-2">
        <label className={cn("text-sm font-semibold", fieldErrors.bodyType ? "text-red-600" : "text-foreground")}>
          Aufbauart <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {currentBodyTypes.map((type, index) => {
            const info = currentBodyTypeInfo[type];
            if (!info) return null;
            const Icon = info.icon;
            const isSelected = formData.bodyType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => updateFormData({ bodyType: type })}
                className={cn(
                  "p-3 rounded-xl border-2 text-center transition-all duration-200 group animate-fade-in relative",
                  "hover:border-primary/50 hover:bg-primary/5 hover:shadow-md",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                    : "border-border bg-background"
                )}
                style={{ animationDelay: `${index * 60}ms` }}
              >
                {/* Check-Badge oben rechts */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                    <Check className="w-3 h-3" />
                  </div>
                )}

                {/* SVG-Icon der Aufbauart */}
                <div className={cn(
                  "w-full flex items-center justify-center mb-2 transition-colors",
                  isSelected ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                )}>
                  <Icon className="w-16 h-10 md:w-20 md:h-12" />
                </div>

                {/* Label */}
                <span className={cn(
                  "font-semibold text-sm block",
                  isSelected ? "text-primary" : "text-foreground"
                )}>
                  {type}
                </span>
                <span className="text-xs text-muted-foreground leading-tight block mt-0.5">
                  {info.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {fieldErrors.bodyType && (
        <p className="text-sm text-red-600 font-medium animate-fade-in">{fieldErrors.bodyType}</p>
      )}

      {/* Trust-Footer */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1">✓ Kostenlos</span>
        <span className="flex items-center gap-1">✓ Unverbindlich</span>
        <span className="flex items-center gap-1">✓ In 2 Min. fertig</span>
      </div>
    </div>
  );
};
