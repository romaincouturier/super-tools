import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { Mission, MissionStatus, missionStatusConfig } from "@/types/missions";
import { useMissions, useMoveMission, useUpdateMission } from "@/hooks/useMissions";
import MissionColumn from "./MissionColumn";
import MissionCard from "./MissionCard";
import MissionDetailDrawer from "./MissionDetailDrawer";
import CreateMissionDialog from "./CreateMissionDialog";
import { Loader2 } from "lucide-react";

interface CrmPrefill {
  title: string;
  clientName: string;
  clientContact: string;
  totalAmount: string;
  fromCrmCardId: string;
}

interface MissionsKanbanBoardProps {
  prefillFromCrm?: CrmPrefill;
  onPrefillConsumed?: () => void;
}

const MissionsKanbanBoard = ({ prefillFromCrm, onPrefillConsumed }: MissionsKanbanBoardProps) => {
  const { data, isLoading, error } = useMissions();
  const moveMission = useMoveMission();
  const updateMission = useUpdateMission();

  const [activeMission, setActiveMission] = useState<Mission | null>(null);
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createDialogStatus, setCreateDialogStatus] = useState<MissionStatus>("not_started");
  const [prefillData, setPrefillData] = useState<CrmPrefill | undefined>(undefined);

  // Auto-open create dialog when prefill data from CRM is provided
  useEffect(() => {
    if (prefillFromCrm) {
      setPrefillData(prefillFromCrm);
      setCreateDialogStatus("not_started");
      setShowCreateDialog(true);
      onPrefillConsumed?.();
    }
  }, [prefillFromCrm]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const missions = data || [];

  const getMissionsByStatus = useCallback(
    (status: MissionStatus) => {
      return missions
        .filter((m) => m.status === status)
        .sort((a, b) => a.position - b.position);
    },
    [missions]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const mission = missions.find((m) => m.id === event.active.id);
    if (mission) setActiveMission(mission);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveMission(null);

    if (!over) return;

    const missionId = active.id as string;
    const mission = missions.find((m) => m.id === missionId);
    if (!mission) return;

    // Determine target status (column)
    let targetStatus: MissionStatus;
    const targetMission = missions.find((m) => m.id === over.id);

    if (targetMission) {
      targetStatus = targetMission.status;
    } else if (Object.keys(missionStatusConfig).includes(over.id as string)) {
      targetStatus = over.id as MissionStatus;
    } else {
      return;
    }

    // Calculate new position
    const targetMissions = getMissionsByStatus(targetStatus);
    let newPosition = 0;

    if (targetMission) {
      const targetIndex = targetMissions.findIndex((m) => m.id === targetMission.id);
      newPosition = targetIndex;
    } else {
      newPosition = targetMissions.length;
    }

    // Only update if something changed
    if (mission.status !== targetStatus || mission.position !== newPosition) {
      await moveMission.mutateAsync({
        missionId,
        newStatus: targetStatus,
        newPosition,
      });
    }
  };

  const handleAddMission = (status: MissionStatus) => {
    console.log("[MissionsKanbanBoard] handleAddMission called, status:", status, "showCreateDialog before:", showCreateDialog);
    setCreateDialogStatus(status);
    setShowCreateDialog(true);
    console.log("[MissionsKanbanBoard] setShowCreateDialog(true) called");
  };

  const handleMissionClick = (mission: Mission) => {
    setSelectedMission(mission);
  };

  const handleMissionEmojiChange = async (missionId: string, emoji: string | null) => {
    await updateMission.mutateAsync({ id: missionId, updates: { emoji } });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        Erreur lors du chargement des missions
      </div>
    );
  }

  const statuses: MissionStatus[] = ["not_started", "in_progress", "completed", "cancelled"];

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 h-full">
          {statuses.map((status) => (
            <MissionColumn
              key={status}
              status={status}
              missions={getMissionsByStatus(status)}
              onAddMission={() => handleAddMission(status)}
              onMissionClick={handleMissionClick}
              onEmojiChange={handleMissionEmojiChange}
            />
          ))}
        </div>

        <DragOverlay>
          {activeMission ? (
            <MissionCard mission={activeMission} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      <CreateMissionDialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) setPrefillData(undefined);
        }}
        defaultStatus={createDialogStatus}
        prefillTitle={prefillData?.title}
        prefillClientName={prefillData?.clientName}
        prefillClientContact={prefillData?.clientContact}
        prefillTotalAmount={prefillData?.totalAmount}
      />

      <MissionDetailDrawer
        mission={selectedMission}
        open={!!selectedMission}
        onOpenChange={(open) => !open && setSelectedMission(null)}
      />
    </>
  );
};

export default MissionsKanbanBoard;
