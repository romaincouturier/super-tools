import { useState, useEffect, useMemo } from "react";
import { Plus, Pencil, Trash2, Zap, MoreHorizontal } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  useSupertiltActions,
  useSupertiltColumns,
  type SupertiltAction,
} from "@/hooks/useSupertilt";
import GenericKanbanBoard from "@/components/shared/kanban/GenericKanbanBoard";
import AddColumnDialog from "@/components/shared/AddColumnDialog";
import type { KanbanColumnDef, KanbanCardDef } from "@/types/kanban";
import SupertiltActionCard from "@/components/supertilt/SupertiltActionCard";
import SupertiltActionDialog from "@/components/supertilt/SupertiltActionDialog";

interface SystemUser {
  user_id: string;
  email: string;
  display_name: string | null;
}

function useSystemUsers() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  useEffect(() => {
    supabase
      .from("profiles")
      .select("user_id, email, display_name")
      .order("email")
      .then(({ data }) => {
        if (data) setUsers(data as SystemUser[]);
      });
  }, []);
  return users;
}

type SupertiltKanbanCard = SupertiltAction & KanbanCardDef;
type SupertiltKanbanColumn = KanbanColumnDef;

const SuperTilt = () => {
  const { actions, isLoading: actionsLoading, addAction, updateAction, deleteAction } =
    useSupertiltActions();
  const {
    columns,
    isLoading: columnsLoading,
    addColumn,
    renameColumn,
    deleteColumn,
    reorderColumns,
  } = useSupertiltColumns();
  const systemUsers = useSystemUsers();

  const [showAddAction, setShowAddAction] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [renameTarget, setRenameTarget] = useState<SupertiltKanbanColumn | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SupertiltKanbanColumn | null>(null);
  const [editingAction, setEditingAction] = useState<SupertiltAction | null>(null);

  const isLoading = actionsLoading || columnsLoading;

  const firstColumnId = columns[0]?.id;

  const kanbanColumns: SupertiltKanbanColumn[] = useMemo(
    () => columns.map((c) => ({ id: c.id, name: c.name, position: c.position })),
    [columns],
  );

  const kanbanCards: SupertiltKanbanCard[] = useMemo(
    () =>
      actions
        .filter((a) => a.column_id) // skip orphans (shouldn't happen after migration)
        .map((a) => ({
          ...a,
          columnId: a.column_id as string,
          position: a.position,
        })),
    [actions],
  );

  const handleAddColumn = (name: string) => {
    addColumn.mutate(name);
    setShowAddColumn(false);
  };

  const handleRename = () => {
    if (!renameTarget || !renameValue.trim()) return;
    renameColumn.mutate({ id: renameTarget.id, name: renameValue.trim() });
    setRenameTarget(null);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteColumn.mutate(deleteTarget.id);
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <ModuleLayout>
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" className="text-primary" />
        </div>
      </ModuleLayout>
    );
  }

  return (
    <ModuleLayout>
      <main className="p-4 sm:p-6 space-y-4 h-full flex flex-col">
        <PageHeader
          icon={Zap}
          title="SuperTilt"
          subtitle={`${actions.length} action${actions.length > 1 ? "s" : ""}`}
        />

        <div className="flex gap-2 items-center">
          <Button
            onClick={() => setShowAddAction(true)}
            disabled={!firstColumnId}
            className="gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowAddColumn(true)}
            className="gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" /> Colonne
          </Button>
        </div>

        <div className="flex-1 min-h-0">
          <GenericKanbanBoard<SupertiltKanbanCard, SupertiltKanbanColumn>
            columns={kanbanColumns}
            cards={kanbanCards}
            config={{ columnSortable: true }}
            renderCard={(card, isDragging) => (
              <SupertiltActionCard
                action={card}
                isDragging={isDragging}
                onToggle={(checked) =>
                  updateAction.mutate({ id: card.id, is_completed: checked })
                }
              />
            )}
            renderColumnHeader={(col, colCards, dragHandle) => (
              <div className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center gap-1.5 min-w-0">
                  {dragHandle}
                  <h3 className="font-semibold text-sm truncate">{col.name}</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {colCards.length}
                  </span>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setRenameTarget(col);
                        setRenameValue(col.name);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Renommer
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteTarget(col)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            renderEmptyColumn={() => (
              <div className="text-center text-xs text-muted-foreground py-8">
                Aucune action
              </div>
            )}
            onCardMove={async ({ card, targetColumnId, newPosition }) => {
              await updateAction.mutateAsync({
                id: card.id,
                column_id: targetColumnId,
                position: newPosition,
              });
            }}
            onColumnReorder={async (ids) => {
              await reorderColumns.mutateAsync(ids);
            }}
            onCardClick={(card) => setEditingAction(card)}
          />
        </div>
      </main>

      <AddColumnDialog
        open={showAddColumn}
        onOpenChange={setShowAddColumn}
        onAdd={handleAddColumn}
      />

      {/* Rename column */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer la colonne</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-col">Nom</Label>
            <Input
              id="rename-col"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Annuler
            </Button>
            <Button onClick={handleRename} disabled={!renameValue.trim()}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete column confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette colonne ?</AlertDialogTitle>
            <AlertDialogDescription>
              La colonne « {deleteTarget?.name} » et toutes les actions qu'elle contient
              seront définitivement supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create new action */}
      <SupertiltActionDialog
        action={null}
        open={showAddAction}
        isNew
        onOpenChange={(open) => setShowAddAction(open)}
        systemUsers={systemUsers}
        onSave={(updates) => {
          if (!updates.title?.trim() || !firstColumnId) return;
          const colCards = kanbanCards.filter((c) => c.columnId === firstColumnId);
          addAction.mutate({
            title: updates.title.trim(),
            description: updates.description ?? null,
            assigned_to: updates.assigned_to ?? null,
            deadline: updates.deadline ?? null,
            column_id: firstColumnId,
            position: colCards.length,
          });
        }}
        onDelete={() => {}}
      />

      {/* Edit existing action */}
      <SupertiltActionDialog
        action={editingAction}
        open={!!editingAction}
        onOpenChange={(open) => !open && setEditingAction(null)}
        systemUsers={systemUsers}
        onSave={(updates) => {
          if (!editingAction) return;
          updateAction.mutate({ id: editingAction.id, ...updates });
        }}
        onDelete={() => {
          if (!editingAction) return;
          deleteAction.mutate(editingAction.id);
        }}
      />
    </ModuleLayout>
  );
};

export default SuperTilt;
