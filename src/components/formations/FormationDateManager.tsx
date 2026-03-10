import { Loader2, Save, X, Plus, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FormationDate } from "@/types/formations";

interface FormationDateManagerProps {
  formationDates: FormationDate[];
  loadingDates: boolean;
  editingDate: FormationDate | null;
  setEditingDate: (d: FormationDate | null) => void;
  newDate: Partial<FormationDate> | null;
  setNewDate: (d: Partial<FormationDate> | null) => void;
  onAdd: () => Promise<void>;
  onSetDefault: (dateConfig: FormationDate) => Promise<void>;
  onDelete: (dateConfig: FormationDate) => Promise<void>;
  onSave: () => Promise<void>;
}

export default function FormationDateManager({
  formationDates,
  loadingDates,
  editingDate,
  setEditingDate,
  newDate,
  setNewDate,
  onAdd,
  onSetDefault,
  onDelete,
  onSave,
}: FormationDateManagerProps) {
  return (
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
                onChange={(e) => setNewDate({
                  ...newDate,
                  date_label: e.target.value
                })}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={onAdd} disabled={!newDate.date_label}>
                <Save className="w-3 h-3 mr-1" />
                Ajouter
              </Button>
              <Button size="sm" variant="outline" onClick={() => setNewDate(null)}>
                <X className="w-3 h-3 mr-1" />
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setNewDate({})}
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
        ) : formationDates.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            Aucune date configurée. Ajoutez-en une ou saisissez directement dans le champ.
          </p>
        ) : (
          formationDates.map((dateConfig) => (
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
                      onClick={() => onSetDefault(dateConfig)}
                      title="Définir par défaut"
                    >
                      <Star className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete(dateConfig)}
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
                      onChange={(e) => setEditingDate({
                        ...editingDate,
                        date_label: e.target.value
                      })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={onSave}>
                      <Save className="w-3 h-3 mr-1" />
                      Sauvegarder
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingDate(null)}>
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
                    onClick={() => setEditingDate(dateConfig)}
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
  );
}
