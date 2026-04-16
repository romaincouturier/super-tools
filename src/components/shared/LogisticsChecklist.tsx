import { useState } from "react";
import { Plus, Trash2, Calendar, Bell, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  useLogisticsChecklist,
  useCreateLogisticsItem,
  useUpdateLogisticsItem,
  useDeleteLogisticsItem,
} from "@/hooks/useLogisticsChecklist";
import type { LogisticsEntityType, LogisticsChecklistItem } from "@/types/logistics";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface LogisticsChecklistProps {
  entityType: LogisticsEntityType;
  entityId: string;
  /** Hide the section entirely if no items (avoids empty section noise). */
  hideWhenEmpty?: boolean;
}

/**
 * Editable logistics checklist for a mission/training.
 *
 * Items with `legacy_field` set keep mirroring the corresponding
 * `*_booked` boolean column on the entity (via DB trigger), so existing
 * alerts continue to work unchanged. The user perceives this as a single
 * checkbox.
 *
 * Optional fields per item:
 *   - due_date          → deadline displayed inline
 *   - notify_days_before → email reminder N days before due_date
 */
export function LogisticsChecklist({ entityType, entityId, hideWhenEmpty = false }: LogisticsChecklistProps) {
  const { toast } = useToast();
  const { data: items = [], isLoading } = useLogisticsChecklist(entityType, entityId);
  const createItem = useCreateLogisticsItem();
  const updateItem = useUpdateLogisticsItem();
  const deleteItem = useDeleteLogisticsItem(entityType, entityId);

  const [newLabel, setNewLabel] = useState("");

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) return;
    try {
      await createItem.mutateAsync({
        entity_type: entityType,
        entity_id: entityId,
        label,
        position: items.length,
      });
      setNewLabel("");
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Impossible d'ajouter l'item.");
    }
  };

  const handleToggle = async (item: LogisticsChecklistItem, checked: boolean) => {
    try {
      await updateItem.mutateAsync({ id: item.id, updates: { is_done: checked } });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Impossible de mettre à jour.");
    }
  };

  const handleDelete = async (item: LogisticsChecklistItem) => {
    try {
      await deleteItem.mutateAsync(item.id);
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Impossible de supprimer.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Spinner />
      </div>
    );
  }

  if (hideWhenEmpty && items.length === 0) return null;

  const remaining = items.filter((i) => !i.is_done).length;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">
            Logistique{" "}
            {items.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">
                ({items.length - remaining}/{items.length})
              </span>
            )}
          </h4>
        </div>

        {items.length === 0 && (
          <p className="text-xs text-muted-foreground">Aucun item. Ajoutez-en un ci-dessous.</p>
        )}

        <ul className="space-y-1">
          {items.map((item) => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              onToggle={(c) => handleToggle(item, c)}
              onDelete={() => handleDelete(item)}
              onUpdate={(updates) => updateItem.mutateAsync({ id: item.id, updates })}
            />
          ))}
        </ul>

        <div className="flex gap-2 pt-1">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Ajouter un item…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
            }}
            className="h-8 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            disabled={!newLabel.trim() || createItem.isPending}
            className="shrink-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}

interface RowProps {
  item: LogisticsChecklistItem;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
  onUpdate: (updates: Partial<LogisticsChecklistItem>) => Promise<unknown>;
}

const ChecklistItemRow = ({ item, onToggle, onDelete, onUpdate }: RowProps) => {
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft] = useState(item.label);
  const [dueDate, setDueDate] = useState(item.due_date || "");
  const [notifyDays, setNotifyDays] = useState<string>(
    item.notify_days_before != null ? String(item.notify_days_before) : "",
  );

  const saveLabel = async () => {
    const trimmed = labelDraft.trim();
    if (!trimmed || trimmed === item.label) {
      setLabelDraft(item.label);
      setEditingLabel(false);
      return;
    }
    await onUpdate({ label: trimmed });
    setEditingLabel(false);
  };

  const saveSchedule = async () => {
    await onUpdate({
      due_date: dueDate || null,
      notify_days_before: notifyDays ? parseInt(notifyDays, 10) || null : null,
    });
  };

  return (
    <li className="flex items-center gap-2 group rounded hover:bg-muted/40 px-1 py-0.5">
      <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0" />
      <Checkbox
        checked={item.is_done}
        onCheckedChange={(c) => onToggle(c === true)}
      />
      {editingLabel ? (
        <Input
          autoFocus
          value={labelDraft}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={saveLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              saveLabel();
            }
            if (e.key === "Escape") {
              setLabelDraft(item.label);
              setEditingLabel(false);
            }
          }}
          className="h-6 text-sm flex-1"
        />
      ) : (
        <button
          type="button"
          className={`text-sm text-left flex-1 ${item.is_done ? "text-muted-foreground line-through" : ""}`}
          onClick={() => setEditingLabel(true)}
        >
          {item.label}
        </button>
      )}

      {item.due_date && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
              <Calendar className="h-3 w-3" />
              {format(parseISO(item.due_date), "d MMM", { locale: fr })}
              {item.notify_days_before != null && (
                <Bell className="h-3 w-3" />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Échéance : {format(parseISO(item.due_date), "d MMMM yyyy", { locale: fr })}
            {item.notify_days_before != null && (
              <> · Rappel {item.notify_days_before} j avant</>
            )}
          </TooltipContent>
        </Tooltip>
      )}

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100"
            title="Date / rappel"
          >
            <Calendar className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3" align="end">
          <div>
            <Label className="text-xs">Échéance (optionnelle)</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-xs">Rappel — jours avant</Label>
            <Input
              type="number"
              min="0"
              max="60"
              value={notifyDays}
              onChange={(e) => setNotifyDays(e.target.value)}
              placeholder="ex: 7"
              disabled={!dueDate}
              className="h-8 text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Sans échéance, pas de rappel possible.
            </p>
          </div>
          <Button size="sm" onClick={saveSchedule} className="w-full">
            Enregistrer
          </Button>
        </PopoverContent>
      </Popover>

      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
        onClick={onDelete}
        title="Supprimer"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
};

export default LogisticsChecklist;
