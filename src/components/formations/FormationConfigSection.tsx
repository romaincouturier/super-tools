import { Settings, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FormationConfig } from "@/types/formations";
import type { FormationFormula } from "@/types/training";
import FormationConfigEditor from "@/components/formations/FormationConfigEditor";

export interface ConfigEditorActions {
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

interface FormationConfigSectionProps {
  formationDemandee: string;
  setFormationDemandee: (v: string) => void;
  formationConfigs: FormationConfig[];
  loadingConfigs: boolean;
  configDialogOpen: boolean;
  setConfigDialogOpen: (v: boolean) => void;
  configEditorActions: ConfigEditorActions;
  formationFormulas: FormationFormula[];
  selectedFormulaId: string;
  setSelectedFormulaId: (v: string) => void;
}

export default function FormationConfigSection({
  formationDemandee,
  setFormationDemandee,
  formationConfigs,
  loadingConfigs,
  configDialogOpen,
  setConfigDialogOpen,
  configEditorActions,
  formationFormulas,
  selectedFormulaId,
  setSelectedFormulaId,
}: FormationConfigSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Formation demandée *</Label>
        <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2">
              <Settings className="w-3 h-3 mr-1" />
              Gérer
            </Button>
          </DialogTrigger>
          <FormationConfigEditor
            formationConfigs={formationConfigs}
            loadingConfigs={loadingConfigs}
            editingFormation={configEditorActions.editingFormation}
            setEditingFormation={configEditorActions.setEditingFormation}
            newFormation={configEditorActions.newFormation}
            setNewFormation={configEditorActions.setNewFormation}
            onSave={configEditorActions.onSave}
            onAdd={configEditorActions.onAdd}
            onDelete={configEditorActions.onDelete}
            onSetDefault={configEditorActions.onSetDefault}
            onMove={configEditorActions.onMove}
          />
        </Dialog>
      </div>

      <Select value={formationDemandee} onValueChange={setFormationDemandee}>
        <SelectTrigger className="w-full bg-background">
          <SelectValue placeholder="Sélectionner une formation" />
        </SelectTrigger>
        <SelectContent className="bg-background border shadow-lg z-50">
          {formationConfigs.map((config) => (
            <SelectItem key={config.id} value={config.formation_name}>
              <div className="flex items-center gap-2">
                {config.is_default && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                <span>{config.formation_name}</span>
                <span className="text-muted-foreground text-xs">
                  ({config.prix}€ • {config.duree_heures}h)
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {formationFormulas.length >= 2 && (
        <div className="mt-3">
          <Label className="text-sm">Formule</Label>
          <Select value={selectedFormulaId} onValueChange={setSelectedFormulaId}>
            <SelectTrigger className="w-full bg-background mt-1">
              <SelectValue placeholder="Sélectionner une formule" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              {formationFormulas.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  <div className="flex items-center gap-2">
                    <span>{f.name}</span>
                    {(f.prix != null || f.duree_heures != null) && (
                      <span className="text-muted-foreground text-xs">
                        ({f.prix != null ? `${f.prix}€` : ""}{f.prix != null && f.duree_heures != null ? " · " : ""}{f.duree_heures != null ? `${f.duree_heures}h` : ""})
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
