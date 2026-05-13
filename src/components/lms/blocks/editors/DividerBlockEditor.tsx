import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DividerBlockContent, DividerStyle } from "@/types/lms-blocks";

interface Props {
  content: DividerBlockContent;
  onChange: (content: DividerBlockContent) => void;
  slim?: boolean;
}

export default function DividerBlockEditor({ content, onChange, slim }: Props) {
  if (slim) {
    return (
      <hr
        style={{
          border: 0,
          borderTop: `1px ${content.style === "dashed" ? "dashed" : "solid"} rgba(16,24,32,0.12)`,
          margin: 0,
        }}
      />
    );
  }

  return (
    <div className="space-y-2">
      <Label>Style</Label>
      <Select
        value={content.style}
        onValueChange={(value) => onChange({ ...content, style: value as DividerStyle })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="solid">Trait plein</SelectItem>
          <SelectItem value="dashed">Pointillés</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
