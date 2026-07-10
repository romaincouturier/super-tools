import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { RevealBlockContent } from "@/types/lms-blocks";

interface Props {
  content: RevealBlockContent;
  onChange: (content: RevealBlockContent) => void;
  slim?: boolean;
}

export default function RevealBlockEditor({ content, onChange, slim }: Props) {
  if (slim) {
    return (
      <p className="text-xs py-0.5" style={{ color: "var(--st-ink-muted)" }}>
        Bouton :{" "}
        <span className="font-medium" style={{ color: "var(--st-ink)" }}>
          {content.button_label || "Révéler la suite"}
        </span>
        {content.hide_button_after_click && " · masqué après clic"}
        {content.collapsible && " · refermable"}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Texte du bouton</Label>
        <Input
          value={content.button_label}
          onChange={(e) => onChange({ ...content, button_label: e.target.value })}
          placeholder="Révéler la suite"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="reveal-hide-button"
          checked={content.hide_button_after_click === true}
          onCheckedChange={(v) =>
            onChange({
              ...content,
              hide_button_after_click: v,
              collapsible: v ? false : content.collapsible,
            })
          }
        />
        <Label htmlFor="reveal-hide-button" className="text-sm">
          Masquer le bouton après le clic
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="reveal-collapsible"
          checked={content.collapsible === true}
          onCheckedChange={(v) =>
            onChange({
              ...content,
              collapsible: v,
              hide_button_after_click: v ? false : content.hide_button_after_click,
            })
          }
        />
        <Label htmlFor="reveal-collapsible" className="text-sm">
          Permettre de refermer le contenu
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Les blocs ajoutés dans ce conteneur restent masqués côté apprenant jusqu'au clic sur le bouton.
      </p>
    </div>
  );
}
