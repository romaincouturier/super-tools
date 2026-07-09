import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineEdit } from "./InlineEdit";
import CodeBlockViewer from "../viewers/CodeBlockViewer";
import { CODE_LANGUAGES } from "@/lib/codeHighlight";
import type { CodeBlockContent } from "@/types/lms-blocks";

interface Props {
  content: CodeBlockContent;
  onChange: (content: CodeBlockContent) => void;
  slim?: boolean;
}

export default function CodeBlockEditor({ content, onChange, slim }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className="space-y-3">
      <InlineEdit
        value={content.title || ""}
        onChange={(v) => onChange({ ...content, title: v || null })}
        placeholder="Titre du bloc (facultatif)…"
        style={{
          fontSize: "0.9375rem",
          fontWeight: 600,
          color: "var(--st-ink)",
          outline: "none",
          display: "block",
          width: "100%",
        }}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="code-block-language" className="text-xs text-muted-foreground">
            Langage
          </Label>
          <Select
            value={content.language}
            onValueChange={(language) => onChange({ ...content, language })}
          >
            <SelectTrigger id="code-block-language" className="h-8 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CODE_LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value}>
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="code-block-line-numbers"
            checked={content.showLineNumbers !== false}
            onCheckedChange={(v) => onChange({ ...content, showLineNumbers: v })}
          />
          <Label htmlFor="code-block-line-numbers" className="text-xs cursor-pointer">
            Numéros de ligne
          </Label>
        </div>
        <button
          type="button"
          onClick={() => setPreviewOpen((v) => !v)}
          className="ml-auto flex items-center gap-1.5 text-xs font-medium rounded-md px-2 py-1"
          style={{ color: previewOpen ? "var(--st-ink)" : "var(--st-ink-50)" }}
        >
          {previewOpen ? <EyeOff size={13} /> : <Eye size={13} />}
          {previewOpen ? "Masquer l'aperçu" : "Aperçu"}
        </button>
      </div>

      <textarea
        value={content.code}
        onChange={(e) => onChange({ ...content, code: e.target.value })}
        placeholder={"function hello() {\n  console.log(\"Hello world\");\n}"}
        spellCheck={false}
        aria-label="Code source"
        style={{
          width: "100%",
          minHeight: slim ? 140 : 200,
          padding: "0.875rem 1rem",
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.08)",
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace",
          fontSize: "0.8125rem",
          lineHeight: 1.65,
          color: "#e6edf3",
          background: "#1e242e",
          outline: "none",
          resize: "vertical",
          boxSizing: "border-box",
          whiteSpace: "pre",
          overflowX: "auto",
        }}
      />

      {previewOpen && (
        content.code.trim() ? (
          <CodeBlockViewer content={content} />
        ) : (
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--st-ink-50)", fontStyle: "italic" }}>
            Saisissez du code pour voir l'aperçu.
          </p>
        )
      )}
    </div>
  );
}
