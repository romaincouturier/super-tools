import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Tag, Plus, Pencil, Trash2, Save, X } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CrmTag {
  id: string;
  name: string;
  color: string;
  category: string | null;
  created_at: string;
}

// Predefined color palette
const COLOR_PALETTE = [
  { name: "Rouge", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Jaune", value: "#eab308" },
  { name: "Vert", value: "#22c55e" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Bleu", value: "#3b82f6" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Rose", value: "#ec4899" },
  { name: "Gris", value: "#6b7280" },
];

// Default suggested categories
const DEFAULT_CATEGORIES = [
  "Secteur",
  "Priorité",
  "Source",
  "Type de client",
  "Budget",
  "Autre",
];

export default function CrmTagManager() {
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<CrmTag | null>(null);
  const [editingTag, setEditingTag] = useState<CrmTag | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [category, setCategory] = useState<string>("");
  const [customCategory, setCustomCategory] = useState("");
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    fetchTags();
  }, []);

  const fetchTags = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_tags")
        .select("*")
        .order("category")
        .order("name");

      if (error) throw error;
      setTags(data || []);
    } catch (error) {
      console.error("Error fetching tags:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les tags CRM.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Compute all categories: defaults + any custom ones from existing tags
  const allCategories = Array.from(
    new Set([
      ...DEFAULT_CATEGORIES,
      ...tags.map((t) => t.category).filter(Boolean) as string[],
    ])
  ).sort();

  const resetForm = () => {
    setName("");
    setColor("#3b82f6");
    setCategory("");
    setCustomCategory("");
    setEditingTag(null);
  };

  const openDialog = (tag?: CrmTag) => {
    if (tag) {
      setEditingTag(tag);
      setName(tag.name);
      setColor(tag.color);
      setCategory(tag.category || "");
      setCustomCategory("");
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSelectCategory = (cat: string) => {
    setCategory(cat);
    setCustomCategory("");
    setCategoryPopoverOpen(false);
  };

  const handleAddCustomCategory = () => {
    const trimmed = customCategory.trim();
    if (!trimmed) return;
    setCategory(trimmed);
    setCustomCategory("");
    setCategoryPopoverOpen(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Champ requis",
        description: "Le nom du tag est obligatoire.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (editingTag) {
        const { error } = await supabase
          .from("crm_tags")
          .update({
            name: name.trim(),
            color: color,
            category: category || null,
          })
          .eq("id", editingTag.id);

        if (error) throw error;
        toast({
          title: "Tag modifié",
          description: "Le tag a été mis à jour.",
        });
      } else {
        const { error } = await supabase.from("crm_tags").insert({
          name: name.trim(),
          color: color,
          category: category || null,
        });

        if (error) throw error;
        toast({
          title: "Tag créé",
          description: "Le tag a été ajouté avec succès.",
        });
      }

      setDialogOpen(false);
      resetForm();
      fetchTags();
    } catch (error) {
      console.error("Error saving tag:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le tag.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!tagToDelete) return;

    try {
      const { error } = await supabase
        .from("crm_tags")
        .delete()
        .eq("id", tagToDelete.id);

      if (error) throw error;

      toast({
        title: "Tag supprimé",
        description: "Le tag a été supprimé.",
      });

      setDeleteDialogOpen(false);
      setTagToDelete(null);
      fetchTags();
    } catch (error) {
      console.error("Error deleting tag:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le tag. Il est peut-être utilisé par des cartes CRM.",
        variant: "destructive",
      });
    }
  };

  // Group tags by category
  const tagsByCategory = tags.reduce((acc, tag) => {
    const cat = tag.category || "Sans catégorie";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(tag);
    return acc;
  }, {} as Record<string, CrmTag[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                Tags CRM
              </CardTitle>
              <CardDescription className="mt-1">
                Gérez les tags disponibles pour catégoriser vos opportunités commerciales.
                Les catégories vous permettent de regrouper les tags par thème.
              </CardDescription>
            </div>
            <Button onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un tag
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun tag configuré.</p>
              <p className="text-sm mt-2">
                Ajoutez des tags pour organiser vos opportunités CRM.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(tagsByCategory).map(([categoryName, categoryTags]) => (
                <div key={categoryName}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                    {categoryName}
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {categoryTags.length}
                    </span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {categoryTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="group flex items-center gap-1 border rounded-full pr-1"
                        style={{ borderColor: tag.color + "40" }}
                      >
                        <Badge
                          style={{ backgroundColor: tag.color + "20", color: tag.color }}
                          className="rounded-full"
                        >
                          {tag.name}
                        </Badge>
                        <div className="hidden group-hover:flex items-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => openDialog(tag)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => {
                              setTagToDelete(tag);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
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
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTag ? "Modifier le tag" : "Ajouter un tag"}
            </DialogTitle>
            <DialogDescription>
              Définissez le nom, la couleur et la catégorie du tag.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Tag name */}
            <div className="space-y-2">
              <Label htmlFor="tagName">Nom du tag *</Label>
              <Input
                id="tagName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: PME, Urgent, LinkedIn..."
              />
            </div>

            {/* Category - with custom input */}
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start font-normal"
                  >
                    {category || "Choisir ou créer une catégorie"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-2 space-y-2" align="start">
                  <p className="text-xs text-muted-foreground px-2 pb-1">Catégories existantes</p>
                  <div className="flex flex-wrap gap-1">
                    {allCategories.map((cat) => (
                      <Badge
                        key={cat}
                        variant={category === cat ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => handleSelectCategory(cat)}
                      >
                        {cat}
                      </Badge>
                    ))}
                  </div>
                  <div className="border-t pt-2">
                    <p className="text-xs text-muted-foreground px-2 pb-1">Créer une nouvelle catégorie</p>
                    <div className="flex gap-1">
                      <Input
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="Nom de la catégorie..."
                        className="h-8 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomCategory();
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 shrink-0"
                        disabled={!customCategory.trim()}
                        onClick={handleAddCustomCategory}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {category && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted-foreground"
                      onClick={() => {
                        setCategory("");
                        setCategoryPopoverOpen(false);
                      }}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Retirer la catégorie
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
              {category && (
                <p className="text-xs text-muted-foreground">
                  Catégorie sélectionnée : <strong>{category}</strong>
                </p>
              )}
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <Label>Couleur</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      color === c.value
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setColor(c.value)}
                    title={c.name}
                  />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Aperçu</Label>
              <div className="p-4 bg-muted rounded-lg">
                <Badge
                  style={{ backgroundColor: color + "20", color: color }}
                  className="text-sm"
                >
                  {name || "Nom du tag"}
                </Badge>
                {category && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    dans « {category} »
                  </span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {editingTag ? "Modifier" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le tag ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le tag "{tagToDelete?.name}" ?
              Cette action est irréversible et le tag sera retiré de toutes les
              cartes CRM auxquelles il est associé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
