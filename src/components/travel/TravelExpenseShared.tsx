import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Plus,
  Trash2,
  Settings2,
  ChevronDown,
  ChevronUp,
  MapPin,
  Car,
  CarTaxiFront,
  Train,
  Plane,
  Navigation,
  Loader2,
  Star,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type TravelDestination,
  type TravelSettings,
  type FavoriteDestination,
  type GeoResult,
  IK_RATES,
  formatEur,
  geocode,
} from "@/lib/travelExpenseUtils";

// ---------------------------------------------------------------------------
// TransportIcon
// ---------------------------------------------------------------------------

export function TransportIcon({ mode }: { mode: TravelDestination["transportMode"] }) {
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
// CityAutocomplete
// ---------------------------------------------------------------------------

export function CityAutocomplete({
  value,
  onSelect,
  onInputChange,
  placeholder,
  className,
}: {
  value: string;
  onSelect: (name: string, lat: number, lon: number) => void;
  onInputChange?: (name: string) => void;
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

  const handleChange = useCallback(
    (text: string) => {
      setQuery(text);
      onInputChange?.(text);
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
    },
    [onInputChange]
  );

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
// TravelSettingsPanel
// ---------------------------------------------------------------------------

export function TravelSettingsPanel({
  settings,
  settingsOpen,
  onSettingsOpenChange,
  onUpdateSetting,
}: {
  settings: TravelSettings;
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  onUpdateSetting: <K extends keyof TravelSettings>(key: K, value: TravelSettings[K]) => void;
}) {
  return (
    <Collapsible open={settingsOpen} onOpenChange={onSettingsOpenChange}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Paramètres
            {settings.departureAddress && (
              <span className="text-foreground ml-1">
                — {settings.departureAddress}, {IK_RATES[settings.vehicleHp]?.label}
              </span>
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
                onInputChange={(name) => {
                  onUpdateSetting("departureAddress", name);
                  onUpdateSetting("departureLat", null);
                  onUpdateSetting("departureLon", null);
                }}
                onSelect={(name, lat, lon) => {
                  onUpdateSetting("departureAddress", name);
                  onUpdateSetting("departureLat", lat);
                  onUpdateSetting("departureLon", lon);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Puissance fiscale</Label>
              <Select
                value={String(settings.vehicleHp)}
                onValueChange={(v) => onUpdateSetting("vehicleHp", parseInt(v))}
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
            {[
              { key: "nightRate" as const, label: "Nuit (€)", step: "1" },
              { key: "parkingRate" as const, label: "Parking (€/j)", step: "0.5" },
              { key: "lunchRate" as const, label: "Déjeuner (€)", step: "0.1" },
              { key: "dinnerRate" as const, label: "Dîner (€)", step: "0.1" },
              { key: "breakfastRate" as const, label: "Petit-déj (€)", step: "0.1" },
              { key: "trainLoyaltyPerTrip" as const, label: "Fidélité (€/trajet)", step: "0.5" },
            ].map(({ key, label, step }) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <Input
                  type="number"
                  min="0"
                  step={step}
                  value={settings[key] || ""}
                  onChange={(e) => onUpdateSetting(key, parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Barème IK 2024. Distances via Google Routes API. Paramètres sauvegardés localement.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ---------------------------------------------------------------------------
// FavoritesPills
// ---------------------------------------------------------------------------

export function FavoritesPills({
  favorites,
  onApply,
  onRemove,
}: {
  favorites: FavoriteDestination[];
  onApply: (fav: FavoriteDestination) => void;
  onRemove: (city: string) => void;
}) {
  if (favorites.length === 0) return null;

  return (
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
            onClick={() => onApply(fav)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-background text-xs hover:bg-accent transition-colors group"
          >
            <TransportIcon mode={fav.transportMode} />
            {fav.city}
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(fav.city);
              }}
              className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
            >
              <X className="h-3 w-3" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DestinationRow
// ---------------------------------------------------------------------------

export function DestinationRow({
  dest,
  index,
  totalCount,
  ikRate,
  costs,
  favorites,
  onUpdate,
  onRemove,
  onCitySelect,
  onModeChange,
  onAddFavorite,
}: {
  dest: TravelDestination;
  index: number;
  totalCount: number;
  ikRate: number;
  costs: { transportCost: number; parkingCost: number; loyaltyCost: number; nightsCost: number; mealsCost: number; total: number } | undefined;
  favorites: FavoriteDestination[];
  onUpdate: (id: string, updates: Partial<TravelDestination>) => void;
  onRemove: (id: string) => void;
  onCitySelect: (destId: string, name: string, lat: number, lon: number) => void;
  onModeChange: (destId: string, mode: TravelDestination["transportMode"]) => void;
  onAddFavorite: (dest: TravelDestination) => void;
}) {
  return (
    <div className="rounded-lg border p-3 space-y-2 bg-background">
      {/* Row 1: city + mode + AR + days + nights */}
      <div className="grid grid-cols-[1fr_120px_70px_70px_70px_68px] gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">
            Destination {totalCount > 1 ? `#${index + 1}` : ""}
          </Label>
          <CityAutocomplete
            value={dest.city}
            placeholder="Ville de destination"
            onInputChange={(name) =>
              onUpdate(dest.id, {
                city: name,
                lat: null,
                lon: null,
                distanceKm: 0,
                tollCostOneWay: 0,
                durationHours: 0,
              })
            }
            onSelect={(name, lat, lon) => onCitySelect(dest.id, name, lat, lon)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Transport</Label>
          <Select
            value={dest.transportMode}
            onValueChange={(v) => onModeChange(dest.id, v as TravelDestination["transportMode"])}
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
          <Input type="number" min="1" step="1" value={dest.roundTrips || ""} onChange={(e) => onUpdate(dest.id, { roundTrips: parseInt(e.target.value) || 1 })} className="h-8 text-sm text-right" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Jours</Label>
          <Input type="number" min="0" step="1" value={dest.days || ""} onChange={(e) => onUpdate(dest.id, { days: parseInt(e.target.value) || 0 })} className="h-8 text-sm text-right" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Nuits</Label>
          <Input type="number" min="0" step="1" value={dest.nights || ""} onChange={(e) => onUpdate(dest.id, { nights: parseInt(e.target.value) || 0 })} className="h-8 text-sm text-right" />
        </div>
        <div className="flex gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", favorites.some((f) => f.city === dest.city?.trim()) ? "text-yellow-500" : "text-muted-foreground hover:text-yellow-500")}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAddFavorite(dest); }}
            disabled={!dest.city?.trim()}
            title="Ajouter aux favoris"
          >
            <Star className={cn("h-3.5 w-3.5", favorites.some((f) => f.city === dest.city?.trim()) && "fill-current")} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onRemove(dest.id)} disabled={totalCount <= 1}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Row 2: mode-specific fields */}
      <div className="flex items-center gap-3 flex-wrap">
        {dest.transportMode === "car" && (
          <>
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Distance (km, aller)</Label>
              <div className="relative">
                <Input type="number" min="0" value={dest.distanceKm || ""} onChange={(e) => onUpdate(dest.id, { distanceKm: parseFloat(e.target.value) || 0 })} className="h-7 w-24 text-xs text-right" />
                {dest.isFetchingDistance && <Loader2 className="absolute right-2 top-1.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Péages (€, aller)</Label>
              <Input type="number" min="0" value={dest.tollCostOneWay || ""} onChange={(e) => onUpdate(dest.id, { tollCostOneWay: parseFloat(e.target.value) || 0 })} className="h-7 w-24 text-xs text-right" />
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
            <Input type="number" min="0" value={dest.ticketPriceRoundTrip || ""} onChange={(e) => onUpdate(dest.id, { ticketPriceRoundTrip: parseFloat(e.target.value) || 0 })} className="h-7 w-24 text-xs text-right" />
          </div>
        )}
      </div>

      {/* Row 3: cost breakdown */}
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
}

// ---------------------------------------------------------------------------
// DestinationsList (wraps multiple DestinationRow + add button)
// ---------------------------------------------------------------------------

export function DestinationsList({
  destinations,
  destCosts,
  ikRate,
  favorites,
  onUpdate,
  onRemove,
  onAdd,
  onCitySelect,
  onModeChange,
  onAddFavorite,
}: {
  destinations: TravelDestination[];
  destCosts: { id: string; transportCost: number; parkingCost: number; loyaltyCost: number; nightsCost: number; mealsCost: number; total: number }[];
  ikRate: number;
  favorites: FavoriteDestination[];
  onUpdate: (id: string, updates: Partial<TravelDestination>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onCitySelect: (destId: string, name: string, lat: number, lon: number) => void;
  onModeChange: (destId: string, mode: TravelDestination["transportMode"]) => void;
  onAddFavorite: (dest: TravelDestination) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-muted-foreground">Destinations</div>
      {destinations.map((dest, idx) => (
        <DestinationRow
          key={dest.id}
          dest={dest}
          index={idx}
          totalCount={destinations.length}
          ikRate={ikRate}
          costs={destCosts.find((c) => c.id === dest.id)}
          favorites={favorites}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onCitySelect={onCitySelect}
          onModeChange={onModeChange}
          onAddFavorite={onAddFavorite}
        />
      ))}
      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5 mr-1" />
        Ajouter une destination
      </Button>
    </div>
  );
}
