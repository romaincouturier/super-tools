import { BULLET_CHARS } from "@/types/lms-blocks";
import type { BulletListBlockContent } from "@/types/lms-blocks";

const SPACING_CLASS: Record<string, string> = {
  compact: "space-y-1",
  normal:  "space-y-2",
  relaxed: "space-y-3.5",
};

interface Props {
  content: BulletListBlockContent;
}

export default function BulletListBlockViewer({ content }: Props) {
  const items = (content.items || []).filter((i) => i.trim());
  if (items.length === 0 && !content.title) return null;

  const bulletChar = BULLET_CHARS[content.bullet_style ?? "round"];
  const spacingClass = SPACING_CLASS[content.item_spacing ?? "normal"] ?? SPACING_CLASS.normal;
  const bulletColor = content.bullet_color || undefined;
  const textColor = content.text_color || undefined;

  return (
    <div style={textColor ? { color: textColor } : undefined}>
      {content.title && (
        <p className="font-semibold mb-2 break-words">{content.title}</p>
      )}
      <ul className={spacingClass}>
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2.5 min-w-0">
            <span
              className="shrink-0 mt-0.5 text-base leading-snug select-none"
              aria-hidden="true"
              style={bulletColor ? { color: bulletColor } : undefined}
            >
              {bulletChar}
            </span>
            <span className="flex-1 min-w-0 break-words text-sm leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
