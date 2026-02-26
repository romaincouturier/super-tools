import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import {
  Loader2,
  ArrowLeft,
  CheckCircle2,
  Clock,
  PlayCircle,
  XCircle,
  Filter,
  MoreVertical,
  Plus,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Training {
  id: string;
  training_name: string;
}

interface Improvement {
  id: string;
  training_id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  source_type: string | null;
  source_description: string | null;
  priority: string | null;
  deadline: string | null;
  responsible: string | null;
  trainings?: {
    training_name: string;
  } | null;
}

const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: {
    label: "En attente",
    icon: <Clock className="h-4 w-4" />,
    color: "bg-yellow-100 text-yellow-800",
  },
  in_progress: {
    label: "En cours",
    icon: <PlayCircle className="h-4 w-4" />,
    color: "bg-blue-100 text-blue-800",
  },
  completed: {
    label: "Terminée",
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: "bg-green-100 text-green-800",
  },
  cancelled: {
    label: "Annulée",
    icon: <XCircle className="h-4 w-4" />,
    color: "bg-gray-100 text-gray-800",
  },
};

const Ameliorations = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [improvements, setImprovements] = useState<Improvement[]>([]);
  const [selectedTraining, setSelectedTraining] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newImprovement, setNewImprovement] = useState({
    training_id: "",
    title: "",
    description: "",
    category: "recommendation",
    source_type: "",
    source_description: "",
    priority: "",
    deadline: "",
    responsible: "",
  });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/auth");
      } else {
        setUser(session.user);
        fetchData();
      }
      setLoading(false);
    });
  }, [navigate]);

  const fetchData = async () => {
    // Fetch trainings
    const { data: trainingsData } = await supabase
      .from("trainings")
      .select("id, training_name")
      .order("start_date", { ascending: false });

    if (trainingsData) {
      setTrainings(trainingsData);
    }

    fetchImprovements();
  };

  const fetchImprovements = async (trainingId?: string, status?: string) => {
    let query = supabase
      .from("improvements")
      .select(`
        *,
        trainings(training_name)
      `)
      .order("created_at", { ascending: false });

    if (trainingId && trainingId !== "all") {
      query = query.eq("training_id", trainingId);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (data) {
      setImprovements(data as unknown as Improvement[]);
    }
    if (error) {
      console.error("Error fetching improvements:", error);
    }
  };

  const handleFilterChange = (trainingId: string, status: string) => {
    setSelectedTraining(trainingId);
    setSelectedStatus(status);
    fetchImprovements(trainingId, status);
  };

  const handleStatusChange = async (improvementId: string, newStatus: string) => {
    try {
      const updateData: Record<string, unknown> = { status: newStatus };
      if (newStatus === "completed") {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("improvements")
        .update(updateData)
        .eq("id", improvementId);

      if (error) throw error;

      toast({
        title: "Statut mis à jour",
        description: `L'amélioration a été marquée comme "${statusConfig[newStatus].label}"`,
      });

      fetchImprovements(selectedTraining, selectedStatus);
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (improvementId: string) => {
    try {
      const { error } = await supabase
        .from("improvements")
        .delete()
        .eq("id", improvementId);

      if (error) throw error;

      toast({
        title: "Amélioration supprimée",
      });

      fetchImprovements(selectedTraining, selectedStatus);
    } catch (error: any) {
      console.error("Error deleting improvement:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'amélioration",
        variant: "destructive",
      });
    }
  };

  const handleAddImprovement = async () => {
    if (!newImprovement.training_id) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une formation",
        variant: "destructive",
      });
      return;
    }

    if (!newImprovement.title.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un titre",
        variant: "destructive",
      });
      return;
    }

    if (!newImprovement.description.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir une description",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("improvements").insert({
        training_id: newImprovement.training_id,
        title: newImprovement.title.trim(),
        description: newImprovement.description.trim(),
        category: newImprovement.category,
        status: "pending",
        created_by: user?.id,
        source_type: newImprovement.source_type || null,
        source_description: newImprovement.source_description.trim() || null,
        priority: newImprovement.priority || null,
        deadline: newImprovement.deadline || null,
        responsible: newImprovement.responsible.trim() || null,
      } as any);

      if (error) throw error;

      toast({
        title: "Amélioration ajoutée",
        description: "L'amélioration a été créée avec succès",
      });

      setShowAddDialog(false);
      setNewImprovement({
        training_id: "",
        title: "",
        description: "",
        category: "recommendation",
        source_type: "",
        source_description: "",
        priority: "",
        deadline: "",
        responsible: "",
      });
      fetchImprovements(selectedTraining, selectedStatus);
    } catch (error: any) {
      console.error("Error adding improvement:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter l'amélioration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getCategoryBadge = (category: string) => {
    const config: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> =
      {
        weakness: { label: "Point faible", variant: "secondary" },
        recommendation: { label: "Recommandation", variant: "default" },
        strength: { label: "Point fort", variant: "outline" },
        manual: { label: "Manuel", variant: "outline" },
      };
    const cat = config[category] || { label: category, variant: "outline" };
    return <Badge variant={cat.variant}>{cat.label}</Badge>;
  };

  // Group improvements by status
  const groupedImprovements = {
    pending: improvements.filter((i) => i.status === "pending"),
    in_progress: improvements.filter((i) => i.status === "in_progress"),
    completed: improvements.filter((i) => i.status === "completed"),
    cancelled: improvements.filter((i) => i.status === "cancelled"),
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Main content */}
      <main className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Améliorations</h1>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter une amélioration
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={selectedTraining}
              onValueChange={(v) => handleFilterChange(v, selectedStatus)}
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Filtrer par formation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les formations</SelectItem>
                {trainings.map((training) => (
                  <SelectItem key={training.id} value={training.id}>
                    {training.training_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Select
            value={selectedStatus}
            onValueChange={(v) => handleFilterChange(selectedTraining, v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrer par statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="in_progress">En cours</SelectItem>
              <SelectItem value="completed">Terminées</SelectItem>
              <SelectItem value="cancelled">Annulées</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                En attente
              </CardTitle>
              <div className="text-2xl font-bold">{groupedImprovements.pending.length}</div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">En cours</CardTitle>
              <div className="text-2xl font-bold">{groupedImprovements.in_progress.length}</div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Terminées
              </CardTitle>
              <div className="text-2xl font-bold">{groupedImprovements.completed.length}</div>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
              <div className="text-2xl font-bold">{improvements.length}</div>
            </CardHeader>
          </Card>
        </div>

        {/* Improvements List */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des améliorations</CardTitle>
          </CardHeader>
          <CardContent>
            {improvements.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Aucune amélioration enregistrée.
                </p>
                <Button onClick={() => setShowAddDialog(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter une amélioration
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {improvements.map((improvement) => (
                  <div
                    key={improvement.id}
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{improvement.title}</span>
                          {getCategoryBadge(improvement.category)}
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[improvement.status]?.color}`}
                          >
                            {statusConfig[improvement.status]?.icon}
                            {statusConfig[improvement.status]?.label}
                          </span>
                          {(improvement as any).priority && (
                            <Badge variant={(improvement as any).priority === "haute" ? "destructive" : "outline"} className="text-xs">
                              {(improvement as any).priority}
                            </Badge>
                          )}
                          {(improvement as any).source_type && (
                            <Badge variant="secondary" className="text-xs">
                              Source : {(improvement as any).source_type}
                            </Badge>
                          )}
                        </div>
                        {improvement.trainings && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {improvement.trainings.training_name}
                          </div>
                        )}
                        <p className="text-sm mt-2">{improvement.description}</p>
                        {(improvement as any).source_description && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Source : {(improvement as any).source_description}
                          </p>
                        )}
                        {((improvement as any).responsible || (improvement as any).deadline) && (
                          <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                            {(improvement as any).responsible && <span>Responsable : {(improvement as any).responsible}</span>}
                            {(improvement as any).deadline && <span>Échéance : {new Date((improvement as any).deadline).toLocaleDateString("fr-FR")}</span>}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-2">
                          Créée le{" "}
                          {new Date(improvement.created_at).toLocaleDateString("fr-FR")}
                          {improvement.completed_at && (
                            <> • Terminée le {new Date(improvement.completed_at).toLocaleDateString("fr-FR")}</>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {improvement.status !== "in_progress" && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(improvement.id, "in_progress")}
                            >
                              <PlayCircle className="h-4 w-4 mr-2" />
                              Marquer en cours
                            </DropdownMenuItem>
                          )}
                          {improvement.status !== "completed" && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(improvement.id, "completed")}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Marquer terminée
                            </DropdownMenuItem>
                          )}
                          {improvement.status !== "pending" && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(improvement.id, "pending")}
                            >
                              <Clock className="h-4 w-4 mr-2" />
                              Remettre en attente
                            </DropdownMenuItem>
                          )}
                          {improvement.status !== "cancelled" && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(improvement.id, "cancelled")}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Annuler
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDelete(improvement.id)}
                            className="text-destructive"
                          >
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Add Improvement Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter une amélioration</DialogTitle>
            <DialogDescription>
              Créez une nouvelle amélioration pour une formation spécifique.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="training">Formation *</Label>
              <Select
                value={newImprovement.training_id}
                onValueChange={(v) =>
                  setNewImprovement({ ...newImprovement, training_id: v })
                }
              >
                <SelectTrigger id="training">
                  <SelectValue placeholder="Sélectionner une formation" />
                </SelectTrigger>
                <SelectContent>
                  {trainings.map((training) => (
                    <SelectItem key={training.id} value={training.id}>
                      {training.training_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Catégorie</Label>
              <Select
                value={newImprovement.category}
                onValueChange={(v) =>
                  setNewImprovement({ ...newImprovement, category: v })
                }
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommendation">Recommandation</SelectItem>
                  <SelectItem value="weakness">Point faible</SelectItem>
                  <SelectItem value="manual">Manuel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Titre *</Label>
              <Input
                id="title"
                value={newImprovement.title}
                onChange={(e) =>
                  setNewImprovement({ ...newImprovement, title: e.target.value })
                }
                placeholder="Ex: Améliorer les supports visuels"
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={newImprovement.description}
                onChange={(e) =>
                  setNewImprovement({ ...newImprovement, description: e.target.value })
                }
                placeholder="Décrivez l'amélioration à apporter..."
                rows={4}
                maxLength={1000}
              />
            </div>

            <div className="space-y-2">
              <Label>Source</Label>
              <Select
                value={newImprovement.source_type || "none"}
                onValueChange={(v) => setNewImprovement({ ...newImprovement, source_type: v === "none" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="Type de source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune</SelectItem>
                  <SelectItem value="reclamation">Réclamation</SelectItem>
                  <SelectItem value="appreciation">Appréciation</SelectItem>
                  <SelectItem value="evaluation">Évaluation</SelectItem>
                  <SelectItem value="alea">Aléa</SelectItem>
                  <SelectItem value="audit">Audit</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description de la source</Label>
              <Input
                value={newImprovement.source_description}
                onChange={(e) => setNewImprovement({ ...newImprovement, source_description: e.target.value })}
                placeholder="Ex: Réclamation client X du 15/01"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priorité</Label>
                <Select
                  value={newImprovement.priority || "none"}
                  onValueChange={(v) => setNewImprovement({ ...newImprovement, priority: v === "none" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Priorité" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non définie</SelectItem>
                    <SelectItem value="haute">Haute</SelectItem>
                    <SelectItem value="moyenne">Moyenne</SelectItem>
                    <SelectItem value="basse">Basse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Échéance</Label>
                <Input
                  type="date"
                  value={newImprovement.deadline}
                  onChange={(e) => setNewImprovement({ ...newImprovement, deadline: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Responsable</Label>
              <Input
                value={newImprovement.responsible}
                onChange={(e) => setNewImprovement({ ...newImprovement, responsible: e.target.value })}
                placeholder="Nom du responsable"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddImprovement} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Ameliorations;
