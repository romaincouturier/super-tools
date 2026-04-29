import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { cryptoRandomId } from "@/types/lms-blocks";
import type { ChecklistBlockContent } from "@/types/lms-blocks";

interface Props {
  content: ChecklistBlockContent;
  onChange: (content: ChecklistBlockContent) => void;
}

export default function ChecklistBlockEditor({ content, onChange }: Props) {
  const items = content.items || [];

  const setLabel = (id: string, label: string) =>
    onChange({
      ...content,
      items: items.map((it) => (it.id === id ? { ...it, label } : it)),
    });

  const addItem = () =>
    onChange({ ...content, items: [...items, { id: cryptoRandomId(), label: "" }] });

  const removeItem = (id: string) =>
    onChange({ ...content, items: items.filter((it) => it.id !== id) });

  return (
    <div className="space-y-3">
      <div>
        <Label>Titre (optionnel)</Label>
        <Input
          value={content.title || ""}
          onChange={(e) => onChange({ ...content, title: e.target.value || null })}
          placeholder="Étapes à valider"
        />
      </div>
      <div className="space-y-2">
        <Label>Éléments à cocher</Label>
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <Input
              value={item.label}
              onChange={(e) => setLabel(item.id, e.target.value)}
              placeholder="Étape ou critère"
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeItem(item.id)}
              disabled={items.length <= 1}
              aria-label="Supprimer cet élément"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-4 w-4 mr-2" /> Ajouter un élément
        </Button>
      </div>
    </div>
  );
}
