import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import RichTextEditor from "@/components/content/RichTextEditor";
import { InlineEdit } from "./InlineEdit";
import { cryptoRandomId } from "@/types/lms-blocks";
import type { AccordionBlockContent, AccordionItem } from "@/types/lms-blocks";

interface Props {
  content: AccordionBlockContent;
  onChange: (content: AccordionBlockContent) => void;
  slim?: boolean;
}

export default function AccordionBlockEditor({ content, onChange, slim }: Props) {
  const items = content.items ?? [];

  const setItems = (next: AccordionItem[]) => onChange({ ...content, items: next });

  const updateItem = (i: number, patch: Partial<AccordionItem>) =>
    setItems(items.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));

  const addItem = () =>
    setItems([...items, { id: cryptoRandomId(), question: "Question", answer_html: "Réponse" }]);

  const removeItem = (i: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, idx) => idx !== i));
  };

  if (slim) {
    return (
      <div
        style={{
          borderRadius: "var(--st-br, 20px)",
          border: "1px solid var(--st-ink-08)",
          padding: "1.25rem",
        }}
      >
        <div className="space-y-2" style={{ marginBottom: "0.875rem" }}>
          {items.map((item, i) => (
            <div
              key={item.id}
              style={{
                borderRadius: 12,
                border: "1.5px solid #e5e7eb",
                padding: "0.625rem 0.875rem",
                background: "#fff",
              }}
            >
              <div className="flex items-center gap-2">
                <InlineEdit
                  value={item.question}
                  onChange={(v) => updateItem(i, { question: v || "Question" })}
                  placeholder="Question…"
                  style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--st-ink)", outline: "none", flex: 1 }}
                />
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(i)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db" }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div style={{ marginTop: 6 }}>
                <RichTextEditor
                  content={item.answer_html || ""}
                  onChange={(answer_html) => updateItem(i, { answer_html })}
                  placeholder="Réponse…"
                />
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={addItem}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: "0.8125rem", fontWeight: 500, color: "var(--st-ink-60)",
            border: "none", background: "transparent", cursor: "pointer",
          }}
        >
          <Plus size={14} /> Ajouter une entrée
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Titre (optionnel)</Label>
        <Input
          value={content.title ?? ""}
          onChange={(e) => onChange({ ...content, title: e.target.value || null })}
          placeholder="Titre de l'accordéon…"
        />
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={item.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Entrée {i + 1}</span>
              {items.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Question / Titre</Label>
              <Input
                value={item.question}
                onChange={(e) => updateItem(i, { question: e.target.value })}
                placeholder="Question…"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Réponse</Label>
              <RichTextEditor
                content={item.answer_html || ""}
                onChange={(answer_html) => updateItem(i, { answer_html })}
                placeholder="Réponse…"
              />
            </div>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={addItem}>
        <Plus className="h-4 w-4 mr-1" /> Ajouter une entrée
      </Button>
    </div>
  );
}
