import { Settings, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FormationConfig } from "@/types/formations";
import type { FormationFormula } from "@/types/training";
import type { ConfigEditorActions } from "@/components/formations/formationFormTypes";
import FormationConfigEditor from "@/components/formations/FormationConfigEditor";

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
  formationDemandee, setFormationDemandee, formationConfigs, loadingConfigs,
  configDialogOpen, setConfigDialogOpen, configEditorActions,
  formationFormulas, selectedFormulaId, setSelectedFormulaId,
}: FormationConfigSectionProps) {
  const a = configEditorActions;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Formation demandée *</Label>
        <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2">
              <Settings className="w-3 h-3 mr-1" />Gérer
            </Button>
          </DialogTrigger>
          <FormationConfigEditor
            formationConfigs={formationConfigs} loadingConfigs={loadingConfigs}
            editingFormation={a.editingFormation} setEditingFormation={a.setEditingFormation}
            newFormation={a.newFormation} setNewFormation={a.setNewFormation}
            onSave={a.onSave} onAdd={a.onAdd} onDelete={a.onDelete}
            onSetDefault={a.onSetDefault} onMove={a.onMove}
          />
        </Dialog>
      </div>
      <Select value={formationDemandee} onValueChange={setFormationDemandee}>
        <SelectTrigger className="w-full bg-background">
          <SelectValue placeholder="Sélectionner une formation" />
        </SelectTrigger>
        <SelectContent className="bg-background border shadow-lg z-50">
          {formationConfigs.map((c) => (
            <SelectItem key={c.id} value={c.formation_name}>
              <div className="flex items-center gap-2">
                {c.is_default && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                <span>{c.formation_name}</span>
                <span className="text-muted-foreground text-xs">({c.prix}€ • {c.duree_heures}h)</span>
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
