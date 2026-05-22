import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FillBlanksBlockContent } from "@/types/lms-blocks";

interface Props {
  content: FillBlanksBlockContent;
  onChange: (content: FillBlanksBlockContent) => void;
  slim?: boolean;
}

function countBlanks(text: string): number {
  return (text.match(/\{\{[^}]+\}\}/g) ?? []).length;
}

export default function FillBlanksBlockEditor({ content, onChange, slim }: Props) {
  const blanksCount = useMemo(() => countBlanks(content.text ?? ""), [content.text]);

  if (slim) {
    return (
      <div
        style={{
          borderRadius: "var(--st-br, 20px)",
          border: "1px solid var(--st-ink-08)",
          padding: "1.25rem",
        }}
      >
        <div className="space-y-2">
          <textarea
            value={content.text ?? ""}
            onChange={(e) => onChange({ ...content, text: e.target.value })}
            placeholder="Ex: La photosynthèse produit de l'{{oxygène}} et du {{glucose}}."
            rows={4}
            className="w-full rounded-md border border-input px-3 py-2 text-sm font-mono resize-y"
            style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.8125rem" }}
          />
          {blanksCount > 0 && (
            <p style={{ fontSize: "0.75rem", color: "#69c3c4", fontWeight: 600 }}>
              {blanksCount} trou{blanksCount > 1 ? "s" : ""} détecté{blanksCount > 1 ? "s" : ""}
            </p>
          )}
        </div>
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
          placeholder="Titre de l'exercice…"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs font-semibold">Consigne (optionnelle)</Label>
        <Input
          value={content.instructions ?? ""}
          onChange={(e) => onChange({ ...content, instructions: e.target.value || null })}
          placeholder="Complétez les phrases suivantes…"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-semibold">
          Texte avec trous{" "}
          <span className="font-normal text-muted-foreground">— entourez les mots à deviner avec {"{{"}double accolades{"}}"}</span>
        </Label>
        <textarea
          value={content.text ?? ""}
          onChange={(e) => onChange({ ...content, text: e.target.value })}
          placeholder={"Ex: La photosynthèse produit de l'{{oxygène}} et du {{glucose}}."}
          rows={6}
          className="w-full rounded-md border border-input px-3 py-2 text-sm font-mono resize-y"
        />
        {blanksCount > 0 && (
          <p className="text-xs font-semibold" style={{ color: "#69c3c4" }}>
            {blanksCount} trou{blanksCount > 1 ? "s" : ""} détecté{blanksCount > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
