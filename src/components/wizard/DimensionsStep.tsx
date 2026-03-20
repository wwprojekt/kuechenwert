import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { WizardFormData } from "@/hooks/useWizardForm";
import { Maximize2, Weight, Users, Bed } from "lucide-react";

interface DimensionsStepProps {
  formData: WizardFormData;
  updateFormData: (updates: Partial<WizardFormData>) => void;
}

export const DimensionsStep = ({ formData, updateFormData }: DimensionsStepProps) => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2 flex items-center gap-2">
          <Maximize2 className="w-6 h-6 text-primary" />
          Maße & Kapazitäten
        </h2>
        <p className="text-muted-foreground">
          Geben Sie die Abmessungen und Kapazitäten an
        </p>
      </div>

      {/* Dimensions */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Abmessungen</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="length_cm">Länge (cm)</Label>
            <Input
              id="length_cm"
              type="number"
              placeholder="z.B. 740"
              value={formData.length_cm || ""}
              onChange={(e) => updateFormData({ length_cm: e.target.value ? parseInt(e.target.value) : null })}
              min={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="width_cm">Breite (cm)</Label>
            <Input
              id="width_cm"
              type="number"
              placeholder="z.B. 235"
              value={formData.width_cm || ""}
              onChange={(e) => updateFormData({ width_cm: e.target.value ? parseInt(e.target.value) : null })}
              min={150}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="height_cm">Höhe (cm)</Label>
            <Input
              id="height_cm"
              type="number"
              placeholder="z.B. 290"
              value={formData.height_cm || ""}
              onChange={(e) => updateFormData({ height_cm: e.target.value ? parseInt(e.target.value) : null })}
              min={150}
            />
          </div>
        </div>
      </div>

      {/* Weight & Technical */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Weight className="w-5 h-5" />
          Gewicht & Achsen
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="total_weight_kg">Zul. Gesamtgewicht (kg)</Label>
            <Input
              id="total_weight_kg"
              type="number"
              placeholder="z.B. 3500"
              value={formData.total_weight_kg || ""}
              onChange={(e) => updateFormData({ total_weight_kg: e.target.value ? parseInt(e.target.value) : null })}
              min={500}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payload_kg">Zuladung (kg)</Label>
            <Input
              id="payload_kg"
              type="number"
              placeholder="z.B. 500"
              value={formData.payload_kg || ""}
              onChange={(e) => updateFormData({ payload_kg: e.target.value ? parseInt(e.target.value) : null })}
              min={0}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="number_of_axles">Anzahl Achsen</Label>
            <Input
              id="number_of_axles"
              type="number"
              placeholder="z.B. 2"
              value={formData.number_of_axles || 2}
              onChange={(e) => updateFormData({ number_of_axles: e.target.value ? parseInt(e.target.value) : 2 })}
              min={1}
              max={4}
            />
          </div>
        </div>
      </div>

      {/* Seating & Sleeping */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          Sitz- & Schlafplätze
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="seats_with_seatbelts">Sitzplätze mit Gurt *</Label>
            <Input
              id="seats_with_seatbelts"
              type="number"
              placeholder="z.B. 4"
              value={formData.seats_with_seatbelts || ""}
              onChange={(e) => updateFormData({ seats_with_seatbelts: e.target.value ? parseInt(e.target.value) : null })}
              min={1}
              max={9}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sleeping_places" className="flex items-center gap-2">
              <Bed className="w-4 h-4" />
              Schlafplätze *
            </Label>
            <Input
              id="sleeping_places"
              type="number"
              placeholder="z.B. 4"
              value={formData.sleeping_places || ""}
              onChange={(e) => updateFormData({ sleeping_places: e.target.value ? parseInt(e.target.value) : null })}
              min={1}
              max={9}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="beds_description">Bettenkonfiguration</Label>
          <Textarea
            id="beds_description"
            placeholder="z.B. Queensbett (140x200cm) im Heck, Hubbett über Fahrerhaus (140x190cm)"
            value={formData.beds_description || ""}
            onChange={(e) => updateFormData({ beds_description: e.target.value })}
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Beschreiben Sie die Schlafmöglichkeiten (z.B. Queensbett, Einzelbetten, Hubbett)
          </p>
        </div>
      </div>
    </div>
  );
};
