import { useState } from "react";
import { Plus, Trash2, Calendar, User, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import UserEmailCombobox from "./UserEmailCombobox";

export interface ScheduledAction {
  id: string;
  description: string;
  dueDate: Date | undefined;
  assignedEmail: string;
  assignedName: string;
}

interface ScheduledActionsEditorProps {
  actions: ScheduledAction[];
  onActionsChange: (actions: ScheduledAction[]) => void;
}

const ScheduledActionsEditor = ({ actions, onActionsChange }: ScheduledActionsEditorProps) => {
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
    onActionsChange(actions.filter((a) => a.id !== id));
  };

  const updateAction = (id: string, field: keyof ScheduledAction, value: any) => {
    onActionsChange(
      actions.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  };

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
        {actions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucune action programmée. Cliquez sur "Ajouter une action" pour en créer une.
          </p>
        ) : (
          actions.map((action, index) => (
            <div
              key={action.id}
              className="border rounded-lg p-4 space-y-3 bg-muted/30"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">
                  Action {index + 1}
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
                  <Label htmlFor={`name-${action.id}`}>Nom de la personne</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id={`name-${action.id}`}
                      value={action.assignedName}
                      onChange={(e) => updateAction(action.id, "assignedName", e.target.value)}
                      placeholder="Ex: Marie Martin"
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label>Email de la personne concernée *</Label>
                <UserEmailCombobox
                  value={action.assignedEmail}
                  onChange={(email, name) => {
                    updateAction(action.id, "assignedEmail", email);
                    if (name && !action.assignedName) {
                      updateAction(action.id, "assignedName", name);
                    }
                  }}
                  placeholder="Sélectionner un utilisateur ou saisir un email"
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default ScheduledActionsEditor;
