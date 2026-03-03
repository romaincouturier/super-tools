import type { CSSProperties, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface TagItem {
  key: string;
  label: string;
  icon?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

interface CardTagListProps {
  tags: TagItem[];
  max?: number;
  className?: string;
  renderTag?: (tag: TagItem) => ReactNode;
}

const DefaultTag = ({ tag }: { tag: TagItem }) => (
  <Badge
    variant="secondary"
    className={cn("text-xs px-1.5 py-0", tag.icon && "flex items-center gap-1", tag.className)}
    style={tag.style}
  >
    {tag.icon}
    {tag.label}
  </Badge>
);

const CardTagList = ({ tags, max = 3, className, renderTag }: CardTagListProps) => {
  if (!tags || tags.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.slice(0, max).map((tag) =>
        renderTag ? renderTag(tag) : <DefaultTag key={tag.key} tag={tag} />,
      )}
      {tags.length > max && (
        <Badge variant="secondary" className="text-xs px-1.5 py-0">
          +{tags.length - max}
        </Badge>
      )}
    </div>
  );
};

export default CardTagList;
