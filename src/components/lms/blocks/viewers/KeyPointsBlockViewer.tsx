import { Lightbulb } from "lucide-react";
import type { KeyPointsBlockContent } from "@/types/lms-blocks";

interface Props {
  content: KeyPointsBlockContent;
}

export default function KeyPointsBlockViewer({ content }: Props) {
  const items = (content.items || []).filter((i) => i.trim());
  if (items.length === 0 && !content.title) return null;
  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-4">
      <div className="flex items-center gap-3 mb-3 text-amber-900">
        <Lightbulb className="h-5 w-5 shrink-0" />
        <p className="text-lg font-bold break-words">{content.title || "À retenir"}</p>
      </div>
      <ul className="space-y-2 text-amber-950 list-disc pl-5">
        {items.map((item, i) => (
          <li key={i} className="break-words">{item}</li>
        ))}
      </ul>
    </div>
  );
}
