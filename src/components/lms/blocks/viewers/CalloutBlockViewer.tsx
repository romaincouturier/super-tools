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
      className="border-l-4 px-5 py-4"
      style={containerStyle}
    >
      {(content.title || levelEntry) && (
        <p className="text-lg font-bold mb-2 break-words flex items-center gap-2">
          {showIcon && levelEntry && <span aria-hidden="true" className="text-xl leading-none">{levelEntry.icon}</span>}
          {content.title || (levelEntry ? levelEntry.defaultTitle : null)}
        </p>
      )}
      {content.body_html && (
        <div
          className="prose max-w-none break-words"
          style={{
            color: palette.text,
            // Force link color to match the palette text so links are readable
            // on any background (yellow, black, teal, etc.) — underline stays visible.
            "--tw-prose-links": palette.text,
            "--tw-prose-bold": palette.text,
            "--tw-prose-headings": palette.text,
          } as React.CSSProperties}
          dangerouslySetInnerHTML={{ __html: content.body_html }}
        />
      )}
    </div>
  );
}
