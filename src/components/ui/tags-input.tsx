import { useState, KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TagsInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  /** Lowercase all incoming tags before adding (default: false). */
  lowercase?: boolean;
  /** Render tags as Badge + X (default) or a lighter pill. */
  variant?: "badge" | "pill";
  className?: string;
}

/**
 * Tags input with add/remove. Owns its own `newTag` state so callers only
 * deal with the final `string[]`.
 *
 * - Enter adds the current input (trimmed, deduped).
 * - Empty strings are ignored.
 * - Click on a tag's `×` to remove it.
 */
export function TagsInput({
  value,
  onChange,
  placeholder = "Ajouter un tag...",
  lowercase = false,
  variant = "badge",
  className,
}: TagsInputProps) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const raw = input.trim();
    if (!raw) return;
    const normalized = lowercase ? raw.toLowerCase() : raw;
    if (value.includes(normalized)) {
      setInput("");
      return;
    }
    onChange([...value, normalized]);
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {value.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {value.map((tag) =>
            variant === "badge" ? (
              <Badge
                key={tag}
                variant="secondary"
                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => removeTag(tag)}
              >
                {tag}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            ) : (
              <span
                key={tag}
                className="px-2 py-1 text-xs bg-muted rounded flex items-center gap-1"
              >
                {tag}
                <button type="button" onClick={() => removeTag(tag)}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ),
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="flex-1"
          onKeyDown={handleKeyDown}
        />
        <Button type="button" variant="outline" size="sm" onClick={addTag}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default TagsInput;
