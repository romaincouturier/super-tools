import { cn } from "@/lib/utils";
import type { DividerBlockContent } from "@/types/lms-blocks";

interface Props {
  content: DividerBlockContent;
}

export default function DividerBlockViewer({ content }: Props) {
  return (
    <hr
      className={cn(
        "border-0 border-t my-2",
        content.style === "dashed" ? "border-dashed border-muted-foreground/40" : "border-border",
      )}
    />
  );
}
