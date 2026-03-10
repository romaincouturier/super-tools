/**
 * Shared Google Maps URL builders.
 */

/** Google Maps place page URL. */
export function getGoogleMapsPlaceUrl(address: string): string {
  return `https://maps.google.com/maps/place/${address.replace(/ /g, "+")}`;
}

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

/** Google Maps embed URL (requires API key). */
export function getGoogleMapsEmbedUrl(address: string, apiKey: string): string {
  return `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(address)}`;
}
