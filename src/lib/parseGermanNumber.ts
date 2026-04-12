/**
 * Parses German-formatted numbers: "50.000" → 50000, "1.234,56" → 1234.56
 * Mobile users naturally type "50.000" for fifty-thousand.
 * JavaScript's parseFloat("50.000") returns 50 — this function prevents that.
 */
export function parseGermanNumber(raw: string): number {
  if (!raw) return NaN;
  let s = raw.trim();
  if (/^\d+$/.test(s)) return Number(s);
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasDot && !hasComma) {
    const parts = s.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      s = s.replace(/\./g, '');
    }
  } else if (hasComma && !hasDot) {
    s = s.replace(',', '.');
  } else if (hasDot && hasComma) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  return Number(s);
}

/**
 * Strips non-numeric characters (except dots and commas) while user types.
 */
export function formatBidDisplay(raw: string): string {
  return raw.replace(/[^\d.,]/g, '');
}
