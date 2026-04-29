import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ContainerBlockContent, ContainerMaxWidth } from "@/types/lms-blocks";

interface Props {
  content: ContainerBlockContent;
  /** Children blocks rendered by the parent player. Empty until ST-2026-0060 PR3. */
  children?: ReactNode;
}

const MAX_WIDTH_CLASSES: Record<ContainerMaxWidth, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
  full: "max-w-full",
};

export default function ContainerBlockViewer({ content, children }: Props) {
  return (
    <div className={cn("mx-auto w-full", MAX_WIDTH_CLASSES[content.max_width])}>
      <div className="space-y-6">{children}</div>
    </div>
  );
}
