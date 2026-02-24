import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Loader2, Search, X, Building, User, Tag, GraduationCap, Briefcase, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useCrmBoard, useMoveCard, useCreateColumn, useCrmSettings, useUpdateCard } from "@/hooks/useCrmBoard";
import { useAuth } from "@/hooks/useAuth";
import { CrmCard, LossReason } from "@/types/crm";
import LossReasonDialog from "./LossReasonDialog";
import CrmColumn from "./CrmColumn";
import CrmCardComponent from "./CrmCard";
import CardDetailDrawer from "./CardDetailDrawer";
import AddColumnDialog from "./AddColumnDialog";
import { CreateTrainingDialog } from "./CreateTrainingDialog";
import { useNavigate } from "react-router-dom";
import { isAfter, startOfDay } from "date-fns";
import confetti from "canvas-confetti";

interface CrmKanbanBoardProps {
  initialCardId?: string | null;
}

const CrmKanbanBoard = ({ initialCardId }: CrmKanbanBoardProps = {}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: boardData, isLoading } = useCrmBoard();
  const { data: crmSettings } = useCrmSettings();
  const moveCard = useMoveCard();
  const createColumn = useCreateColumn();
  const updateCard = useUpdateCard();

  const serviceTypeColors = crmSettings?.serviceTypeColors;

  const [activeCard, setActiveCard] = useState<CrmCard | null>(null);
  const [selectedCard, setSelectedCard] = useState<CrmCard | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [localCards, setLocalCards] = useState<CrmCard[]>([]);
  
  // Training creation dialog state
  const [showCreateTrainingDialog, setShowCreateTrainingDialog] = useState(false);
  const [pendingTrainingCard, setPendingTrainingCard] = useState<CrmCard | null>(null);

  // Loss reason dialog state (for drag-to-lost)
  const [showLossReasonDialog, setShowLossReasonDialog] = useState(false);
  const [pendingLossCard, setPendingLossCard] = useState<{ cardId: string; targetColumnId: string; newIndex: number; oldCard: CrmCard } | null>(null);

  // Auto-open card from URL
  const [initialCardOpened, setInitialCardOpened] = useState(false);
  useEffect(() => {
    if (initialCardId && boardData?.cards && !initialCardOpened) {
      const card = boardData.cards.find((c) => c.id === initialCardId);
      if (card) {
        setSelectedCard(card);
        setInitialCardOpened(true);
      }
    }
  }, [initialCardId, boardData?.cards, initialCardOpened]);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filter state: all (default board), en_cours, gagne, perdu, a_venir
  type FilterMode = "all" | "en_cours" | "gagne" | "perdu" | "a_venir";
  const [filterMode, setFilterMode] = useState<FilterMode>("en_cours");

  // Search across all card fields (including hidden/scheduled cards)
  const allCards = boardData?.cards || [];
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) return [];
    const q = searchQuery.toLowerCase().trim();
    return allCards.filter((card) => {
      const fields = [
        card.title,
        card.company,
        card.first_name,
        card.last_name,
        card.email,
        card.phone,
        card.description_html?.replace(/<[^>]*>/g, ""),
        card.next_action_text,
        card.waiting_next_action_text,
        card.raw_input,
        card.linkedin_url,
        card.website_url,
        ...(card.tags?.map((t) => t.name) || []),
      ];
      return fields.some((f) => f && f.toLowerCase().includes(q));
    }).slice(0, 10);
  }, [searchQuery, allCards]);

  // Close search results on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSelect = useCallback((card: CrmCard) => {
    setSelectedCard(card);
    setShowSearchResults(false);
    setSearchQuery("");
  }, []);

  const getColumnName = useCallback((columnId: string) => {
    return boardData?.columns.find((c) => c.id === columnId)?.name || "";
  }, [boardData?.columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter helpers
  const isScheduledInFuture = (card: CrmCard): boolean => {
    if (!card.waiting_next_action_date) return false;
    const scheduledDate = startOfDay(new Date(card.waiting_next_action_date));
    const today = startOfDay(new Date());
    return isAfter(scheduledDate, today);
  };

  const isWonCard = (card: CrmCard): boolean => {
    return card.sales_status === "WON";
  };

  const isLostCard = (card: CrmCard): boolean => {
    return card.sales_status === "LOST";
  };

  // Sync local cards with server data, applying filter mode
  useEffect(() => {
    if (boardData?.cards) {
      let filtered: CrmCard[];
      switch (filterMode) {
        case "gagne":
          filtered = boardData.cards.filter(isWonCard);
          break;
        case "perdu":
          filtered = boardData.cards.filter(isLostCard);
          break;
        case "a_venir":
          filtered = boardData.cards.filter(isScheduledInFuture);
          break;
        case "en_cours":
          filtered = boardData.cards.filter((c) => !isWonCard(c) && !isLostCard(c) && !isScheduledInFuture(c));
          break;
        default: // "all" — default board behavior: hide future scheduled
          filtered = boardData.cards.filter((c) => !isScheduledInFuture(c));
          break;
      }
      setLocalCards(filtered);
    }
  }, [boardData?.cards, filterMode]);


  const handleDragStart = (event: DragStartEvent) => {
    const card = localCards.find((c) => c.id === event.active.id);
    if (card) setActiveCard(card);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;
    const activeCard = localCards.find((c) => c.id === activeCardId);
    if (!activeCard) return;

    // Check if over a column
    const overColumn = boardData?.columns.find((col) => col.id === overId);
    if (overColumn && activeCard.column_id !== overColumn.id) {
      setLocalCards((prev) =>
        prev.map((c) =>
          c.id === activeCardId ? { ...c, column_id: overColumn.id } : c
        )
      );
      return;
    }

    // Check if over another card
    const overCard = localCards.find((c) => c.id === overId);
    if (overCard && activeCard.column_id !== overCard.column_id) {
      setLocalCards((prev) =>
        prev.map((c) =>
          c.id === activeCardId ? { ...c, column_id: overCard.column_id } : c
        )
      );
    }
  };

  // Handle loss reason dialog confirmation from drag
  const handleDragLossReasonConfirm = async (reason: LossReason, detail: string) => {
    setShowLossReasonDialog(false);
    if (!pendingLossCard || !user?.email) return;

    await updateCard.mutateAsync({
      id: pendingLossCard.cardId,
      updates: {
        column_id: pendingLossCard.targetColumnId,
        position: pendingLossCard.newIndex,
        sales_status: "LOST",
        lost_at: new Date().toISOString(),
        loss_reason: reason,
        loss_reason_detail: detail || null,
        status_operational: "TODAY",
        waiting_next_action_date: null,
        waiting_next_action_text: null,
      },
      actorEmail: user.email,
      oldCard: pendingLossCard.oldCard,
    });
    setPendingLossCard(null);
  };

  const handleDragLossReasonCancel = () => {
    setShowLossReasonDialog(false);
    setPendingLossCard(null);
  };

  // Celebration confetti animation for won deals
  const celebrateWin = () => {
    const duration = 3000;
    const end = Date.now() + duration;
    const colors = ["#FFD700", "#FFA500", "#FF6347", "#32CD32", "#1E90FF", "#9370DB"];

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.8 },
        colors: colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.8 },
        colors: colors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };

    // Initial burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { x: 0.5, y: 0.5 },
      colors: colors,
    });

    frame();
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over || !user?.email) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;
    const draggedCard = localCards.find((c) => c.id === activeCardId);
    if (!draggedCard) return;

    // Determine target column
    let targetColumnId = draggedCard.column_id;
    const overColumn = boardData?.columns.find((col) => col.id === overId);
    const overCard = localCards.find((c) => c.id === overId);
    let targetColumn = overColumn;

    if (overColumn) {
      targetColumnId = overColumn.id;
    } else if (overCard) {
      targetColumnId = overCard.column_id;
      targetColumn = boardData?.columns.find((col) => col.id === targetColumnId);
    }

    // Calculate new position
    const columnCards = localCards.filter((c) => c.column_id === targetColumnId);
    const newIndex = overCard
      ? columnCards.findIndex((c) => c.id === overId)
      : columnCards.length;

    // Get old column for logging
    const originalCard = boardData?.cards.find((c) => c.id === activeCardId);
    const oldColumnId = originalCard?.column_id || targetColumnId;
    const oldColumn = boardData?.columns.find((col) => col.id === oldColumnId);

    // Check if moving to/from a "won" or "lost" column
    const isWonColumn = targetColumn?.name.toLowerCase().includes("gagné") || false;
    const wasInWonColumn = oldColumn?.name.toLowerCase().includes("gagné") || false;
    const isLostColumn = targetColumn?.name.toLowerCase().includes("perdu") || false;
    const wasInLostColumn = oldColumn?.name.toLowerCase().includes("perdu") || false;

    // Detect transitions
    const movingToWon = isWonColumn && !wasInWonColumn;
    const movingToLost = isLostColumn && !wasInLostColumn;
    const leavingWonColumn = wasInWonColumn && !isWonColumn;
    const leavingLostColumn = wasInLostColumn && !isLostColumn;

    // Determine what updates to apply
    if (movingToLost && originalCard) {
      // Moving to lost column: intercept with loss reason dialog
      setPendingLossCard({
        cardId: activeCardId,
        targetColumnId,
        newIndex: Math.max(0, newIndex),
        oldCard: originalCard,
      });
      setShowLossReasonDialog(true);
    } else if (movingToWon) {
      // Moving to won column: set sales_status to WON + trigger celebration
      await updateCard.mutateAsync({
        id: activeCardId,
        updates: {
          column_id: targetColumnId,
          position: Math.max(0, newIndex),
          sales_status: "WON",
          won_at: new Date().toISOString(),
        },
        actorEmail: user.email,
        oldCard: originalCard!,
      });

      // Celebrate with confetti!
      celebrateWin();

      // Check if card is a formation (or no type set) and prompt for training creation
      const cardServiceType = originalCard?.service_type;
      if (cardServiceType === "formation" || !cardServiceType) {
        setPendingTrainingCard(originalCard!);
        setShowCreateTrainingDialog(true);
      }
    } else if (leavingWonColumn || leavingLostColumn) {
      // Leaving won/lost column: reset sales_status to OPEN
      await updateCard.mutateAsync({
        id: activeCardId,
        updates: {
          column_id: targetColumnId,
          position: Math.max(0, newIndex),
          sales_status: "OPEN",
          won_at: null,
          lost_at: null,
          loss_reason: null,
          loss_reason_detail: null,
        },
        actorEmail: user.email,
        oldCard: originalCard!,
      });
    } else {
      // Regular move (no status change)
      moveCard.mutate({
        cardId: activeCardId,
        newColumnId: targetColumnId,
        newPosition: Math.max(0, newIndex),
        actorEmail: user.email,
        oldColumnId,
      });
    }
  };

  // Build training params from a card
  const buildTrainingParams = (card: CrmCard): URLSearchParams => {
    const params = new URLSearchParams();
    if (card.company) params.set("clientName", card.company);
    if (card.first_name) params.set("sponsorFirstName", card.first_name);
    if (card.last_name) params.set("sponsorLastName", card.last_name);
    if (card.email) params.set("sponsorEmail", card.email);
    if (card.phone) params.set("sponsorPhone", card.phone);
    if (card.title) params.set("trainingName", card.title.replace(/^\([^)]+\)\s*/, ""));
    params.set("fromCrmCardId", card.id);
    if (card.estimated_value && card.estimated_value > 0) {
      params.set("estimatedValue", String(card.estimated_value));
    }
    return params;
  };

  const handleConfirmCreateTraining = () => {
    if (pendingTrainingCard) {
      const params = buildTrainingParams(pendingTrainingCard);
      setShowCreateTrainingDialog(false);
      navigate(`/formations/new?${params.toString()}`);
      setPendingTrainingCard(null);
    }
  };

  const handleConfirmAddParticipant = (trainingId: string) => {
    if (pendingTrainingCard) {
      const params = new URLSearchParams();
      if (pendingTrainingCard.first_name) params.set("addParticipantFirstName", pendingTrainingCard.first_name);
      if (pendingTrainingCard.last_name) params.set("addParticipantLastName", pendingTrainingCard.last_name);
      if (pendingTrainingCard.email) params.set("addParticipantEmail", pendingTrainingCard.email);
      if (pendingTrainingCard.company) params.set("addParticipantCompany", pendingTrainingCard.company);
      params.set("fromCrmCardId", pendingTrainingCard.id);
      setShowCreateTrainingDialog(false);
      navigate(`/formations/${trainingId}?${params.toString()}`);
      setPendingTrainingCard(null);
    }
  };

  const handleAddColumn = async (name: string) => {
    createColumn.mutate({ name });
    setShowAddColumn(false);
  };

  const handleCardClick = (card: CrmCard) => {
    setSelectedCard(card);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const columns = boardData?.columns || [];
  const tags = boardData?.tags || [];

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Search bar + filters */}
      <div className="flex items-center gap-3 flex-wrap">
      <div ref={searchRef} className="relative w-full max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher une opportunité..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchResults(true);
            }}
            onFocus={() => searchQuery.trim().length >= 2 && setShowSearchResults(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSearchQuery("");
                setShowSearchResults(false);
              }
            }}
            className="pl-9 pr-8 h-9"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); setShowSearchResults(false); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {showSearchResults && searchQuery.trim().length >= 2 && (
          <div className="absolute z-50 top-full mt-1 w-full max-w-lg bg-background border border-border rounded-lg shadow-lg overflow-hidden">
            {searchResults.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">
                Aucun résultat pour "{searchQuery}"
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-border">
                {searchResults.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => handleSearchSelect(card)}
                    className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors flex items-start gap-3"
                  >
                    <div
                      className="w-1 self-stretch rounded-full shrink-0 mt-0.5"
                      style={{
                        backgroundColor: card.service_type === "formation" ? "#3b82f6" : card.service_type === "mission" ? "#8b5cf6" : "#6b7280",
                      }}
                    />
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        {card.emoji && <span className="text-sm">{card.emoji}</span>}
                        <span className="text-sm font-medium truncate">{card.title}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {card.company && (
                          <span className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {card.company}
                          </span>
                        )}
                        {(card.first_name || card.last_name) && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {[card.first_name, card.last_name].filter(Boolean).join(" ")}
                          </span>
                        )}
                        {card.estimated_value > 0 && (
                          <span className="font-semibold text-green-700">
                            {card.estimated_value.toLocaleString("fr-FR")} €
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {getColumnName(card.column_id)}
                        </span>
                        {card.tags && card.tags.slice(0, 2).map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            className="text-xs py-0 h-4"
                            style={{ backgroundColor: tag.color + "20", color: tag.color }}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter buttons */}
      <div className="flex items-center gap-1 border rounded-lg p-1">
        <Button
          variant={filterMode === "all" ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setFilterMode("all")}
        >
          Tout
        </Button>
        <Button
          variant={filterMode === "en_cours" ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setFilterMode("en_cours")}
        >
          En cours
        </Button>
        <Button
          variant={filterMode === "gagne" ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setFilterMode("gagne")}
        >
          Gagné
        </Button>
        <Button
          variant={filterMode === "perdu" ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setFilterMode("perdu")}
        >
          Perdu
        </Button>
        <Button
          variant={filterMode === "a_venir" ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setFilterMode("a_venir")}
        >
          À venir
        </Button>
      </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 h-full">
          <SortableContext
            items={columns.map((c) => c.id)}
            strategy={horizontalListSortingStrategy}
          >
            {columns.map((column) => {
              const columnCards = localCards
                .filter((c) => c.column_id === column.id)
                .sort((a, b) => a.position - b.position);

              return (
                <CrmColumn
                  key={column.id}
                  column={column}
                  cards={columnCards}
                  allColumns={columns}
                  onCardClick={handleCardClick}
                  serviceTypeColors={serviceTypeColors}
                />
              );
            })}
          </SortableContext>

          <div className="flex-shrink-0 w-72">
            <Button
              variant="outline"
              className="w-full h-12 border-dashed"
              onClick={() => setShowAddColumn(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une colonne
            </Button>
          </div>
        </div>

        <DragOverlay>
          {activeCard ? (
            <CrmCardComponent
              card={activeCard}
              isDragging
              serviceTypeColors={serviceTypeColors}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <AddColumnDialog
        open={showAddColumn}
        onOpenChange={setShowAddColumn}
        onAdd={handleAddColumn}
      />

      <CardDetailDrawer
        card={selectedCard}
        open={!!selectedCard}
        onOpenChange={(open) => !open && setSelectedCard(null)}
        allTags={tags}
        allColumns={columns}
      />

      {/* Create Training Dialog for drag-to-won */}
      <CreateTrainingDialog
        open={showCreateTrainingDialog}
        onOpenChange={(open) => {
          setShowCreateTrainingDialog(open);
          if (!open) setPendingTrainingCard(null);
        }}
        onConfirmCreate={handleConfirmCreateTraining}
        onConfirmAddParticipant={handleConfirmAddParticipant}
        opportunityTitle={pendingTrainingCard?.title || ""}
        isFormation={pendingTrainingCard?.service_type === "formation" || !pendingTrainingCard?.service_type}
      />

      {/* Loss Reason Dialog for drag-to-lost */}
      <LossReasonDialog
        open={showLossReasonDialog}
        onConfirm={handleDragLossReasonConfirm}
        onCancel={handleDragLossReasonCancel}
      />
    </div>
  );
};

export default CrmKanbanBoard;
