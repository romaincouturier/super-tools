import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle2,
  Clock,
  MoreVertical,
  Pencil,
  PlayCircle,
  Trash2,
  XCircle,
} from "lucide-react";
import type { Improvement, ImprovementStatus } from "@/hooks/useImprovements";
import { STATUS_CONFIG, CATEGORY_CONFIG } from "@/hooks/useImprovements";

interface ImprovementCardProps {
  improvement: Improvement;
  onStatusChange: (id: string, status: ImprovementStatus) => void;
  onEdit: (improvement: Improvement) => void;
  onDelete: (id: string) => void;
  onClick: (improvement: Improvement) => void;
  compact?: boolean;
}

export default function ImprovementCard({
  improvement,
  onStatusChange,
  onEdit,
  onDelete,
  onClick,
  compact = false,
}: ImprovementCardProps) {
  const status = improvement.status as ImprovementStatus;
  const cat = CATEGORY_CONFIG[improvement.category] || { label: improvement.category, variant: "outline" as const };
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const canDelete = status === "draft" || status === "pending";

  if (compact) {
    return (
      <div
        className="border rounded-lg p-3 bg-card hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => onClick(improvement)}
      >
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-medium text-sm truncate">{improvement.title}</span>
          <Badge variant={cat.variant} className="text-[10px] px-1.5 py-0">{cat.label}</Badge>
        </div>
        {improvement.trainings && (
          <div className="text-xs text-muted-foreground truncate">{improvement.trainings.training_name}</div>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {improvement.priority && (
            <Badge variant={improvement.priority === "haute" ? "destructive" : "outline"} className="text-[10px] px-1.5 py-0">
              {improvement.priority}
            </Badge>
          )}
          {improvement.responsible && (
            <span className="text-[10px] text-muted-foreground">{improvement.responsible}</span>
          )}
          {improvement.deadline && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(improvement.deadline).toLocaleDateString("fr-FR")}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => onClick(improvement)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{improvement.title}</span>
            <Badge variant={cat.variant}>{cat.label}</Badge>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
              {cfg.label}
            </span>
            {improvement.priority && (
              <Badge variant={improvement.priority === "haute" ? "destructive" : "outline"} className="text-xs">
                {improvement.priority}
              </Badge>
            )}
            {improvement.source_type && (
              <Badge variant="secondary" className="text-xs">Source : {improvement.source_type}</Badge>
            )}
          </div>
          {improvement.trainings && (
            <div className="text-sm text-muted-foreground mt-1">{improvement.trainings.training_name}</div>
          )}
          <p className="text-sm mt-2">{improvement.description}</p>
          {improvement.source_description && (
            <p className="text-xs text-muted-foreground mt-1 italic">Source : {improvement.source_description}</p>
          )}
          {(improvement.responsible || improvement.deadline) && (
            <div className="text-xs text-muted-foreground mt-1 flex gap-3">
              {improvement.responsible && <span>Responsable : {improvement.responsible}</span>}
              {improvement.deadline && (
                <span>Échéance : {new Date(improvement.deadline).toLocaleDateString("fr-FR")}</span>
              )}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-2">
            Créée le {new Date(improvement.created_at).toLocaleDateString("fr-FR")}
            {improvement.completed_at && (
              <> • Terminée le {new Date(improvement.completed_at).toLocaleDateString("fr-FR")}</>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onEdit(improvement)}>
              <Pencil className="h-4 w-4 mr-2" />
              Modifier
            </DropdownMenuItem>
            {status !== "in_progress" && (
              <DropdownMenuItem onClick={() => onStatusChange(improvement.id, "in_progress")}>
                <PlayCircle className="h-4 w-4 mr-2" />
                Marquer en cours
              </DropdownMenuItem>
            )}
            {status !== "completed" && (
              <DropdownMenuItem onClick={() => onStatusChange(improvement.id, "completed")}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Marquer terminée
              </DropdownMenuItem>
            )}
            {status !== "pending" && (
              <DropdownMenuItem onClick={() => onStatusChange(improvement.id, "pending")}>
                <Clock className="h-4 w-4 mr-2" />
                Remettre en attente
              </DropdownMenuItem>
            )}
            {status !== "cancelled" && (
              <DropdownMenuItem onClick={() => onStatusChange(improvement.id, "cancelled")}>
                <XCircle className="h-4 w-4 mr-2" />
                Annuler
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem onClick={() => onDelete(improvement.id)} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
