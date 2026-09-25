import { Lightbulb, Ruler } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KITCHEN_FORMS, formById, type KitchenFormId, type RoomInput } from "../core";
import type { PlannerPhoto } from "../api";
import { ChoiceGrid, Section } from "../components/choices";
import { FloorPlanSketch } from "../components/FloorPlanSketch";
import { PhotoUploader } from "../components/PhotoUploader";

export function RoomStep({
  room,
  photos,
  selectedPhotoPath,
  postalCode,
  onForm,
  onWall,
  onRoom,
  onPostalCode,
  onUpload,
  onRemovePhoto,
  onSelectPhoto,
}: {
  room: RoomInput;
  photos: PlannerPhoto[];
  selectedPhotoPath: string | null;
  postalCode: string;
  onForm: (form: KitchenFormId) => void;
  onWall: (key: string, cm: number) => void;
  onRoom: (patch: Partial<RoomInput>) => void;
  onPostalCode: (value: string) => void;
  onUpload: (file: File) => Promise<void>;
  onRemovePhoto: (path: string) => Promise<void>;
  onSelectPhoto: (path: string) => void;
}) {
  const walls = formById(room.form)?.walls ?? [];

  return (
    <div className="space-y-9">
      <Section
        title="Foto Ihres Raums"
        hint="Mit Foto zeigt Ihnen die KI Ihre neue Küche genau in Ihrem Raum – mit Ihren Fenstern, Türen und Ihrer Perspektive."
      >
        <PhotoUploader
          photos={photos}
          selectedPath={selectedPhotoPath}
          onSelect={onSelectPhoto}
          onUpload={onUpload}
          onRemove={onRemovePhoto}
        />
        <div className="flex gap-2.5 rounded-xl bg-muted/60 p-3.5 text-sm text-muted-foreground">
          <Lightbulb className="mt-0.5 h-4 w-4 flex-none text-accent" />
          <span>
            Tipp: Räumen Sie die Arbeitsfläche kurz frei und fotografieren Sie bei Tageslicht aus der Tür. Kein Foto zur Hand?
            Kein Problem – dann entwerfen wir einen passenden Raum anhand Ihrer Maße.
          </span>
        </div>
      </Section>

      <Section title="Welche Form soll Ihre Küche haben?" hint="Die Form bestimmt Stauraum, Arbeitsfläche und Preis.">
        <ChoiceGrid
          label="Küchenform"
          value={room.form}
          onChange={onForm}
          size="lg"
          options={KITCHEN_FORMS.map((f) => ({
            id: f.id,
            label: f.label,
            hint: f.hint,
            image: `/images/planner/forms/${f.id}.webp`,
          }))}
        />
      </Section>

      <Section title="Maße" hint="Ungefähre Werte genügen – das Küchenstudio misst vor Ort exakt nach.">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {walls.map((w) => (
                <div key={`${room.form}-${w.key}`} className="space-y-1.5">
                  <Label htmlFor={`wall-${w.key}`}>{w.label}</Label>
                  <div className="relative">
                    <Input
                      id={`wall-${w.key}`}
                      inputMode="numeric"
                      value={room.walls[w.key] ? String(room.walls[w.key]) : ""}
                      placeholder={w.optional ? "0" : String(w.defaultCm)}
                      onChange={(e) => {
                        const cm = Number(e.target.value.replace(/\D/g, "").slice(0, 4));
                        onWall(w.key, Number.isFinite(cm) ? cm : 0);
                      }}
                      className="h-11 pr-11 text-base tabular-nums"
                      aria-describedby={`wall-${w.key}-unit`}
                    />
                    <span id={`wall-${w.key}-unit`} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      cm
                    </span>
                  </div>
                </div>
              ))}
              <div className="space-y-1.5">
                <Label htmlFor="ceiling">Raumhöhe</Label>
                <div className="relative">
                  <Input
                    id="ceiling"
                    inputMode="numeric"
                    value={room.ceilingHeightCm ? String(room.ceilingHeightCm) : ""}
                    placeholder="250"
                    onChange={(e) => {
                      const cm = Number(e.target.value.replace(/\D/g, "").slice(0, 3));
                      onRoom({ ceilingHeightCm: cm || null });
                    }}
                    className="h-11 pr-11 text-base tabular-nums"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">cm</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plz-early">PLZ (für regionale Preise)</Label>
                <Input
                  id="plz-early"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={5}
                  value={postalCode}
                  placeholder="z. B. 30159"
                  onChange={(e) => onPostalCode(e.target.value)}
                  className="h-11 text-base tabular-nums"
                />
              </div>
            </div>
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Ruler className="mt-0.5 h-3.5 w-3.5 flex-none" />
              Gemessen wird die Wandlänge, an der Schränke stehen sollen. Ecken zählen wir automatisch nur einmal.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-3">
            <FloorPlanSketch room={room} className="h-56 w-full sm:h-64" />
            <p className="mt-2 text-center text-xs text-muted-foreground">Draufsicht (schematisch)</p>
          </div>
        </div>
      </Section>
    </div>
  );
}
