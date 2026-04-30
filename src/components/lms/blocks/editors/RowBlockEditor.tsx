import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RowBlockContent, RowColumnCount } from "@/types/lms-blocks";

interface Props {
  content: RowBlockContent;
  onChange: (content: RowBlockContent) => void;
}

export default function RowBlockEditor({ content, onChange }: Props) {
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
