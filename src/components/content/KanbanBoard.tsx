import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Loader2, Settings2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserPreference } from "@/hooks/useUserPreferences";
import GenericKanbanBoard from "@/components/shared/kanban/GenericKanbanBoard";
import type { KanbanColumnDef, KanbanCardDef } from "@/types/kanban";
import ContentCard from "./ContentCard";
import ContentCardDialog from "./ContentCardDialog";
import AddColumnDialog from "@/components/shared/AddColumnDialog";

export interface ContentTypeColors {
  article: string;
  post: string;
}

const DEFAULT_CONTENT_TYPE_COLORS: ContentTypeColors = {
  article: "#3b82f6",
  post: "#a855f7",
};

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
  emoji?: string | null;
  newsletter_name?: string | null;
}

export interface Column {
  id: string;
  name: string;
  display_order: number;
  is_system: boolean;
}

// Mapped types for GenericKanbanBoard
type ContentKanbanCard = Card & KanbanCardDef;
type ContentKanbanColumn = Column & KanbanColumnDef;

interface KanbanBoardProps {
  openCardId?: string | null;
  onCloseCard?: () => void;
  filterReviewOnly?: boolean;
  showPublished?: boolean;
  onNewsletterChange?: () => void;
}

const KanbanBoard = ({ openCardId, onCloseCard, filterReviewOnly = false, showPublished = false, onNewsletterChange }: KanbanBoardProps) => {
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [cardIdsInReview, setCardIdsInReview] = useState<Set<string>>(new Set());
  const [cardIdsInSentNewsletter, setCardIdsInSentNewsletter] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showColorSettings, setShowColorSettings] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [newCardColumnId, setNewCardColumnId] = useState<string | null>(null);
  const [renameColumn, setRenameColumn] = useState<Column | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const {
    value: typeColors,
    save: saveTypeColors,
  } = useUserPreference<ContentTypeColors>("content_type_colors", DEFAULT_CONTENT_TYPE_COLORS);
  const colors = typeColors ?? DEFAULT_CONTENT_TYPE_COLORS;

  useEffect(() => {
    fetchData();

    // Realtime subscription for cross-device sync
    const channel = supabase
      .channel("content-kanban-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "content_cards" },
        () => {
          console.log("[Kanban] Realtime: content_cards changed");
          fetchData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "content_columns" },
        () => {
          console.log("[Kanban] Realtime: content_columns changed");
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      const [columnsRes, cardsRes, reviewsRes, sentNewslettersRes, newsletterAttachmentsRes] = await Promise.all([
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
        (async () => {
          const { data: sentNl } = await supabase
            .from("newsletters")
            .select("id")
            .eq("status", "sent");
          if (!sentNl || sentNl.length === 0) return { data: [] };
          const nlIds = sentNl.map((n) => n.id);
          const { data: nlCards } = await supabase
            .from("newsletter_cards")
            .select("card_id")
            .in("newsletter_id", nlIds);
          return { data: nlCards || [] };
        })(),
        // Fetch all newsletter attachments with newsletter title
        (async () => {
          const { data: nlCards } = await supabase
            .from("newsletter_cards")
            .select("card_id, newsletter_id");
          if (!nlCards || nlCards.length === 0) return new Map<string, string>();
          const nlIds = [...new Set(nlCards.map((nc) => nc.newsletter_id))];
          const { data: newsletters } = await supabase
            .from("newsletters")
            .select("id, title, scheduled_date")
            .in("id", nlIds);
          const nlMap = new Map<string, string>();
          for (const nl of newsletters || []) {
            nlMap.set(nl.id, nl.title || "Newsletter");
          }
          const cardNlMap = new Map<string, string>();
          for (const nc of nlCards) {
            const name = nlMap.get(nc.newsletter_id);
            if (name) cardNlMap.set(nc.card_id, name);
          }
          return cardNlMap;
        })(),
      ]);

      if (columnsRes.error) throw columnsRes.error;
      if (cardsRes.error) throw cardsRes.error;

      const cardReviewStatus = new Map<string, ReviewStatus>();
      for (const r of reviewsRes.data || []) {
        if (!cardReviewStatus.has(r.card_id)) {
          cardReviewStatus.set(r.card_id, r.status as ReviewStatus);
        }
      }

      const reviewCardIds = new Set<string>(
        (reviewsRes.data || [])
          .filter((r) => r.status === "pending" || r.status === "in_review")
          .map((r) => r.card_id)
      );
      setCardIdsInReview(reviewCardIds);

      const sentNlCardIds = new Set<string>(
        (sentNewslettersRes.data || []).map((nc) => nc.card_id)
      );
      setCardIdsInSentNewsletter(sentNlCardIds);

      const cardNewsletterMap = newsletterAttachmentsRes as Map<string, string>;

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
          card_type: (c.card_type as ContentCardType) || "article",
          emoji: (c as unknown as { emoji?: string | null }).emoji || null,
          newsletter_name: cardNewsletterMap.get(c.id) || null,
        }))
      );
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erreur lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  // --- Map data to GenericKanbanBoard types ---

  const kanbanColumns: ContentKanbanColumn[] = useMemo(() => {
    let cols = columns.map((col) => ({
      ...col,
      position: col.display_order,
      name: col.name,
    }));
    if (!showPublished) {
      cols = cols.filter((c) => c.name.toLowerCase() !== "archive");
    }
    return cols;
  }, [columns, showPublished]);

  const kanbanCards: ContentKanbanCard[] = useMemo(() => {
    let filtered = cards;
    if (filterReviewOnly) {
      filtered = filtered.filter((c) => cardIdsInReview.has(c.id));
    }
    if (!showPublished) {
      filtered = filtered.filter((c) => !cardIdsInSentNewsletter.has(c.id));
    }
    return filtered.map((card) => ({
      ...card,
      columnId: card.column_id,
      position: card.display_order,
    }));
  }, [cards, filterReviewOnly, showPublished, cardIdsInReview, cardIdsInSentNewsletter]);

  // --- Column actions ---

  const handleAddColumn = async (name: string) => {
    try {
      const archiveColumn = columns.find((c) => c.name === "Archive");
      const newOrder = archiveColumn
        ? archiveColumn.display_order
        : columns.length;

      if (archiveColumn) {
        await supabase
          .from("content_columns")
          .update({ display_order: archiveColumn.display_order + 1 })
          .eq("id", archiveColumn.id);
      }

      const { error } = await supabase
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

  const handleRenameColumn = async () => {
    if (!renameColumn || !renameValue.trim()) return;
    try {
      const { error } = await supabase
        .from("content_columns")
        .update({ name: renameValue.trim() })
        .eq("id", renameColumn.id);

      if (error) throw error;

      setColumns((prev) =>
        prev.map((c) => (c.id === renameColumn.id ? { ...c, name: renameValue.trim() } : c))
      );
      toast.success("Colonne renommée");
    } catch (error) {
      console.error("Error renaming column:", error);
      toast.error("Erreur lors du renommage");
    }
    setRenameColumn(null);
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

  const handleColumnReorder = useCallback(async (columnIds: string[]) => {
    const newColumns = columnIds
      .map((id, idx) => {
        const col = columns.find((c) => c.id === id);
        return col ? { ...col, display_order: idx } : null;
      })
      .filter(Boolean) as Column[];

    setColumns(newColumns);

    try {
      await Promise.all(
        newColumns.map((col) =>
          supabase
            .from("content_columns")
            .update({ display_order: col.display_order })
            .eq("id", col.id)
        )
      );
    } catch (error) {
      console.error("Error reordering columns:", error);
      toast.error("Erreur lors du réordonnancement des colonnes");
      fetchData();
    }
  }, [columns]);

  // --- Card actions ---

  const handleCardMove = useCallback(async ({ card, targetColumnId, newPosition }: { card: ContentKanbanCard; sourceColumnId: string; targetColumnId: string; newPosition: number }) => {
    // Optimistic update
    setCards((prev) =>
      prev.map((c) =>
        c.id === card.id
          ? { ...c, column_id: targetColumnId, display_order: newPosition }
          : c
      )
    );

    try {
      await supabase
        .from("content_cards")
        .update({
          column_id: targetColumnId,
          display_order: newPosition >= 0 ? newPosition : 0,
        })
        .eq("id", card.id);
    } catch (error) {
      console.error("Error updating card position:", error);
      toast.error("Erreur lors du déplacement de la carte");
      fetchData();
    }
  }, []);

  const handleSaveCard = async (cardData: Partial<Card>, options?: { newsletterId?: string; initialComment?: string }) => {
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
            emoji: cardData.emoji ?? null,
          })
          .eq("id", editingCard.id);

        if (error) throw error;
        toast.success("Carte mise à jour");
      } else if (newCardColumnId) {
        const columnCards = cards.filter((c) => c.column_id === newCardColumnId);
        const { data: newCard, error } = await supabase.from("content_cards").insert({
          column_id: newCardColumnId,
          title: cardData.title || "Nouvelle carte",
          description: cardData.description,
          image_url: cardData.image_url,
          tags: cardData.tags || [],
          card_type: cardData.card_type || "article",
          emoji: cardData.emoji ?? null,
          display_order: columnCards.length,
        }).select().single();

        if (error) throw error;

        if (options?.newsletterId && newCard) {
          const { data: existing } = await supabase
            .from("newsletter_cards")
            .select("display_order")
            .eq("newsletter_id", options.newsletterId)
            .order("display_order", { ascending: false })
            .limit(1);

          const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;

          await supabase
            .from("newsletter_cards")
            .insert({
              newsletter_id: options.newsletterId,
              card_id: newCard.id,
              display_order: nextOrder,
            });

          onNewsletterChange?.();
        }

        // Create initial comment if provided
        if (options?.initialComment && newCard) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from("content_comments")
              .insert({
                card_id: newCard.id,
                author_id: user.id,
                content: options.initialComment,
                status: "pending",
              });
          }
        }

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

  const handleDeleteCard = useCallback(async (cardId: string) => {
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
  }, []);

  const handleCardEmojiChange = useCallback(async (cardId: string, emoji: string | null) => {
    try {
      const { error } = await supabase
        .from("content_cards")
        .update({ emoji })
        .eq("id", cardId);

      if (error) throw error;

      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, emoji } : c))
      );
    } catch (error) {
      console.error("Error updating emoji:", error);
      toast.error("Erreur lors de la mise à jour de l'emoji");
    }
  }, []);

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

      <GenericKanbanBoard<ContentKanbanCard, ContentKanbanColumn>
        columns={kanbanColumns}
        cards={kanbanCards}
        config={{
          cardSortable: true,
          columnSortable: true,
          enableKeyboard: true,
        }}
        renderCard={(card, isDragging) => (
          <ContentCard
            card={card}
            isDragging={isDragging}
            typeColors={colors}
            onView={() => setEditingCard(card)}
            onEdit={() => setEditingCard(card)}
            onDelete={() => handleDeleteCard(card.id)}
            onEmojiChange={handleCardEmojiChange}
          />
        )}
        renderColumnHeader={(column, colCards, dragHandle) => (
          <div className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {dragHandle}
              <h3 className="font-semibold text-sm flex items-center gap-2">
                {column.name}
                <span className="bg-muted text-muted-foreground text-xs px-1.5 py-0.5 rounded-full">
                  {colCards.length}
                </span>
              </h3>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setNewCardColumnId(column.id)}
              >
                <Plus className="h-4 w-4" />
              </Button>
              {!column.is_system && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      setRenameColumn(column);
                      setRenameValue(column.name);
                    }}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Renommer
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDeleteColumn(column.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        )}
        renderEmptyColumn={() => (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Aucune carte
          </div>
        )}
        renderAfterColumns={() => (
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
        )}
        onCardMove={handleCardMove}
        onColumnReorder={handleColumnReorder}
        onCardClick={(card) => setEditingCard(card)}
        columnClassName="max-h-[calc(100vh-280px)]"
      />

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
        onNewsletterChange={onNewsletterChange}
      />

      {/* Rename column dialog */}
      <Dialog open={!!renameColumn} onOpenChange={(open) => !open && setRenameColumn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer la colonne</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="column-name">Nom</Label>
              <Input
                id="column-name"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRenameColumn()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameColumn(null)}>
              Annuler
            </Button>
            <Button onClick={handleRenameColumn}>Renommer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
