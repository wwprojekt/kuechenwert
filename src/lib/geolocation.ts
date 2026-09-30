/**
 * Ländernamen für die Anzeige von Länderkürzeln (z. B. Studio-Sitz).
 */

// Country code to name mapping (German)
export const countryNames: Record<string, string> = {
  'DE': 'Deutschland', 'AT': 'Österreich', 'CH': 'Schweiz', 'NL': 'Niederlande',
  'BE': 'Belgien', 'FR': 'Frankreich', 'IT': 'Italien', 'ES': 'Spanien',
  'PL': 'Polen', 'CZ': 'Tschechien', 'DK': 'Dänemark', 'SE': 'Schweden',
  'GB': 'Großbritannien', 'PT': 'Portugal', 'LU': 'Luxemburg', 'HU': 'Ungarn',
  'NO': 'Norwegen', 'FI': 'Finnland', 'SK': 'Slowakei', 'SI': 'Slowenien',
  'HR': 'Kroatien', 'RO': 'Rumänien', 'BG': 'Bulgarien', 'GR': 'Griechenland',
  'IE': 'Irland', 'EE': 'Estland', 'LV': 'Lettland', 'LT': 'Litauen',
  'MT': 'Malta', 'CY': 'Zypern'
};

/**
 * Get country name from country code
 * @param countryCode ISO 2-letter country code
 * @returns Country name in German or the country code if not found
 */
export function getCountryName(countryCode: string | null | undefined): string {
  if (!countryCode) return '';
  return countryNames[countryCode.toUpperCase()] || countryCode;
}
