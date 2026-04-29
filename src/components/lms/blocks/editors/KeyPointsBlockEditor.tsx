import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import type { KeyPointsBlockContent } from "@/types/lms-blocks";

interface Props {
  content: KeyPointsBlockContent;
  onChange: (content: KeyPointsBlockContent) => void;
}

export default function KeyPointsBlockEditor({ content, onChange }: Props) {
  const items = content.items || [];

  const setItem = (i: number, value: string) => {
    const next = [...items];
    next[i] = value;
    onChange({ ...content, items: next });
  };

  const addItem = () => onChange({ ...content, items: [...items, ""] });

  const removeItem = (i: number) =>
    onChange({ ...content, items: items.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-3">
      <div>
        <Label>Titre</Label>
        <Input
          value={content.title || ""}
          onChange={(e) => onChange({ ...content, title: e.target.value || null })}
          placeholder="À retenir"
        />
      </div>
      <div className="space-y-2">
        <Label>Points clés</Label>
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={item}
              onChange={(e) => setItem(i, e.target.value)}
              placeholder={`Point ${i + 1}`}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeItem(i)}
              disabled={items.length <= 1}
              aria-label="Supprimer ce point"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-4 w-4 mr-2" /> Ajouter un point
        </Button>
      </div>
    </div>
  );
}
