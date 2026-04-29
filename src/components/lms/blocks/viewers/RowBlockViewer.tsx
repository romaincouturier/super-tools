import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { RowBlockContent, RowColumnCount } from "@/types/lms-blocks";

interface Props {
  content: RowBlockContent;
  /** Children blocks rendered by the parent player. Empty until ST-2026-0060 PR3. */
  children?: ReactNode;
}

const COLUMN_GRID: Record<RowColumnCount, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-3",
};

export default function RowBlockViewer({ content, children }: Props) {
  const cols = COLUMN_GRID[content.column_count] || COLUMN_GRID[1];
  return <div className={cn("grid gap-6", cols)}>{children}</div>;
}
