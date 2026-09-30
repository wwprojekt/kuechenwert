import { FloorPlanSketch } from "@/features/planner/components/FloorPlanSketch";
import {
  VENTILATION_OPTIONS,
  describeRoom,
  sanitizeRoom,
  type ChoiceSource,
  type DimensionsSource,
  type RoomInput,
} from "@/features/planner/core";
import type { ProjectSummary } from "../dealer-api";
import type { ProjectSummaryLabels } from "../project-api";

const CHOICE_NOTE: Record<ChoiceSource, string> = { default: "Standard", partial: "teils Standard" };

const DIMENSIONS_NOTE: Record<DimensionsSource, string> = {
  customer: "Angaben des Kunden, bitte vor Ort aufmessen",
  partial: "teils Beispielmaße des Planers, vom Kunden nicht angepasst; bitte vor Ort aufmessen",
  example: "Beispielmaße des Planers, vom Kunden nicht angepasst; bitte vor Ort aufmessen",
};

type ConfigRow = [key: keyof ProjectSummaryLabels, label: string, value: string | undefined];

function configRows(labels: ProjectSummaryLabels): ConfigRow[] {
  const rows: ConfigRow[] = [
    ["quality", "Qualität", labels.quality],
    ["style", "Stil", labels.style],
    ["front", "Fronten", labels.front],
    ["handle", "Griffe", labels.handle],
    ["wall_cabinets", "Oberschränke", labels.wall_cabinets],
    ["tall_units", "Hochschränke", labels.tall_units != null ? String(labels.tall_units) : undefined],
    ["worktop", "Arbeitsplatte", labels.worktop],
    ["sink", "Spüle & Armatur", [labels.sink, labels.tap].filter(Boolean).join(", ")],
    ["appliance_level", "Geräte", labels.appliance_level],
    ["appliances", "Gerätewünsche", (labels.appliances ?? []).join(", ")],
    ["extras", "Extras", (labels.extras ?? []).join(", ")],
    ["services", "Leistungen", (labels.services ?? []).join(", ")],
  ];
  return rows.filter(([, , value]) => !!value);
}

/**
 * Raum einer Planung, sonst die vom Kunden nachgetragenen Wandlängen
 * (Funnel A/B); null ohne Maße.
 */
export function summaryRoom(summary: ProjectSummary, addedRoom: RoomInput | null = null): RoomInput | null {
  if (summary.room?.form && summary.room.walls) return sanitizeRoom(summary.room);
  return addedRoom ? sanitizeRoom(addedRoom) : null;
}

/**
 * Wunschkonfiguration und Raum wie auf der Studio-Projektseite; die Admin-
 * Vorschau nutzt dieselbe Darstellung.
 */
export function PlannerSummaryCards({ summary, addedRoom = null }: { summary: ProjectSummary; addedRoom?: RoomInput | null }) {
  const labels = summary.labels;
  const defaults = summary.defaults ?? {};
  const choiceRows = labels ? configRows(labels) : [];
  const planned = !!(summary.room?.form && summary.room.walls);
  const room = summaryRoom(summary, addedRoom);
  const ventilationLabel = VENTILATION_OPTIONS.find((o) => o.id === summary.room?.ventilation)?.label;

  return (
    <>
      {labels && (
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-bold">Wunschkonfiguration</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {choiceRows.map(([key, label, value]) => {
              const note = defaults[key];
              return (
                <div key={key} className="flex gap-3">
                  <dt className="w-28 flex-none text-muted-foreground">{label}</dt>
                  <dd className="font-medium">
                    {value}
                    {note && <span className="ml-1.5 font-normal text-muted-foreground">({CHOICE_NOTE[note]})</span>}
                  </dd>
                </div>
              );
            })}
          </dl>
          {choiceRows.some(([key]) => defaults[key]) && (
            <p className="mt-3 text-xs text-muted-foreground">
              „Standard“: Diesen Schritt hat der Kunde übersprungen, der Wert ist die Voreinstellung des Planers.
            </p>
          )}
          {summary.wishes && (
            <p className="mt-4 rounded-lg bg-muted/60 p-3 text-sm">
              <span className="font-semibold">Hinweis des Kunden:</span> {summary.wishes}
            </p>
          )}
        </div>
      )}

      {room && (
        <div className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="font-bold">Raum & Maße</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {planned
                ? `${summary.room?.description ?? describeRoom(room)} (${DIMENSIONS_NOTE[summary.room?.dimensions_source ?? "customer"]})`
                : `${describeRoom(room)} (vom Kunden nachgetragen, bitte vor Ort aufmessen)`}
            </p>
            {(summary.layout || summary.room?.ceiling_height_cm || ventilationLabel) && (
              <ul className="mt-3 space-y-1 text-sm">
                {summary.layout && <li>Schrankzeile: {(summary.layout.runCm / 100).toLocaleString("de-DE")} m</li>}
                {summary.layout && <li>Arbeitsplatte: ca. {(summary.layout.worktopCm / 100).toLocaleString("de-DE")} m</li>}
                {summary.layout && summary.layout.islandCm > 0 && (
                  <li>Insel: {(summary.layout.islandCm / 100).toLocaleString("de-DE")} m</li>
                )}
                {summary.room?.ceiling_height_cm && (
                  <li>Raumhöhe: {(summary.room.ceiling_height_cm / 100).toLocaleString("de-DE")} m</li>
                )}
                {ventilationLabel && <li>Dunstabzug: {ventilationLabel}</li>}
              </ul>
            )}
          </div>
          <FloorPlanSketch room={room} className="h-52 w-full" />
        </div>
      )}
    </>
  );
}
