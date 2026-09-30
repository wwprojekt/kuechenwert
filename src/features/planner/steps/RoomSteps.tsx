import { HelpCircle, Lightbulb, Plus, RefreshCw, Ruler, Wind, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CardStep } from "@/components/funnel/card-step";
import { FUNNEL_HEADING_ID } from "@/components/funnel/funnel-frame";
import { ImageCardStep } from "@/components/funnel/image-card-step";
import { KitchenFormPlan } from "@/components/kitchen/KitchenFormPlan";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PlannerPhoto } from "../api";
import { FloorPlanSketch } from "../components/FloorPlanSketch";
import { PhotoUploader } from "../components/PhotoUploader";
import { KITCHEN_FORMS, VENTILATION_OPTIONS, formById, type KitchenFormId, type RoomInput, type VentilationId } from "../core";

const VENTILATION_ICONS: Record<VentilationId, LucideIcon> = { abluft: Wind, umluft: RefreshCw, unbekannt: HelpCircle };

/** Raumfrage, keine Planungswahl: ohne Antwort bleibt sie leer statt eines Standardwerts. */
export function VentilationStep({
  value,
  onChange,
  onAdvance,
}: {
  value: VentilationId | null;
  onChange: (value: VentilationId) => void;
  onAdvance: () => void;
}) {
  return (
    <CardStep
      labelledBy={FUNNEL_HEADING_ID}
      columns={3}
      mobileColumns={1}
      selected={value ?? ""}
      onSelect={(id) => onChange(id as VentilationId)}
      onAutoAdvance={onAdvance}
      options={VENTILATION_OPTIONS.map((o) => {
        const Icon = VENTILATION_ICONS[o.id];
        return { id: o.id, label: o.label, description: o.hint, icon: <Icon aria-hidden="true" /> };
      })}
    />
  );
}

export function FormStep({ form, onForm, onAdvance }: { form: KitchenFormId; onForm: (form: KitchenFormId) => void; onAdvance: () => void }) {
  return (
    <ImageCardStep
      labelledBy={FUNNEL_HEADING_ID}
      selected={form}
      onSelect={(id) => onForm(id as KitchenFormId)}
      onAutoAdvance={onAdvance}
      options={KITCHEN_FORMS.map((f) => ({ id: f.id, label: f.label, description: f.hint, pictogram: <KitchenFormPlan form={f.id} /> }))}
    />
  );
}

