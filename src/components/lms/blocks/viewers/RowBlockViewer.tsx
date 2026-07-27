import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { RowBlockContent, RowColumnCount, RowVerticalAlign } from "@/types/lms-blocks";
import { RowMediaContext, resolveRowMediaSettings } from "./rowMediaContext";

interface Props {
  content: RowBlockContent;
  /** One entry per column; each column renders as an independent vertical stack (ST-2026-0236). */
  columns: ReactNode[][];
}

const COLUMN_GRID: Record<RowColumnCount, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-3",
};

const VERTICAL_ALIGN: Record<RowVerticalAlign, string> = {
  top: "items-start",
  center: "items-center",
  bottom: "items-end",
};

export default function RowBlockViewer({ content, columns }: Props) {
  const cols = COLUMN_GRID[content.column_count] || COLUMN_GRID[1];
  const media = resolveRowMediaSettings(content);

  return (
    <RowMediaContext.Provider value={content.column_count > 1 ? media : null}>
      <div className={cn("grid gap-6", VERTICAL_ALIGN[media.verticalAlign], cols)}>
        {columns.map((column, i) => (
          <div key={i} className="min-w-0 space-y-6">
            {column}
          </div>
        ))}
      </div>
    </RowMediaContext.Provider>
  );
}
