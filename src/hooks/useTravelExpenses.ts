import { useState, useEffect, useCallback, useMemo } from "react";
import {
  type TravelSettings,
  type TravelDestination,
  type FavoriteDestination,
  IK_RATES,
  loadSettings,
  saveSettings,
  loadFavorites,
  saveFavorites,
  loadDestinations,
  saveDestinations,
  emptyDestination,
  destToFavorite,
  favoriteToDestination,
  fetchRoute,
  calcDestinationCost,
} from "@/lib/travelExpenseUtils";

interface UseTravelExpensesOptions {
  initialSettings?: TravelSettings | null;
  initialDestinations?: TravelDestination[];
  autoSave?: boolean;
}

export function useTravelExpenses(opts: UseTravelExpensesOptions = {}) {
  const [settings, setSettings] = useState<TravelSettings>(
    opts.initialSettings ?? loadSettings()
  );
  const [destinations, setDestinations] = useState<TravelDestination[]>(
    opts.initialDestinations?.length ? opts.initialDestinations : [emptyDestination()]
  );
  const [settingsOpen, setSettingsOpen] = useState(!settings.departureAddress);
  const [favorites, setFavorites] = useState<FavoriteDestination[]>(loadFavorites);

  // Auto-save settings
  useEffect(() => {
    if (opts.autoSave !== false) saveSettings(settings);
  }, [settings, opts.autoSave]);

  // Auto-save destinations
  useEffect(() => {
    if (opts.autoSave !== false && destinations.length > 0) saveDestinations(destinations);
  }, [destinations, opts.autoSave]);

  const updateSetting = useCallback(<K extends keyof TravelSettings>(key: K, value: TravelSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateDest = useCallback((id: string, updates: Partial<TravelDestination>) => {
    setDestinations((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
  }, []);

  const addDestination = useCallback(() => {
    setDestinations((prev) => [...prev, emptyDestination()]);
  }, []);

  const removeDestination = useCallback((id: string) => {
    setDestinations((prev) => (prev.length <= 1 ? prev : prev.filter((d) => d.id !== id)));
  }, []);

  const autoFetchDistance = useCallback(
    async (destId: string, destLat: number, destLon: number) => {
      if (settings.departureLat == null || settings.departureLon == null) return;
      updateDest(destId, { isFetchingDistance: true });
      const result = await fetchRoute(settings.departureLat, settings.departureLon, destLat, destLon);
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
    [settings.departureLat, settings.departureLon, updateDest]
  );

  const handleCitySelect = useCallback(
    (destId: string, name: string, lat: number, lon: number) => {
      const dest = destinations.find((d) => d.id === destId);
      updateDest(destId, { city: name, lat, lon });
      if (dest?.transportMode === "car") {
        autoFetchDistance(destId, lat, lon);
      }
    },
    [destinations, updateDest, autoFetchDistance]
  );

  const handleModeChange = useCallback(
    (destId: string, mode: TravelDestination["transportMode"]) => {
      const dest = destinations.find((d) => d.id === destId);
      updateDest(destId, { transportMode: mode });
      if (mode === "car" && dest?.lat != null && dest?.lon != null) {
        autoFetchDistance(destId, dest.lat, dest.lon);
      }
    },
    [destinations, updateDest, autoFetchDistance]
  );

  const addFavorite = useCallback(
    (dest: TravelDestination) => {
      if (!dest.city?.trim()) return;
      const fav = destToFavorite(dest);
      const updated = [...favorites.filter((f) => f.city !== fav.city), fav];
      setFavorites(updated);
      saveFavorites(updated);
    },
    [favorites]
  );

  const removeFavorite = useCallback(
    (city: string) => {
      const updated = favorites.filter((f) => f.city !== city);
      setFavorites(updated);
      saveFavorites(updated);
    },
    [favorites]
  );

  const applyFavorite = useCallback(
    (fav: FavoriteDestination) => {
      const newDest = favoriteToDestination(fav);
      setDestinations((prev) => [...prev, newDest]);
      if (fav.transportMode === "car" && fav.lat != null && fav.lon != null) {
        autoFetchDistance(newDest.id, fav.lat, fav.lon);
      }
    },
    [autoFetchDistance]
  );

  // Re-initialize from external data (e.g., when a dialog opens)
  const reinitialize = useCallback(
    (newSettings?: TravelSettings | null, newDests?: TravelDestination[]) => {
      if (newSettings) setSettings(newSettings);
      else setSettings(loadSettings());

      if (newDests && newDests.length > 0) setDestinations(newDests);
      else {
        const saved = loadDestinations();
        setDestinations(saved ?? [emptyDestination()]);
      }

      const s = newSettings ?? loadSettings();
      if (!s.departureAddress) setSettingsOpen(true);
    },
    []
  );

  const destCosts = useMemo(
    () => destinations.map((d) => ({ id: d.id, ...calcDestinationCost(d, settings) })),
    [destinations, settings]
  );

  const grandTotal = useMemo(() => destCosts.reduce((sum, c) => sum + c.total, 0), [destCosts]);

  const ikRate = IK_RATES[settings.vehicleHp]?.perKm ?? IK_RATES[5].perKm;

  return {
    settings,
    setSettings,
    destinations,
    setDestinations,
    settingsOpen,
    setSettingsOpen,
    favorites,
    updateSetting,
    updateDest,
    addDestination,
    removeDestination,
    handleCitySelect,
    handleModeChange,
    addFavorite,
    removeFavorite,
    applyFavorite,
    reinitialize,
    destCosts,
    grandTotal,
    ikRate,
  };
}
