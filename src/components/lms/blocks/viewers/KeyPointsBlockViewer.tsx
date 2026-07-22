import { Lightbulb, Check } from "lucide-react";
import type { KeyPointsBlockContent } from "@/types/lms-blocks";

const YELLOW = "#FFD100";
const INK = "#101820";
const BORDER = "#EDEDED";

interface Props {
  content: KeyPointsBlockContent;
}

export default function KeyPointsBlockViewer({ content }: Props) {
  const items = (content.items || []).filter((i) => i.trim());
  if (items.length === 0 && !content.title && !content.image_url) return null;
  return (
    <div
      className="rounded-2xl bg-white border px-6 py-6"
      style={{
        borderColor: BORDER,
        borderLeft: `4px solid ${YELLOW}`,
        boxShadow: "0 8px 24px rgba(16, 24, 32, 0.06)",
      }}
    >
      <div className="flex items-center gap-3 mb-5">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: YELLOW }}
        >
          <Lightbulb className="h-5 w-5" style={{ color: INK }} />
        </span>
        <p className="text-2xl font-bold break-words" style={{ color: INK }}>
          {content.title || "À retenir"}
        </p>
      </div>
      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: YELLOW }}
              >
                <Check className="h-4 w-4" strokeWidth={3} style={{ color: INK }} />
              </span>
              <span
                className="text-base sm:text-lg font-semibold break-words"
                style={{ color: INK }}
              >
                {item}
              </span>
            </li>
          ))}
        </ul>
      )}
      {content.image_url && (
        <img
          src={content.image_url}
          alt=""
          className="mt-4 w-full h-auto rounded-lg"
        />
      )}
    </div>
  );
}
