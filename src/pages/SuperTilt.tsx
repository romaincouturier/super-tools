import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { Plus, Trash2, Pencil, CalendarDays, User, Check, X, Loader2, Zap } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSupertiltActions, type SupertiltAction } from "@/hooks/useSupertilt";
import { format, isPast, isToday } from "date-fns";
import { fr } from "date-fns/locale";

interface SystemUser {
  user_id: string;
  email: string;
  display_name: string | null;
}

function useSystemUsers() {
  const [users, setUsers] = useState<SystemUser[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("user_id, email, display_name").order("email").then(({ data }) => {
      if (data) setUsers(data as SystemUser[]);
    });
  }, []);
  return users;
}

const SuperTilt = () => {
  const { actions, isLoading, addAction, updateAction, deleteAction } = useSupertiltActions();
  const systemUsers = useSystemUsers();
  const [newTitle, setNewTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const pendingActions = actions.filter((a) => !a.is_completed);
  const completedActions = actions.filter((a) => a.is_completed);

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    addAction.mutate({ title: newTitle.trim() });
    setNewTitle("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAdd();
  };

  if (isLoading) {
    return (
      <ModuleLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </ModuleLayout>
    );
  }

  return (
    <ModuleLayout>
      <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        <PageHeader icon={Zap} title="SuperTilt" subtitle={`${pendingActions.length} action${pendingActions.length > 1 ? "s" : ""} en cours`} />

        {/* Quick add */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nouvelle action..."
            className="flex-1"
            autoFocus
          />
          <Button onClick={handleAdd} disabled={!newTitle.trim() || addAction.isPending} className="gap-1.5 shrink-0">
            {addAction.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Ajouter
          </Button>
        </div>

        {/* Pending actions */}
        <section className="space-y-1">
          {pendingActions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucune action en cours. Ajoutez-en une !
            </p>
          )}
          {pendingActions.map((action) => (
            <ActionRow
              key={action.id}
              action={action}
              systemUsers={systemUsers}
              onToggle={(checked) => updateAction.mutate({ id: action.id, is_completed: checked })}
              onUpdate={(updates) => updateAction.mutate({ id: action.id, ...updates })}
              onDelete={() => deleteAction.mutate(action.id)}
              isDeleting={deleteAction.isPending}
            />
          ))}
        </section>

        {/* Completed actions */}
        {completedActions.length > 0 && (
          <section>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Terminées ({completedActions.length})
            </h3>
            <div className="space-y-1 opacity-60">
              {completedActions.map((action) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  systemUsers={systemUsers}
                  onToggle={(checked) => updateAction.mutate({ id: action.id, is_completed: checked })}
                  onUpdate={(updates) => updateAction.mutate({ id: action.id, ...updates })}
                  onDelete={() => deleteAction.mutate(action.id)}
                  isDeleting={deleteAction.isPending}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </ModuleLayout>
  );
};

// ── Action row ───────────────────────────────────────────────

interface ActionRowProps {
  action: SupertiltAction;
  systemUsers: SystemUser[];
  onToggle: (checked: boolean) => void;
  onUpdate: (updates: Partial<Pick<SupertiltAction, "title" | "description" | "assigned_to" | "deadline">>) => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function ActionRow({ action, systemUsers, onToggle, onUpdate, onDelete, isDeleting }: ActionRowProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(action.title);
  const [editDesc, setEditDesc] = useState(action.description || "");
  const [editAssigned, setEditAssigned] = useState(action.assigned_to || "");
  const [editDeadline, setEditDeadline] = useState<Date | undefined>(
    action.deadline ? new Date(action.deadline + "T00:00:00") : undefined
  );

  const deadlineDate = action.deadline ? new Date(action.deadline + "T00:00:00") : undefined;
  const isOverdue = deadlineDate && isPast(deadlineDate) && !isToday(deadlineDate) && !action.is_completed;

  const handleSaveEdit = () => {
    if (!editTitle.trim()) return;
    onUpdate({
      title: editTitle.trim(),
      description: editDesc.trim() || null,
      assigned_to: editAssigned && editAssigned !== "__none__" ? editAssigned : null,
      deadline: editDeadline ? format(editDeadline, "yyyy-MM-dd") : null,
    });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
        <Input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Titre *"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
        />
        <Input
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          placeholder="Description (optionnel)"
          onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
        />
        <Select value={editAssigned} onValueChange={setEditAssigned}>
          <SelectTrigger>
            <SelectValue placeholder="Assigné à (optionnel)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Aucun —</SelectItem>
            {systemUsers.map((u) => (
              <SelectItem key={u.user_id} value={u.display_name || u.email}>
                {u.display_name || u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !editDeadline && "text-muted-foreground"
              )}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              {editDeadline ? format(editDeadline, "d MMMM yyyy", { locale: fr }) : "Date attendue (optionnel)"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={editDeadline}
              onSelect={setEditDeadline}
              locale={fr}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSaveEdit} disabled={!editTitle.trim()} className="gap-1">
            <Check className="w-3.5 h-3.5" /> Enregistrer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="gap-1">
            <X className="w-3.5 h-3.5" /> Annuler
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3 rounded-lg border px-3 py-2.5 hover:bg-muted/30 transition-colors">
      <Checkbox
        checked={action.is_completed}
        onCheckedChange={(checked) => onToggle(!!checked)}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium truncate", action.is_completed && "line-through text-muted-foreground")}>
          {action.title}
        </p>
        {action.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{action.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {action.assigned_to && (
            <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
              <User className="w-2.5 h-2.5" /> {action.assigned_to}
            </Badge>
          )}
          {action.deadline && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] gap-1 px-1.5 py-0",
                isOverdue && "border-red-300 text-red-600 bg-red-50",
              )}
            >
              <CalendarDays className="w-2.5 h-2.5" />
              {format(deadlineDate!, "d MMM yyyy", { locale: fr })}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Choisir une date limite"
            >
              <CalendarDays className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={deadlineDate}
              onSelect={(date) => onUpdate({ deadline: date ? format(date, "yyyy-MM-dd") : null })}
              locale={fr}
            />
          </PopoverContent>
        </Popover>
        <button
          onClick={() => {
            setEditTitle(action.title);
            setEditDesc(action.description || "");
            setEditAssigned(action.assigned_to || "");
            setEditDeadline(action.deadline ? new Date(action.deadline + "T00:00:00") : undefined);
            setEditing(true);
          }}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Modifier l'action"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              aria-label="Supprimer l'action"
              disabled={isDeleting}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cette action ?</AlertDialogTitle>
              <AlertDialogDescription>
                L'action « {action.title} » sera définitivement supprimée.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export default SuperTilt;
