import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Car,
  CarTaxiFront,
  ArrowRight,
  SkipForward,
  Plus,
  Trash2,
  Settings2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Train,
  Plane,
  Navigation,
  Loader2,
  Star,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type {
  TravelDestination,
  TravelSettings,
} from "@/components/crm/TravelExpenseCalculator";

// ---------------------------------------------------------------------------
// Constants & helpers (duplicated from TravelExpenseCalculator for inline use)
// ---------------------------------------------------------------------------

const IK_RATES: Record<number, { perKm: number; label: string }> = {
  3: { perKm: 0.529, label: "3 CV et moins" },
  4: { perKm: 0.606, label: "4 CV" },
  5: { perKm: 0.636, label: "5 CV" },
  6: { perKm: 0.665, label: "6 CV" },
  7: { perKm: 0.697, label: "7 CV et plus" },
};

const TOLL_ESTIMATE_PER_KM = 0.09;
const STORAGE_KEY = "crm-travel-settings";
const FAVORITES_KEY = "crm-travel-favorites";

interface FavoriteDestination {
  city: string;
  lat: number | null;
  lon: number | null;
  transportMode: TravelDestination["transportMode"];
  roundTrips: number;
  days: number;
  nights: number;
  ticketPriceRoundTrip: number;
}

function loadFavorites(): FavoriteDestination[] {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function saveFavorites(favs: FavoriteDestination[]) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  } catch {}
}

const DEFAULT_SETTINGS: TravelSettings = {
  vehicleHp: 5,
  departureAddress: "",
  departureLat: null,
  departureLon: null,
  parkingRate: 15,
  nightRate: 70,
  lunchRate: 20.7,
  dinnerRate: 20.7,
  breakfastRate: 10,
  trainLoyaltyPerTrip: 5,
};

let destCounter = 0;
const createDestId = () => `dest_${Date.now()}_${++destCounter}`;

