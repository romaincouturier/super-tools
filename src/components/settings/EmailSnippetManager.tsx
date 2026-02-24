import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Pencil, Trash2, Save, X, TextQuote } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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

interface EmailSnippet {
  id: string;
  name: string;
  content: string;
  category: string | null;
  position: number | null;
}

const EmailSnippetManager = () => {
  const [snippets, setSnippets] = useState<EmailSnippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<EmailSnippet | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const loadSnippets = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("email_snippets")
      .select("*")
      .order("category")
      .order("position");

    if (error) {
      console.error("Error loading snippets:", error);
      toast({ title: "Erreur", description: "Impossible de charger les blocs de texte", variant: "destructive" });
    } else {
      setSnippets(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSnippets();
  }, []);

  const openCreate = () => {
    setEditingSnippet(null);
    setName("");
    setContent("");
    setCategory("");
    setDialogOpen(true);
  };

  const openEdit = (snippet: EmailSnippet) => {
    setEditingSnippet(snippet);
    setName(snippet.name);
    setContent(snippet.content);
    setCategory(snippet.category || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) return;
    setSaving(true);

    const payload = {
      name: name.trim(),
      content: content.trim(),
      category: category.trim() || null,
    };

    if (editingSnippet) {
      const { error } = await (supabase as any)
        .from("email_snippets")
        .update(payload)
        .eq("id", editingSnippet.id);

      if (error) {
        toast({ title: "Erreur", description: "Impossible de modifier le bloc", variant: "destructive" });
      } else {
        toast({ title: "Bloc modifié", description: `"${name}" a été mis à jour.` });
      }
    } else {
      const maxPosition = snippets.length > 0 ? Math.max(...snippets.map(s => s.position || 0)) : 0;
      const { error } = await (supabase as any)
        .from("email_snippets")
        .insert({ ...payload, position: maxPosition + 1 });

      if (error) {
        toast({ title: "Erreur", description: "Impossible de créer le bloc", variant: "destructive" });
      } else {
        toast({ title: "Bloc créé", description: `"${name}" a été ajouté.` });
      }
    }

    setSaving(false);
    setDialogOpen(false);
    loadSnippets();
    queryClient.invalidateQueries({ queryKey: ["email-snippets"] });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await (supabase as any)
      .from("email_snippets")
      .delete()
      .eq("id", deleteId);

    if (error) {
      toast({ title: "Erreur", description: "Impossible de supprimer le bloc", variant: "destructive" });
    } else {
      toast({ title: "Bloc supprimé" });
    }
    setDeleteId(null);
    loadSnippets();
    queryClient.invalidateQueries({ queryKey: ["email-snippets"] });
  };

  // Group by category
  const snippetsByCategory = snippets.reduce((acc, snippet) => {
    const cat = snippet.category || "Général";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(snippet);
    return acc;
  }, {} as Record<string, EmailSnippet[]>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <TextQuote className="h-4 w-4" />
              Blocs de texte (emails CRM)
            </CardTitle>
            <CardDescription>
              Blocs de texte réutilisables à insérer dans les emails envoyés depuis une opportunité.
            </CardDescription>
          </div>
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : snippets.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucun bloc de texte configuré. Cliquez sur "Ajouter" pour en créer un.
          </p>
        ) : (
          <div className="space-y-4">
            {Object.entries(snippetsByCategory).map(([cat, catSnippets]) => (
              <div key={cat}>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{cat}</h4>
                <div className="space-y-2">
                  {catSnippets.map((snippet) => (
                    <div key={snippet.id} className="flex items-start justify-between gap-3 p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{snippet.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {snippet.content.substring(0, 150)}{snippet.content.length > 150 ? "..." : ""}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(snippet)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(snippet.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSnippet ? "Modifier le bloc" : "Nouveau bloc de texte"}</DialogTitle>
            <DialogDescription>
              Ce bloc sera disponible dans le bouton "Insérer" de l'éditeur d'email CRM.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Signature formation" />
            </div>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Relance, Suivi, Général" />
            </div>
            <div className="space-y-2">
              <Label>Contenu *</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Tapez le contenu du bloc de texte..."
                className="min-h-[150px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!name.trim() || !content.trim() || saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {editingSnippet ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce bloc de texte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le bloc ne sera plus disponible dans l'éditeur d'email.
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

export default EmailSnippetManager;
