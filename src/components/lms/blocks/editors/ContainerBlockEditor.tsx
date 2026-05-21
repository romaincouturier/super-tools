import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ContainerBlockContent, ContainerMaxWidth } from "@/types/lms-blocks";

interface Props {
  content: ContainerBlockContent;
  onChange: (content: ContainerBlockContent) => void;
  slim?: boolean;
}

const WIDTH_LABELS: Record<ContainerMaxWidth, string> = {
  sm: "Étroite",
  md: "Moyenne",
  lg: "Large",
  xl: "Très large",
  full: "Pleine largeur",
};

export default function ContainerBlockEditor({ content, onChange, slim }: Props) {
  if (slim) {
    return (
      <p className="text-xs py-0.5" style={{ color: "var(--st-ink-muted)" }}>
        Largeur max :{" "}
        <span className="font-medium" style={{ color: "var(--st-ink)" }}>
          {WIDTH_LABELS[content.max_width] ?? content.max_width}
        </span>
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Largeur maximale</Label>
      <Select
        value={content.max_width}
        onValueChange={(value) => onChange({ ...content, max_width: value as ContainerMaxWidth })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sm">Étroite</SelectItem>
          <SelectItem value="md">Moyenne</SelectItem>
          <SelectItem value="lg">Large</SelectItem>
          <SelectItem value="xl">Très large</SelectItem>
          <SelectItem value="full">Pleine</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