export function MeasureStep({
  room,
  wallIssues,
  ceilingError,
  showAllWallErrors,
  onWall,
  onCeiling,
}: {
  room: RoomInput;
  wallIssues: Record<string, string>;
  ceilingError: string | null;
  /** Nach einem Weiter-Versuch mit unvollständigen Maßen alle Fehler zeigen. */
  showAllWallErrors: boolean;
  onWall: (key: string, cm: number) => void;
  onCeiling: (cm: number | null) => void;
}) {
  const walls = formById(room.form)?.walls ?? [];
  // Fehler erst nach Verlassen des Feldes zeigen, aber sofort ausblenden, sobald der Wert passt.
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const ceilingShown = showAllWallErrors || flagged.ceiling ? ceilingError : null;
  // Die freiwillige Raumhöhe klappt erst auf Wunsch auf: So passen alle Wände auch auf kleine Handys.
  const [ceilingRequested, setCeilingRequested] = useState(false);
  const ceilingInput = useRef<HTMLInputElement>(null);
  const ceilingOpen = ceilingRequested || !!room.ceilingHeightCm || !!ceilingShown;
  useEffect(() => {
    if (ceilingRequested) ceilingInput.current?.focus();
  }, [ceilingRequested]);

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_1.1fr] sm:items-start sm:gap-6">
      <div className="rounded-2xl border bg-card p-2 sm:order-2 sm:p-3">
        <FloorPlanSketch room={room} className="h-28 w-full sm:h-56 xshort:h-24 sm:short:h-40" />
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {walls.map((w) => {
            const error = showAllWallErrors || flagged[w.key] ? wallIssues[w.key] : undefined;
            return (
              <div key={`${room.form}-${w.key}`} className="space-y-1">
                <Label htmlFor={`wall-${w.key}`}>{w.label}</Label>
                <div className="relative">
                  <Input
                    id={`wall-${w.key}`}
                    inputMode="numeric"
                    enterKeyHint="next"
                    value={room.walls[w.key] ? String(room.walls[w.key]) : ""}
                    placeholder={w.optional ? "0" : `z. B. ${w.defaultCm}`}
                    onChange={(e) => {
                      const cm = Number(e.target.value.replace(/\D/g, "").slice(0, 4));
                      onWall(w.key, Number.isFinite(cm) ? cm : 0);
                    }}
                    onBlur={() => setFlagged((f) => ({ ...f, [w.key]: !!wallIssues[w.key] }))}
                    className={cn("h-12 pr-11 text-base tabular-nums xshort:h-11", error && "border-destructive focus-visible:ring-destructive")}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={cn(`wall-${w.key}-unit`, error && `wall-${w.key}-error`)}
                  />
                  <span id={`wall-${w.key}-unit`} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    cm
                  </span>
                </div>
                {error && (
                  <p id={`wall-${w.key}-error`} className="text-xs font-medium text-destructive">
                    {error}
                  </p>
                )}
              </div>
            );
          })}
          {ceilingOpen && (
            <div className="space-y-1">
              <Label htmlFor="ceiling">
                Raumhöhe <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <div className="relative">
                <Input
                  ref={ceilingInput}
                  id="ceiling"
                  name="ceiling"
                  inputMode="numeric"
                  enterKeyHint="next"
                  value={room.ceilingHeightCm ? String(room.ceilingHeightCm) : ""}
                  placeholder="z. B. 250"
                  onChange={(e) => {
                    const cm = Number(e.target.value.replace(/\D/g, "").slice(0, 3));
                    onCeiling(cm > 0 ? cm : null);
                  }}
                  onBlur={() => setFlagged((f) => ({ ...f, ceiling: !!ceilingError }))}
                  className={cn("h-12 pr-11 text-base tabular-nums xshort:h-11", ceilingShown && "border-destructive focus-visible:ring-destructive")}
                  aria-invalid={ceilingShown ? true : undefined}
                  aria-describedby={cn("ceiling-unit", ceilingShown && "ceiling-error")}
                />
                <span id="ceiling-unit" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  cm
                </span>
              </div>
              {ceilingShown && (
                <p id="ceiling-error" className="text-xs font-medium text-destructive">
                  {ceilingShown}
                </p>
              )}
            </div>
          )}
        </div>
        {!ceilingOpen && (
          <button
            type="button"
            onClick={() => setCeilingRequested(true)}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-lg text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Raumhöhe angeben (optional)
          </button>
        )}
        <p className="flex items-start gap-2 text-xs text-muted-foreground xshort:hidden">
          <Ruler className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
          Wandlänge, an der Schränke stehen sollen. Ecken zählen wir nur einmal.
        </p>
      </div>
    </div>
  );
}

export function PhotoStep({
  photos,
  selectedPhotoPath,
  onUpload,
  onRemovePhoto,
  onSelectPhoto,
}: {
  photos: PlannerPhoto[];
  selectedPhotoPath: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemovePhoto: (path: string) => Promise<void>;
  onSelectPhoto: (path: string) => void;
}) {
  return (
    <div className="space-y-3">
      <PhotoUploader photos={photos} selectedPath={selectedPhotoPath} onSelect={onSelectPhoto} onUpload={onUpload} onRemove={onRemovePhoto} />
      {photos.length === 0 && (
        <p className="flex gap-2.5 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground xshort:text-xs">
          <Lightbulb className="mt-0.5 h-4 w-4 flex-none text-accent" aria-hidden="true" />
          <span>Tipp: Bei Tageslicht aus der Tür fotografieren. Kein Foto zur Hand? Dann entwerfen wir den Raum anhand Ihrer Maße.</span>
        </p>
      )}
    </div>
  );
}
