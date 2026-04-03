import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Tag, Plus, Pencil, Trash2, Save, X, FolderOpen, ChevronDown, ChevronRight } from "lucide-react";
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

interface CrmTag {
  id: string;
  name: string;
  color: string;
  category: string | null;
  created_at: string;
}

interface CategoryInfo {
  name: string;
  color: string;
  tags: CrmTag[];
}

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

export default function CrmTagManager() {
  const [tags, setTags] = useState<CrmTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Category dialog
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState("#3b82f6");

  // Tag dialog
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<CrmTag | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagCategory, setTagCategory] = useState("");

  // Delete dialogs
  const [deleteTagDialogOpen, setDeleteTagDialogOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<CrmTag | null>(null);
  const [deleteCategoryDialogOpen, setDeleteCategoryDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => { fetchTags(); }, []);

  const fetchTags = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_tags")
        .select("*")
        .order("category")
        .order("name");
      if (error) throw error;
      setTags(data || []);
    } catch {
      toast({ title: "Erreur", description: "Impossible de charger les tags.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Build categories from tags — color = first tag's color in that category
  const categories = useMemo(() => {
    const map = new Map<string, CategoryInfo>();
    for (const tag of tags) {
      const cat = tag.category || "Sans catégorie";
      if (!map.has(cat)) {
        map.set(cat, { name: cat, color: tag.color, tags: [] });
      }
      map.get(cat)!.tags.push(tag);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.name === "Sans catégorie") return 1;
      if (b.name === "Sans catégorie") return -1;
      return a.name.localeCompare(b.name, "fr");
    });
  }, [tags]);

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // ── Category actions ──────────────────────────────────────────

  const openCategoryDialog = (existingName?: string) => {
    if (existingName) {
      setEditingCategory(existingName);
      setCategoryName(existingName);
      const cat = categories.find((c) => c.name === existingName);
      setCategoryColor(cat?.color || "#3b82f6");
    } else {
      setEditingCategory(null);
      setCategoryName("");
      setCategoryColor("#3b82f6");
    }
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    const trimmed = categoryName.trim();
    if (!trimmed) {
      toast({ title: "Champ requis", description: "Le nom de la catégorie est obligatoire.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingCategory) {
        // Rename category + update color on all tags of this category
        const tagsInCat = tags.filter((t) => t.category === editingCategory);
        for (const tag of tagsInCat) {
          await supabase.from("crm_tags").update({ category: trimmed, color: categoryColor }).eq("id", tag.id);
        }
        toast({ title: "Catégorie modifiée" });
      } else {
        // Just close — category is created when first tag is added
        toast({ title: "Catégorie prête", description: "Ajoutez maintenant des tags dans cette catégorie." });
      }
      setCategoryDialogOpen(false);
      // Expand the new/renamed category
      setExpandedCategories((prev) => new Set([...prev, trimmed]));
      fetchTags();
    } catch {
      toast({ title: "Erreur", description: "Impossible de sauvegarder la catégorie.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      const tagsInCat = tags.filter((t) => t.category === categoryToDelete);
      for (const tag of tagsInCat) {
        await supabase.from("crm_tags").delete().eq("id", tag.id);
      }
      toast({ title: "Catégorie supprimée", description: `${tagsInCat.length} tag(s) supprimé(s).` });
      setDeleteCategoryDialogOpen(false);
      setCategoryToDelete(null);
      fetchTags();
    } catch {
      toast({ title: "Erreur", description: "Impossible de supprimer la catégorie.", variant: "destructive" });
    }
  };

  // ── Tag actions ────────────────────────────────────────────────

  const openTagDialog = (categoryForTag: string, tag?: CrmTag) => {
    if (tag) {
      setEditingTag(tag);
      setTagName(tag.name);
      setTagCategory(tag.category || categoryForTag);
    } else {
      setEditingTag(null);
      setTagName("");
      setTagCategory(categoryForTag);
    }
    setTagDialogOpen(true);
  };

  const handleSaveTag = async () => {
    if (!tagName.trim()) {
      toast({ title: "Champ requis", description: "Le nom du tag est obligatoire.", variant: "destructive" });
      return;
    }

    // Get color from the category
    const cat = categories.find((c) => c.name === tagCategory);
    const tagColor = cat?.color || categoryColor || "#3b82f6";

    setSaving(true);
    try {
      if (editingTag) {
        await supabase.from("crm_tags").update({
          name: tagName.trim(),
          category: tagCategory || null,
          color: tagColor,
        }).eq("id", editingTag.id);
        toast({ title: "Tag modifié" });
      } else {
        await supabase.from("crm_tags").insert({
          name: tagName.trim(),
          category: tagCategory || null,
          color: tagColor,
        });
        toast({ title: "Tag créé" });
      }
      setTagDialogOpen(false);
      fetchTags();
    } catch {
      toast({ title: "Erreur", description: "Impossible de sauvegarder le tag.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTag = async () => {
    if (!tagToDelete) return;
    try {
      await supabase.from("crm_tags").delete().eq("id", tagToDelete.id);
      toast({ title: "Tag supprimé" });
      setDeleteTagDialogOpen(false);
      setTagToDelete(null);
      fetchTags();
    } catch {
      toast({ title: "Erreur", description: "Impossible de supprimer le tag.", variant: "destructive" });
    }
  };

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
                Organisez vos tags par catégorie. La couleur s'applique à toute la catégorie.
              </CardDescription>
            </div>
            <Button onClick={() => openCategoryDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle catégorie
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune catégorie configurée.</p>
              <p className="text-sm mt-2">Créez une catégorie puis ajoutez des tags à l'intérieur.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => {
                const isExpanded = expandedCategories.has(cat.name);
                return (
                  <div key={cat.name} className="border rounded-lg overflow-hidden">
                    {/* Category header */}
                    <div
                      className="flex items-center gap-3 px-4 py-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => toggleCategory(cat.name)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-medium text-sm flex-1">{cat.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {cat.tags.length} tag{cat.tags.length > 1 ? "s" : ""}
                      </span>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCategoryDialog(cat.name)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {cat.name !== "Sans catégorie" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => { setCategoryToDelete(cat.name); setDeleteCategoryDialogOpen(true); }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Tags inside category */}
                    {isExpanded && (
                      <div className="px-4 py-3 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {cat.tags.map((tag) => (
                            <div
                              key={tag.id}
                              className="group flex items-center gap-1 border rounded-full pr-1"
                              style={{ borderColor: cat.color + "40" }}
                            >
                              <Badge
                                style={{ backgroundColor: cat.color + "20", color: cat.color }}
                                className="rounded-full"
                              >
                                {tag.name}
                              </Badge>
                              <div className="hidden group-hover:flex items-center">
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => openTagDialog(cat.name, tag)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => { setTagToDelete(tag); setDeleteTagDialogOpen(true); }}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => openTagDialog(cat.name)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Ajouter un tag
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Modifiez le nom ou la couleur. La couleur s'applique à tous les tags de cette catégorie."
                : "Créez une catégorie puis ajoutez des tags à l'intérieur."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="catName">Nom de la catégorie *</Label>
              <Input
                id="catName"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Ex: Priorité, Secteur, Source..."
              />
            </div>
            <div className="space-y-2">
              <Label>Couleur</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      categoryColor === c.value ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setCategoryColor(c.value)}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Aperçu</Label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: categoryColor }} />
                <span className="font-medium text-sm">{categoryName || "Nom de la catégorie"}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={handleSaveCategory} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {editingCategory ? "Modifier" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tag Dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTag ? "Modifier le tag" : "Ajouter un tag"}</DialogTitle>
            <DialogDescription>
              Tag dans la catégorie « {tagCategory} ».
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tagName">Nom du tag *</Label>
              <Input
                id="tagName"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="Ex: PME, Urgent, LinkedIn..."
              />
            </div>
            <div className="space-y-2">
              <Label>Aperçu</Label>
              <div className="p-3 bg-muted rounded-lg">
                {(() => {
                  const cat = categories.find((c) => c.name === tagCategory);
                  const color = cat?.color || categoryColor || "#3b82f6";
                  return (
                    <Badge style={{ backgroundColor: color + "20", color }} className="text-sm">
                      {tagName || "Nom du tag"}
                    </Badge>
                  );
                })()}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={handleSaveTag} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {editingTag ? "Modifier" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Tag */}
      <AlertDialog open={deleteTagDialogOpen} onOpenChange={setDeleteTagDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le tag ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le tag « {tagToDelete?.name} » sera retiré de toutes les cartes CRM.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTag} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Category */}
      <AlertDialog open={deleteCategoryDialogOpen} onOpenChange={setDeleteCategoryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la catégorie ?</AlertDialogTitle>
            <AlertDialogDescription>
              La catégorie « {categoryToDelete} » et tous ses tags seront supprimés.
              Les tags seront retirés de toutes les cartes CRM.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCategory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
