import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RichTextEditor from "@/components/content/RichTextEditor";
import { cn } from "@/lib/utils";
import { CALLOUT_COLORS, CALLOUT_LABELS, CALLOUT_SWATCHES } from "../callout-colors";
import type { CalloutBlockContent } from "@/types/lms-blocks";

interface Props {
  content: CalloutBlockContent;
  onChange: (content: CalloutBlockContent) => void;
}

export default function CalloutBlockEditor({ content, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Couleur</Label>
        <div className="flex flex-wrap gap-2 mt-1">
          {CALLOUT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange({ ...content, color })}
              className={cn(
                "px-2.5 py-1 rounded-md border text-xs flex items-center gap-1.5 transition-colors",
                content.color === color ? "border-foreground" : "border-transparent hover:border-muted-foreground/40",
              )}
              aria-pressed={content.color === color}
            >
              <span className={cn("h-3 w-3 rounded-full", CALLOUT_SWATCHES[color])} />
              {CALLOUT_LABELS[color]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Titre (optionnel)</Label>
        <Input
          value={content.title || ""}
          onChange={(e) => onChange({ ...content, title: e.target.value || null })}
          placeholder="Ex: Important"
        />
      </div>
      <div>
        <Label>Contenu</Label>
        <RichTextEditor
          content={content.body_html || ""}
          onChange={(body_html) => onChange({ ...content, body_html })}
        />
      </div>
    </div>
  );
}
