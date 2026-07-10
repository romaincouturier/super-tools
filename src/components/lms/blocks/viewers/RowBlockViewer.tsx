import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { RowBlockContent, RowColumnCount } from "@/types/lms-blocks";

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

export default function RowBlockViewer({ content, columns }: Props) {
  const cols = COLUMN_GRID[content.column_count] || COLUMN_GRID[1];
  return (
    <div className={cn("grid gap-6 items-start", cols)}>
      {columns.map((column, i) => (
        <div key={i} className="min-w-0 space-y-6">
          {column}
        </div>
      ))}
    </div>
  );
}
