import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { BULLET_CHARS } from "@/types/lms-blocks";
import type { BulletListBlockContent, BulletStyle, BulletSpacing } from "@/types/lms-blocks";

const BULLET_STYLES: { value: BulletStyle; label: string }[] = [
  { value: "round",   label: "Ronde  •" },
  { value: "square",  label: "Carrée ■" },
  { value: "check",   label: "Coche  ✓" },
  { value: "arrow",   label: "Flèche →" },
  { value: "star",    label: "Étoile ★" },
  { value: "diamond", label: "Losange ◆" },
];

const BULLET_COLORS = [
  { label: "Jaune SuperTilt", value: "#FFD100" },
  { label: "Noir SuperTilt",  value: "#101820" },
  { label: "Gris clair",     value: "#EDEDED" },
  { label: "Gris très clair", value: "#F2F4F4" },
  { label: "Blanc",           value: "#FFFFFF" },
  { label: "Turquoise",       value: "#69c3c4" },
  { label: "Corail",          value: "#f08275" },
  { label: "Par défaut",      value: "" },
];

const SPACING_OPTIONS: { value: BulletSpacing; label: string }[] = [
  { value: "compact",  label: "Compact" },
  { value: "normal",   label: "Normal" },
  { value: "relaxed",  label: "Aéré" },
];

interface Props {
  content: BulletListBlockContent;
  onChange: (content: BulletListBlockContent) => void;
}

export default function BulletListBlockEditor({ content, onChange }: Props) {
  const items = content.items || [""];

  const setItem = (idx: number, value: string) =>
    onChange({ ...content, items: items.map((it, i) => (i === idx ? value : it)) });

  const addItem = () =>
    onChange({ ...content, items: [...items, ""] });

  const removeItem = (idx: number) =>
    onChange({ ...content, items: items.filter((_, i) => i !== idx) });

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    const arr = [...items];
    [arr[idx], arr[next]] = [arr[next], arr[idx]];
    onChange({ ...content, items: arr });
  };

  const bulletStyle = content.bullet_style ?? "round";
  const bulletChar = BULLET_CHARS[bulletStyle];

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <Label>Titre (optionnel)</Label>
        <Input
          value={content.title || ""}
          onChange={(e) => onChange({ ...content, title: e.target.value || null })}
          placeholder="Ex: Points importants"
        />
      </div>

      {/* Style row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Style de puce</Label>
          <Select
            value={bulletStyle}
            onValueChange={(v) => onChange({ ...content, bullet_style: v as BulletStyle })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BULLET_STYLES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Espacement</Label>
          <Select
            value={content.item_spacing ?? "normal"}
            onValueChange={(v) => onChange({ ...content, item_spacing: v as BulletSpacing })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPACING_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Colour row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Couleur des puces</Label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {BULLET_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => onChange({ ...content, bullet_color: c.value || null })}
                className={cn(
                  "h-6 w-6 rounded border-2 transition-all",
                  (content.bullet_color ?? "") === c.value
                    ? "border-foreground scale-110"
                    : "border-transparent hover:border-muted-foreground/50",
                  c.value === "" && "bg-muted text-[10px] flex items-center justify-center",
                  c.value === "#FFFFFF" && "ring-1 ring-inset ring-gray-200",
                )}
                style={c.value ? { backgroundColor: c.value } : undefined}
                aria-label={c.label}
              >
                {c.value === "" && "–"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs">Couleur du texte (optionnel)</Label>
          <div className="flex items-center gap-2 mt-1.5">
            <input
              type="color"
              value={content.text_color || "#111827"}
              onChange={(e) => onChange({ ...content, text_color: e.target.value })}
              className="h-7 w-8 cursor-pointer rounded border p-0.5"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => onChange({ ...content, text_color: null })}
            >
              Réinitialiser
            </Button>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2">
        <Label>Éléments</Label>
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-sm shrink-0 w-5 text-center font-mono"
              style={{ color: content.bullet_color || undefined }}>
              {bulletChar}
            </span>
            <Input
              value={item}
              onChange={(e) => setItem(idx, e.target.value)}
              placeholder="Élément de la liste"
              className="flex-1"
            />
            <div className="flex gap-0.5 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveItem(idx, -1)} disabled={idx === 0} aria-label="Monter">
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} aria-label="Descendre">
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(idx)} disabled={items.length <= 1} aria-label="Supprimer">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-3.5 w-3.5 mr-1" />Ajouter un élément
        </Button>
      </div>
    </div>
  );
}
