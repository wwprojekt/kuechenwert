/**
 * Prompt-Aufbau für die KI-Visualisierung.
 *
 * mode "edit": das Raumfoto des Kunden wird umgestaltet. Der Prompt fixiert
 * Architektur, Perspektive und Licht, damit das Ergebnis "genau so" im
 * eigenen Raum aussieht.
 * mode "text": ohne Foto wird ein Raum aus Form und Maßen erzeugt.
 * Varianten (buildVariantPrompt) bearbeiten eine fertige Visualisierung und
 * ändern nur, was gewünscht ist.
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

/** Mit jedem Bild gespeichert (spec_snapshot.prompt_version), damit sich Prompt-Stände vergleichen lassen. */
export const PROMPT_VERSION = "2026-09-30-realism";

const promptOf = <T extends { id: string; prompt: string }>(list: T[], id: string): string =>
  list.find((o) => o.id === id)?.prompt ?? "";

function sanitizeFreeText(text: string | null | undefined, max = 300): string {
  if (!text) return "";
  return text
    // eslint-disable-next-line no-control-regex -- Steuerzeichen aus Nutzereingaben entfernen, bevor sie in den Prompt gehen
    .replace(/[\u0000-\u001f<>{}[\]`\\]/g, " ")
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

/**
 * Übliche Maße deutscher Küchen: Ohne Maßstab zeichnen Bildmodelle Schränke oft
 * zu hoch oder zu tief, und die Visualisierung weckt falsche Erwartungen.
 */
function proportionHint(config: PlannerConfig): string {
  const parts = ["base units about 60 cm deep with the worktop at about 90 cm and a plinth of about 10-15 cm"];
  if (config.wallCabinets === "oberschraenke") parts.push("wall units about 35 cm deep, hung about 55-60 cm above the worktop");
  if (config.tallUnits > 0) parts.push("tall units about 2.1-2.2 m high");
  return `Use true-to-scale German kitchen proportions: ${parts.join(", ")}; appliances built in flush with the cabinetry.`;
}

/** Der Hauptgrund, warum KI-Bilder unecht wirken: fremdes Licht, Glanz und Kunststoff-Look. */
const PHOTO_REALISM =
  "The result must look like a real, unretouched photograph, not a 3D render: realistic material textures, natural soft shadows and reflections, no CGI look, no oversaturated colours.";

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
        "Keep the existing floor covering and wall colours unless the customer wishes say otherwise; where the old kitchen stood, continue the surrounding wall and floor surfaces seamlessly.",
        dims
          ? `Fit the kitchen realistically along the existing walls (${dims}) without covering windows, doors or radiators.`
          : "Fit the kitchen realistically along the existing walls without covering windows, doors or radiators.",
        proportionHint(config),
        extra,
        `${PHOTO_REALISM} Keep the exposure, white balance and colour temperature of the original photo, as if taken with the same camera in the same light.`,
        "Tidy, with only a few subtle everyday items, sharp details, no people, no text, no watermark.",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  return {
    mode: "text",
    prompt: [
      `Photorealistic wide-angle interior photograph of a brand-new kitchen in a bright, modern German home: ${kitchen}.`,
      dims ? `Room layout: ${dims}.` : "",
      proportionHint(config),
      extra,
      PHOTO_REALISM,
      "Natural daylight from a window, natural colour grading, eye-level camera with a 24 mm lens and straight verticals, calm styling with a few plants and ceramics, no people, no text, no watermark.",
    ]
      .filter(Boolean)
      .join(" "),
  };
}

/** Variante einer fertigen Visualisierung: nur die gewünschte Änderung, alles andere bleibt gleich. */
export function buildVariantPrompt(hint: string): string {
  const change = sanitizeFreeText(hint) || "subtle refinement of materials and light";
  return [
    `Edit this photorealistic kitchen visualization: ${change}.`,
    "Keep everything the request does not mention exactly as it is: room, walls, windows, doors, floor, ceiling, camera position, perspective, lighting and exposure, kitchen layout, cabinet arrangement and appliances.",
    `${PHOTO_REALISM} Correct proportions, no people, no text, no watermark.`,
  ].join(" ");
}
