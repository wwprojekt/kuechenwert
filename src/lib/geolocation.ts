/**
 * Geolocation utilities for distance calculation and location handling
 */

// Country code to flag emoji mapping
export const countryFlags: Record<string, string> = {
  'DE': '🇩🇪', 'AT': '🇦🇹', 'CH': '🇨🇭', 'NL': '🇳🇱',
  'BE': '🇧🇪', 'FR': '🇫🇷', 'IT': '🇮🇹', 'ES': '🇪🇸',
  'PL': '🇵🇱', 'CZ': '🇨🇿', 'DK': '🇩🇰', 'SE': '🇸🇪',
  'GB': '🇬🇧', 'PT': '🇵🇹', 'LU': '🇱🇺', 'HU': '🇭🇺',
  'NO': '🇳🇴', 'FI': '🇫🇮', 'SK': '🇸🇰', 'SI': '🇸🇮',
  'HR': '🇭🇷', 'RO': '🇷🇴', 'BG': '🇧🇬', 'GR': '🇬🇷',
  'IE': '🇮🇪', 'EE': '🇪🇪', 'LV': '🇱🇻', 'LT': '🇱🇹',
  'MT': '🇲🇹', 'CY': '🇨🇾'
};

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

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param coord1 First coordinate
 * @param coord2 Second coordinate
 * @returns Distance in kilometers
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371; // Earth's radius in kilometers
  
  const lat1Rad = toRadians(coord1.latitude);
  const lat2Rad = toRadians(coord2.latitude);
  const deltaLat = toRadians(coord2.latitude - coord1.latitude);
  const deltaLon = toRadians(coord2.longitude - coord1.longitude);
  
  const a = 
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Format distance for display
 * @param km Distance in kilometers
 * @returns Formatted string (e.g., "25 km" or "1.2 km")
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }
  return `${Math.round(km)} km`;
}

/**
 * Get country flag emoji from country code
 * @param countryCode ISO 2-letter country code
 * @returns Flag emoji or the country code if not found
 */
export function getCountryFlag(countryCode: string | null | undefined): string {
  if (!countryCode) return '';
  return countryFlags[countryCode.toUpperCase()] || countryCode;
}

/**
 * Get country name from country code
 * @param countryCode ISO 2-letter country code
 * @returns Country name in German or the country code if not found
 */
export function getCountryName(countryCode: string | null | undefined): string {
  if (!countryCode) return '';
  return countryNames[countryCode.toUpperCase()] || countryCode;
}

/**
 * Request user's current position
 * @returns Promise with coordinates or null if denied/unavailable
 */
export async function getCurrentPosition(): Promise<Coordinates | null> {
  if (!navigator.geolocation) {
    console.warn('Geolocation is not supported by this browser');
    return null;
  }
  
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        resolve(null);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // Cache for 5 minutes
      }
    );
  });
}
