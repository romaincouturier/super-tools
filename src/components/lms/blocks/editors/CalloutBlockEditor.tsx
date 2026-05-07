import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RichTextEditor from "@/components/content/RichTextEditor";
import { cn } from "@/lib/utils";
import {
  CALLOUT_PALETTE,
  CALLOUT_COLOR_GROUPS,
  CALLOUT_LEVELS,
  CALLOUT_LEVEL_LIST,
} from "../callout-colors";
import type { CalloutBlockContent, CalloutColor, CalloutLevel } from "@/types/lms-blocks";

interface Props {
  content: CalloutBlockContent;
  onChange: (content: CalloutBlockContent) => void;
}

export default function CalloutBlockEditor({ content, onChange }: Props) {
  const palette = CALLOUT_PALETTE[content.color] ?? CALLOUT_PALETTE.blue;

  return (
    <div className="space-y-4">
      {/* Colour palette grouped */}
      <div>
        <Label>Couleur de fond</Label>
        <div className="space-y-2 mt-1.5">
          {CALLOUT_COLOR_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-xs text-muted-foreground mb-1">{group.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.colors.map((color) => {
                  const entry = CALLOUT_PALETTE[color];
                  const isSelected = content.color === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      title={entry.label}
                      onClick={() => onChange({ ...content, color })}
                      className={cn(
                        "h-7 w-7 rounded-md border-2 transition-all",
                        isSelected ? "border-foreground scale-110 shadow-sm" : "border-transparent hover:border-muted-foreground/50",
                        color === "white" && "ring-1 ring-inset ring-gray-200",
                      )}
                      style={{ backgroundColor: entry.swatch || entry.bg }}
                      aria-pressed={isSelected}
                      aria-label={entry.label}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Fond : <span className="font-mono">{palette.bg}</span> · Texte : <span className="font-mono">{palette.text}</span>
        </p>
      </div>

      {/* Level */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Niveau visuel</Label>
          <Select
            value={content.level ?? ""}
            onValueChange={(v) => onChange({ ...content, level: (v || null) as CalloutLevel | null })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Aucun" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Aucun</SelectItem>
              {CALLOUT_LEVEL_LIST.map((lvl) => {
                const entry = CALLOUT_LEVELS[lvl];
                return (
                  <SelectItem key={lvl} value={lvl}>
                    {entry.icon} {entry.label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Arrondi (px)</Label>
          <Input
            type="number"
            min={0}
            max={32}
            className="mt-1"
            value={content.border_radius ?? 8}
            onChange={(e) => onChange({ ...content, border_radius: Math.max(0, parseInt(e.target.value, 10) || 0) })}
          />
        </div>
      </div>

      {/* Show icon toggle */}
      {content.level && (
        <div className="flex items-center gap-2">
          <Switch
            id="callout-show-icon"
            checked={content.show_icon !== false}
            onCheckedChange={(v) => onChange({ ...content, show_icon: v })}
          />
          <Label htmlFor="callout-show-icon" className="cursor-pointer">Afficher l'icône de niveau</Label>
        </div>
      )}

      {/* Title */}
      <div>
        <Label>Titre (optionnel)</Label>
        <Input
          value={content.title || ""}
          onChange={(e) => onChange({ ...content, title: e.target.value || null })}
          placeholder={content.level ? CALLOUT_LEVELS[content.level]?.defaultTitle ?? "Ex : Important" : "Ex : Important"}
        />
      </div>

      {/* Body */}
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
