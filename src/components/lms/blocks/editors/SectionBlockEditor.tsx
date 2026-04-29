import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SectionBackground, SectionBlockContent } from "@/types/lms-blocks";

interface Props {
  content: SectionBlockContent;
  onChange: (content: SectionBlockContent) => void;
}

export default function SectionBlockEditor({ content, onChange }: Props) {
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
