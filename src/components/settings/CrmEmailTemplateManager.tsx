import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Save, Mail } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useCrmEmailTemplates,
  useCreateCrmTemplate,
  useUpdateCrmTemplate,
  useDeleteCrmTemplate,
  CrmEmailTemplate,
} from "@/hooks/useCrmEmailTemplates";

const CrmEmailTemplateManager = () => {
  const { data: templates, isLoading } = useCrmEmailTemplates();
  const createTemplate = useCreateCrmTemplate();
  const updateTemplate = useUpdateCrmTemplate();
  const deleteTemplate = useDeleteCrmTemplate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CrmEmailTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const { toast } = useToast();

  const openCreate = () => {
    setEditingTemplate(null);
    setName("");
    setSubject("");
    setBody("");
    setDialogOpen(true);
  };

  const openEdit = (template: CrmEmailTemplate) => {
    setEditingTemplate(template);
    setName(template.template_name);
    setSubject(template.subject);
    // Convert HTML to plain text for editing (simple conversion)
    const plainBody = template.html_content
      .replace(/<\/p><p>/g, "\n")
      .replace(/<p>/g, "")
      .replace(/<\/p>/g, "")
      .replace(/<br\s*\/?>/g, "\n")
      .replace(/<[^>]*>/g, "");
    setBody(plainBody);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) return;

    // Convert plain text to HTML paragraphs
    const htmlContent = body
      .split("\n")
      .map((line) => `<p>${line || "<br>"}</p>`)
      .join("");

    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({
          id: editingTemplate.id,
          updates: {
            template_name: name.trim(),
            subject: subject.trim(),
            html_content: htmlContent,
          },
        });
        toast({ title: "Modèle modifié", description: `"${name}" a été mis à jour.` });
      } else {
        await createTemplate.mutateAsync({
          template_name: name.trim(),
          subject: subject.trim(),
          html_content: htmlContent,
        });
        toast({ title: "Modèle créé", description: `"${name}" a été ajouté.` });
      }
      setDialogOpen(false);
    } catch {
      toastError(toast, "Impossible de sauvegarder le modèle.");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteTemplate.mutateAsync(deleteId);
      toast({ title: "Modèle supprimé" });
    } catch {
      toastError(toast, "Impossible de supprimer le modèle.");
    }
    setDeleteId(null);
  };

  const saving = createTemplate.isPending || updateTemplate.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Modèles d'emails CRM
            </CardTitle>
            <CardDescription>
              Modèles pré-remplis pour envoyer des emails depuis une opportunité.
              Variables disponibles : {"{{"}company{"}}"},  {"{{"}first_name{"}}"},  {"{{"}title{"}}"}.
              Syntaxe conditionnelle : {"{{"}company? texte si présent{"}}"}. Fallback : {"{{"}title||valeur par défaut{"}}"}.
            </CardDescription>
          </div>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : !templates || templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucun modèle d'email CRM configuré. Cliquez sur "Ajouter" pour en créer un.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((template) => (
              <div key={template.id} className="flex items-start justify-between gap-3 p-3 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{template.template_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Objet : {template.subject}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {template.html_content.replace(/<[^>]*>/g, "").substring(0, 120)}...
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(template)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(template.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Modifier le modèle" : "Nouveau modèle d'email"}</DialogTitle>
            <DialogDescription>
              Utilisez {"{{"}company{"}}"}, {"{{"}first_name{"}}"}, {"{{"}title{"}}"}  pour insérer les données de l'opportunité.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom du modèle *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Relance devis" />
            </div>
            <div className="space-y-2">
              <Label>Objet de l'email *</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Suivi de votre demande{{company? – {{company}}}}" />
            </div>
            <div className="space-y-2">
              <Label>Corps de l'email *</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Bonjour{{first_name? {{first_name}}}},&#10;&#10;..."
                className="min-h-[200px] font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!name.trim() || !subject.trim() || !body.trim() || saving}>
              {saving ? <Spinner className="mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              {editingTemplate ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce modèle d'email ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le modèle ne sera plus disponible dans le CRM.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default CrmEmailTemplateManager;
