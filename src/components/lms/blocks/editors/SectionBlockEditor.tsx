import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineEdit } from "./InlineEdit";
import type { SectionBackground, SectionBlockContent } from "@/types/lms-blocks";

interface Props {
  content: SectionBlockContent;
  onChange: (content: SectionBlockContent) => void;
  slim?: boolean;
}

const BG_STYLES: Record<SectionBackground, React.CSSProperties> = {
  default: {},
  muted: { background: "var(--st-surface)", borderRadius: 12, padding: "1rem 1.25rem" },
  primary: { background: "var(--st-ink)", borderRadius: 12, padding: "1rem 1.25rem" },
  accent: { background: "var(--st-yellow-soft)", borderRadius: 12, padding: "1rem 1.25rem" },
};

const BG_TEXT: Record<SectionBackground, string> = {
  default: "var(--st-ink)",
  muted: "var(--st-ink)",
  primary: "#fff",
  accent: "var(--st-ink)",
};

export default function SectionBlockEditor({ content, onChange, slim }: Props) {
  if (slim) {
    const bg = content.background ?? "default";
    const wrapStyle = BG_STYLES[bg] ?? {};
    const textColor = BG_TEXT[bg] ?? "var(--st-ink)";

    return (
      <div style={wrapStyle}>
        <InlineEdit
          value={content.title || ""}
          onChange={(v) => onChange({ ...content, title: v || null })}
          placeholder="Titre de section…"
          style={{
            fontWeight: 700,
            fontSize: "1.25rem",
            color: textColor,
            outline: "none",
            display: "block",
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Titre (optionnel)</Label>
        <Input
          value={content.title || ""}
          onChange={(e) => onChange({ ...content, title: e.target.value || null })}
          placeholder="Ex : Pour aller plus loin"
        />
      </div>
      <div>
        <Label>Fond</Label>
        <Select
          value={content.background ?? "default"}
          onValueChange={(value) => onChange({ ...content, background: value as SectionBackground })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Aucun</SelectItem>
            <SelectItem value="muted">Discret</SelectItem>
            <SelectItem value="primary">Primaire</SelectItem>
            <SelectItem value="accent">Accent</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
