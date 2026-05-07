import { useState } from "react";
import { Eye, EyeOff, ChevronUp, ChevronDown, Copy, Trash2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BLOCK_META } from "./registry";
import type { BlockTreeNode } from "@/services/lms-blocks";
import type { LessonBlock, LessonBlockContent } from "@/types/lms-blocks";
import { useConfirm } from "@/hooks/useConfirm";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function getBlockSummary(block: LessonBlock): string {
  const c = block.content as Record<string, unknown> | null;
  if (!c) return "";
  switch (block.type) {
    case "text":     return c.html ? stripHtml(String(c.html)).slice(0, 60) : "";
    case "video":    return c.url ? String(c.url).replace(/^https?:\/\//, "").slice(0, 50) : "Aucune URL";
    case "image":    return c.url ? "Image" : "Aucune image";
    case "file":     return c.name ? String(c.name) : c.url ? "Fichier" : "Aucun fichier";
    case "callout":  return (c.title ? String(c.title) : "") || (c.body_html ? stripHtml(String(c.body_html)).slice(0, 50) : "");
    case "key_points":  return c.title ? String(c.title) : "Points clés";
    case "checklist":   return c.title ? String(c.title) : `${(c.items as unknown[])?.length ?? 0} éléments`;
    case "bullet_list": return c.title ? String(c.title) : `${(c.items as unknown[])?.length ?? 0} éléments`;
    case "button":   return c.label ? String(c.label) : "Bouton";
    case "exercise": return c.prompt_html ? stripHtml(String(c.prompt_html)).slice(0, 50) : "Exercice";
    case "self_assessment": return c.prompt ? String(c.prompt).slice(0, 50) : "Auto-évaluation";
    case "work_deposit": return c.title ? String(c.title) : "Dépôt de travail";
    case "quiz":     return c.quiz_id ? `Quiz (${String(c.quiz_id).slice(0, 8)}…)` : "Quiz non configuré";
    case "assignment": return c.instructions_html ? stripHtml(String(c.instructions_html)).slice(0, 50) : "Devoir";
    case "section":  return (c.bg_color && c.bg_color !== "default") ? `Fond : ${c.bg_color}` : "";
    case "row":      return c.column_count ? `${c.column_count} colonne(s)` : "";
    case "container": return c.max_width ? `Max ${c.max_width}` : "";
    case "divider":  return c.style ? String(c.style) : "";
    case "spacer":   return c.height_px ? `${c.height_px}px` : "";
    default:         return "";
  }
}

interface OutlineRowProps {
  node: BlockTreeNode;
  depth: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onToggleHidden: (id: string, hidden: boolean) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

function OutlineRow({
  node, depth, isFirst, isLast,
  onMoveUp, onMoveDown, onToggleHidden, onDuplicate, onDelete,
}: OutlineRowProps) {
  const [expanded, setExpanded] = useState(true);
  const { block, children } = node;
  const meta = BLOCK_META[block.type];
  const Icon = meta?.icon;
  const summary = getBlockSummary(block);
  const hasChildren = children.length > 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 py-1 px-2 rounded hover:bg-muted/50 group text-sm",
          block.hidden && "opacity-50",
        )}
        style={{ paddingLeft: `${8 + depth * 20}px` }}
      >
        {/* Expand toggle for layout blocks with children */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label={expanded ? "Réduire" : "Développer"}
          >
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        {/* Type icon */}
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}

        {/* Label + summary */}
        <span className="font-medium shrink-0 text-xs text-muted-foreground">{meta?.label ?? block.type}</span>
        {summary && (
          <span className="flex-1 truncate text-xs text-foreground/70 min-w-0">{summary}</span>
        )}

        {/* Hidden badge */}
        {block.hidden && (
          <Badge variant="outline" className="h-4 text-[10px] px-1 shrink-0">masqué</Badge>
        )}

        {/* Actions — shown on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto">
          {onMoveUp && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={isFirst} aria-label="Monter">
              <ChevronUp className="h-3 w-3" />
            </Button>
          )}
          {onMoveDown && (
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={isLast} aria-label="Descendre">
              <ChevronDown className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onToggleHidden(block.id, !block.hidden)}
            aria-label={block.hidden ? "Rendre visible" : "Masquer"}
          >
            {block.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onDuplicate(block.id)}
            aria-label="Dupliquer"
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => onDelete(block.id)}
            aria-label="Supprimer"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {children.map((child, idx) => (
            <OutlineRow
              key={child.block.id}
              node={child}
              depth={depth + 1}
              isFirst={idx === 0}
              isLast={idx === children.length - 1}
              onToggleHidden={onToggleHidden}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  tree: BlockTreeNode[];
  onMoveRoot: (id: string, dir: -1 | 1) => void;
  onToggleHidden: (id: string, hidden: boolean) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function LessonOutlineView({ tree, onMoveRoot, onToggleHidden, onDuplicate, onDelete }: Props) {
  if (tree.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-4 text-center border border-dashed rounded-lg">
        Aucun bloc. Passez en mode Éditeur pour en ajouter.
      </p>
    );
  }

  return (
    <div className="rounded-lg border divide-y">
      {tree.map((node, idx) => (
        <OutlineRow
          key={node.block.id}
          node={node}
          depth={0}
          isFirst={idx === 0}
          isLast={idx === tree.length - 1}
          onMoveUp={() => onMoveRoot(node.block.id, -1)}
          onMoveDown={() => onMoveRoot(node.block.id, 1)}
          onToggleHidden={onToggleHidden}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
