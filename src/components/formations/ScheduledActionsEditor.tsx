import { Plus, Trash2, Calendar, User, AlertCircle, Loader2, Check, Pencil, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import UserEmailCombobox from "./UserEmailCombobox";

export interface ScheduledAction {
  id: string;
  description: string;
  dueDate: Date | undefined;
  assignedEmail: string;
  assignedName: string;
  completed?: boolean;
}

interface ScheduledActionsEditorProps {
  actions: ScheduledAction[];
  onActionsChange: (actions: ScheduledAction[]) => void;
  onSave?: () => void;
  saving?: boolean;
  onToggleComplete?: (actionId: string, completed: boolean) => void;
  onDeleteSaved?: (actionId: string) => void;
}

// Check if an ID is a database UUID (saved) or a temporary ID (unsaved)
const isSavedAction = (id: string) => {
  // Temporary IDs start with "action_", UUIDs don't
  return !id.startsWith("action_");
};

const ScheduledActionsEditor = ({ actions, onActionsChange, onSave, saving, onToggleComplete, onDeleteSaved }: ScheduledActionsEditorProps) => {
  const generateId = () => `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addAction = () => {
    onActionsChange([
      ...actions,
      {
        id: generateId(),
        description: "",
        dueDate: undefined,
        assignedEmail: "",
        assignedName: "",
      },
    ]);
  };

  const removeAction = (id: string) => {
    if (isSavedAction(id) && onDeleteSaved) {
      onDeleteSaved(id);
    }
    onActionsChange(actions.filter((a) => a.id !== id));
  };

  const updateAction = (id: string, field: keyof ScheduledAction, value: any) => {
    onActionsChange(
      actions.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  };

  const savedActions = actions.filter((a) => isSavedAction(a.id));
  const unsavedActions = actions.filter((a) => !isSavedAction(a.id));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning" />
              Actions à programmer
            </CardTitle>
            <CardDescription className="mt-1">
              Programmez des rappels par email pour les tâches liées à cette formation
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addAction}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter une action
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Saved actions - display mode */}
        {savedActions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              Actions enregistrées ({savedActions.length})
            </p>
            {savedActions.map((action) => (
              <div
                key={action.id}
                className={cn(
                  "border rounded-lg p-3 flex items-start gap-3",
                  action.completed ? "bg-muted/40 opacity-70" : "bg-muted/20"
                )}
              >
                <Checkbox
                  checked={action.completed ?? false}
                  onCheckedChange={(checked) => {
                    onToggleComplete?.(action.id, checked === true);
                  }}
                  className="mt-1"
                  title={action.completed ? "Marquer comme à faire" : "Marquer comme terminée"}
                />
                <div className="flex-1 space-y-1 min-w-0">
                  <p className={cn("font-medium", action.completed && "line-through text-muted-foreground")}>{action.description}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {action.dueDate
                        ? format(action.dueDate, "d MMMM yyyy", { locale: fr })
                        : "—"}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" />
                      {action.assignedName || action.assignedEmail}
                    </span>
                    {action.completed && (
                      <span className="flex items-center gap-1 text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Terminée
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => removeAction(action.id)}
                  title="Supprimer cette action"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Unsaved actions - edit mode */}
        {unsavedActions.length === 0 && savedActions.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune action programmée. Cliquez sur "Ajouter une action" pour en créer une.
          </p>
        )}

        {unsavedActions.map((action, index) => (
          <div
            key={action.id}
            className="border rounded-lg p-4 space-y-3 bg-primary/5 border-primary/20"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-primary">
                Nouvelle action
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => removeAction(action.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor={`desc-${action.id}`}>Description de l'action *</Label>
              <Input
                id={`desc-${action.id}`}
                value={action.description}
                onChange={(e) => updateAction(action.id, "description", e.target.value)}
                placeholder="Ex: Envoyer les documents de suivi au financeur"
              />
            </div>

            {/* Date and User */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date d'échéance *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !action.dueDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {action.dueDate
                        ? format(action.dueDate, "d MMMM yyyy", { locale: fr })
                        : "Sélectionner une date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={action.dueDate}
                      onSelect={(date) => updateAction(action.id, "dueDate", date)}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>En charge de l'action *</Label>
                <UserEmailCombobox
                  value={action.assignedEmail}
                  onChange={(email, name) => {
                    updateAction(action.id, "assignedEmail", email);
                    if (name) {
                      updateAction(action.id, "assignedName", name);
                    }
                  }}
                  placeholder="Sélectionner un utilisateur ou saisir un email"
                />
              </div>
            </div>

            {/* Save button per action */}
            {onSave && (
              <Button
                type="button"
                onClick={onSave}
                disabled={saving || !action.description || !action.dueDate || !action.assignedEmail}
                className="w-full"
                size="sm"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  "Enregistrer les actions"
                )}
              </Button>
            )}
          </div>
        ))}

        {/* Saving indicator */}
        {saving && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            Sauvegarde...
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ScheduledActionsEditor;