const emptyDestination = (): TravelDestination => ({
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

const formatEur = (n: number) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function loadSettings(): TravelSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: TravelSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

interface GeoResult {
  display_name: string;
  lat: string;
  lon: string;
}

async function geocode(query: string): Promise<GeoResult[]> {
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
// Route fetching
// ---------------------------------------------------------------------------

async function fetchRoute(
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
// Cost calculation
// ---------------------------------------------------------------------------

function calcDestinationCost(dest: TravelDestination, settings: TravelSettings) {
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

// ---------------------------------------------------------------------------
// CityAutocomplete
// ---------------------------------------------------------------------------

function CityAutocomplete({
  value,
  onSelect,
  placeholder,
  className,
}: {
  value: string;
  onSelect: (name: string, lat: number, lon: number) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      const r = await geocode(text);
      setResults(r);
      setShowDropdown(r.length > 0);
      setIsLoading(false);
    }, 400);
  }, []);

  const handleSelect = (r: GeoResult) => {
    const shortName = r.display_name.split(",")[0].trim();
    setQuery(shortName);
    setShowDropdown(false);
    onSelect(shortName, parseFloat(r.lat), parseFloat(r.lon));
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-sm pr-7"
        />
        {isLoading && (
          <Loader2 className="absolute right-2 top-2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={i}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent truncate"
              onClick={() => handleSelect(r)}
            >
              <MapPin className="h-3 w-3 inline mr-1 text-muted-foreground" />
              {r.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Google Maps Embed
// ---------------------------------------------------------------------------

function GoogleMapsEmbed({
  departure,
  destinations,
}: {
  departure: { lat: number | null; lon: number | null; address: string };
  destinations: TravelDestination[];
}) {
  const validDests = destinations.filter((d) => d.lat != null && d.lon != null);
  if (!departure.lat || !departure.lon || validDests.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 h-[250px] flex items-center justify-center text-sm text-muted-foreground">
        <MapPin className="w-4 h-4 mr-2" />
        Sélectionnez un départ et une destination pour afficher la carte
      </div>
    );
  }

  // Build Google Maps embed URL with directions
  const origin = `${departure.lat},${departure.lon}`;
  const destination = `${validDests[validDests.length - 1].lat},${validDests[validDests.length - 1].lon}`;
  const waypoints = validDests
    .slice(0, -1)
    .map((d) => `${d.lat},${d.lon}`)
    .join("|");

  const params = new URLSearchParams({
    origin,
    destination,
    ...(waypoints ? { waypoints } : {}),
  });

  const embedUrl = `https://www.google.com/maps/embed/v1/directions?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&${params.toString()}&mode=driving`;

  return (
    <div className="rounded-lg border overflow-hidden h-[250px]">
      <iframe
        src={embedUrl}
        className="w-full h-full border-0"
        allowFullScreen
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title="Carte du trajet"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Transport icon
// ---------------------------------------------------------------------------

function TransportIcon({ mode }: { mode: TravelDestination["transportMode"] }) {
  switch (mode) {
    case "car":
      return <Car className="h-3.5 w-3.5" />;
    case "train":
      return <Train className="h-3.5 w-3.5" />;
    case "plane":
      return <Plane className="h-3.5 w-3.5" />;
    case "taxi":
      return <CarTaxiFront className="h-3.5 w-3.5" />;
    default:
      return <Navigation className="h-3.5 w-3.5" />;
  }
}

// ---------------------------------------------------------------------------
// Main component — INLINE (no modal)
// ---------------------------------------------------------------------------

interface Props {
  onContinue: (travelTotal: number, destinations: TravelDestination[], settings: TravelSettings | null) => void;
  initialTotal?: number;
  initialDestinations?: TravelDestination[];
  initialSettings?: TravelSettings | null;
}

export default function StepTravelExpenses({
  onContinue,
  initialTotal = 0,
  initialDestinations,
  initialSettings,
}: Props) {
  const [settings, setSettings] = useState<TravelSettings>(
    initialSettings ?? loadSettings()
  );
  const [destinations, setDestinations] = useState<TravelDestination[]>(
    initialDestinations?.length ? initialDestinations : [emptyDestination()]
  );
  const [settingsOpen, setSettingsOpen] = useState(!settings.departureAddress);
  const [favorites, setFavorites] = useState<FavoriteDestination[]>(loadFavorites);

  const addFavorite = (dest: TravelDestination) => {
    if (!dest.city.trim()) return;
    const fav: FavoriteDestination = {
      city: dest.city,
      lat: dest.lat,
      lon: dest.lon,
      transportMode: dest.transportMode,
      roundTrips: dest.roundTrips,
      days: dest.days,
      nights: dest.nights,
      ticketPriceRoundTrip: dest.ticketPriceRoundTrip,
    };
    const updated = [...favorites.filter((f) => f.city !== fav.city), fav];
    setFavorites(updated);
    saveFavorites(updated);
  };

  const removeFavorite = (city: string) => {
    const updated = favorites.filter((f) => f.city !== city);
    setFavorites(updated);
    saveFavorites(updated);
  };

  const applyFavorite = (fav: FavoriteDestination) => {
    const newDest: TravelDestination = {
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
    setDestinations((prev) => [...prev, newDest]);
    if (fav.transportMode === "car" && fav.lat != null && fav.lon != null) {
      autoFetchDistance(newDest.id, fav.lat, fav.lon);
    }
  };

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSetting = <K extends keyof TravelSettings>(key: K, value: TravelSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const addDestination = () => setDestinations((prev) => [...prev, emptyDestination()]);

  const removeDestination = (id: string) => {
    setDestinations((prev) => (prev.length <= 1 ? prev : prev.filter((d) => d.id !== id)));
  };

  const updateDest = (id: string, updates: Partial<TravelDestination>) => {
    setDestinations((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );
  };

  const autoFetchDistance = useCallback(
    async (destId: string, destLat: number, destLon: number) => {
      if (settings.departureLat == null || settings.departureLon == null) return;
      updateDest(destId, { isFetchingDistance: true });
      const result = await fetchRoute(
        settings.departureLat,
        settings.departureLon,
        destLat,
        destLon
      );
      if (result) {
        updateDest(destId, {
          distanceKm: result.distanceKm,
          tollCostOneWay: result.tollCostEur,
          durationHours: result.durationHours,
          isFetchingDistance: false,
        });
      } else {
        updateDest(destId, { isFetchingDistance: false });
      }
    },
    [settings.departureLat, settings.departureLon]
  );

  const handleCitySelect = (destId: string, name: string, lat: number, lon: number) => {
    const dest = destinations.find((d) => d.id === destId);
    updateDest(destId, { city: name, lat, lon });
    if (dest?.transportMode === "car") {
      autoFetchDistance(destId, lat, lon);
    }
  };

  const handleModeChange = (destId: string, mode: TravelDestination["transportMode"]) => {
    const dest = destinations.find((d) => d.id === destId);
    updateDest(destId, { transportMode: mode });
    if (mode === "car" && dest?.lat != null && dest?.lon != null) {
      autoFetchDistance(destId, dest.lat, dest.lon);
    }
  };

  const destCosts = useMemo(
    () => destinations.map((d) => ({ id: d.id, ...calcDestinationCost(d, settings) })),
    [destinations, settings]
  );

  const grandTotal = useMemo(() => destCosts.reduce((sum, c) => sum + c.total, 0), [destCosts]);

  const ikRate = IK_RATES[settings.vehicleHp]?.perKm ?? IK_RATES[5].perKm;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="w-5 h-5" />
            Frais de déplacement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Car className="w-4 h-4" />
            <AlertDescription>
              Estimez les frais de déplacement pour cette prestation. Ils pourront être intégrés au devis.
            </AlertDescription>
          </Alert>

          {/* Google Maps preview */}
          <GoogleMapsEmbed
            departure={{
              lat: settings.departureLat,
              lon: settings.departureLon,
              address: settings.departureAddress,
            }}
            destinations={destinations}
          />

          {/* Settings collapsible */}
          <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-xs font-medium text-muted-foreground hover:text-foreground">
                <span className="flex items-center gap-1.5">
                  <Settings2 className="h-3.5 w-3.5" />
                  Paramètres
                  {settings.departureAddress && (
                    <span className="text-foreground ml-1">— {settings.departureAddress}, {IK_RATES[settings.vehicleHp]?.label}</span>
                  )}
                </span>
                {settingsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="rounded-lg border p-4 space-y-4 bg-muted/30">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1 space-y-1">
                    <Label className="text-xs">Adresse de départ</Label>
                    <CityAutocomplete
                      value={settings.departureAddress}
                      placeholder="Ex: Lyon, Bordeaux…"
                      onSelect={(name, lat, lon) => {
                        updateSetting("departureAddress", name);
                        updateSetting("departureLat", lat);
                        updateSetting("departureLon", lon);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Puissance fiscale</Label>
                    <Select
                      value={String(settings.vehicleHp)}
                      onValueChange={(v) => updateSetting("vehicleHp", parseInt(v))}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(IK_RATES).map(([hp, { label, perKm }]) => (
                          <SelectItem key={hp} value={hp}>
                            {label} — {perKm} €/km
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nuit (€)</Label>
                    <Input type="number" min="0" step="1" value={settings.nightRate || ""} onChange={(e) => updateSetting("nightRate", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Parking (€/j)</Label>
                    <Input type="number" min="0" step="0.5" value={settings.parkingRate || ""} onChange={(e) => updateSetting("parkingRate", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Déjeuner (€)</Label>
                    <Input type="number" min="0" step="0.1" value={settings.lunchRate || ""} onChange={(e) => updateSetting("lunchRate", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dîner (€)</Label>
                    <Input type="number" min="0" step="0.1" value={settings.dinnerRate || ""} onChange={(e) => updateSetting("dinnerRate", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Petit-déj (€)</Label>
                    <Input type="number" min="0" step="0.1" value={settings.breakfastRate || ""} onChange={(e) => updateSetting("breakfastRate", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Fidélité (€/trajet)</Label>
                    <Input type="number" min="0" step="0.5" value={settings.trainLoyaltyPerTrip || ""} onChange={(e) => updateSetting("trainLoyaltyPerTrip", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Barème IK 2024. Distances via Google Routes API. Paramètres sauvegardés localement.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Favorites */}
          {favorites.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Star className="h-3 w-3" />
                Destinations favorites
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {favorites.map((fav) => (
                  <button
                    key={fav.city}
                    type="button"
                    onClick={() => applyFavorite(fav)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-background text-xs hover:bg-accent transition-colors group"
                  >
                    <TransportIcon mode={fav.transportMode} />
                    {fav.city}
                    <span
                      role="button"
                      onClick={(e) => { e.stopPropagation(); removeFavorite(fav.city); }}
                      className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Destinations */}
          <div className="space-y-3">
            <div className="text-xs font-medium text-muted-foreground">Destinations</div>

            {destinations.map((dest, idx) => {
              const costs = destCosts.find((c) => c.id === dest.id);
              return (
                <div key={dest.id} className="rounded-lg border p-3 space-y-2 bg-background">
                  <div className="grid grid-cols-[1fr_120px_70px_70px_70px_68px] gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">
                        Destination {destinations.length > 1 ? `#${idx + 1}` : ""}
                      </Label>
                      <CityAutocomplete
                        value={dest.city}
                        placeholder="Ville de destination"
                        onSelect={(name, lat, lon) => handleCitySelect(dest.id, name, lat, lon)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Transport</Label>
                      <Select
                        value={dest.transportMode}
                        onValueChange={(v) => handleModeChange(dest.id, v as TravelDestination["transportMode"])}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="train"><span className="flex items-center gap-1.5"><Train className="h-3.5 w-3.5" /> Train</span></SelectItem>
                          <SelectItem value="car"><span className="flex items-center gap-1.5"><Car className="h-3.5 w-3.5" /> Voiture</span></SelectItem>
                          <SelectItem value="plane"><span className="flex items-center gap-1.5"><Plane className="h-3.5 w-3.5" /> Avion</span></SelectItem>
                          <SelectItem value="taxi"><span className="flex items-center gap-1.5"><CarTaxiFront className="h-3.5 w-3.5" /> Taxi</span></SelectItem>
                          <SelectItem value="other"><span className="flex items-center gap-1.5"><Navigation className="h-3.5 w-3.5" /> Autre</span></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">A/R</Label>
                      <Input type="number" min="1" step="1" value={dest.roundTrips || ""} onChange={(e) => updateDest(dest.id, { roundTrips: parseInt(e.target.value) || 1 })} className="h-8 text-sm text-right" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Jours</Label>
                      <Input type="number" min="0" step="1" value={dest.days || ""} onChange={(e) => updateDest(dest.id, { days: parseInt(e.target.value) || 0 })} className="h-8 text-sm text-right" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Nuits</Label>
                      <Input type="number" min="0" step="1" value={dest.nights || ""} onChange={(e) => updateDest(dest.id, { nights: parseInt(e.target.value) || 0 })} className="h-8 text-sm text-right" />
                    </div>
                    <div className="flex gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn("h-8 w-8", favorites.some((f) => f.city === dest.city) ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500")}
                        onClick={() => addFavorite(dest)}
                        disabled={!dest.city.trim()}
                        title="Ajouter aux favoris"
                      >
                        <Star className={cn("h-3.5 w-3.5", favorites.some((f) => f.city === dest.city) && "fill-current")} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeDestination(dest.id)} disabled={destinations.length <= 1}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Mode-specific fields */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {dest.transportMode === "car" && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Distance (km, aller)</Label>
                          <div className="relative">
                            <Input type="number" min="0" value={dest.distanceKm || ""} onChange={(e) => updateDest(dest.id, { distanceKm: parseFloat(e.target.value) || 0 })} className="h-7 w-24 text-xs text-right" />
                            {dest.isFetchingDistance && <Loader2 className="absolute right-2 top-1.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Péages (€, aller)</Label>
                          <Input type="number" min="0" value={dest.tollCostOneWay || ""} onChange={(e) => updateDest(dest.id, { tollCostOneWay: parseFloat(e.target.value) || 0 })} className="h-7 w-24 text-xs text-right" />
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          IK : {formatEur(dest.distanceKm * 2 * ikRate * dest.roundTrips)} €
                        </span>
                        {dest.durationHours > 0 && (
                          <span className="text-[10px] text-muted-foreground">🕐 {dest.durationHours} h</span>
                        )}
                      </>
                    )}
                    {(dest.transportMode === "train" || dest.transportMode === "plane" || dest.transportMode === "taxi" || dest.transportMode === "other") && (
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {dest.transportMode === "taxi" ? "Course A/R (€)" : dest.transportMode === "other" ? "Coût A/R (€)" : "Billet A/R (€)"}
                        </Label>
                        <Input type="number" min="0" value={dest.ticketPriceRoundTrip || ""} onChange={(e) => updateDest(dest.id, { ticketPriceRoundTrip: parseFloat(e.target.value) || 0 })} className="h-7 w-24 text-xs text-right" />
                      </div>
                    )}
                  </div>

                  {/* Cost breakdown */}
                  {costs && costs.total > 0 && (
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground border-t pt-1.5 flex-wrap">
                      {costs.transportCost > 0 && <span className="flex items-center gap-0.5"><TransportIcon mode={dest.transportMode} /> {formatEur(costs.transportCost)} €</span>}
                      {costs.parkingCost > 0 && <span>Parking : {formatEur(costs.parkingCost)} €</span>}
                      {costs.loyaltyCost > 0 && <span>Carte : {formatEur(costs.loyaltyCost)} €</span>}
                      {costs.nightsCost > 0 && <span>Nuits : {formatEur(costs.nightsCost)} €</span>}
                      {costs.mealsCost > 0 && <span>Repas : {formatEur(costs.mealsCost)} €</span>}
                      <span className="ml-auto font-semibold text-foreground text-xs">{formatEur(costs.total)} €</span>
                    </div>
                  )}
                </div>
              );
            })}

            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={addDestination}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Ajouter une destination
            </Button>
          </div>

          {/* Total */}
          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Total frais de déplacement</span>
              <span className="text-lg font-bold text-primary">{formatEur(grandTotal)} €</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="ghost"
          onClick={() => onContinue(0, [], null)}
          className="gap-2 text-muted-foreground"
        >
          <SkipForward className="w-4 h-4" />
          Passer cette étape
        </Button>
        <Button
          onClick={() => onContinue(grandTotal, destinations, settings)}
          size="lg"
          className="gap-2"
        >
          Continuer
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
