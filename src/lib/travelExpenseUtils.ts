import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TravelSettings {
  vehicleHp: number;
  departureAddress: string;
  departureLat: number | null;
  departureLon: number | null;
  parkingRate: number;
  nightRate: number;
  lunchRate: number;
  dinnerRate: number;
  breakfastRate: number;
  trainLoyaltyPerTrip: number;
}

export interface TravelDestination {
  id: string;
  city: string;
  lat: number | null;
  lon: number | null;
  transportMode: "train" | "car" | "plane" | "taxi" | "other";
  roundTrips: number;
  days: number;
  nights: number;
  distanceKm: number;
  tollCostOneWay: number;
  durationHours: number;
  ticketPriceRoundTrip: number;
  isFetchingDistance: boolean;
}

export interface FavoriteDestination {
  city: string;
  lat: number | null;
  lon: number | null;
  transportMode: TravelDestination["transportMode"];
  roundTrips: number;
  days: number;
  nights: number;
  ticketPriceRoundTrip: number;
}

export interface GeoResult {
  display_name: string;
  lat: string;
  lon: string;
}

// ---------------------------------------------------------------------------
// IK barème 2024
// ---------------------------------------------------------------------------

export const IK_RATES: Record<number, { perKm: number; label: string }> = {
  3: { perKm: 0.529, label: "3 CV et moins" },
  4: { perKm: 0.606, label: "4 CV" },
  5: { perKm: 0.636, label: "5 CV" },
  6: { perKm: 0.665, label: "6 CV" },
  7: { perKm: 0.697, label: "7 CV et plus" },
};

export const TOLL_ESTIMATE_PER_KM = 0.09;

// ---------------------------------------------------------------------------
// Storage keys & persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = "crm-travel-settings";
const DESTINATIONS_STORAGE_KEY = "crm-travel-destinations";
const FAVORITES_KEY = "crm-travel-favorites";

export const DEFAULT_SETTINGS: TravelSettings = {
  vehicleHp: 5,
  departureAddress: "",
  departureLat: null,
  departureLon: null,
  parkingRate: 15,
  nightRate: 70,
  lunchRate: 20.70,
  dinnerRate: 20.70,
  breakfastRate: 10,
  trainLoyaltyPerTrip: 5,
};

export function loadFavorites(): FavoriteDestination[] {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

export function saveFavorites(favs: FavoriteDestination[]) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  } catch {}
}

export function loadSettings(): TravelSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: TravelSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

export function loadDestinations(): TravelDestination[] | null {
  try {
    const stored = localStorage.getItem(DESTINATIONS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as TravelDestination[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((d) => ({ ...d, isFetchingDistance: false, id: createDestId() }));
      }
    }
  } catch {}
  return null;
}

export function saveDestinations(dests: TravelDestination[]) {
  try {
    localStorage.setItem(DESTINATIONS_STORAGE_KEY, JSON.stringify(dests));
  } catch {}
}

// ---------------------------------------------------------------------------
// Destination helpers
// ---------------------------------------------------------------------------

let destCounter = 0;
export const createDestId = () => `dest_${Date.now()}_${++destCounter}`;

export const emptyDestination = (): TravelDestination => ({
  id: createDestId(),
  city: "",
  lat: null,
  lon: null,
  transportMode: "train",
  roundTrips: 1,
  days: 1,
  nights: 0,
  distanceKm: 0,
  tollCostOneWay: 0,
  durationHours: 0,
  ticketPriceRoundTrip: 0,
  isFetchingDistance: false,
});

export const formatEur = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function destToFavorite(dest: TravelDestination): FavoriteDestination {
  return {
    city: dest.city.trim(),
    lat: dest.lat,
    lon: dest.lon,
    transportMode: dest.transportMode,
    roundTrips: dest.roundTrips,
    days: dest.days,
    nights: dest.nights,
    ticketPriceRoundTrip: dest.ticketPriceRoundTrip,
  };
}

export function favoriteToDestination(fav: FavoriteDestination): TravelDestination {
  return {
    ...emptyDestination(),
    city: fav.city,
    lat: fav.lat,
    lon: fav.lon,
    transportMode: fav.transportMode,
    roundTrips: fav.roundTrips,
    days: fav.days,
    nights: fav.nights,
    ticketPriceRoundTrip: fav.ticketPriceRoundTrip,
  };
}

// ---------------------------------------------------------------------------
// Geocoding (Nominatim)
// ---------------------------------------------------------------------------

export async function geocode(query: string): Promise<GeoResult[]> {
  if (query.length < 2) return [];
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
    q: query,
    format: "json",
    countrycodes: "fr",
    limit: "5",
  })}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "SuperTools-TravelCalc/1.0" },
  });
  if (!res.ok) return [];
  return res.json();
}

// ---------------------------------------------------------------------------
// Distance (Google Routes → OSRM fallback)
// ---------------------------------------------------------------------------

export async function fetchRoute(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): Promise<{ distanceKm: number; durationHours: number; tollCostEur: number } | null> {
  try {
    const { data, error } = await supabase.functions.invoke("google-routes", {
      body: { originLat: fromLat, originLon: fromLon, destLat: toLat, destLon: toLon },
    });
    if (error || !data || data.error) {
      // Fallback to OSRM
      const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=false`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const osrmData = await res.json();
      if (osrmData.routes?.length > 0) {
        const distanceKm = Math.round(osrmData.routes[0].distance / 1000);
        return {
          distanceKm,
          durationHours: +(osrmData.routes[0].duration / 3600).toFixed(1),
          tollCostEur: Math.round(distanceKm * TOLL_ESTIMATE_PER_KM),
        };
      }
      return null;
    }
    return {
      distanceKm: data.distanceKm,
      durationHours: data.durationHours,
      tollCostEur: data.tollCostEur,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cost calculations
// ---------------------------------------------------------------------------

export interface DestinationCost {
  transportCost: number;
  parkingCost: number;
  loyaltyCost: number;
  nightsCost: number;
  mealsCost: number;
  total: number;
}

export function calcDestinationCost(dest: TravelDestination, settings: TravelSettings): DestinationCost {
  const ikRate = IK_RATES[settings.vehicleHp]?.perKm ?? IK_RATES[5].perKm;

  let transportCost = 0;
  let parkingCost = 0;
  let loyaltyCost = 0;

  switch (dest.transportMode) {
    case "car":
      transportCost =
        dest.distanceKm * 2 * ikRate * dest.roundTrips +
        dest.tollCostOneWay * 2 * dest.roundTrips;
      break;
    case "train":
      transportCost = dest.ticketPriceRoundTrip * dest.roundTrips;
      parkingCost = settings.parkingRate * (dest.nights + 1) * dest.roundTrips;
      loyaltyCost = settings.trainLoyaltyPerTrip * dest.roundTrips;
      break;
    case "plane":
    case "taxi":
    case "other":
      transportCost = dest.ticketPriceRoundTrip * dest.roundTrips;
      break;
  }

  const nightsCost = dest.nights * settings.nightRate;
  const mealsCost =
    dest.days * settings.lunchRate +
    dest.nights * settings.dinnerRate +
    dest.nights * settings.breakfastRate;

  return {
    transportCost,
    parkingCost,
    loyaltyCost,
    nightsCost,
    mealsCost,
    total: transportCost + parkingCost + loyaltyCost + nightsCost + mealsCost,
  };
}
