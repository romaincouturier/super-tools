import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, ArrowLeft, BookOpen, Search, X, Pencil, Trash2, ExternalLink, ShoppingCart } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import CatalogFormDialog from "@/components/catalogue/CatalogFormDialog";
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

interface CatalogEntry {
  id: string;
  formation_name: string;
  prix: number;
  duree_heures: number;
  programme_url: string | null;
  objectives: string[] | null;
  prerequisites: string[] | null;
  supports_url: string | null;
  elearning_duration: number | null;
  elearning_access_email_content: string | null;
  supertilt_link: string | null;
  woocommerce_product_id: number | null;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  training_count?: number;
}

const Catalogue = () => {
  const [catalogEntries, setCatalogEntries] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CatalogEntry | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  useAuth();

  const fetchCatalog = async () => {
    setLoading(true);
    try {
      const { data: entries, error } = await supabase
        .from("formation_configs")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;

      // Count trainings per catalog entry
      const { data: trainings } = await supabase
        .from("trainings")
        .select("catalog_id");

      const countMap: Record<string, number> = {};
      trainings?.forEach((t) => {
        if (t.catalog_id) {
          countMap[t.catalog_id] = (countMap[t.catalog_id] || 0) + 1;
        }
      });

      setCatalogEntries(
        (entries || []).map((e) => ({
          ...e,
          training_count: countMap[e.id] || 0,
        }))
      );
    } catch (error: unknown) {
      console.error("Error fetching catalog:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger le catalogue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, []);

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return catalogEntries;
    const q = searchQuery.toLowerCase();
    return catalogEntries.filter(
      (e) =>
        e.formation_name.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q)
    );
  }, [catalogEntries, searchQuery]);

  const handleCreate = () => {
    setEditingEntry(null);
    setDialogOpen(true);
  };

  const handleEdit = (entry: CatalogEntry) => {
    setEditingEntry(entry);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from("formation_configs")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({ title: "Supprimé", description: "Entrée du catalogue supprimée." });
      fetchCatalog();
    } catch (error: unknown) {
      console.error("Error deleting catalog entry:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de supprimer cette entrée.",
        variant: "destructive",
      });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleDialogClose = (saved: boolean) => {
    setDialogOpen(false);
    setEditingEntry(null);
    if (saved) fetchCatalog();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Catalogue de formations</h1>
                <p className="text-sm text-muted-foreground">
                  {catalogEntries.length} formation{catalogEntries.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {!isMobile && "Nouvelle formation"}
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher une formation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredEntries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery
                  ? "Aucune formation ne correspond à votre recherche."
                  : "Aucune formation dans le catalogue. Cliquez sur \"Nouvelle formation\" pour commencer."}
              </div>
            ) : isMobile ? (
              /* Mobile: Card layout */
              <div className="space-y-3">
                {filteredEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="border rounded-lg p-4 space-y-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleEdit(entry)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{entry.formation_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {entry.duree_heures}h &middot; {entry.prix}€
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {!entry.is_active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                        {entry.woocommerce_product_id && (
                          <Badge variant="outline" className="gap-1">
                            <ShoppingCart className="h-3 w-3" />
                            WC
                          </Badge>
                        )}
                      </div>
                    </div>
                    {entry.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {entry.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{entry.training_count} session{(entry.training_count || 0) > 1 ? "s" : ""}</span>
                      {entry.objectives && entry.objectives.length > 0 && (
                        <span>&middot; {entry.objectives.length} objectif{entry.objectives.length > 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Desktop: Table layout */
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Formation</TableHead>
                    <TableHead className="w-[80px]">Durée</TableHead>
                    <TableHead className="w-[100px]">Prix HT</TableHead>
                    <TableHead className="w-[80px]">Sessions</TableHead>
                    <TableHead className="w-[120px]">WooCommerce</TableHead>
                    <TableHead className="w-[80px]">Statut</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow
                      key={entry.id}
                      className="cursor-pointer"
                      onClick={() => handleEdit(entry)}
                    >
                      <TableCell>
                        <div>
                          <span className="font-medium">{entry.formation_name}</span>
                          {entry.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {entry.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{entry.duree_heures}h</TableCell>
                      <TableCell>{entry.prix}€</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{entry.training_count}</Badge>
                      </TableCell>
                      <TableCell>
                        {entry.woocommerce_product_id ? (
                          <Badge variant="outline" className="gap-1">
                            <ShoppingCart className="h-3 w-3" />
                            ID: {entry.woocommerce_product_id}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.is_active ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(entry);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(entry.id);
                            }}
                            disabled={(entry.training_count || 0) > 0}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Create/Edit dialog */}
      <CatalogFormDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        entry={editingEntry}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette formation du catalogue ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La formation sera retirée du catalogue.
              Les sessions existantes ne seront pas affectées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Catalogue;
