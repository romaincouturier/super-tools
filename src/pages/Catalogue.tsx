import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, ArrowLeft, BookOpen, Search, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  format_formation: string | null;
  created_at: string;
  updated_at: string;
  training_count: number;
  formula_names: string[];
  last_session_date: string | null;
}

type SortColumn = "formation_name" | "duree_heures" | "prix" | "training_count" | "formula_names" | "last_session_date";
type SortDirection = "asc" | "desc";

const Catalogue = () => {
  const [catalogEntries, setCatalogEntries] = useState<CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CatalogEntry | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("formation_name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
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

      // Fetch trainings (count + last session date per catalog entry)
      const { data: trainings } = await supabase
        .from("trainings")
        .select("catalog_id, start_date");

      const countMap: Record<string, number> = {};
      const lastDateMap: Record<string, string> = {};
      trainings?.forEach((t: any) => {
        if (t.catalog_id) {
          countMap[t.catalog_id] = (countMap[t.catalog_id] || 0) + 1;
          if (!lastDateMap[t.catalog_id] || t.start_date > lastDateMap[t.catalog_id]) {
            lastDateMap[t.catalog_id] = t.start_date;
          }
        }
      });

      // Fetch formulas per catalog entry
      const { data: formulas } = await supabase
        .from("formation_formulas")
        .select("formation_config_id, name")
        .order("display_order", { ascending: true });

      const formulaMap: Record<string, string[]> = {};
      formulas?.forEach((f: any) => {
        if (f.formation_config_id) {
          if (!formulaMap[f.formation_config_id]) formulaMap[f.formation_config_id] = [];
          formulaMap[f.formation_config_id].push(f.name);
        }
      });

      setCatalogEntries(
        (entries || []).map((e: any) => ({
          ...e,
          training_count: countMap[e.id] || 0,
          formula_names: formulaMap[e.id] || [],
          last_session_date: lastDateMap[e.id] || null,
        }))
      );
    } catch (error: any) {
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

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const sortedAndFilteredEntries = useMemo(() => {
    let result = catalogEntries;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.formation_name.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.formula_names.some((f) => f.toLowerCase().includes(q))
      );
    }

    return [...result].sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      switch (sortColumn) {
        case "formation_name":
          return dir * a.formation_name.localeCompare(b.formation_name, "fr");
        case "duree_heures":
          return dir * ((a.duree_heures || 0) - (b.duree_heures || 0));
        case "prix":
          return dir * ((a.prix || 0) - (b.prix || 0));
        case "training_count":
          return dir * (a.training_count - b.training_count);
        case "formula_names":
          return dir * (a.formula_names.join(", ")).localeCompare(b.formula_names.join(", "), "fr");
        case "last_session_date":
          if (!a.last_session_date && !b.last_session_date) return 0;
          if (!a.last_session_date) return dir;
          if (!b.last_session_date) return -dir;
          return dir * a.last_session_date.localeCompare(b.last_session_date);
        default:
          return 0;
      }
    });
  }, [catalogEntries, searchQuery, sortColumn, sortDirection]);

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
      setDialogOpen(false);
      setEditingEntry(null);
      fetchCatalog();
    } catch (error: any) {
      console.error("Error deleting catalog entry:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer cette entrée.",
        variant: "destructive",
      });
    }
  };

  const handleDialogClose = (saved: boolean) => {
    setDialogOpen(false);
    setEditingEntry(null);
    if (saved) fetchCatalog();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
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
            {sortedAndFilteredEntries.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery
                  ? "Aucune formation ne correspond à votre recherche."
                  : "Aucune formation dans le catalogue. Cliquez sur \"Nouvelle formation\" pour commencer."}
              </div>
            ) : isMobile ? (
              /* Mobile: Card layout */
              <div className="space-y-3">
                {sortedAndFilteredEntries.map((entry) => (
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
                      {!entry.is_active && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                    {entry.formula_names.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {entry.formula_names.map((name) => (
                          <Badge key={name} variant="outline" className="text-xs">{name}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{entry.training_count} session{entry.training_count > 1 ? "s" : ""}</span>
                      <span>&middot;</span>
                      <span>
                        {entry.last_session_date
                          ? `Dernière : ${formatDate(entry.last_session_date)}`
                          : "Aucune session"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Desktop: Table layout */
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer select-none"
                      onClick={() => handleSort("formation_name")}
                    >
                      <div className="flex items-center">
                        Formation
                        <SortIcon column="formation_name" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-[80px] cursor-pointer select-none"
                      onClick={() => handleSort("duree_heures")}
                    >
                      <div className="flex items-center">
                        Durée
                        <SortIcon column="duree_heures" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-[100px] cursor-pointer select-none"
                      onClick={() => handleSort("prix")}
                    >
                      <div className="flex items-center">
                        Prix HT
                        <SortIcon column="prix" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-[80px] cursor-pointer select-none"
                      onClick={() => handleSort("training_count")}
                    >
                      <div className="flex items-center">
                        Sessions
                        <SortIcon column="training_count" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-[160px] cursor-pointer select-none"
                      onClick={() => handleSort("formula_names")}
                    >
                      <div className="flex items-center">
                        Formules
                        <SortIcon column="formula_names" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="w-[140px] cursor-pointer select-none"
                      onClick={() => handleSort("last_session_date")}
                    >
                      <div className="flex items-center">
                        Dernière session
                        <SortIcon column="last_session_date" />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedAndFilteredEntries.map((entry) => (
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
                        {entry.formula_names.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {entry.formula_names.map((name) => (
                              <Badge key={name} variant="outline" className="text-xs">
                                {name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.last_session_date ? (
                          <span className="text-sm">{formatDate(entry.last_session_date)}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Aucune</span>
                        )}
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
        onDelete={handleDelete}
        trainingCount={editingEntry?.training_count ?? 0}
      />
    </div>
  );
};

export default Catalogue;
