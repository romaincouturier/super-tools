import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DragWordsBlockContent } from "@/types/lms-blocks";

interface Props {
  content: DragWordsBlockContent;
  onChange: (content: DragWordsBlockContent) => void;
  slim?: boolean;
}

function countWords(text: string): number {
  return (text.match(/\*([^*]+)\*/g) ?? []).length;
}

export default function DragWordsBlockEditor({ content, onChange, slim }: Props) {
  const wordCount = useMemo(() => countWords(content.text ?? ""), [content.text]);

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
            placeholder="Ex: Le *soleil* est une *étoile* de type G."
            rows={4}
            className="w-full rounded-md border border-input px-3 py-2 text-sm font-mono resize-y"
            style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.8125rem" }}
          />
          {wordCount > 0 && (
            <p style={{ fontSize: "0.75rem", color: "#69c3c4", fontWeight: 600 }}>
              {wordCount} mot{wordCount > 1 ? "s" : ""} à glisser détecté{wordCount > 1 ? "s" : ""}
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
          placeholder="Glissez les mots au bon endroit…"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-semibold">
          Texte avec mots à replacer{" "}
          <span className="font-normal text-muted-foreground">— entourez les mots à déplacer avec *astérisques*</span>
        </Label>
        <textarea
          value={content.text ?? ""}
          onChange={(e) => onChange({ ...content, text: e.target.value })}
          placeholder={"Ex: Le *soleil* est une *étoile* de type G située à 150 millions de km de la *Terre*."}
          rows={6}
          className="w-full rounded-md border border-input px-3 py-2 text-sm font-mono resize-y"
        />
        {wordCount > 0 && (
          <p className="text-xs font-semibold" style={{ color: "#69c3c4" }}>
            {wordCount} mot{wordCount > 1 ? "s" : ""} à glisser détecté{wordCount > 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
