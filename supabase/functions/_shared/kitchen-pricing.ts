/**
 * Parametrische Preis-Schätzung für Einbauküchen (Deutschland, Bruttopreise
 * inkl. 19 % MwSt., typische Studio-Endkundenpreise).
 *
 * Die Engine rechnet wie ein Küchenstudio in Laufmetern: Schrankzeile nach
 * Qualitätsstufe × Front-/Griff-/Stilfaktor, Hochschränke je Stück,
 * Arbeitsplatte je Meter, Geräte je Qualitätsstufe, Dienstleistungen als
 * Anteil. Jede Position liefert eine Spanne (min/max); die Summe ist die
 * realistische Marktspanne, nicht ein verbindliches Angebot.
 *
 * Alle Sätze lassen sich über eine Rate-Card (DB-Tabelle
 * kitchen_pricing_rate_cards.overrides) partiell überschreiben.
 */

import {
  APPLIANCES,
  APPLIANCE_LEVELS,
  EXTRAS,
  FRONT_MATERIALS,
  QUALITY_LEVELS,
  SERVICES,
  WORKTOPS,
  effectiveAppliances,
  formById,
  labelOf,
  type ApplianceId,
  type ExtraId,
  type FrontMaterialId,
  type HandleId,
  type PlannerConfig,
  type QualityLevel,
  type RoomInput,
  type SinkId,
  type StyleId,
  type TapId,
  type WorktopId,
} from "./kitchen-catalog.ts";

export type Range = readonly [number, number];
type ByQuality = Record<QualityLevel, Range>;

export interface RateCard {
  cabinetsPerMeter: ByQuality;
  noWallCabinetsFactor: number;
  openShelvesFactor: number;
  tallUnit: ByQuality;
  islandFactor: number;
  frontFactor: Record<FrontMaterialId, number>;
  handleFactor: Record<HandleId, number>;
  styleFactor: Record<StyleId, number>;
  worktopPerMeter: Record<WorktopId, Range>;
  stoneProcessing: Range;
  appliances: Record<ApplianceId, ByQuality>;
  sink: ByQuality;
  sinkMaterialFactor: Record<SinkId, number>;
  tapSurcharge: Record<TapId, Range>;
  extras: Record<Exclude<ExtraId, "innenorganisation" | "nischenrueckwand">, Range>;
  interiorOrganisationShare: Range;
  backsplashPerMeter: Range;
  assemblyShare: Range;
  assemblyMinimum: Range;
  services: { altkueche: Range; elektro: Range; wasser: Range };
  regionalFactorByFirstDigit: Record<string, number>;
  roundingStep: number;
}

