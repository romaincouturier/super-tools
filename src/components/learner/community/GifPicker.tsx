import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2 } from "lucide-react";

const GIPHY_API_KEY = "9QEPZvBy7qXRYjft8F4BE8fu1dbAcMgE";
const GIPHY_LIMIT = 18;

interface GiphyGif {
  id: string;
  title: string;
  images: {
    fixed_height: { url: string; width: string; height: string };
    original: { url: string };
  };
}

async function fetchGiphy(q: string): Promise<GiphyGif[]> {
  const endpoint = q.trim()
    ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(q)}&limit=${GIPHY_LIMIT}&rating=g`
    : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=${GIPHY_LIMIT}&rating=g`;
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error("Giphy error");
  const json = await res.json();
  return json.data as GiphyGif[];
}

export default function GifPicker({
  onSelect,
  onClose,
}: {
  onSelect: (url: string, title: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      setGifs(await fetchGiphy(q));
    } catch {
      setGifs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load("");
    inputRef.current?.focus();
  }, [load]);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(value), 350);
  };

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.12)", width: 320, maxHeight: 420, display: "flex", flexDirection: "column" }}
    >
      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "rgba(16,24,32,0.08)" }}>
        <Search size={14} style={{ color: "var(--st-ink-muted)", flexShrink: 0 }} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Rechercher un GIF…"
          className="flex-1 text-sm bg-transparent outline-none"
          style={{ color: "var(--st-ink)", fontFamily: "inherit" }}
        />
        <button onClick={onClose} className="p-1 rounded hover:bg-black/5" style={{ color: "var(--st-ink-muted)" }}>
          <X size={14} />
        </button>
      </div>

      {/* Grid */}
      <div className="overflow-y-auto flex-1 p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin" style={{ color: "var(--st-ink-muted)" }} />
          </div>
        ) : gifs.length === 0 ? (
          <p className="text-center text-sm py-8" style={{ color: "var(--st-ink-muted)" }}>Aucun résultat</p>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                onClick={() => onSelect(gif.images.original.url, gif.title)}
                className="rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
                style={{ aspectRatio: "1", background: "#EDEDED" }}
              >
                <img
                  src={gif.images.fixed_height.url}
                  alt={gif.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Giphy attribution */}
      <div className="px-3 py-1.5 border-t text-right" style={{ borderColor: "rgba(16,24,32,0.08)" }}>
        <span className="text-[10px] font-semibold tracking-wide" style={{ color: "var(--st-ink-muted)" }}>
          Powered by GIPHY
        </span>
      </div>
    </div>
  );
}
