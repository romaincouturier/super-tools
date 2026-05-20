import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Plus, X, Tag, Check } from "lucide-react";
import type { CrmTag } from "@/types/crm";
import type { CardDetailState, CardDetailHandlers } from "./types";

interface Props {
  state: CardDetailState;
  handlers: CardDetailHandlers;
}

const CardDetailTagsBar = ({ state, handlers }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { card, allTags, tagUsageCounts } = state;
  const cardTags = card.tags || [];

  const usedCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const t of cardTags) cats.add(t.category || "Autre");
    return cats;
  }, [cardTags]);

  const sortByFrequency = (a: CrmTag, b: CrmTag) =>
    (tagUsageCounts[b.id] || 0) - (tagUsageCounts[a.id] || 0);

  const sortedCardTags = useMemo(
    () => [...cardTags].sort(sortByFrequency),
    [cardTags, tagUsageCounts],
  );

  const tagsByCategory = useMemo(() => {
    const acc: Record<string, CrmTag[]> = {};
    for (const tag of allTags) {
      const cat = tag.category || "Autre";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(tag);
    }
    for (const cat of Object.keys(acc)) acc[cat].sort(sortByFrequency);
    return acc;
  }, [allTags, tagUsageCounts]);

  const availableTags = allTags.filter((t) => !cardTags.some((ct) => ct.id === t.id));

  const startCreate = (category: string) => {
    setCreatingIn(category);
    setNewTagName("");
  };

  const cancelCreate = () => {
    setCreatingIn(null);
    setNewTagName("");
  };

  const submitCreate = async (category: string) => {
    const name = newTagName.trim();
    if (!name) return;
    // If a tag with this name already exists, just assign it.
    const existing = allTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!cardTags.some((ct) => ct.id === existing.id)) {
        await handlers.handleToggleTag(existing.id);
      }
      cancelCreate();
      return;
    }
    setSubmitting(true);
    try {
      // Reuse the dominant color of the category for visual cohesion.
      const color = tagsByCategory[category]?.[0]?.color;
      const cat = category === "Autre" ? undefined : category;
      await handlers.handleCreateAndAddTag(name, cat, color);
      cancelCreate();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-2 border-b bg-muted/20">
      {/* Collapsed bar: show assigned tags inline */}
      <div className="flex items-center gap-2 min-h-[28px]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <Tag className="h-3.5 w-3.5" />
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        <div className="flex flex-wrap items-center gap-1 min-w-0">
          {sortedCardTags.length === 0 && (
            <span className="text-xs text-muted-foreground">Aucun tag</span>
          )}
          {sortedCardTags.map((tag) => (
            <Badge
              key={tag.id}
              style={{ backgroundColor: tag.color + "20", color: tag.color }}
              className="cursor-pointer text-[10px] h-5 px-1.5 gap-0.5"
              onClick={() => handlers.handleToggleTag(tag.id)}
            >
              {tag.name}
              <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
          {!expanded && availableTags.length > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="h-5 px-1.5 rounded-md border border-dashed border-muted-foreground/30 text-[10px] text-muted-foreground hover:border-foreground/50 hover:text-foreground transition-colors flex items-center gap-0.5"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded: show available tags by category (hide categories already used) */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5 pb-1">
          {Object.entries(tagsByCategory).map(([category, tags]) => {
            const available = tags.filter((t) => !cardTags.some((ct) => ct.id === t.id));
            const color = tags[0]?.color;
            const isCreating = creatingIn === category;
            return (
              <div key={category} className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground w-16 shrink-0 truncate">{category}</span>
                {available.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    style={{ borderColor: tag.color, color: tag.color }}
                    className="cursor-pointer hover:bg-muted text-[10px] h-5 px-1.5 gap-0.5"
                    onClick={() => handlers.handleToggleTag(tag.id)}
                  >
                    <Plus className="h-2.5 w-2.5" />
                    {tag.name}
                  </Badge>
                ))}
                {isCreating ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); submitCreate(category); }
                        if (e.key === "Escape") cancelCreate();
                      }}
                      placeholder="Nouvelle valeur…"
                      disabled={submitting}
                      className="h-5 text-[10px] border border-dashed rounded px-1.5 bg-transparent placeholder:text-muted-foreground/50 focus:outline-none min-w-0"
                      style={{ borderColor: color, color }}
                    />
                    <button
                      type="button"
                      onClick={() => submitCreate(category)}
                      disabled={submitting || !newTagName.trim()}
                      className="h-5 w-5 flex items-center justify-center rounded border border-dashed text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                      style={{ borderColor: color }}
                    >
                      <Check className="h-2.5 w-2.5" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelCreate}
                      className="h-5 w-5 flex items-center justify-center rounded border border-dashed border-muted-foreground/40 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startCreate(category)}
                    className="h-5 px-1.5 rounded-md border border-dashed text-[10px] flex items-center gap-0.5 hover:bg-muted transition-colors"
                    style={{ borderColor: color, color }}
                    title={`Ajouter une valeur dans « ${category} »`}
                  >
                    <Plus className="h-2.5 w-2.5" />
                    nouvelle valeur
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CardDetailTagsBar;
