import { CALLOUT_PALETTE, CALLOUT_LEVELS } from "../callout-colors";
import type { CalloutBlockContent } from "@/types/lms-blocks";

interface Props {
  content: CalloutBlockContent;
}

export default function CalloutBlockViewer({ content }: Props) {
  if (!content.title && !content.body_html) return null;

  const palette = CALLOUT_PALETTE[content.color] ?? CALLOUT_PALETTE.blue;
  const radius = content.border_radius ?? 8;
  const showIcon = content.show_icon !== false;
  const levelEntry = content.level ? CALLOUT_LEVELS[content.level] : null;

  const containerStyle: React.CSSProperties = {
    backgroundColor: palette.bg,
    color: palette.text,
    borderLeftColor: palette.border,
    borderRadius: `${radius}px`,
  };

  return (
    <div
      className="border-l-4 px-4 py-3"
      style={containerStyle}
    >
      {(content.title || levelEntry) && (
        <p className="font-semibold mb-1 break-words flex items-center gap-1.5">
          {showIcon && levelEntry && <span aria-hidden="true">{levelEntry.icon}</span>}
          {content.title || (levelEntry ? levelEntry.defaultTitle : null)}
        </p>
      )}
      {content.body_html && (
        <div
          className="prose prose-sm max-w-none break-words"
          style={{ color: palette.text }}
          dangerouslySetInnerHTML={{ __html: content.body_html }}
        />
      )}
    </div>
  );
}
