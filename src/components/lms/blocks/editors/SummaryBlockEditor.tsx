import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { InlineEdit } from "./InlineEdit";
import { cryptoRandomId } from "@/types/lms-blocks";
import type { SummaryBlockContent, SummaryStatement } from "@/types/lms-blocks";

interface Props {
  content: SummaryBlockContent;
  onChange: (content: SummaryBlockContent) => void;
  slim?: boolean;
}

export default function SummaryBlockEditor({ content, onChange, slim }: Props) {
  const statements = content.statements ?? [];

  const setStatements = (next: SummaryStatement[]) => onChange({ ...content, statements: next });

  const updateStatement = (i: number, patch: Partial<SummaryStatement>) =>
    setStatements(statements.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const addStatement = () =>
    setStatements([...statements, { id: cryptoRandomId(), text: "Nouvelle affirmation", is_correct: true }]);

  const removeStatement = (i: number) => {
    if (statements.length <= 1) return;
    setStatements(statements.filter((_, idx) => idx !== i));
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
          {statements.map((stmt, i) => (
            <div
              key={stmt.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                borderRadius: 10,
                border: `1.5px solid ${stmt.is_correct ? "#69c3c4" : "#e5e7eb"}`,
                padding: "0.5rem 0.75rem",
                background: stmt.is_correct ? "rgba(105,195,196,0.06)" : "#fff",
              }}
            >
              <button
                type="button"
                onClick={() => updateStatement(i, { is_correct: !stmt.is_correct })}
                title={stmt.is_correct ? "Correcte" : "Incorrecte"}
                style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                  border: `2px solid ${stmt.is_correct ? "#69c3c4" : "#d1d5db"}`,
                  background: stmt.is_correct ? "#69c3c4" : "#fff",
                  cursor: "pointer",
                }}
              />
              <InlineEdit
                value={stmt.text}
                onChange={(v) => updateStatement(i, { text: v || "Affirmation" })}
                placeholder="Affirmation…"
                style={{ fontSize: "0.8125rem", color: "var(--st-ink)", outline: "none", flex: 1 }}
              />
              {statements.length > 1 && (
                <button
                  onClick={() => removeStatement(i)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db" }}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={addStatement}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: "0.8125rem", fontWeight: 500, color: "var(--st-ink-60)",
            border: "none", background: "transparent", cursor: "pointer",
          }}
        >
          <Plus size={14} /> Ajouter une affirmation
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs font-semibold">Titre (optionnel)</Label>
        <Input
          value={content.title ?? ""}
          onChange={(e) => onChange({ ...content, title: e.target.value || null })}
          placeholder="Titre du résumé…"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-semibold">Consigne (optionnelle)</Label>
        <Input
          value={content.instructions ?? ""}
          onChange={(e) => onChange({ ...content, instructions: e.target.value || null })}
          placeholder="Cochez toutes les affirmations correctes…"
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Affirmations</Label>
          <span className="text-xs text-muted-foreground">
            {statements.filter((s) => s.is_correct).length} correcte{statements.filter((s) => s.is_correct).length !== 1 ? "s" : ""} / {statements.length}
          </span>
        </div>
        {statements.map((stmt, i) => (
          <div key={stmt.id} className="flex items-center gap-3 rounded-lg border p-3">
            <button
              type="button"
              onClick={() => updateStatement(i, { is_correct: !stmt.is_correct })}
              title={stmt.is_correct ? "Marquer comme incorrecte" : "Marquer comme correcte"}
              style={{
                width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                border: `2px solid ${stmt.is_correct ? "#69c3c4" : "#d1d5db"}`,
                background: stmt.is_correct ? "#69c3c4" : "#fff",
                cursor: "pointer",
              }}
            />
            <Input
              value={stmt.text}
              onChange={(e) => updateStatement(i, { text: e.target.value })}
              placeholder="Affirmation…"
              className="flex-1"
            />
            {statements.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeStatement(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={addStatement}>
        <Plus className="h-4 w-4 mr-1" /> Ajouter une affirmation
      </Button>
    </div>
  );
}
