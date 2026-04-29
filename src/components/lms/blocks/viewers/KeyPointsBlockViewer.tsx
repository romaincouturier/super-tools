import { Lightbulb } from "lucide-react";
import type { KeyPointsBlockContent } from "@/types/lms-blocks";

interface Props {
  content: KeyPointsBlockContent;
}

export default function KeyPointsBlockViewer({ content }: Props) {
  const items = (content.items || []).filter((i) => i.trim());
  if (items.length === 0 && !content.title) return null;
  return (
    <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
      <div className="flex items-start gap-2 mb-2 text-amber-900">
        <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" />
        <p className="font-semibold break-words">{content.title || "À retenir"}</p>
      </div>
      <ul className="space-y-1.5 text-sm text-amber-950 list-disc pl-5">
        {items.map((item, i) => (
          <li key={i} className="break-words">{item}</li>
        ))}
      </ul>
    </div>
  );
}
