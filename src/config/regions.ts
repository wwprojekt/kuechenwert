export interface RegionConfig {
  id: string;
  label: string;
  plzRanges: [number, number][];
}

export const REGIONS: RegionConfig[] = [
  { id: "nord", label: "Norddeutschland", plzRanges: [[20000, 29999]] },
  { id: "ost", label: "Ostdeutschland", plzRanges: [[1000, 9999], [10000, 16999], [39000, 39999]] },
  { id: "west", label: "Westdeutschland", plzRanges: [[30000, 38999], [40000, 59999]] },
  { id: "sued", label: "Süddeutschland", plzRanges: [[60000, 99999]] },
];

export function getRegionByPlz(plz: string): RegionConfig | null {
  const num = parseInt(plz, 10);
  if (isNaN(num)) return null;
  return REGIONS.find((r) => r.plzRanges.some(([min, max]) => num >= min && num <= max)) ?? null;
}

export const DEFAULT_SEARCH_RADIUS_KM = 50;
