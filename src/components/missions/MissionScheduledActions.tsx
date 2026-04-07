import { useMissionActivities, useUpdateMissionActivity, useDeleteMissionActivity } from "@/hooks/useMissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Check, Trash2, Clock } from "lucide-react";
import { format, isPast, isToday, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";

interface MissionScheduledActionsProps {
  missionId: string;
}

const MissionScheduledActions = ({ missionId }: MissionScheduledActionsProps) => {
  const { data: activities = [] } = useMissionActivities(missionId);
  const updateActivity = useUpdateMissionActivity();
  const deleteActivity = useDeleteMissionActivity();

  // Scheduled actions = activities with duration 0 and a future/today date, not yet marked as done
  const scheduledActions = activities
    .filter((a) => a.duration === 0 && a.activity_date)
    .sort((a, b) => a.activity_date.localeCompare(b.activity_date));

  if (scheduledActions.length === 0) return null;

  const handleToggleDone = async (activity: typeof scheduledActions[0]) => {
    const newBilled = !activity.is_billed; // reuse is_billed as "done" flag for scheduled actions
    await updateActivity.mutateAsync({
      id: activity.id,
      missionId,
      updates: { is_billed: newBilled },
    });
  };

  const handleDelete = async (activityId: string) => {
    await deleteActivity.mutateAsync({ id: activityId, missionId });
  };

  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <Clock className="h-3 w-3" />
        Actions programmées ({scheduledActions.length})
      </p>
      {scheduledActions.map((action) => {
        const date = new Date(action.activity_date);
        const past = isPast(startOfDay(date)) && !isToday(date);
        const today = isToday(date);
        const done = action.is_billed;

        return (
          <div
            key={action.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm group transition-colors ${
              done
                ? "bg-muted/50 border-muted text-muted-foreground line-through"
                : past
                ? "bg-red-50 border-red-200 text-red-700"
                : today
                ? "bg-amber-50 border-amber-200 text-amber-700"
                : "bg-blue-50 border-blue-200 text-blue-700"
            }`}
          >
            <button
              onClick={() => handleToggleDone(action)}
              className="shrink-0"
              title={done ? "Marquer comme à faire" : "Marquer comme fait"}
            >
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  done
                    ? "border-green-500 bg-green-500"
                    : "border-current hover:bg-current/10"
                }`}
              >
                {done && <Check className="h-3 w-3 text-white" />}
              </div>
            </button>
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium shrink-0">
              {format(date, "d MMM", { locale: fr })}
            </span>
            <span className="truncate flex-1">{action.description}</span>
            {past && !done && (
              <Badge variant="destructive" className="text-[10px] h-5 px-1.5 shrink-0">
                En retard
              </Badge>
            )}
            {today && !done && (
              <Badge className="text-[10px] h-5 px-1.5 shrink-0 bg-amber-500">
                Aujourd'hui
              </Badge>
            )}
            <button
              onClick={() => handleDelete(action.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
              title="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default MissionScheduledActions;
