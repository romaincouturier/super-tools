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
  muted: { background: "hsl(var(--grey-light))", borderRadius: 12, padding: "1rem 1.25rem" },
  primary: { background: "hsl(var(--ink))", borderRadius: 12, padding: "1rem 1.25rem" },
  accent: { background: "hsl(var(--yellow-brand) / 0.22)", borderRadius: 12, padding: "1rem 1.25rem" },
};

const BG_TEXT: Record<SectionBackground, string> = {
  default: "hsl(var(--ink))",
  muted: "hsl(var(--ink))",
  primary: "#fff",
  accent: "hsl(var(--ink))",
};

export default function SectionBlockEditor({ content, onChange, slim }: Props) {
  if (slim) {
    const bg = content.background ?? "default";
    const wrapStyle = BG_STYLES[bg] ?? {};
    const textColor = BG_TEXT[bg] ?? "hsl(var(--ink))";

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
