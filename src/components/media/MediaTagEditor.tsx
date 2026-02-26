import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus, Tag } from "lucide-react";
import { useUpdateMediaTags } from "@/hooks/useMedia";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface MediaTagEditorProps {
  mediaId: string;
  tags: string[];
  allTags: string[];
  compact?: boolean;
}

const MediaTagEditor = ({ mediaId, tags = [], allTags = [], compact }: MediaTagEditorProps) => {
  const [open, setOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const updateTags = useUpdateMediaTags();
  const inputRef = useRef<HTMLInputElement>(null);

  const safeTags = Array.isArray(tags) ? tags : [];
  const safeAllTags = Array.isArray(allTags) ? allTags : [];

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const addTag = async (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed || safeTags.includes(trimmed)) return;
    try {
      await updateTags.mutateAsync({ id: mediaId, tags: [...safeTags, trimmed] });
    } catch {
      toast.error("Erreur lors de l'ajout du tag");
    }
    setNewTag("");
  };

  const removeTag = async (tag: string) => {
    try {
      await updateTags.mutateAsync({ id: mediaId, tags: safeTags.filter((t) => t !== tag) });
    } catch {
      toast.error("Erreur lors de la suppression du tag");
    }
  };

  const suggestions = safeAllTags.filter(
    (t) => !safeTags.includes(t) && t.toLowerCase().includes(newTag.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? "icon" : "sm"}
          className={compact ? "h-6 w-6" : "h-7 gap-1 text-xs"}
          onClick={(e) => e.stopPropagation()}
        >
          <Tag className="h-3 w-3" />
          {!compact && (
            <span>{safeTags.length > 0 ? safeTags.length : "Tagger"}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-64 p-3 space-y-2"
        onClick={(e) => e.stopPropagation()}
        align="start"
      >
        <p className="text-xs font-medium text-muted-foreground">Tags</p>

        {/* Current tags */}
        {safeTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {safeTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs gap-1 pr-1">
                {tag}
                <button
                  onClick={() => removeTag(tag)}
                  className="ml-0.5 hover:text-destructive"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-1">
          <Input
            ref={inputRef}
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag(newTag);
              }
            }}
            placeholder="Ajouter un tag..."
            className="h-7 text-xs"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 flex-shrink-0"
            disabled={!newTag.trim()}
            onClick={() => addTag(newTag)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && newTag.length === 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Suggestions</p>
            <div className="flex flex-wrap gap-1">
              {suggestions.slice(0, 10).map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-accent"
                  onClick={() => addTag(tag)}
                >
                  <Plus className="h-2.5 w-2.5 mr-0.5" />
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {suggestions.length > 0 && newTag.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {suggestions.slice(0, 5).map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-xs cursor-pointer hover:bg-accent"
                onClick={() => addTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default MediaTagEditor;
