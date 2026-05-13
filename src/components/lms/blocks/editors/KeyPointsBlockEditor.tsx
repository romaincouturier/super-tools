import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, X, Lightbulb } from "lucide-react";
import { InlineEdit } from "./InlineEdit";
import type { KeyPointsBlockContent } from "@/types/lms-blocks";

interface Props {
  content: KeyPointsBlockContent;
  onChange: (content: KeyPointsBlockContent) => void;
  slim?: boolean;
}

export default function KeyPointsBlockEditor({ content, onChange, slim }: Props) {
  const items = content.items || [""];
  const listRef = useRef<(HTMLElement | null)[]>([]);

  const setItem = (i: number, value: string) => {
    const next = [...items];
    next[i] = value;
    onChange({ ...content, items: next });
  };

  const addItem = (afterIndex?: number) => {
    const next = [...items];
    const idx = afterIndex !== undefined ? afterIndex + 1 : next.length;
    next.splice(idx, 0, "");
    onChange({ ...content, items: next });
    setTimeout(() => {
      const el = listRef.current[idx];
      if (el) el.focus();
    }, 10);
  };

  const removeItem = (i: number) =>
    onChange({ ...content, items: items.length > 1 ? items.filter((_, idx) => idx !== i) : items });

  if (slim) {
    return (
      <div
        style={{
          background: "var(--st-yellow-soft)",
          borderRadius: "var(--st-br, 20px)",
          padding: "1.25rem 1.5rem",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <Lightbulb size={20} style={{ color: "var(--st-ink)", flexShrink: 0 }} />
          <InlineEdit
            value={content.title || ""}
            onChange={(v) => onChange({ ...content, title: v || null })}
            placeholder="À retenir"
            style={{
              flex: 1,
              fontWeight: 700,
              fontSize: "0.9375rem",
              color: "var(--st-ink)",
              outline: "none",
            }}
          />
        </div>

        {/* Items */}
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {items.map((item, i) => (
            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--st-ink)",
                  flexShrink: 0,
                  marginTop: "0.45em",
                }}
              />
              <InlineEdit
                value={item}
                onChange={(v) => setItem(i, v)}
                placeholder="Un point clé à retenir…"
                onEnter={() => addItem(i)}
                onEmptyBackspace={() => {
                  if (items.length > 1) {
                    removeItem(i);
                    setTimeout(() => listRef.current[Math.max(0, i - 1)]?.focus(), 10);
                  }
                }}
                style={{ flex: 1, fontSize: "0.9375rem", color: "var(--st-ink)", outline: "none" }}
              />
              <button
                onClick={() => items.length > 1 && removeItem(i)}
                style={{
                  opacity: 0.4,
                  fontSize: 16,
                  lineHeight: 1,
                  padding: "1px 5px",
                  borderRadius: 4,
                  border: "none",
                  background: "transparent",
                  cursor: items.length > 1 ? "pointer" : "default",
                  flexShrink: 0,
                  color: "var(--st-ink)",
                }}
                aria-label="Supprimer ce point"
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        {/* Add button */}
        <button
          onClick={() => addItem()}
          style={{
            marginTop: "0.875rem",
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "var(--st-ink-60)",
            cursor: "pointer",
            border: "none",
            background: "transparent",
            padding: "0.25rem 0",
          }}
        >
          <Plus size={14} />
          Ajouter un point
        </button>
      </div>
    );
  }

  // Form mode (non-slim)
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
        <Button variant="outline" size="sm" onClick={() => addItem()}>
          <Plus className="h-4 w-4 mr-2" /> Ajouter un point
        </Button>
      </div>
    </div>
  );
}
