/**
 * Funnel C: Zusammenfassung einer Planung für Studios (public_summary der
 * Ausschreibung, Studio-Portal, Mails). Ohne Datenbankzugriff, damit Deno und
 * Vite die Datei laden; die Ausschreibung eröffnet planner-offers.ts.
 */

import {
  APPLIANCES,
  APPLIANCE_LEVELS,
  EXTRAS,
  FRONT_COLORS,
  FRONT_MATERIALS,
  HANDLES,
  QUALITY_LEVELS,
  SERVICES,
  SINKS,
  STYLES,
  TAPS,
  WALL_CABINETS,
  WORKTOPS,
  WORKTOP_COLORS,
  effectiveAppliances,
  labelOf,
  plannerTimeframeLabel,
  type PlannerConfig,
  type RoomInput,
} from "./kitchen-catalog.ts";
import { describeRoom, type KitchenEstimate } from "./kitchen-pricing.ts";
import { dimensionsSource, labelDefaults, type PlannerProvenance } from "./planner-provenance.ts";

export function buildPlannerSummary(
  config: PlannerConfig,
  room: RoomInput,
  estimate: KitchenEstimate,
  extra: {
    timeframeMonths: number | null;
    housingType: string;
    photoCount: number;
    cover: { bucket: string; path: string } | null;
    /** Ohne Angabe (ältere Planungen) bleibt offen, was Standardwert ist. */
    provenance: PlannerProvenance | null;
  },
): Record<string, unknown> {
  const provenance = extra.provenance;
  return {
    source: "c",
    room: {
      form: room.form,
      walls: room.walls,
      ceiling_height_cm: room.ceilingHeightCm ?? null,
      description: describeRoom(room),
      notes: room.notes ?? null,
      ...(provenance ? { dimensions_source: dimensionsSource(provenance, room) } : {}),
    },
    config,
    labels: {
      quality: labelOf(QUALITY_LEVELS, config.quality),
      style: labelOf(STYLES, config.style),
      front: `${labelOf(FRONT_MATERIALS, config.front)}, ${labelOf(FRONT_COLORS, config.frontColor)}`,
      handle: labelOf(HANDLES, config.handle),
      wall_cabinets: labelOf(WALL_CABINETS, config.wallCabinets),
      tall_units: config.tallUnits,
      worktop: `${labelOf(WORKTOPS, config.worktop)}, ${labelOf(WORKTOP_COLORS, config.worktopColor)}`,
      sink: labelOf(SINKS, config.sink),
      tap: labelOf(TAPS, config.tap),
      appliance_level: labelOf(APPLIANCE_LEVELS, config.applianceLevel),
      appliances: effectiveAppliances(config.appliances).map((id) => labelOf(APPLIANCES, id)),
      extras: config.extras.map((id) => labelOf(EXTRAS, id)),
      services: config.services.map((id) => labelOf(SERVICES, id)),
      timeframe: plannerTimeframeLabel(extra.timeframeMonths),
    },
    ...(provenance ? { defaults: labelDefaults(provenance) } : {}),
    wishes: config.wishes ?? null,
    estimate: { min: estimate.min, max: estimate.max, mid: estimate.mid },
    layout: estimate.layout,
    timeframe_months: extra.timeframeMonths,
    housing_type: extra.housingType,
    photo_count: extra.photoCount,
    cover: extra.cover,
  };
}
