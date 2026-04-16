import { useState, useEffect, useMemo, useRef } from "react";
import { closestCenter } from "@dnd-kit/core";
import { Plus, Info } from "lucide-react";
import { startOfDay, isAfter } from "date-fns";
import { Button } from "@/components/ui/button";
import { Mission, MissionStatus, missionStatusConfig } from "@/types/missions";
import { useMissions, useMoveMission, useUpdateMission, useMissionIdsWithFutureScheduledActions } from "@/hooks/useMissions";
import MissionCard from "./MissionCard";
import MissionDetailDrawer from "./MissionDetailDrawer";
import CreateMissionDialog from "./CreateMissionDialog";
import GenericKanbanBoard from "@/components/shared/kanban/GenericKanbanBoard";
import KanbanStatsDialog from "@/components/shared/kanban/KanbanStatsDialog";
import KanbanToolbar from "@/components/shared/kanban/KanbanToolbar";
import type { KanbanColumnDef, KanbanCardDef, KanbanStatsItem } from "@/types/kanban";

type MissionKanbanCard = Mission & KanbanCardDef;
type MissionKanbanColumn = KanbanColumnDef & { statusColor: string };

interface CrmPrefill {
  title: string;
  clientName: string;
  clientContact: string;
  totalAmount: string;
  fromCrmCardId: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

interface MissionsKanbanBoardProps {
  prefillFromCrm?: CrmPrefill;
  onPrefillConsumed?: () => void;
  openMissionId?: string | null;
}

const statuses: MissionStatus[] = ["not_started", "in_progress", "completed", "cancelled"];

const columns: MissionKanbanColumn[] = statuses.map((s, idx) => ({
  id: s,
  name: missionStatusConfig[s].label,
  position: idx,
  statusColor: missionStatusConfig[s].color,
}));

const MissionsKanbanBoard = ({ prefillFromCrm, onPrefillConsumed, openMissionId }: MissionsKanbanBoardProps) => {
  const { data, isLoading, error } = useMissions();
  const { data: futureScheduledIds } = useMissionIdsWithFutureScheduledActions();
  const moveMission = useMoveMission();
  const updateMission = useUpdateMission();

  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createDialogStatus, setCreateDialogStatus] = useState<MissionStatus>("not_started");
  const [prefillData, setPrefillData] = useState<CrmPrefill | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [showStats, setShowStats] = useState(false);

  // Auto-open mission drawer when openMissionId is provided (deep link from emails)
  // Only consume the deep link once to avoid overwriting user's subsequent selections
  const deepLinkConsumedRef = useRef<string | null>(null);
  useEffect(() => {
    if (openMissionId && data?.length && deepLinkConsumedRef.current !== openMissionId) {
      const mission = data.find((m) => m.id === openMissionId);
      if (mission) {
        deepLinkConsumedRef.current = openMissionId;
        setSelectedMission(mission);
      }
    }
  }, [openMissionId, data]);

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
  const normalizedSearch = searchTerm.toLowerCase().trim();

  const isScheduledInFuture = (m: Mission): boolean => {
    // Check the legacy field on the mission itself
    if (m.waiting_next_action_date) {
      const scheduledDate = startOfDay(new Date(m.waiting_next_action_date));
      const today = startOfDay(new Date());
      if (isAfter(scheduledDate, today)) return true;
    }
    // Also check activities-based scheduled actions (duration=0, undone, future)
    if (futureScheduledIds?.has(m.id)) return true;
    return false;
  };

  const cards: MissionKanbanCard[] = useMemo(() => {
    let filtered = missions;
    if (normalizedSearch) {
      filtered = missions.filter((m) => {
        const title = (m.title || "").toLowerCase();
        const client = (m.client_name || "").toLowerCase();
        const tags = (m.tags || []).join(" ").toLowerCase();
        return title.includes(normalizedSearch) || client.includes(normalizedSearch) || tags.includes(normalizedSearch);
      });
    }
    // Hide missions with a future scheduled action only when not searching
    if (!normalizedSearch) {
      filtered = filtered.filter((m) => !isScheduledInFuture(m));
    }
    // Hide completed missions that have an end_date set (they are archived)
    if (!normalizedSearch) {
      filtered = filtered.filter((m) => !(m.status === "completed" && m.end_date));
    }

    return filtered.map((m) => ({
      ...m,
      columnId: m.status,
      position: m.position,
    }));
  }, [missions, normalizedSearch, futureScheduledIds]);

  const statsItems: KanbanStatsItem[] = useMemo(() => {
    return missions.map((m) => ({
      id: m.id,
      columnId: m.status,
      createdAt: m.created_at,
      completedAt: m.status === "completed" ? m.updated_at : null,
    }));
  }, [missions]);

  const handleAddMission = (status: MissionStatus) => {
    setCreateDialogStatus(status);
    setShowCreateDialog(true);
  };

  const handleMissionEmojiChange = async (missionId: string, emoji: string | null) => {
    await updateMission.mutateAsync({ id: missionId, updates: { emoji } });
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500">
        Erreur lors du chargement des missions
      </div>
    );
  }

  return (
    <>
      <KanbanToolbar
        searchPlaceholder="Rechercher une mission..."
        search={searchTerm}
        onSearchChange={setSearchTerm}
        showStatsButton
        onStatsClick={() => setShowStats(true)}
      />

      <GenericKanbanBoard<MissionKanbanCard, MissionKanbanColumn>
        columns={columns}
        cards={cards}
        loading={isLoading}
        config={{ cardSortable: true, collisionDetection: closestCenter }}
        renderCard={(card, isDragging) => (
          <MissionCard
            mission={card}
            isDragging={isDragging}
            onEmojiChange={handleMissionEmojiChange}
          />
        )}
        renderColumnHeader={(col, colCards) => (
          <div className="p-3 border-b flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: col.statusColor }}
              />
              <h3 className="font-medium text-sm">{col.name}</h3>
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {colCards.length}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => handleAddMission(col.id as MissionStatus)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
        renderEmptyColumn={() => (
          <div className="text-center text-xs text-muted-foreground py-8">
            Aucune mission
          </div>
        )}
        onCardMove={async ({ card, targetColumnId, newPosition }) => {
          await moveMission.mutateAsync({
            missionId: card.id,
            newStatus: targetColumnId as MissionStatus,
            newPosition,
          });
        }}
        onCardClick={(card) => setSelectedMission(card)}
      />

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
        prefillContactFirstName={prefillData?.contactFirstName}
        prefillContactLastName={prefillData?.contactLastName}
        prefillContactEmail={prefillData?.contactEmail}
        prefillContactPhone={prefillData?.contactPhone}
      />

      <MissionDetailDrawer
        mission={selectedMission}
        open={!!selectedMission}
        onOpenChange={(open) => !open && setSelectedMission(null)}
      />

      <KanbanStatsDialog
        open={showStats}
        onOpenChange={setShowStats}
        columns={columns}
        items={statsItems}
        doneColumnIds={["completed", "cancelled"]}
      />
    </>
  );
};

export default MissionsKanbanBoard;
