import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { 
  Bed, 
  Sun, 
  Tent, 
  Car, 
  Home,
  Shield,
  Bell,
  RotateCcw,
  Gauge,
  Camera,
  ParkingCircle,
  Lock,
  Tv,
  Battery,
  Zap,
  Bike,
  Warehouse
} from "lucide-react";
import { Card } from "@/components/ui/card";

interface VehicleFeaturesStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
}

export const VehicleFeaturesStep = ({ formData, updateFormData }: VehicleFeaturesStepProps) => {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Bed className="w-6 h-6 text-primary" />
          Ausstattung & Merkmale
        </h2>
        <p className="text-muted-foreground">
          Geben Sie die besonderen Merkmale Ihres Wohnmobils an
        </p>
      </div>

      {/* Basisfahrzeug (Base Vehicle) Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
          <Car className="w-5 h-5 text-primary" />
          Basisfahrzeug
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-4 transition-all hover:bg-muted/50 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="has_airbag" className="text-base font-medium cursor-pointer">
                    Airbag
                  </Label>
                  <p className="text-xs text-muted-foreground">Fahrer-/Beifahrerairbag</p>
                </div>
              </div>
              <Switch
                id="has_airbag"
                checked={formData.has_airbag}
                onCheckedChange={(checked) => updateFormData({ has_airbag: checked })}
              />
            </div>
          </Card>

          <Card className="p-4 transition-all hover:bg-muted/50 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Bell className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="has_alarm" className="text-base font-medium cursor-pointer">
                    Alarmanlage
                  </Label>
                  <p className="text-xs text-muted-foreground">Diebstahlschutz</p>
                </div>
              </div>
              <Switch
                id="has_alarm"
                checked={formData.has_alarm}
                onCheckedChange={(checked) => updateFormData({ has_alarm: checked })}
              />
            </div>
          </Card>

          <Card className="p-4 transition-all hover:bg-muted/50 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <RotateCcw className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="has_swivel_seats" className="text-base font-medium cursor-pointer">
                    Drehsitze
                  </Label>
                  <p className="text-xs text-muted-foreground">Fahrer-/Beifahrer drehbar</p>
                </div>
              </div>
              <Switch
                id="has_swivel_seats"
                checked={formData.has_swivel_seats}
                onCheckedChange={(checked) => updateFormData({ has_swivel_seats: checked })}
              />
            </div>
          </Card>

          <Card className="p-4 transition-all hover:bg-muted/50 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Gauge className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="has_esp" className="text-base font-medium cursor-pointer">
                    ESP
                  </Label>
                  <p className="text-xs text-muted-foreground">Elektronisches Stabilitätsprogramm</p>
                </div>
              </div>
              <Switch
                id="has_esp"
                checked={formData.has_esp}
                onCheckedChange={(checked) => updateFormData({ has_esp: checked })}
              />
            </div>
          </Card>

          <Card className="p-4 transition-all hover:bg-muted/50 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Gauge className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="has_cruise_control" className="text-base font-medium cursor-pointer">
                    Tempomat
                  </Label>
                  <p className="text-xs text-muted-foreground">Geschwindigkeitsregelung</p>
                </div>
              </div>
              <Switch
                id="has_cruise_control"
                checked={formData.has_cruise_control}
                onCheckedChange={(checked) => updateFormData({ has_cruise_control: checked })}
              />
            </div>
          </Card>

          <Card className="p-4 transition-all hover:bg-muted/50 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ParkingCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="has_parking_sensors" className="text-base font-medium cursor-pointer">
                    Einparkhilfe
                  </Label>
                  <p className="text-xs text-muted-foreground">Parksensoren</p>
                </div>
              </div>
              <Switch
                id="has_parking_sensors"
                checked={formData.has_parking_sensors}
                onCheckedChange={(checked) => updateFormData({ has_parking_sensors: checked })}
              />
            </div>
          </Card>

          <Card className="p-4 transition-all hover:bg-muted/50 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Camera className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="has_reversing_camera" className="text-base font-medium cursor-pointer">
                    Rückfahrkamera
                  </Label>
                  <p className="text-xs text-muted-foreground">Kamera für Rückwärtsfahren</p>
                </div>
              </div>
              <Switch
                id="has_reversing_camera"
                checked={formData.has_reversing_camera}
                onCheckedChange={(checked) => updateFormData({ has_reversing_camera: checked })}
              />
            </div>
          </Card>

          <Card className="p-4 transition-all hover:bg-muted/50 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="has_central_locking" className="text-base font-medium cursor-pointer">
                    Zentralverriegelung
                  </Label>
                  <p className="text-xs text-muted-foreground">Zentrale Türverriegelung</p>
                </div>
              </div>
              <Switch
                id="has_central_locking"
                checked={formData.has_central_locking}
                onCheckedChange={(checked) => updateFormData({ has_central_locking: checked })}
              />
            </div>
          </Card>
        </div>
      </div>

      {/* Wohnbereich (Living Area) Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
          <Home className="w-5 h-5 text-primary" />
          Wohnbereich
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-4 transition-all hover:bg-muted/50 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Sun className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="has_solar" className="text-base font-medium cursor-pointer">
                    Solaranlage
                  </Label>
                  <p className="text-xs text-muted-foreground">Photovoltaik</p>
                </div>
              </div>
              <Switch
                id="has_solar"
                checked={formData.has_solar}
                onCheckedChange={(checked) => updateFormData({ has_solar: checked })}
              />
            </div>
            {formData.has_solar && (
              <div className="mt-3 pt-3 border-t">
                <Label htmlFor="solar_power_watts" className="text-sm">Leistung (Watt)</Label>
                <Input
                  id="solar_power_watts"
                  type="number"
                  placeholder="z.B. 200"
                  value={formData.solar_power_watts || ""}
                  onChange={(e) => updateFormData({ solar_power_watts: parseInt(e.target.value) || null })}
                  min={0}
                  className="mt-1"
                />
              </div>
            )}
          </Card>

          <Card className="p-4 transition-all hover:bg-muted/50 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Battery className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="battery_capacity_ah" className="text-base font-medium cursor-pointer">
                    Aufbaubatterie
                  </Label>
                  <p className="text-xs text-muted-foreground">Kapazität in Ah</p>
                </div>
              </div>
              <Input
                id="battery_capacity_ah"
                type="number"
                placeholder="z.B. 100"
                value={formData.battery_capacity_ah || ""}
                onChange={(e) => updateFormData({ battery_capacity_ah: parseInt(e.target.value) || null })}
                min={0}
                className="w-24"
              />
            </div>
          </Card>

          <Card className="p-4 transition-all hover:bg-muted/50 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="has_inverter" className="text-base font-medium cursor-pointer">
                    Wechselrichter
                  </Label>
                  <p className="text-xs text-muted-foreground">12V auf 230V</p>
                </div>
              </div>
              <Switch
                id="has_inverter"
                checked={formData.has_inverter}
                onCheckedChange={(checked) => updateFormData({ has_inverter: checked })}
              />
            </div>
          </Card>

          <Card className="p-4 transition-all hover:bg-muted/50 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Tent className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="has_awning" className="text-base font-medium cursor-pointer">
                    Markise
                  </Label>
                  <p className="text-xs text-muted-foreground">Außenmarkise</p>
                </div>
              </div>
              <Switch
                id="has_awning"
                checked={formData.has_awning}
                onCheckedChange={(checked) => updateFormData({ has_awning: checked })}
              />
            </div>
            {formData.has_awning && (
              <div className="mt-3 pt-3 border-t">
                <Label htmlFor="awning_length_cm" className="text-sm">Länge (cm)</Label>
                <Input
                  id="awning_length_cm"
                  type="number"
                  placeholder="z.B. 350"
                  value={formData.awning_length_cm || ""}
                  onChange={(e) => updateFormData({ awning_length_cm: parseInt(e.target.value) || null })}
                  min={0}
                  className="mt-1"
                />
              </div>
            )}
          </Card>

          <Card className="p-4 transition-all hover:bg-muted/50 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Tv className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="has_tv_sat" className="text-base font-medium cursor-pointer">
                    TV / SAT-Anlage
                  </Label>
                  <p className="text-xs text-muted-foreground">Satelliten-TV</p>
                </div>
              </div>
              <Switch
                id="has_tv_sat"
                checked={formData.has_tv_sat}
                onCheckedChange={(checked) => updateFormData({ has_tv_sat: checked })}
              />
            </div>
          </Card>

          <Card className="p-4 transition-all hover:bg-muted/50 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Bike className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="has_bike_rack" className="text-base font-medium cursor-pointer">
                    Fahrradträger
                  </Label>
                  <p className="text-xs text-muted-foreground">Heck-Fahrradträger</p>
                </div>
              </div>
              <Switch
                id="has_bike_rack"
                checked={formData.has_bike_rack}
                onCheckedChange={(checked) => updateFormData({ has_bike_rack: checked })}
              />
            </div>
          </Card>

          <Card className="p-4 transition-all hover:bg-muted/50 hover:border-primary/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Warehouse className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <Label htmlFor="has_garage" className="text-base font-medium cursor-pointer">
                    Heckgarage
                  </Label>
                  <p className="text-xs text-muted-foreground">Abschließbare Garage</p>
                </div>
              </div>
              <Switch
                id="has_garage"
                checked={formData.has_garage}
                onCheckedChange={(checked) => updateFormData({ has_garage: checked })}
              />
            </div>
          </Card>
        </div>
      </div>

      <div className="bg-muted/50 rounded-lg p-4 border border-border">
        <p className="text-sm text-muted-foreground">
          💡 <strong>Tipp:</strong> Je detaillierter Sie die Ausstattung angeben, desto attraktiver wird Ihr Angebot für potenzielle Käufer.
        </p>
      </div>
    </div>
  );
};
