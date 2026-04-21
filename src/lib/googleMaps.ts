/**
 * Shared Google Maps URL builders.
 */

/** Google Maps directions URL. */
export function getGoogleMapsDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/** Google Maps search URL. */
export function getGoogleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Google Maps nearby search (e.g. "restaurants near Lyon"). */
export function getGoogleMapsNearbyUrl(type: string, location: string): string {
  return `https://www.google.com/maps/search/${type}+near+${encodeURIComponent(location)}`;
}
