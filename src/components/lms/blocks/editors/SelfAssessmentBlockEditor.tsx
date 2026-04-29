import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import SelfAssessmentBlockViewer from "../viewers/SelfAssessmentBlockViewer";
import type { SelfAssessmentBlockContent, SelfAssessmentScale } from "@/types/lms-blocks";

interface Props {
  content: SelfAssessmentBlockContent;
  onChange: (content: SelfAssessmentBlockContent) => void;
}

export default function SelfAssessmentBlockEditor({ content, onChange }: Props) {
  const labels = content.labels || [];

  const setLabel = (i: number, value: string) => {
    const next = [...labels];
    next[i] = value;
    onChange({ ...content, labels: next });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Question</Label>
        <Input
          value={content.prompt}
          onChange={(e) => onChange({ ...content, prompt: e.target.value })}
          placeholder="Comment évaluez-vous votre maîtrise ?"
        />
      </div>
      <div>
        <Label>Type d'échelle</Label>
        <Select
          value={content.scale}
          onValueChange={(v) => onChange({ ...content, scale: v as SelfAssessmentScale })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="labels">Libellés personnalisés</SelectItem>
            <SelectItem value="stars">Étoiles (1 à 5)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {content.scale === "labels" && (
        <div className="space-y-2">
          <Label>Libellés (de la moins forte à la plus forte)</Label>
          {labels.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}.</span>
              <Input
                value={label}
                onChange={(e) => setLabel(i, e.target.value)}
                placeholder={`Niveau ${i + 1}`}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onChange({ ...content, labels: labels.filter((_, idx) => idx !== i) })}
                disabled={labels.length <= 2}
                aria-label="Supprimer ce libellé"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange({ ...content, labels: [...labels, ""] })}
            disabled={labels.length >= 7}
          >
            <Plus className="h-4 w-4 mr-2" /> Ajouter un niveau
          </Button>
        </div>
      )}
      <div className="border-t pt-3">
        <p className="text-xs text-muted-foreground mb-2">Aperçu :</p>
        <SelfAssessmentBlockViewer content={content} />
      </div>
    </div>
  );
}
