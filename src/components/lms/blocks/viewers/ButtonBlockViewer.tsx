import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import type { ButtonBlockContent, ButtonVariant } from "@/types/lms-blocks";

interface Props {
  content: ButtonBlockContent;
}

const VARIANT_TO_BUTTON: Record<ButtonVariant, "default" | "secondary" | "outline"> = {
  primary: "default",
  secondary: "secondary",
  outline: "outline",
};

export default function ButtonBlockViewer({ content }: Props) {
  if (!content.url || !content.label) return null;
  const newTab = content.open_in_new_tab !== false;
  return (
    <div>
      <Button asChild variant={VARIANT_TO_BUTTON[content.variant] || "default"} className="w-full sm:w-auto">
        <a
          href={content.url}
          target={newTab ? "_blank" : undefined}
          rel={newTab ? "noopener noreferrer" : undefined}
        >
          {content.label}
          {newTab && <ExternalLink className="ml-2 h-4 w-4" />}
        </a>
      </Button>
    </div>
  );
}
