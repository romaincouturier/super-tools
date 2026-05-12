import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, User, Briefcase } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { SupertiltAction } from "@/hooks/useSupertilt";

interface Props {
  action: SupertiltAction;
  isDragging?: boolean;
  onToggle: (checked: boolean) => void;
}

export default function SupertiltActionCard({ action, isDragging, onToggle }: Props) {
  const deadlineDate = action.deadline ? new Date(action.deadline + "T00:00:00") : undefined;
  const isOverdue =
    deadlineDate && isPast(deadlineDate) && !isToday(deadlineDate) && !action.is_completed;

  return (
    <div
      className={cn(
        "rounded-md border bg-card p-2.5 shadow-sm hover:shadow-md transition-shadow",
        isDragging && "opacity-80",
      )}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          checked={action.is_completed}
          onCheckedChange={(checked) => onToggle(!!checked)}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium break-words",
              action.is_completed && "line-through text-muted-foreground",
            )}
          >
            {action.title}
          </p>
          {action.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {action.description}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {action.mission_id && (
              <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0">
                <Briefcase className="w-2.5 h-2.5" /> Mission
              </Badge>
            )}
            {action.assigned_to && (
              <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                <User className="w-2.5 h-2.5" /> {action.assigned_to}
              </Badge>
            )}
            {action.deadline && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] gap-1 px-1.5 py-0",
                  isOverdue && "border-red-300 text-red-600 bg-red-50",
                )}
              >
                <CalendarDays className="w-2.5 h-2.5" />
                {format(deadlineDate!, "d MMM", { locale: fr })}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
