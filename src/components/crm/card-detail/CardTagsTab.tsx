import { Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { CrmTag } from "@/types/crm";

interface CardTagsTabProps {
  cardTags: CrmTag[];
  allTags: CrmTag[];
  onToggleTag: (tagId: string) => void;
}

const CardTagsTab = ({ cardTags, allTags, onToggleTag }: CardTagsTabProps) => {
  const tagsByCategory = allTags.reduce((acc, tag) => {
    const cat = tag.category || "Autre";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tag);
    return acc;
  }, {} as Record<string, CrmTag[]>);

  return (
    <div className="space-y-4 mt-4">
      <div>
        <Label className="mb-2 block">Tags assignés</Label>
        <div className="flex flex-wrap gap-2">
          {cardTags.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucun tag</p>
          )}
          {cardTags.map((tag) => (
            <Badge
              key={tag.id}
              style={{ backgroundColor: tag.color + "20", color: tag.color }}
              className="cursor-pointer"
              onClick={() => onToggleTag(tag.id)}
            >
              {tag.name}
              <X className="h-3 w-3 ml-1" />
            </Badge>
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Ajouter un tag</Label>
        {Object.entries(tagsByCategory).map(([category, tags]) => (
          <div key={category} className="mb-3">
            <p className="text-xs text-muted-foreground mb-1">{category}</p>
            <div className="flex flex-wrap gap-2">
              {tags
                .filter((t) => !cardTags.some((ct) => ct.id === t.id))
                .map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    style={{ borderColor: tag.color, color: tag.color }}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => onToggleTag(tag.id)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {tag.name}
                  </Badge>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CardTagsTab;
