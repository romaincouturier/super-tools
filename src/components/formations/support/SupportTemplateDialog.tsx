import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LayoutTemplate, Plus, Trash2, Save } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  useSupportTemplates, useDeleteTemplate, useSaveAsTemplate,
} from "@/hooks/useTrainingSupport";

interface SupportTemplateDialogProps {
  supportId?: string;
  onSelectTemplate: (templateId: string) => void;
  mode: "create" | "save";
}

const SupportTemplateDialog = ({ supportId, onSelectTemplate, mode }: SupportTemplateDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: templates = [] } = useSupportTemplates();
  const deleteTemplate = useDeleteTemplate();
  const saveAsTemplate = useSaveAsTemplate();

  const handleSelectTemplate = () => {
    if (!selectedTemplateId) return;
    onSelectTemplate(selectedTemplateId);
    setOpen(false);
  };

  const handleSaveAsTemplate = async () => {
    if (!supportId || !newTemplateName.trim()) return;
    setSaving(true);
    try {
      await saveAsTemplate.mutateAsync({ supportId, name: newTemplateName.trim() });
      toast.success("Modèle enregistré");
      setNewTemplateName("");
      setOpen(false);
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Supprimer ce modèle ?")) return;
    try {
      await deleteTemplate.mutateAsync(id);
      toast.success("Modèle supprimé");
    } catch {
      toast.error("Erreur lors de la suppression");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {mode === "create" ? (
            <><LayoutTemplate className="h-3.5 w-3.5" />Depuis un modèle</>
          ) : (
            <><Save className="h-3.5 w-3.5" />Enregistrer comme modèle</>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Créer depuis un modèle" : "Enregistrer comme modèle"}
          </DialogTitle>
        </DialogHeader>

        {mode === "create" ? (
          <div className="space-y-4">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Aucun modèle disponible. Créez d'abord un support, puis enregistrez-le comme modèle.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {templates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedTemplateId === tpl.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedTemplateId(tpl.id)}
                    >
                      <div>
                        <p className="text-sm font-medium">{tpl.name}</p>
                        {tpl.description && (
                          <p className="text-xs text-muted-foreground">{tpl.description}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={(e) => handleDeleteTemplate(e, tpl.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button onClick={handleSelectTemplate} disabled={!selectedTemplateId} className="w-full">
                  Utiliser ce modèle
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label>Nom du modèle</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Ex: Formation technique standard"
              />
            </div>
            <Button
              onClick={handleSaveAsTemplate}
              disabled={saving || !newTemplateName.trim()}
              className="w-full"
            >
              {saving ? <Spinner className="mr-2" /> : null}
              Enregistrer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SupportTemplateDialog;
