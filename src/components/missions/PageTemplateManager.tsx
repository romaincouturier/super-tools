import { useState } from "react";
import { Plus, Trash2, Edit2, Loader2, Save, GripVertical } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  useMissionPageTemplates,
  useCreateMissionPageTemplate,
  useUpdateMissionPageTemplate,
  useDeleteMissionPageTemplate,
  MissionPageTemplate,
} from "@/hooks/useMissions";

const EMOJI_OPTIONS = [
  "📄", "📝", "📋", "📌", "💡", "⭐", "🎯", "✅",
  "🔧", "📊", "🚀", "💰", "📞", "📧", "🗓️", "👤",
];

const PageTemplateManager = () => {
  const { toast } = useToast();
  const { data: templates, isLoading } = useMissionPageTemplates();
  const createTemplate = useCreateMissionPageTemplate();
  const updateTemplate = useUpdateMissionPageTemplate();
  const deleteTemplate = useDeleteMissionPageTemplate();

  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MissionPageTemplate | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [icon, setIcon] = useState("📄");

  const resetForm = () => {
    setName("");
    setDescription("");
    setContent("");
    setIcon("📄");
    setEditingTemplate(null);
  };

  const openNew = () => {
    resetForm();
    setShowEditor(true);
  };

  const openEdit = (t: MissionPageTemplate) => {
    setEditingTemplate(t);
    setName(t.name);
    setDescription(t.description || "");
    setContent(t.content);
    setIcon(t.icon);
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Le nom est requis", variant: "destructive" });
      return;
    }

    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({
          id: editingTemplate.id,
          updates: {
            name: name.trim(),
            description: description.trim() || null,
            content,
            icon,
          },
        });
        toast({ title: "Modèle modifié" });
      } else {
        await createTemplate.mutateAsync({
          name: name.trim(),
          description: description.trim() || undefined,
          content,
          icon,
        });
        toast({ title: "Modèle créé" });
      }
      setShowEditor(false);
      resetForm();
    } catch (err: unknown) {
      toastError(toast, err instanceof Error ? err : "Erreur inconnue");
    }
  };

  const handleDelete = async (t: MissionPageTemplate) => {
    if (!confirm(`Supprimer le modèle "${t.name}" ?`)) return;
    try {
      await deleteTemplate.mutateAsync(t.id);
      toast({ title: "Modèle supprimé" });
    } catch (err: unknown) {
      toastError(toast, err instanceof Error ? err : "Erreur inconnue");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          Modèles de pages mission
          <Button size="sm" variant="outline" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" />
            Nouveau modèle
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : templates && templates.length > 0 ? (
          <div className="space-y-2">
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <span className="text-xl">{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{t.name}</div>
                  {t.description && (
                    <div className="text-xs text-muted-foreground truncate">{t.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-500 hover:text-red-600"
                    onClick={() => handleDelete(t)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun modèle. Créez des modèles pour pré-remplir vos pages mission.
          </p>
        )}

        <Dialog open={showEditor} onOpenChange={setShowEditor}>
          <DialogContent className="w-full sm:max-w-xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? "Modifier le modèle" : "Nouveau modèle de page"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <div>
                  <Label>Icône</Label>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {EMOJI_OPTIONS.map((e) => (
                      <button
                        key={e}
                        className={`text-lg rounded p-1 transition-colors ${
                          icon === e ? "bg-primary/15 ring-1 ring-primary" : "hover:bg-muted"
                        }`}
                        onClick={() => setIcon(e)}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Label>Nom du modèle *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex: Compte-rendu de réunion"
                />
              </div>

              <div>
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brève description du modèle"
                />
              </div>

              <div>
                <Label>Contenu HTML du modèle</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="<h2>Titre de section</h2><p>Contenu...</p>"
                  rows={10}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Utilisez du HTML : &lt;h2&gt;, &lt;ul&gt;, &lt;li data-type="taskItem"&gt;, etc.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditor(false)}>
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={createTemplate.isPending || updateTemplate.isPending}>
                {(createTemplate.isPending || updateTemplate.isPending) && (
                  <Spinner className="mr-2" />
                )}
                <Save className="h-4 w-4 mr-2" />
                {editingTemplate ? "Modifier" : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default PageTemplateManager;
