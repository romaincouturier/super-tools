import { useState } from "react";
import {
  Loader2,
  Filter,
  Plus,
  LayoutList,
  Columns3,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useImprovements } from "@/hooks/useImprovements";
import type { Improvement, ImprovementFormData, ImprovementStatus } from "@/hooks/useImprovements";
import ImprovementCard from "@/components/ameliorations/ImprovementCard";
import ImprovementFormDialog from "@/components/ameliorations/ImprovementFormDialog";
import ImprovementDetailDrawer from "@/components/ameliorations/ImprovementDetailDrawer";
import ImprovementKanban from "@/components/ameliorations/ImprovementKanban";
import { useAuth } from "@/hooks/useAuth";

const Ameliorations = () => {
  const { user, loading: authLoading } = useAuth();

  // View mode: list or kanban (persisted in localStorage)
  const [viewMode, setViewMode] = useState<"list" | "kanban">(() => {
    return (localStorage.getItem("ameliorations-view") as "list" | "kanban") || "kanban";
  });

  // Form dialog
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingImprovement, setEditingImprovement] = useState<Improvement | null>(null);

  // Detail drawer
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedImprovement, setSelectedImprovement] = useState<Improvement | null>(null);

  // Stats collapsible (collapsed on mobile)
  const [statsOpen, setStatsOpen] = useState(() => window.innerWidth >= 768);

  const {
    trainings,
    improvements,
    grouped,
    stats,
    loading,
    filterTraining,
    setFilterTraining,
    filterStatus,
    setFilterStatus,
    changeStatus,
    deleteImprovement,
    saveImprovement,
    fetchNotes,
    addNote,
  } = useImprovements();

  const toggleView = (mode: "list" | "kanban") => {
    setViewMode(mode);
    localStorage.setItem("ameliorations-view", mode);
  };

  const handleEdit = (improvement: Improvement) => {
    setEditingImprovement(improvement);
    setFormDialogOpen(true);
  };

  const handleClick = (improvement: Improvement) => {
    setSelectedImprovement(improvement);
    setDetailDrawerOpen(true);
  };

  const handleSave = async (data: ImprovementFormData, existingId?: string) => {
    await saveImprovement(data, user?.id, existingId);
    setEditingImprovement(null);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ModuleLayout>
      <main className="max-w-6xl mx-auto p-6">
        <PageHeader
          icon={Lightbulb}
          title="Améliorations"
          actions={
            <>
              <div className="flex border rounded-lg">
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-r-none"
                  onClick={() => toggleView("list")}
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "kanban" ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-l-none"
                  onClick={() => toggleView("kanban")}
                >
                  <Columns3 className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={() => { setEditingImprovement(null); setFormDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </Button>
            </>
          }
        />

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterTraining} onValueChange={setFilterTraining}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Filtrer par formation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les formations</SelectItem>
                {trainings.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.training_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="draft">Brouillons</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="in_progress">En cours</SelectItem>
              <SelectItem value="completed">Terminées</SelectItem>
              <SelectItem value="cancelled">Annulées</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Brouillons</CardTitle>
              <div className="text-2xl font-bold">{stats.draft}</div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">En attente</CardTitle>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">En cours</CardTitle>
              <div className="text-2xl font-bold">{stats.in_progress}</div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Terminées</CardTitle>
              <div className="text-2xl font-bold">{stats.completed}</div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardHeader>
          </Card>
        </div>

        {/* Content */}
        {viewMode === "kanban" ? (
          <ImprovementKanban
            grouped={grouped}
            onStatusChange={changeStatus}
            onEdit={handleEdit}
            onDelete={deleteImprovement}
            onClick={handleClick}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Liste des améliorations</CardTitle>
            </CardHeader>
            <CardContent>
              {improvements.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">Aucune amélioration enregistrée.</p>
                  <Button onClick={() => setFormDialogOpen(true)} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter une amélioration
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {improvements.map((imp) => (
                    <ImprovementCard
                      key={imp.id}
                      improvement={imp}
                      onStatusChange={changeStatus}
                      onEdit={handleEdit}
                      onDelete={deleteImprovement}
                      onClick={handleClick}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Form dialog (create + edit) */}
      <ImprovementFormDialog
        open={formDialogOpen}
        onOpenChange={(open) => {
          setFormDialogOpen(open);
          if (!open) setEditingImprovement(null);
        }}
        trainings={trainings}
        improvement={editingImprovement}
        onSave={handleSave}
      />

      {/* Detail drawer with notes */}
      <ImprovementDetailDrawer
        open={detailDrawerOpen}
        onOpenChange={setDetailDrawerOpen}
        improvement={selectedImprovement}
        onStatusChange={changeStatus}
        onEdit={handleEdit}
        fetchNotes={fetchNotes}
        addNote={addNote}
        userId={user?.id}
      />
    </ModuleLayout>
  );
};

export default Ameliorations;
