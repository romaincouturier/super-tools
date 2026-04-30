import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SpacerBlockContent } from "@/types/lms-blocks";

interface Props {
  content: SpacerBlockContent;
  onChange: (content: SpacerBlockContent) => void;
}

const MIN_HEIGHT = 4;
const MAX_HEIGHT = 240;

export default function SpacerBlockEditor({ content, onChange }: Props) {
  const handleHeight = (raw: string) => {
    const next = Number.parseInt(raw, 10);
    if (Number.isNaN(next)) return;
    const clamped = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, next));
    onChange({ ...content, height_px: clamped });
  };
  return (
    <div className="space-y-2">
      <Label>Hauteur (px)</Label>
      <Input
        type="number"
        min={MIN_HEIGHT}
        max={MAX_HEIGHT}
        step={4}
        value={content.height_px}
        onChange={(e) => handleHeight(e.target.value)}
      />
    </div>
  );
}
