import { useState, useEffect } from "react";
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useUserPreference } from "@/hooks/useUserPreferences";
import KanbanColumn from "./KanbanColumn";
import ContentCard from "./ContentCard";
import ContentCardDialog from "./ContentCardDialog";
import AddColumnDialog from "./AddColumnDialog";

export interface ContentTypeColors {
  article: string;
  post: string;
}

const DEFAULT_CONTENT_TYPE_COLORS: ContentTypeColors = {
  article: "#3b82f6",
  post: "#a855f7",
};

export interface Column {
  id: string;
  name: string;
  display_order: number;
  is_system: boolean;
}

export type ReviewStatus = "none" | "pending" | "in_review" | "approved" | "changes_requested";

export type ContentCardType = "article" | "post";

export interface Card {
  id: string;
  column_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  tags: string[];
  display_order: number;
  review_status?: ReviewStatus;
  card_type?: ContentCardType;
}

interface KanbanBoardProps {
  openCardId?: string | null;
  onCloseCard?: () => void;
  filterReviewOnly?: boolean;
}

const KanbanBoard = ({ openCardId, onCloseCard, filterReviewOnly = false }: KanbanBoardProps) => {
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [cardIdsInReview, setCardIdsInReview] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activeColumn, setActiveColumn] = useState<Column | null>(null);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showColorSettings, setShowColorSettings] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [newCardColumnId, setNewCardColumnId] = useState<string | null>(null);

  const {
    value: typeColors,
    save: saveTypeColors,
  } = useUserPreference<ContentTypeColors>("content_type_colors", DEFAULT_CONTENT_TYPE_COLORS);
  const colors = typeColors ?? DEFAULT_CONTENT_TYPE_COLORS;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    fetchData();
  }, []);

  // Open card from URL parameter
  useEffect(() => {
    if (openCardId && cards.length > 0 && !loading) {
      const card = cards.find((c) => c.id === openCardId);
      if (card) {
        setEditingCard(card);
      }
    }
  }, [openCardId, cards, loading]);

  const fetchData = async () => {
    try {
      const [columnsRes, cardsRes, reviewsRes] = await Promise.all([
        supabase
          .from("content_columns")
          .select("*")
          .order("display_order"),
        supabase
          .from("content_cards")
          .select("*")
          .order("display_order"),
        supabase
          .from("content_reviews")
          .select("card_id, status")
          .order("created_at", { ascending: false }),
      ]);

      if (columnsRes.error) throw columnsRes.error;
      if (cardsRes.error) throw cardsRes.error;

      // Build map of card IDs to their most recent review status
      const cardReviewStatus = new Map<string, ReviewStatus>();
      for (const r of reviewsRes.data || []) {
        // Only keep the first (most recent) status for each card
        if (!cardReviewStatus.has(r.card_id)) {
          cardReviewStatus.set(r.card_id, r.status as ReviewStatus);
        }
      }

      // Build set of card IDs that are currently in review (for filtering)
      const reviewCardIds = new Set<string>(
        (reviewsRes.data || [])
          .filter((r) => r.status === "pending" || r.status === "in_review")
          .map((r) => r.card_id)
      );
      setCardIdsInReview(reviewCardIds);

      setColumns(columnsRes.data || []);
      setCards(
        (cardsRes.data || []).map((c) => ({
          id: c.id,
          column_id: c.column_id,
          title: c.title,
          description: c.description,
          image_url: c.image_url,
          display_order: c.display_order,
          tags: Array.isArray(c.tags) ? (c.tags as string[]) : [],
          review_status: cardReviewStatus.get(c.id) || "none",
          card_type: "article" as ContentCardType,
        }))
      );
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    // Check if dragging a column (prefixed with "column-")
    const activeIdStr = String(active.id);
    if (activeIdStr.startsWith("column-")) {
      const col = columns.find((c) => `column-${c.id}` === activeIdStr);
      if (col) setActiveColumn(col);
      return;
    }
    const card = cards.find((c) => c.id === active.id);
    if (card) {
      setActiveCard(card);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    // Skip if dragging a column
    if (String(active.id).startsWith("column-")) return;

    const activeCardId = active.id as string;
    const overId = over.id as string;

    const activeCard = cards.find((c) => c.id === activeCardId);
    if (!activeCard) return;

    // Check if we're over a column
    const overColumn = columns.find((col) => col.id === overId);
    if (overColumn) {
      // Moving to an empty column or the column itself
      if (activeCard.column_id !== overColumn.id) {
        setCards((prev) =>
          prev.map((c) =>
            c.id === activeCardId ? { ...c, column_id: overColumn.id } : c
          )
        );
      }
      return;
    }

    // Check if we're over another card
    const overCard = cards.find((c) => c.id === overId);
    if (overCard && activeCard.column_id !== overCard.column_id) {
      setCards((prev) =>
        prev.map((c) =>
          c.id === activeCardId ? { ...c, column_id: overCard.column_id } : c
        )
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);
    setActiveColumn(null);

    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // Handle column reordering
    if (activeIdStr.startsWith("column-") && overIdStr.startsWith("column-")) {
      const activeColId = activeIdStr.replace("column-", "");
      const overColId = overIdStr.replace("column-", "");
      if (activeColId === overColId) return;

      const oldIndex = columns.findIndex((c) => c.id === activeColId);
      const newIndex = columns.findIndex((c) => c.id === overColId);
      if (oldIndex === -1 || newIndex === -1) return;

      const newColumns = arrayMove(columns, oldIndex, newIndex);
      setColumns(newColumns);

      // Persist new order to database
      try {
        await Promise.all(
          newColumns.map((col, idx) =>
            supabase
              .from("content_columns")
              .update({ display_order: idx })
              .eq("id", col.id)
          )
        );
      } catch (error) {
        console.error("Error reordering columns:", error);
        toast.error("Erreur lors du réordonnancement des colonnes");
        fetchData();
      }
      return;
    }

    const activeCardId = active.id as string;
    const overId = over.id as string;

    const activeCard = cards.find((c) => c.id === activeCardId);
    if (!activeCard) return;

    // Find the target column
    let targetColumnId = activeCard.column_id;
    const overColumn = columns.find((col) => col.id === overId);
    const overCard = cards.find((c) => c.id === overId);

    if (overColumn) {
      targetColumnId = overColumn.id;
    } else if (overCard) {
      targetColumnId = overCard.column_id;
    }

    // Get cards in the target column
    const columnCards = cards.filter((c) => c.column_id === targetColumnId);
    const oldIndex = columnCards.findIndex((c) => c.id === activeCardId);
    const newIndex = overCard
      ? columnCards.findIndex((c) => c.id === overId)
      : columnCards.length;

    if (oldIndex !== -1 && oldIndex !== newIndex) {
      const newOrder = arrayMove(columnCards, oldIndex, newIndex);
      const updatedCards = cards.map((c) => {
        const orderIndex = newOrder.findIndex((nc) => nc.id === c.id);
        if (orderIndex !== -1) {
          return { ...c, display_order: orderIndex };
        }
        return c;
      });
      setCards(updatedCards);
    }

    // Update in database
    try {
      await supabase
        .from("content_cards")
        .update({
          column_id: targetColumnId,
          display_order: newIndex >= 0 ? newIndex : 0,
        })
        .eq("id", activeCardId);
    } catch (error) {
      console.error("Error updating card position:", error);
      toast.error("Erreur lors du déplacement de la carte");
      fetchData();
    }
  };

  const handleAddColumn = async (name: string) => {
    try {
      const archiveColumn = columns.find((c) => c.name === "Archive");
      const newOrder = archiveColumn
        ? archiveColumn.display_order
        : columns.length;

      // Shift archive column
      if (archiveColumn) {
        await supabase
          .from("content_columns")
          .update({ display_order: archiveColumn.display_order + 1 })
          .eq("id", archiveColumn.id);
      }

      const { data, error } = await supabase
        .from("content_columns")
        .insert({ name, display_order: newOrder })
        .select()
        .single();

      if (error) throw error;

      toast.success("Colonne ajoutée");
      fetchData();
    } catch (error) {
      console.error("Error adding column:", error);
      toast.error("Erreur lors de l'ajout de la colonne");
    }
    setShowAddColumn(false);
  };

  const handleRenameColumn = async (columnId: string, newName: string) => {
    try {
      const { error } = await supabase
        .from("content_columns")
        .update({ name: newName })
        .eq("id", columnId);

      if (error) throw error;

      setColumns((prev) =>
        prev.map((c) => (c.id === columnId ? { ...c, name: newName } : c))
      );
      toast.success("Colonne renommée");
    } catch (error) {
      console.error("Error renaming column:", error);
      toast.error("Erreur lors du renommage");
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    try {
      const { error } = await supabase
        .from("content_columns")
        .delete()
        .eq("id", columnId);

      if (error) throw error;

      setColumns((prev) => prev.filter((c) => c.id !== columnId));
      setCards((prev) => prev.filter((c) => c.column_id !== columnId));
      toast.success("Colonne supprimée");
    } catch (error) {
      console.error("Error deleting column:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleSaveCard = async (cardData: Partial<Card>) => {
    try {
      if (editingCard) {
        const { error } = await supabase
          .from("content_cards")
          .update({
            title: cardData.title,
            description: cardData.description,
            image_url: cardData.image_url,
            tags: cardData.tags,
            card_type: cardData.card_type || "article",
          })
          .eq("id", editingCard.id);

        if (error) throw error;
        toast.success("Carte mise à jour");
      } else if (newCardColumnId) {
        const columnCards = cards.filter((c) => c.column_id === newCardColumnId);
        const { error } = await supabase.from("content_cards").insert({
          column_id: newCardColumnId,
          title: cardData.title || "Nouvelle carte",
          description: cardData.description,
          image_url: cardData.image_url,
          tags: cardData.tags || [],
          card_type: cardData.card_type || "article",
          display_order: columnCards.length,
        });

        if (error) throw error;
        toast.success("Carte créée");
      }
      fetchData();
    } catch (error) {
      console.error("Error saving card:", error);
      toast.error("Erreur lors de la sauvegarde");
    }
    setEditingCard(null);
    setNewCardColumnId(null);
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      const { error } = await supabase
        .from("content_cards")
        .delete()
        .eq("id", cardId);

      if (error) throw error;

      setCards((prev) => prev.filter((c) => c.id !== cardId));
      toast.success("Carte supprimée");
    } catch (error) {
      console.error("Error deleting card:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full">
      {/* Legend & Settings */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors.article }} />
            Article
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: colors.post }} />
            Post réseaux sociaux
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground"
          onClick={() => setShowColorSettings(true)}
        >
          <Settings2 className="h-3.5 w-3.5" />
        </Button>
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
            items={columns.map((c) => `column-${c.id}`)}
            strategy={horizontalListSortingStrategy}
          >
            {columns.map((column) => {
              // Filter cards: if filterReviewOnly is true, only show cards in review
              const columnCards = cards.filter((c) => c.column_id === column.id);
              const filteredCards = filterReviewOnly
                ? columnCards.filter((c) => cardIdsInReview.has(c.id))
                : columnCards;

              return (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={filteredCards}
                  typeColors={colors}
                  onRename={handleRenameColumn}
                  onDelete={handleDeleteColumn}
                  onAddCard={() => setNewCardColumnId(column.id)}
                  onEditCard={setEditingCard}
                  onViewCard={setEditingCard}
                  onDeleteCard={handleDeleteCard}
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
            <ContentCard card={activeCard} isDragging typeColors={colors} />
          ) : activeColumn ? (
            <div className="flex-shrink-0 w-72 bg-muted/50 rounded-lg p-3 opacity-80 shadow-lg rotate-1">
              <h3 className="font-semibold text-sm">{activeColumn.name}</h3>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AddColumnDialog
        open={showAddColumn}
        onOpenChange={setShowAddColumn}
        onAdd={handleAddColumn}
      />

      <ContentCardDialog
        open={!!editingCard || !!newCardColumnId}
        onOpenChange={(open) => {
          if (!open) {
            setEditingCard(null);
            setNewCardColumnId(null);
            onCloseCard?.();
          }
        }}
        card={editingCard}
        onSave={handleSaveCard}
      />

      {/* Color Settings Dialog */}
      <ColorSettingsDialog
        open={showColorSettings}
        onOpenChange={setShowColorSettings}
        colors={colors}
        onSave={saveTypeColors}
      />
    </div>
  );
};

/* Color settings dialog for card type colors */
const ColorSettingsDialog = ({
  open,
  onOpenChange,
  colors,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colors: ContentTypeColors;
  onSave: (colors: ContentTypeColors) => Promise<void>;
}) => {
  const [articleColor, setArticleColor] = useState(colors.article);
  const [postColor, setPostColor] = useState(colors.post);

  useEffect(() => {
    setArticleColor(colors.article);
    setPostColor(colors.post);
  }, [colors, open]);

  const handleSave = async () => {
    await onSave({ article: articleColor, post: postColor });
    toast.success("Couleurs enregistrées");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Couleurs des types de contenu</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={articleColor}
              onChange={(e) => setArticleColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border-0 p-0"
            />
            <div>
              <Label className="font-medium">Article</Label>
              <p className="text-xs text-muted-foreground">Blog, newsletter, etc.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={postColor}
              onChange={(e) => setPostColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border-0 p-0"
            />
            <div>
              <Label className="font-medium">Post réseaux sociaux</Label>
              <p className="text-xs text-muted-foreground">LinkedIn, Instagram, etc.</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default KanbanBoard;
