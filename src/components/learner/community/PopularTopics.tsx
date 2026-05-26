import { Hash } from "lucide-react";
import type { PopularHashtag } from "@/hooks/usePracticeFeed";

export default function PopularTopics({
  topics,
  onSelectTag,
  onSeeAll,
  activeTag,
}: {
  topics: PopularHashtag[];
  onSelectTag: (tag: string) => void;
  onSeeAll: () => void;
  activeTag?: string | null;
}) {
  if (topics.length === 0) return null;

  return (
    <div className="rounded-2xl border p-4" style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.08)" }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold" style={{ color: "var(--st-ink)" }}>Sujets populaires</h3>
        <button onClick={onSeeAll} className="text-xs hover:underline" style={{ color: "var(--st-ink-muted)" }}>
          Voir tout
        </button>
      </div>
      <div className="space-y-1">
        {topics.map((t) => (
          <button
            key={t.tag}
            onClick={() => onSelectTag(t.tag)}
            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-black/5 text-left"
            style={activeTag === t.tag ? { background: "rgba(255,209,0,0.15)" } : undefined}
          >
            <span className="flex items-center gap-1.5 text-sm font-medium min-w-0" style={{ color: "var(--st-ink)" }}>
              <Hash size={13} style={{ color: "var(--st-ink-muted)" }} />
              <span className="truncate">{t.tag}</span>
            </span>
            <span className="text-xs shrink-0" style={{ color: "var(--st-ink-muted)" }}>
              {t.post_count} publication{t.post_count > 1 ? "s" : ""}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
