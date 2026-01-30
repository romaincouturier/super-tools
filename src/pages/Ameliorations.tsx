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
} from "lucide-react";
import SupertiltLogo from "@/components/SupertiltLogo";
import UserMenu from "@/components/UserMenu";
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
import { useToast } from "@/hooks/use-toast";

interface Training {
  id: string;
  training_name: string;
}

interface Improvement {
  id: string;
  training_id: string | null;
  title: string;
  description: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
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
      {/* Header */}
      <header className="bg-foreground text-background py-4 px-6 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SupertiltLogo className="h-10" invert />
            <span className="text-xl font-bold">SuperTools</span>
          </div>
          {user && <UserMenu user={user} onLogout={handleLogout} />}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Améliorations</h1>
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
              <p className="text-muted-foreground text-center py-8">
                Aucune amélioration enregistrée. Utilisez l'analyse IA dans la section Évaluations
                pour générer des recommandations.
              </p>
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
                        </div>
                        {improvement.trainings && (
                          <div className="text-sm text-muted-foreground mt-1">
                            {improvement.trainings.training_name}
                          </div>
                        )}
                        <p className="text-sm mt-2">{improvement.description}</p>
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
    </div>
  );
};

export default Ameliorations;
