import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RowBlockContent, RowColumnCount } from "@/types/lms-blocks";

interface Props {
  content: RowBlockContent;
  onChange: (content: RowBlockContent) => void;
  slim?: boolean;
}

const COL_LABELS: Record<number, string> = { 1: "1 colonne", 2: "2 colonnes", 3: "3 colonnes" };

export default function RowBlockEditor({ content, onChange, slim }: Props) {
  if (slim) {
    return (
      <div className="flex items-center gap-1.5 py-0.5">
        {Array.from({ length: content.column_count }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-4 rounded"
            style={{ background: "rgba(16,24,32,0.05)", border: "1.5px dashed rgba(16,24,32,0.15)" }}
          />
        ))}
        <span className="text-xs ml-1 shrink-0" style={{ color: "var(--st-ink-muted)" }}>
          {COL_LABELS[content.column_count] ?? `${content.column_count} col.`}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Nombre de colonnes</Label>
      <Select
        value={String(content.column_count)}
        onValueChange={(value) =>
          onChange({ ...content, column_count: Number.parseInt(value, 10) as RowColumnCount })
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">1 colonne</SelectItem>
          <SelectItem value="2">2 colonnes</SelectItem>
          <SelectItem value="3">3 colonnes</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Sur mobile, les colonnes s&apos;empilent verticalement.
      </p>
    </div>
  );
}