export const DEFAULT_RATE_CARD: RateCard = {
  cabinetsPerMeter: {
    budget: [650, 1050],
    mittel: [1150, 1850],
    premium: [2000, 3200],
    luxus: [3600, 6200],
  },
  noWallCabinetsFactor: 0.72,
  openShelvesFactor: 0.8,
  tallUnit: {
    budget: [420, 700],
    mittel: [700, 1150],
    premium: [1150, 1900],
    luxus: [1900, 3200],
  },
  islandFactor: 1.2,
  frontFactor: {
    melamin: 0.92,
    lack_matt: 1.08,
    lack_hochglanz: 1.08,
    fenix: 1.15,
    furnier: 1.22,
    massivholz: 1.38,
    keramik: 1.32,
    beton: 1.2,
    glas: 1.25,
  },
  handleFactor: { grifflos: 1.06, griffleiste: 1, knopf: 1, push: 1.04 },
  styleFactor: {
    modern_grifflos: 1,
    modern: 1,
    skandinavisch: 1,
    landhaus: 1.05,
    industrial: 1.03,
    klassisch: 1.07,
  },
  worktopPerMeter: {
    laminat: [90, 190],
    compact: [260, 460],
    massivholz: [260, 480],
    quarzstein: [480, 880],
    granit: [420, 900],
    keramik: [620, 1150],
    edelstahl: [700, 1300],
  },
  stoneProcessing: [250, 550],
  appliances: {
    backofen: { budget: [350, 600], mittel: [650, 1100], premium: [1100, 1900], luxus: [2200, 4500] },
    dampfgarer: { budget: [650, 900], mittel: [900, 1500], premium: [1500, 2600], luxus: [2800, 5200] },
    mikrowelle: { budget: [200, 350], mittel: [350, 700], premium: [700, 1300], luxus: [1300, 2600] },
    induktion: { budget: [300, 500], mittel: [550, 1000], premium: [1000, 1900], luxus: [2000, 4500] },
    gas: { budget: [300, 500], mittel: [500, 900], premium: [900, 1700], luxus: [2000, 5000] },
    kochfeldabzug: { budget: [1000, 1500], mittel: [1500, 2500], premium: [2400, 3900], luxus: [4000, 7500] },
    haube: { budget: [250, 450], mittel: [450, 900], premium: [900, 1800], luxus: [1800, 4500] },
    geschirrspueler: { budget: [350, 550], mittel: [550, 950], premium: [950, 1600], luxus: [1600, 2800] },
    kuehl: { budget: [450, 700], mittel: [700, 1200], premium: [1200, 2200], luxus: [2600, 6500] },
    side_by_side: { budget: [1400, 2200], mittel: [2200, 3600], premium: [3600, 6500], luxus: [7000, 16000] },
    kaffee: { budget: [900, 1400], mittel: [1400, 2400], premium: [2400, 3600], luxus: [3600, 6200] },
    weinkuehler: { budget: [500, 900], mittel: [900, 1600], premium: [1600, 2800], luxus: [2800, 6000] },
    waermeschublade: { budget: [300, 450], mittel: [450, 800], premium: [800, 1300], luxus: [1300, 2200] },
  },
  sink: { budget: [200, 380], mittel: [380, 800], premium: [800, 1600], luxus: [1500, 3200] },
  sinkMaterialFactor: { edelstahl: 1, granit: 1.1, keramik: 1.25 },
  tapSurcharge: { standard: [0, 0], ausziehbar: [120, 350], kochendwasser: [1100, 2100] },
  extras: {
    led: [300, 900],
    abfall: [150, 420],
    apothekerschrank: [450, 1300],
    eckloesung: [250, 700],
    bar: [400, 1400],
  },
  interiorOrganisationShare: [0.05, 0.1],
  backsplashPerMeter: [120, 380],
  assemblyShare: [0.07, 0.11],
  assemblyMinimum: [650, 950],
  services: { altkueche: [300, 800], elektro: [350, 1400], wasser: [250, 900] },
  regionalFactorByFirstDigit: {
    "0": 0.95,
    "1": 1,
    "2": 1,
    "3": 0.98,
    "4": 0.99,
    "5": 1,
    "6": 1.03,
    "7": 1.04,
    "8": 1.07,
    "9": 0.99,
  },
  roundingStep: 100,
};

/** Tiefe Zusammenführung von Overrides in die Default-Rate-Card. */
export function mergeRateCard(overrides: unknown, base: RateCard = DEFAULT_RATE_CARD): RateCard {
  if (!overrides || typeof overrides !== "object") return base;
  const merge = (target: unknown, patch: unknown): unknown => {
    if (Array.isArray(patch)) {
      return patch.length === 2 && patch.every((n) => typeof n === "number" && Number.isFinite(n))
        ? [Math.min(patch[0], patch[1]), Math.max(patch[0], patch[1])]
        : target;
    }
    if (typeof patch === "number") return Number.isFinite(patch) && patch >= 0 ? patch : target;
    if (patch && typeof patch === "object" && target && typeof target === "object" && !Array.isArray(target)) {
      const out: Record<string, unknown> = { ...(target as Record<string, unknown>) };
      for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
        if (k in out) out[k] = merge(out[k], v);
      }
      return out;
    }
    return target;
  };
  return merge(base, overrides) as RateCard;
}

export interface LayoutMetrics {
  /** Gesamte Schrankzeile an den Wänden in cm (Ecken nur einmal gezählt). */
  runCm: number;
  /** Unterschrank-Laufmeter nach Abzug der Hochschränke. */
  baseRunCm: number;
  islandCm: number;
  worktopCm: number;
  tallUnits: number;
  corners: number;
}

const CORNER_OVERLAP_CM = 60;
const TALL_UNIT_WIDTH_CM = 60;

