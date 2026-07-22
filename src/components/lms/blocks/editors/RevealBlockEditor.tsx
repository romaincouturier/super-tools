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
        {content.collapsible && " · refermable"}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Texte du bouton (contenu générique)</Label>
        <Input
          value={content.button_label}
          onChange={(e) => onChange({ ...content, button_label: e.target.value })}
          placeholder="Révéler la suite"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="reveal-collapsible"
          checked={content.collapsible === true}
          onCheckedChange={(v) => onChange({ ...content, collapsible: v })}
        />
        <Label htmlFor="reveal-collapsible" className="text-sm">
          Permettre de refermer le contenu
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Les blocs ajoutés dans ce conteneur restent masqués côté apprenant et se révèlent un par un
        à chaque clic. Le libellé du bouton s'adapte au bloc suivant (« Voir les points clés », «
        Passer à l'exercice »…) et le bouton disparaît une fois tout le contenu affiché.
      </p>
    </div>
  );
}
