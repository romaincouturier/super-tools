import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Plus, X, Tag } from "lucide-react";
import type { CrmTag } from "@/types/crm";
import type { CardDetailState, CardDetailHandlers } from "./types";

interface Props {
  state: CardDetailState;
  handlers: CardDetailHandlers;
}

const CardDetailTagsBar = ({ state, handlers }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const { card, allTags } = state;
  const cardTags = card.tags || [];

  const tagsByCategory = allTags.reduce((acc, tag) => {
    const cat = tag.category || "Autre";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tag);
    return acc;
  }, {} as Record<string, CrmTag[]>);

  const availableTags = allTags.filter((t) => !cardTags.some((ct) => ct.id === t.id));

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
          {cardTags.length === 0 && (
            <span className="text-xs text-muted-foreground">Aucun tag</span>
          )}
          {cardTags.map((tag) => (
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

      {/* Expanded: show available tags by category */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5 pb-1">
          {Object.entries(tagsByCategory).map(([category, tags]) => {
            const available = tags.filter((t) => !cardTags.some((ct) => ct.id === t.id));
            if (available.length === 0) return null;
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CardDetailTagsBar;
