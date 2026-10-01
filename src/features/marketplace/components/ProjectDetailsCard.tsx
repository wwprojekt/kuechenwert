import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CEILING_HEIGHT_RANGE, VENTILATION_OPTIONS, formById, type VentilationId } from "@/features/planner/core";
import { cn } from "@/lib/utils";
import { errorMessage } from "../api-client";
import { CONNECTION_OPTIONS, CONSULTATION_OPTIONS, DETAILS_NOTES_MAX, ROOM_FEATURES, type CustomerDetails } from "../lead-details";
import { saveProjectDetails } from "../project-api";

const lengthField = (min: number, max: number) => z.union([z.literal(""), z.coerce.number().int().min(min).max(max)]);
const measuresSchema = z.object({
  ceiling: lengthField(CEILING_HEIGHT_RANGE.min, CEILING_HEIGHT_RANGE.max),
  walls: z.record(lengthField(60, 1200)),
});

type Option = { id: string; label: string };

function Choices({ label, options, selected, onToggle }: { label: string; options: readonly Option[]; selected: readonly string[]; onToggle: (id: string) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const active = selected.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(o.id)}
              className={cn(
                "min-h-10 rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary bg-primary/10 font-medium text-foreground" : "border-input bg-card text-muted-foreground hover:border-primary",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
const single = (current: string, id: string) => (current === id ? "" : id);

interface ProjectDetailsCardProps {
  token: string;
  kitchenForm: string | null;
  details: CustomerDetails | null;
  updatedAt: string | null;
  /**
   * Es gibt eine Planung (Konfigurator oder vom Studio hochgeladen): Die Wandlängen
   * stehen darin, Raumhöhe und Dunstabzug, soweit gesetzt, auch.
   */
  planned?: { ceiling: boolean; ventilation: boolean } | null;
  className?: string;
}

/**
 * Angaben vervollständigen: freiwillige Details nach dem Absenden. Studios
 * sehen sie ohne Kontaktdaten; Studios mit Angebot oder gekauftem Kontakt
 * werden über Änderungen informiert (kw-market-worker project_updated).
 */
export function ProjectDetailsCard({ token, kitchenForm, details, updatedAt, planned, className }: ProjectDetailsCardProps) {
  const qc = useQueryClient();
  const form = planned ? undefined : formById(kitchenForm ?? "");
  const [walls, setWalls] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(details?.walls ?? {}).map(([key, cm]) => [key, String(cm)])),
  );
  const [ceiling, setCeiling] = useState(details?.ceiling_height_cm ? String(details.ceiling_height_cm) : "");
  const [features, setFeatures] = useState<string[]>(details?.room_features ?? []);
  const [ventilation, setVentilation] = useState<string>(details?.ventilation ?? "");
  const [connections, setConnections] = useState<string>(details?.connections ?? "");
  const [consultation, setConsultation] = useState<string[]>(details?.consultation ?? []);
  const [notes, setNotes] = useState(details?.notes ?? "");
  const [problem, setProblem] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (payload: CustomerDetails) => saveProjectDetails(token, payload),
    onSuccess: (view) => {
      qc.setQueryData(["kw-project", token], view);
      // Der Server entfernt Kontaktdaten aus dem Hinweis: gespeicherten Stand zeigen.
      setNotes(view.details?.customer?.notes ?? "");
      toast.success("Gespeichert – danke! Studios, die an Ihrem Projekt arbeiten, sehen Ihre Angaben.");
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const submit = () => {
    const measures = measuresSchema.safeParse({ ceiling: ceiling.trim(), walls });
    if (!measures.success) {
      setProblem("Bitte Maße in Zentimetern angeben: Wände 60 bis 1.200 cm, Raumhöhe 200 bis 400 cm.");
      return;
    }
    setProblem(null);
    const wallCm = Object.entries(measures.data.walls).filter((entry): entry is [string, number] => entry[1] !== "");
    save.mutate({
      walls: wallCm.length ? Object.fromEntries(wallCm) : undefined,
      ceiling_height_cm: measures.data.ceiling === "" ? undefined : measures.data.ceiling,
      room_features: features,
      ventilation: (ventilation || undefined) as VentilationId | undefined,
      connections: connections || undefined,
      consultation,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className={cn("rounded-2xl border bg-card p-5", className)}>
      <div className="flex gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-primary/10 text-primary">
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-bold leading-snug">Angaben vervollständigen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {planned
              ? "Was in Ihrer Planung steht, müssen Sie hier nicht wiederholen. Alles ist freiwillig; Studios sehen es ohne Ihren Namen und Ihre Kontaktdaten."
              : "Je genauer Ihre Angaben, desto genauer die Angebote. Alles ist freiwillig; Studios sehen es ohne Ihren Namen und Ihre Kontaktdaten."}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {(form || !planned?.ceiling) && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {form?.walls.map((w) => (
              <div key={w.key} className="space-y-1">
                <Label htmlFor={`details-wall-${w.key}`}>{w.label.replace(" (optional)", "")} (cm)</Label>
                <Input
                  id={`details-wall-${w.key}`}
                  inputMode="numeric"
                  value={walls[w.key] ?? ""}
                  placeholder={`z. B. ${w.defaultCm || 240}`}
                  onChange={(e) => setWalls((prev) => ({ ...prev, [w.key]: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                />
              </div>
            ))}
            {!planned?.ceiling && (
              <div className="space-y-1">
                <Label htmlFor="details-ceiling">Raumhöhe (cm)</Label>
                <Input
                  id="details-ceiling"
                  inputMode="numeric"
                  value={ceiling}
                  placeholder="z. B. 250"
                  onChange={(e) => setCeiling(e.target.value.replace(/\D/g, "").slice(0, 3))}
                />
              </div>
            )}
          </div>
        )}
        <Choices label="Was ist im Raum zu beachten?" options={ROOM_FEATURES} selected={features} onToggle={(id) => setFeatures((f) => toggle(f, id))} />
        {!planned?.ventilation && (
          <Choices label="Dunstabzug" options={VENTILATION_OPTIONS} selected={[ventilation]} onToggle={(id) => setVentilation((v) => single(v, id))} />
        )}
        <Choices label="Wasser- und Stromanschlüsse" options={CONNECTION_OPTIONS} selected={[connections]} onToggle={(id) => setConnections((v) => single(v, id))} />
        <Choices label="Wie möchten Sie beraten werden?" options={CONSULTATION_OPTIONS} selected={consultation} onToggle={(id) => setConsultation((c) => toggle(c, id))} />
        <div className="space-y-1">
          <Label htmlFor="details-notes">Hinweis für die Studios</Label>
          <Textarea
            id="details-notes"
            rows={3}
            value={notes}
            maxLength={DETAILS_NOTES_MAX}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="z. B. Heizkörper unter dem Fenster bleibt, Einzug am 1. März"
          />
          <p className="text-xs text-muted-foreground">Telefonnummern, E-Mail-Adressen und Links entfernen wir automatisch.</p>
        </div>
      </div>

      {problem && (
        <p role="alert" className="mt-4 text-sm font-medium text-destructive">
          {problem}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
          Angaben speichern
        </Button>
        {updatedAt && (
          <span className="text-xs text-muted-foreground">Zuletzt gespeichert am {new Date(updatedAt).toLocaleDateString("de-DE")}</span>
        )}
      </div>
    </div>
  );
}
