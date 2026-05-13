import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { cryptoRandomId } from "@/types/lms-blocks";
import { InlineEdit } from "./InlineEdit";
import type { ChecklistBlockContent } from "@/types/lms-blocks";

interface Props {
  content: ChecklistBlockContent;
  onChange: (content: ChecklistBlockContent) => void;
  slim?: boolean;
}

export default function ChecklistBlockEditor({ content, onChange, slim }: Props) {
  const items = content.items || [];
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  const setLabel = (id: string, label: string) =>
    onChange({
      ...content,
      items: items.map((it) => (it.id === id ? { ...it, label } : it)),
    });

  const addItem = (afterId?: string) => {
    const newItem = { id: cryptoRandomId(), label: "" };
    if (afterId) {
      const idx = items.findIndex((it) => it.id === afterId);
      const next = [...items];
      next.splice(idx + 1, 0, newItem);
      onChange({ ...content, items: next });
      setTimeout(() => itemRefs.current[idx + 1]?.focus(), 10);
    } else {
      onChange({ ...content, items: [...items, newItem] });
      setTimeout(() => itemRefs.current[items.length]?.focus(), 10);
    }
  };

  const removeItem = (id: string) =>
    onChange({ ...content, items: items.length > 1 ? items.filter((it) => it.id !== id) : items });

  if (slim) {
    return (
      <div>
        {content.title && (
          <InlineEdit
            value={content.title || ""}
            onChange={(v) => onChange({ ...content, title: v || null })}
            placeholder="Titre (optionnel)"
            style={{
              fontWeight: 700, fontSize: "1rem", color: "var(--st-ink)",
              outline: "none", marginBottom: "0.75rem", display: "block",
            }}
          />
        )}
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {items.map((item, i) => (
            <li key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <div
                style={{
                  width: 18, height: 18, borderRadius: 4,
                  border: "2px solid rgba(16,24,32,0.25)",
                  flexShrink: 0,
                }}
              />
              <InlineEdit
                value={item.label}
                onChange={(v) => setLabel(item.id, v)}
                placeholder="Étape ou critère"
                onEnter={() => addItem(item.id)}
                onEmptyBackspace={() => {
                  if (items.length > 1) {
                    removeItem(item.id);
                    setTimeout(() => itemRefs.current[Math.max(0, i - 1)]?.focus(), 10);
                  }
                }}
                style={{ flex: 1, color: "var(--st-ink)", outline: "none" }}
              />
              <button
                onClick={() => items.length > 1 && removeItem(item.id)}
                style={{
                  opacity: 0.4, fontSize: 16, lineHeight: 1, padding: "1px 5px",
                  borderRadius: 4, border: "none", background: "transparent",
                  cursor: items.length > 1 ? "pointer" : "default", flexShrink: 0,
                  color: "var(--st-ink)",
                }}
                aria-label="Supprimer"
              >×</button>
            </li>
          ))}
        </ul>
        <button
          onClick={() => addItem()}
          style={{
            marginTop: "0.75rem",
            display: "flex", alignItems: "center", gap: "0.375rem",
            fontSize: "0.8125rem", fontWeight: 500,
            color: "var(--st-ink-60)", cursor: "pointer",
            border: "none", background: "transparent", padding: "0.25rem 0",
          }}
        >
          <Plus size={14} /> Ajouter un élément
        </button>
      </div>
    );
  }

  // Form mode
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
        <Button variant="outline" size="sm" onClick={() => addItem()}>
          <Plus className="h-4 w-4 mr-2" /> Ajouter un élément
        </Button>
      </div>
    </div>
  );
}