export function computeLayout(room: RoomInput, tallUnits: number): LayoutMetrics {
  const walls = room.walls;
  const w = (key: string) => Math.max(0, Math.round(walls[key] ?? 0));
  let run = 0;
  let corners = 0;
  let island = 0;
  switch (room.form) {
    case "zeile":
      run = w("a");
      break;
    case "parallel":
      run = w("a") + w("b");
      break;
    case "l":
      run = w("a") + w("b");
      corners = 1;
      break;
    case "u":
      run = w("a") + w("b") + w("c");
      corners = 2;
      break;
    case "g":
      run = w("a") + w("b") + w("c") + w("d");
      corners = 3;
      break;
    case "insel":
      run = w("a") + w("b");
      corners = w("b") > 0 ? 1 : 0;
      island = w("island");
      break;
  }
  run = Math.max(60, run - corners * CORNER_OVERLAP_CM);
  const maxTall = Math.max(0, Math.floor((run - 120) / TALL_UNIT_WIDTH_CM));
  const tall = Math.min(Math.max(0, Math.round(tallUnits)), maxTall);
  const baseRun = Math.max(60, run - tall * TALL_UNIT_WIDTH_CM);
  return {
    runCm: run,
    baseRunCm: baseRun,
    islandCm: island,
    worktopCm: baseRun + island,
    tallUnits: tall,
    corners,
  };
}

export type EstimateGroup = "moebel" | "arbeitsplatte" | "geraete" | "spuele" | "extras" | "service";

export interface EstimateLine {
  id: string;
  group: EstimateGroup;
  label: string;
  detail?: string;
  min: number;
  max: number;
}

export interface KitchenEstimate {
  currency: "EUR";
  min: number;
  max: number;
  mid: number;
  lines: EstimateLine[];
  layout: LayoutMetrics;
  regionalFactor: number;
  rateCardVersion?: number | null;
  assumptions: string[];
}

const scale = (r: Range, f: number): Range => [r[0] * f, r[1] * f];
const add = (a: Range, b: Range): Range => [a[0] + b[0], a[1] + b[1]];
const meters = (cm: number) => cm / 100;
const fmtMeters = (cm: number) => `${(cm / 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} m`;

export function regionalFactor(postalCode: string | null | undefined, card: RateCard = DEFAULT_RATE_CARD): number {
  const first = (postalCode ?? "").trim().charAt(0);
  return card.regionalFactorByFirstDigit[first] ?? 1;
}

