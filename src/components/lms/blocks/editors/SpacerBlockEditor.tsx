import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SpacerBlockContent } from "@/types/lms-blocks";

interface Props {
  content: SpacerBlockContent;
  onChange: (content: SpacerBlockContent) => void;
  slim?: boolean;
}

const MIN_HEIGHT = 4;
const MAX_HEIGHT = 240;

export default function SpacerBlockEditor({ content, onChange, slim }: Props) {
  const handleHeight = (raw: string) => {
    const next = Number.parseInt(raw, 10);
    if (Number.isNaN(next)) return;
    const clamped = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, next));
    onChange({ ...content, height_px: clamped });
  };

  if (slim) {
    return (
      <div
        style={{ height: content.height_px, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <span
          style={{
            fontSize: "0.6875rem",
            color: "rgba(16,24,32,0.25)",
            fontFamily: "monospace",
            userSelect: "none",
          }}
        >
          ↕ {content.height_px}px
        </span>
      </div>
    );
  }

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
