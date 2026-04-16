import { useState, useEffect, useRef, useId } from "react";
import { MapPin, Video, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { REMOTE_LOCATION_LABEL, isRemoteLocation } from "@/lib/missionLocation";

interface LocationInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

interface AddressFeature {
  properties: { label: string; city?: string; postcode?: string };
}

/**
 * Input "Lieu" enrichi : bascule rapide vers "Distanciel" + autocomplétion
 * de villes françaises via l'API Adresse data.gouv (gratuite, sans clé).
 *
 * Quand l'utilisateur active Distanciel, la value devient `REMOTE_LOCATION_LABEL`
 * et l'input est désactivé. Un re-clic ramène à un champ vide modifiable.
 *
 * Endpoint utilisé :
 *   https://api-adresse.data.gouv.fr/search/?q=...&type=municipality&limit=6
 */
const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

export function LocationInput({
  value,
  onChange,
  placeholder = "Ville (ex : Lyon, Paris...)",
  className,
}: LocationInputProps) {
  const inputId = useId();
  const isRemote = isRemoteLocation(value);

  const [suggestions, setSuggestions] = useState<AddressFeature[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced fetch on value change (skip when remote or focus lost).
  useEffect(() => {
    if (isRemote || !showSuggestions) {
      setSuggestions([]);
      return;
    }
    const q = value.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setLoading(true);
      try {
        const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&type=municipality&limit=6`;
        const res = await fetch(url, { signal: abortRef.current.signal });
        if (!res.ok) throw new Error("API error");
        const data = await res.json();
        setSuggestions((data.features || []) as AddressFeature[]);
        setHighlighted(0);
      } catch (err) {
        // AbortError is expected when typing fast — silent.
        if (err instanceof Error && err.name !== "AbortError") {
          console.warn("LocationInput suggest error:", err);
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, showSuggestions, isRemote]);

  const toggleRemote = () => {
    if (isRemote) onChange("");
    else onChange(REMOTE_LOCATION_LABEL);
  };

  const pickSuggestion = (feature: AddressFeature) => {
    const label = feature.properties.label;
    onChange(label);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pickSuggestion(suggestions[highlighted]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        {isRemote ? (
          <Video className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="relative flex-1">
          <Input
            id={inputId}
            value={isRemote ? REMOTE_LOCATION_LABEL : value}
            onChange={(e) => {
              onChange(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => !isRemote && setShowSuggestions(true)}
            onBlur={() => {
              // Delay so suggestion mousedown fires first.
              blurTimeoutRef.current = setTimeout(() => setShowSuggestions(false), 150);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isRemote}
            autoComplete="off"
          />
          {showSuggestions && !isRemote && (suggestions.length > 0 || loading) && (
            <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-md max-h-64 overflow-y-auto">
              {loading && (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                  <Spinner className="h-3 w-3" />
                  Recherche…
                </div>
              )}
              {suggestions.map((s, i) => (
                <button
                  key={`${s.properties.postcode}-${s.properties.city}-${i}`}
                  type="button"
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-sm hover:bg-accent",
                    i === highlighted && "bg-accent",
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickSuggestion(s);
                  }}
                  onMouseEnter={() => setHighlighted(i)}
                >
                  {s.properties.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button
          type="button"
          variant={isRemote ? "default" : "outline"}
          size="sm"
          className="shrink-0 gap-1"
          onClick={toggleRemote}
          title={isRemote ? "Désactiver le distanciel" : "Marquer comme distanciel"}
        >
          {isRemote ? <X className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
          {isRemote ? "Présentiel" : "Distanciel"}
        </Button>
      </div>
    </div>
  );
}

export default LocationInput;
