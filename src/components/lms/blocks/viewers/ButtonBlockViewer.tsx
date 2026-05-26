import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import type { ButtonBlockContent, ButtonVariant } from "@/types/lms-blocks";

interface Props {
  content: ButtonBlockContent;
}

const VARIANT_TO_BUTTON: Record<Exclude<ButtonVariant, "supertilt">, "default" | "secondary" | "outline"> = {
  primary: "default",
  secondary: "secondary",
  outline: "outline",
};

const ALIGN_CLASS: Record<string, string> = {
  left: "flex justify-start",
  center: "flex justify-center",
  right: "flex justify-end",
};

export default function ButtonBlockViewer({ content }: Props) {
  if (!content.label) return null;
  const hasUrl = !!content.url;
  const newTab = content.open_in_new_tab !== false;
  const alignClass = ALIGN_CLASS[content.alignment ?? "center"];

  // SuperTilt brand CTA: yellow #FFD100 background, ink #101820 text, 20px radius
  if (content.variant === "supertilt") {
    const className =
      "inline-flex items-center justify-center gap-2 whitespace-normal text-center font-semibold transition-all hover:-translate-y-px hover:shadow-lg";
    const style = {
      background: "#FFD100",
      color: "#101820",
      borderRadius: 20,
      padding: "0.75rem 1.75rem",
      fontSize: "0.9375rem",
      boxShadow: "0 4px 12px rgba(255, 209, 0, 0.35)",
    };
    const inner = (
      <>
        <span className="break-words">{content.label}</span>
        {hasUrl && newTab && <ExternalLink className="h-4 w-4 shrink-0" />}
      </>
    );
    return (
      <div className={alignClass}>
        {hasUrl ? (
          <a
            href={content.url}
            target={newTab ? "_blank" : undefined}
            rel={newTab ? "noopener noreferrer" : undefined}
            className={className}
            style={style}
          >
            {inner}
          </a>
        ) : (
          <span className={className} style={style}>{inner}</span>
        )}
      </div>
    );
  }

  return (
    <div className={alignClass}>
      <Button
        asChild
        variant={VARIANT_TO_BUTTON[content.variant as Exclude<ButtonVariant, "supertilt">] || "default"}
        className="whitespace-normal h-auto min-h-10 py-2 text-center"
      >
        {hasUrl ? (
          <a
            href={content.url}
            target={newTab ? "_blank" : undefined}
            rel={newTab ? "noopener noreferrer" : undefined}
          >
            <span className="break-words">{content.label}</span>
            {newTab && <ExternalLink className="ml-2 h-4 w-4 shrink-0" />}
          </a>
        ) : (
          <span><span className="break-words">{content.label}</span></span>
        )}
      </Button>
    </div>
  );
}