export function estimateKitchenPrice(
  config: PlannerConfig,
  room: RoomInput,
  options: { card?: RateCard; postalCode?: string | null; rateCardVersion?: number | null } = {},
): KitchenEstimate {
  const card = options.card ?? DEFAULT_RATE_CARD;
  const layout = computeLayout(room, config.tallUnits);
  const lines: EstimateLine[] = [];
  const q = config.quality;

  const furnitureFactor =
    card.frontFactor[config.front] * card.handleFactor[config.handle] * card.styleFactor[config.style];
  const wallFactor =
    config.wallCabinets === "keine"
      ? card.noWallCabinetsFactor
      : config.wallCabinets === "regale"
        ? card.openShelvesFactor
        : 1;

  const cabinets = scale(card.cabinetsPerMeter[q], meters(layout.baseRunCm) * furnitureFactor * wallFactor);
  lines.push({
    id: "schraenke",
    group: "moebel",
    label: `Küchenmöbel ${labelOf(QUALITY_LEVELS, q)}`,
    detail: `${fmtMeters(layout.baseRunCm)} Schrankzeile, ${labelOf(FRONT_MATERIALS, config.front)}`,
    min: cabinets[0],
    max: cabinets[1],
  });

  let furnitureTotal: Range = cabinets;
  if (layout.tallUnits > 0) {
    const tall = scale(card.tallUnit[q], layout.tallUnits * furnitureFactor);
    furnitureTotal = add(furnitureTotal, tall);
    lines.push({
      id: "hochschraenke",
      group: "moebel",
      label: "Hochschränke",
      detail: `${layout.tallUnits} × 60 cm (Geräte- & Vorratsschränke)`,
      min: tall[0],
      max: tall[1],
    });
  }
  if (layout.islandCm > 0) {
    const island = scale(card.cabinetsPerMeter[q], meters(layout.islandCm) * card.islandFactor * furnitureFactor);
    furnitureTotal = add(furnitureTotal, island);
    lines.push({
      id: "insel",
      group: "moebel",
      label: "Kochinsel",
      detail: `${fmtMeters(layout.islandCm)} inkl. Rückwand & Seitenblenden`,
      min: island[0],
      max: island[1],
    });
  }

  const worktop = scale(card.worktopPerMeter[config.worktop], meters(layout.worktopCm));
  lines.push({
    id: "arbeitsplatte",
    group: "arbeitsplatte",
    label: `Arbeitsplatte ${labelOf(WORKTOPS, config.worktop)}`,
    detail: fmtMeters(layout.worktopCm),
    min: worktop[0],
    max: worktop[1],
  });
  let worktopTotal: Range = worktop;
  if (config.worktop === "quarzstein" || config.worktop === "granit" || config.worktop === "keramik") {
    worktopTotal = add(worktopTotal, card.stoneProcessing);
    lines.push({
      id: "steinbearbeitung",
      group: "arbeitsplatte",
      label: "Aufmaß, Ausschnitte & Kanten",
      detail: "Naturstein-/Keramikbearbeitung",
      min: card.stoneProcessing[0],
      max: card.stoneProcessing[1],
    });
  }

  let appliancesTotal: Range = [0, 0];
  for (const id of effectiveAppliances(config.appliances)) {
    const r = card.appliances[id][config.applianceLevel];
    appliancesTotal = add(appliancesTotal, r);
    lines.push({
      id: `geraet_${id}`,
      group: "geraete",
      label: labelOf(APPLIANCES, id),
      detail: labelOf(APPLIANCE_LEVELS, config.applianceLevel),
      min: r[0],
      max: r[1],
    });
  }

  const sink = add(scale(card.sink[q], card.sinkMaterialFactor[config.sink]), card.tapSurcharge[config.tap]);
  lines.push({
    id: "spuele",
    group: "spuele",
    label: "Spüle & Armatur",
    min: sink[0],
    max: sink[1],
  });

  for (const id of config.extras) {
    let r: Range;
    let detail: string | undefined;
    if (id === "innenorganisation") {
      r = [furnitureTotal[0] * card.interiorOrganisationShare[0], furnitureTotal[1] * card.interiorOrganisationShare[1]];
    } else if (id === "nischenrueckwand") {
      r = scale(card.backsplashPerMeter, meters(layout.baseRunCm));
      detail = fmtMeters(layout.baseRunCm);
    } else {
      r = card.extras[id];
    }
    lines.push({ id: `extra_${id}`, group: "extras", label: labelOf(EXTRAS, id), detail, min: r[0], max: r[1] });
  }

  if (config.services.includes("lieferung_montage")) {
    const base = add(add(furnitureTotal, worktopTotal), appliancesTotal);
    const r: Range = [
      Math.max(card.assemblyMinimum[0], base[0] * card.assemblyShare[0]),
      Math.max(card.assemblyMinimum[1], base[1] * card.assemblyShare[1]),
    ];
    lines.push({ id: "montage", group: "service", label: labelOf(SERVICES, "lieferung_montage"), min: r[0], max: r[1] });
  }
  for (const id of ["altkueche", "elektro", "wasser"] as const) {
    if (config.services.includes(id)) {
      const r = card.services[id];
      lines.push({ id: `service_${id}`, group: "service", label: labelOf(SERVICES, id), min: r[0], max: r[1] });
    }
  }

  const factor = regionalFactor(options.postalCode, card);
  const step = Math.max(1, card.roundingStep);
  const round = (n: number) => Math.round(n / step) * step;
  const rounded = lines.map((l) => ({
    ...l,
    min: Math.round(l.min * factor),
    max: Math.round(l.max * factor),
  }));
  const min = round(rounded.reduce((s, l) => s + l.min, 0));
  const max = round(rounded.reduce((s, l) => s + l.max, 0));
  const mid = round(Math.sqrt(Math.max(1, min) * Math.max(1, max)));

  const assumptions = [
    "Bruttopreise inkl. 19 % MwSt., typische Endkundenpreise deutscher Küchenstudios",
    `Schrankzeile ${fmtMeters(layout.runCm)} (Ecken einfach gezählt), davon ${fmtMeters(layout.baseRunCm)} Unterschränke`,
  ];
  if (factor !== 1) {
    assumptions.push(`Regionales Preisniveau berücksichtigt (Faktor ${factor.toLocaleString("de-DE")})`);
  }
  if (!config.services.includes("lieferung_montage")) {
    assumptions.push("Ohne Lieferung und Montage");
  }

  return {
    currency: "EUR",
    min,
    max,
    mid,
    lines: rounded,
    layout,
    regionalFactor: factor,
    rateCardVersion: options.rateCardVersion ?? null,
    assumptions,
  };
}

/** Kurzbeschreibung der Maße, z. B. "L-Küche 3,0 m × 2,4 m". */
export function describeRoom(room: RoomInput): string {
  const def = formById(room.form);
  const parts = (def?.walls ?? [])
    .map((w) => room.walls[w.key] ?? 0)
    .filter((cm) => cm > 0)
    .map((cm) => (cm / 100).toLocaleString("de-DE", { maximumFractionDigits: 1 }));
  return `${def?.label ?? room.form} ${parts.join(" m × ")} m`;
}
