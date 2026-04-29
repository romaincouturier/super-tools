import type { SpacerBlockContent } from "@/types/lms-blocks";

interface Props {
  content: SpacerBlockContent;
}

export default function SpacerBlockViewer({ content }: Props) {
  return <div aria-hidden style={{ height: `${content.height_px}px` }} />;
}
