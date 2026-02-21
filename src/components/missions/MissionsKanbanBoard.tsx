import { useState, useCallback, useEffect } from "react";
import { closestCenter } from "@dnd-kit/core";
import { Mission, MissionStatus, missionStatusConfig } from "@/types/missions";
import { useMissions, useMoveMission, useUpdateMission } from "@/hooks/useMissions";
import MissionColumn from "./MissionColumn";
import MissionCard from "./MissionCard";
import MissionDetailDrawer from "./MissionDetailDrawer";
import CreateMissionDialog from "./CreateMissionDialog";
import { useKanbanDnd, KanbanLayout } from "@/components/kanban";

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

const STATUSES: MissionStatus[] = ["not_started", "in_progress", "completed", "cancelled"];
const STATUS_COLUMNS = STATUSES.map((s) => ({ id: s }));

const MissionsKanbanBoard = ({ prefillFromCrm, onPrefillConsumed }: MissionsKanbanBoardProps) => {
  const { data, isLoading, error } = useMissions();
  const moveMission = useMoveMission();
  const updateMission = useUpdateMission();

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

  const missions = data || [];

  const getMissionsByStatus = useCallback(
    (status: MissionStatus) => {
      return missions
        .filter((m) => m.status === status)
        .sort((a, b) => a.position - b.position);
    },
    [missions]
  );

  const { sensors, activeItem, handleDragStart, handleDragEnd } = useKanbanDnd<Mission>({
    items: missions,
    getItemColumnId: (m) => m.status,
    columns: STATUS_COLUMNS,
    enableKeyboard: false,
    onMoveItem: async ({ itemId, targetColumnId, newIndex, item }) => {
      const targetStatus = targetColumnId as MissionStatus;
      if (item.status !== targetStatus || item.position !== newIndex) {
        await moveMission.mutateAsync({
          missionId: itemId,
          newStatus: targetStatus,
          newPosition: newIndex,
        });
      }
    },
  });

  const handleAddMission = (status: MissionStatus) => {
    setCreateDialogStatus(status);
    setShowCreateDialog(true);
  };

  const handleMissionEmojiChange = async (missionId: string, emoji: string | null) => {
    await updateMission.mutateAsync({ id: missionId, updates: { emoji } });
  };

  return (
    <>
      <KanbanLayout
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        collisionDetection={closestCenter}
        isLoading={isLoading}
        error={error ? "Erreur lors du chargement des missions" : undefined}
        dragOverlay={activeItem ? <MissionCard mission={activeItem} isDragging /> : null}
      >
        {STATUSES.map((status) => (
          <MissionColumn
            key={status}
            status={status}
            missions={getMissionsByStatus(status)}
            onAddMission={() => handleAddMission(status)}
            onMissionClick={setSelectedMission}
            onEmojiChange={handleMissionEmojiChange}
          />
        ))}
      </KanbanLayout>

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
