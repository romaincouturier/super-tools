import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mission, MissionStatus, missionStatusConfig } from "@/types/missions";
import MissionCard from "./MissionCard";
import { cn } from "@/lib/utils";

interface MissionColumnProps {
  status: MissionStatus;
  missions: Mission[];
  onAddMission: () => void;
  onMissionClick: (mission: Mission) => void;
}

const MissionColumn = ({
  status,
  missions,
  onAddMission,
  onMissionClick,
}: MissionColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const config = missionStatusConfig[status];

  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-muted/30 rounded-lg">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: config.color }}
          />
          <h3 className="font-medium text-sm">{config.label}</h3>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {missions.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onAddMission}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px] transition-colors",
          isOver && "bg-primary/5"
        )}
      >
        <SortableContext
          items={missions.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          {missions.map((mission) => (
            <MissionCard
              key={mission.id}
              mission={mission}
              onClick={() => onMissionClick(mission)}
            />
          ))}
        </SortableContext>

        {missions.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">
            Aucune mission
          </div>
        )}
      </div>
    </div>
  );
};

export default MissionColumn;
