import { Save, X, Plus, Trash2, Star, ChevronUp, ChevronDown } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FormationConfig } from "@/types/formations";

interface FormationConfigEditorProps {
  formationConfigs: FormationConfig[];
  loadingConfigs: boolean;
  editingFormation: FormationConfig | null;
  setEditingFormation: (f: FormationConfig | null) => void;
  newFormation: Partial<FormationConfig> | null;
  setNewFormation: (f: Partial<FormationConfig> | null) => void;
  onSave: () => Promise<void>;
  onAdd: () => Promise<void>;
  onDelete: (id: string, name: string) => Promise<void>;
  onSetDefault: (id: string) => Promise<void>;
  onMove: (index: number, direction: "up" | "down") => Promise<void>;
}

export default function FormationConfigEditor({
  formationConfigs,
  loadingConfigs,
  editingFormation,
  setEditingFormation,
  newFormation,
  setNewFormation,
  onSave,
  onAdd,
  onDelete,
  onSetDefault,
  onMove,
}: FormationConfigEditorProps) {
  return (
    <DialogContent className="w-full sm:max-w-3xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Configuration des formations</DialogTitle>
        <DialogDescription>
          Gérez les formations, leurs prix, durées et URLs des programmes
        </DialogDescription>
      </DialogHeader>

      {/* Add new formation */}
      <div className="border-b pb-4 mb-4">
        {newFormation ? (
          <div className="space-y-3 p-4 border rounded-lg bg-primary/5">
            <h4 className="font-medium">Nouvelle formation</h4>
            <div className="space-y-2">
              <Label className="text-xs">Nom de la formation *</Label>
              <Input
                placeholder="Nom de la formation"
                value={newFormation.formation_name || ""}
                onChange={(e) => setNewFormation({
                  ...newFormation,
                  formation_name: e.target.value
                })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Prix (EUR)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newFormation.prix || ""}
                  onChange={(e) => setNewFormation({
                    ...newFormation,
                    prix: parseFloat(e.target.value) || 0
                  })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Durée (heures)</Label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="0"
                  value={newFormation.duree_heures || ""}
                  onChange={(e) => setNewFormation({
                    ...newFormation,
                    duree_heures: parseFloat(e.target.value) || 0
                  })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL du programme *</Label>
              <Input
                type="url"
                placeholder="https://..."
                value={newFormation.programme_url || ""}
                onChange={(e) => setNewFormation({
                  ...newFormation,
                  programme_url: e.target.value || null
                })}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={onAdd} disabled={!newFormation.formation_name || !newFormation.programme_url}>
                <Save className="w-3 h-3 mr-1" />
                Ajouter
              </Button>
              <Button size="sm" variant="outline" onClick={() => setNewFormation(null)}>
                <X className="w-3 h-3 mr-1" />
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setNewFormation({ prix: 1490, duree_heures: 14 })}
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une formation
          </Button>
        )}
      </div>

      {/* Existing formations */}
      <div className="space-y-3">
        {loadingConfigs ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : (
          formationConfigs.map((config, index) => (
            <div key={config.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {/* Reorder buttons */}
                  <div className="flex flex-col">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0"
                      onClick={() => onMove(index, "up")}
                      disabled={index === 0}
                      title="Monter"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0"
                      onClick={() => onMove(index, "down")}
                      disabled={index === formationConfigs.length - 1}
                      title="Descendre"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </div>
                  {config.is_default && (
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  )}
                  <h4 className="font-medium text-sm">{config.formation_name}</h4>
                </div>
                <div className="flex gap-1">
                  {!config.is_default && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onSetDefault(config.id)}
                      title="Définir par défaut"
                    >
                      <Star className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete(config.id, config.formation_name)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {editingFormation?.id === config.id ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Nom de la formation</Label>
                    <Input
                      value={editingFormation.formation_name}
                      onChange={(e) => setEditingFormation({
                        ...editingFormation,
                        formation_name: e.target.value
                      })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Prix (EUR)</Label>
                      <Input
                        type="number"
                        value={editingFormation.prix}
                        onChange={(e) => setEditingFormation({
                          ...editingFormation,
                          prix: parseFloat(e.target.value) || 0
                        })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Durée (heures)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={editingFormation.duree_heures}
                        onChange={(e) => setEditingFormation({
                          ...editingFormation,
                          duree_heures: parseFloat(e.target.value) || 0
                        })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">URL du programme</Label>
                    <Input
                      type="url"
                      placeholder="https://..."
                      value={editingFormation.programme_url || ""}
                      onChange={(e) => setEditingFormation({
                        ...editingFormation,
                        programme_url: e.target.value || null
                      })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={onSave}>
                      <Save className="w-3 h-3 mr-1" />
                      Sauvegarder
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingFormation(null)}>
                      <X className="w-3 h-3 mr-1" />
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {config.prix}€ • {config.duree_heures}h
                    {config.programme_url && " • Programme ✓"}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingFormation(config)}
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
