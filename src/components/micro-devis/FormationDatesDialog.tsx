import { Loader2, Save, X, Plus, Trash2, Star, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FormationDate } from "@/types/micro-devis";

interface FormationDatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dates: FormationDate[];
  loadingDates: boolean;
  editingDate: FormationDate | null;
  onEditDate: (d: FormationDate | null) => void;
  newDate: Partial<FormationDate> | null;
  onNewDate: (d: Partial<FormationDate> | null) => void;
  onAddDate: (label: string) => Promise<void>;
  onDeleteDate: (id: string, label: string) => Promise<void>;
  onSetDefault: (id: string, label: string) => Promise<void>;
  onSaveDate: (date: FormationDate) => Promise<void>;
}

export function FormationDatesDialog({
  open,
  onOpenChange,
  dates,
  loadingDates,
  editingDate,
  onEditDate,
  newDate,
  onNewDate,
  onAddDate,
  onDeleteDate,
  onSetDefault,
  onSaveDate,
}: FormationDatesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2">
          <Settings className="w-3 h-3 mr-1" />
          Gérer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configuration des dates de formation</DialogTitle>
          <DialogDescription>
            Gérez les dates de formation prédéfinies
          </DialogDescription>
        </DialogHeader>

        {/* Add new date */}
        <div className="border-b pb-4 mb-4">
          {newDate ? (
            <div className="space-y-3 p-4 border rounded-lg bg-primary/5">
              <h4 className="font-medium">Nouvelle date</h4>
              <div className="space-y-2">
                <Label className="text-xs">Libellé de la date *</Label>
                <Input
                  placeholder="Ex: 15 et 16 janvier 2026"
                  value={newDate.date_label || ""}
                  onChange={(e) => onNewDate({
                    ...newDate,
                    date_label: e.target.value
                  })}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => newDate.date_label && onAddDate(newDate.date_label)}
                  disabled={!newDate.date_label}
                >
                  <Save className="w-3 h-3 mr-1" />
                  Ajouter
                </Button>
                <Button size="sm" variant="outline" onClick={() => onNewDate(null)}>
                  <X className="w-3 h-3 mr-1" />
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onNewDate({})}
            >
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une date
            </Button>
          )}
        </div>

        {/* Existing dates */}
        <div className="space-y-3">
          {loadingDates ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : dates.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Aucune date configurée. Ajoutez-en une ou saisissez directement dans le champ.
            </p>
          ) : (
            dates.map((dateConfig) => (
              <div key={dateConfig.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {dateConfig.is_default && (
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    )}
                    <h4 className="font-medium text-sm">{dateConfig.date_label}</h4>
                  </div>
                  <div className="flex gap-1">
                    {!dateConfig.is_default && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onSetDefault(dateConfig.id, dateConfig.date_label)}
                        title="Définir par défaut"
                      >
                        <Star className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDeleteDate(dateConfig.id, dateConfig.date_label)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {editingDate?.id === dateConfig.id ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Libellé de la date</Label>
                      <Input
                        value={editingDate.date_label}
                        onChange={(e) => onEditDate({
                          ...editingDate,
                          date_label: e.target.value
                        })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => onSaveDate(editingDate)}>
                        <Save className="w-3 h-3 mr-1" />
                        Sauvegarder
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onEditDate(null)}>
                        <X className="w-3 h-3 mr-1" />
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEditDate(dateConfig)}
                    >
                      Modifier
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
