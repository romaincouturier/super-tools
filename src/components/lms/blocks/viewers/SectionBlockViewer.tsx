import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { SectionBackground, SectionBlockContent } from "@/types/lms-blocks";

interface Props {
  content: SectionBlockContent;
  /** Children blocks rendered by the parent player. Empty until ST-2026-0060 PR3. */
  children?: ReactNode;
}

const BACKGROUND_CLASSES: Record<SectionBackground, string> = {
  default: "",
  muted: "bg-muted/40",
  primary: "bg-primary/5",
  accent: "bg-accent/30",
};

export default function SectionBlockViewer({ content, children }: Props) {
  const bg = BACKGROUND_CLASSES[content.background ?? "default"];
  return (
    <section className={cn("rounded-lg", bg && "px-4 py-6", bg)}>
      {content.title && <h3 className="font-semibold mb-3 break-words">{content.title}</h3>}
      {children && <div className="space-y-6">{children}</div>}
    </section>
  );
}
