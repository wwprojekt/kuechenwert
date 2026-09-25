/**
 * Prompt-Aufbau für die KI-Visualisierung.
 *
 * mode "edit": das Raumfoto des Kunden wird umgestaltet. Der Prompt fixiert
 * Architektur, Perspektive und Licht, damit das Ergebnis "genau so" im
 * eigenen Raum aussieht.
 * mode "text": ohne Foto wird ein Raum aus Form und Maßen erzeugt.
 */

import {
  APPLIANCES,
  EXTRAS,
  FRONT_COLORS,
  FRONT_MATERIALS,
  HANDLES,
  KITCHEN_FORMS,
  QUALITY_LEVELS,
  SINKS,
  STYLES,
  TAPS,
  WALL_CABINETS,
  WORKTOPS,
  WORKTOP_COLORS,
  effectiveAppliances,
  formById,
  type PlannerConfig,
  type RoomInput,
} from "./kitchen-catalog.ts";

const promptOf = <T extends { id: string; prompt: string }>(list: T[], id: string): string =>
  list.find((o) => o.id === id)?.prompt ?? "";

function sanitizeFreeText(text: string | null | undefined, max = 300): string {
  if (!text) return "";
  return text
    .replace(/[\u0000-\u001f<>{}\[\]`\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function dimensionHint(room: RoomInput): string {
  const def = formById(room.form);
  const parts = (def?.walls ?? [])
    .filter((w) => (room.walls[w.key] ?? 0) > 0)
    .map((w) => `${w.key === "island" ? "island" : w.key === "d" ? "peninsula" : `wall ${w.key.toUpperCase()}`} about ${((room.walls[w.key] ?? 0) / 100).toFixed(1)} m`);
  const ceiling = room.ceilingHeightCm ? `, ceiling height about ${(room.ceilingHeightCm / 100).toFixed(1)} m` : "";
  return parts.length ? `${parts.join(", ")}${ceiling}` : "";
}

export function describeKitchen(config: PlannerConfig, room: RoomInput): string {
  const frontColor = promptOf(FRONT_COLORS, config.frontColor);
  const front = promptOf(FRONT_MATERIALS, config.front);
  const worktopColor = promptOf(WORKTOP_COLORS, config.worktopColor);
  const worktop = promptOf(WORKTOPS, config.worktop);
  const appliances = effectiveAppliances(config.appliances)
    .map((id) => {
      if (id === "haube") return room.form === "insel" ? "a slim ceiling-mounted extractor above the island hob" : promptOf(APPLIANCES, id);
      return promptOf(APPLIANCES, id);
    })
    .filter(Boolean);
  const extras = config.extras.map((id) => promptOf(EXTRAS, id)).filter(Boolean);
  const tall = config.tallUnits > 0 ? `${config.tallUnits} floor-to-ceiling tall units` : "";

  return [
    promptOf(KITCHEN_FORMS, room.form),
    promptOf(STYLES, config.style),
    `${frontColor} ${front}`,
    promptOf(HANDLES, config.handle),
    promptOf(WALL_CABINETS, config.wallCabinets),
    tall,
    `${worktopColor} ${worktop}`,
    promptOf(SINKS, config.sink),
    promptOf(TAPS, config.tap),
    ...appliances,
    ...extras,
    promptOf(QUALITY_LEVELS, config.quality),
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

export interface RenderPrompt {
  prompt: string;
  mode: "edit" | "text";
}

export function buildRenderPrompt(
  config: PlannerConfig,
  room: RoomInput,
  opts: { mode: "edit" | "text"; variantHint?: string | null },
): RenderPrompt {
  const kitchen = describeKitchen(config, room);
  const dims = dimensionHint(room);
  const wishes = sanitizeFreeText(config.wishes);
  const hint = sanitizeFreeText(opts.variantHint);
  const extra = [
    wishes ? `Customer wishes: ${wishes}.` : "",
    hint ? `Design adjustment requested by the customer: ${hint}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (opts.mode === "edit") {
    return {
      mode: "edit",
      prompt: [
        "Edit this photo into a photorealistic image of the very same room after a complete kitchen renovation.",
        `Remove the existing kitchen furniture and appliances and install a brand-new kitchen: ${kitchen}.`,
        "Keep the architecture exactly as in the photo: identical walls, windows, doors, radiators, ceiling, floor area, camera position, perspective, focal length and daylight direction.",
        dims ? `Fit the kitchen realistically along the existing walls (${dims}).` : "Fit the kitchen realistically along the existing walls.",
        extra,
        "Tidy, styled like a high-end interior magazine photo, sharp details, correct proportions, no people, no text, no watermark.",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  return {
    mode: "text",
    prompt: [
      `Photorealistic wide-angle interior photograph of a brand-new German kitchen: ${kitchen}.`,
      dims ? `Room layout: ${dims}.` : "",
      extra,
      "Bright natural daylight from a large window, soft shadows, calm styling with a few plants and ceramics, architectural interior photography, 24mm lens, eye-level camera, no people, no text, no watermark.",
    ]
      .filter(Boolean)
      .join(" "),
  };
}
