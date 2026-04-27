import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ChecklistBlockContent } from "@/types/lms-blocks";

interface Props {
  content: ChecklistBlockContent;
}

/**
 * Interactive checklist. Tick state lives only in component memory — the
 * progress is not persisted server-side in this stage. Resetting on reload
 * is acceptable for a simple "follow these steps" interaction.
 */
export default function ChecklistBlockViewer({ content }: Props) {
  const items = (content.items || []).filter((i) => i.label.trim());
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  if (items.length === 0 && !content.title) return null;

  const toggle = (id: string) =>
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      {content.title && <p className="font-semibold mb-2">{content.title}</p>}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <Checkbox
              id={`checklist-${item.id}`}
              checked={!!checked[item.id]}
              onCheckedChange={() => toggle(item.id)}
              className="mt-0.5 shrink-0"
            />
            <label
              htmlFor={`checklist-${item.id}`}
              className={cn(
                "text-sm cursor-pointer flex-1 min-w-0 break-words",
                checked[item.id] && "line-through text-muted-foreground",
              )}
            >
              {item.label}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
