import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Star, Filter, Sparkles, Check, AlertCircle, TrendingUp, Lightbulb, Trash2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import EvaluationDetailDialog from "@/components/formations/EvaluationDetailDialog";
import { computeAvgRating, computeRecommendationRate } from "@/lib/evaluationUtils";

interface Training {
  id: string;
  training_name: string;
}

interface Evaluation {
  id: string;
  training_id: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  email: string | null;
  appreciation_generale: number | null;
  recommandation: string | null;
  message_recommandation: string | null;
  objectifs_evaluation: { objectif: string; niveau: number }[] | null;
  objectif_prioritaire: string | null;
  delai_application: string | null;
  freins_application: string | null;
  rythme: string | null;
  equilibre_theorie_pratique: string | null;
  amelioration_suggeree: string | null;
  conditions_info_satisfaisantes: boolean | null;
  formation_adaptee_public: boolean | null;
  qualification_intervenant_adequate: boolean | null;
  appreciations_prises_en_compte: string | null;
  consent_publication: boolean | null;
  remarques_libres: string | null;
  etat: string;
  date_soumission: string | null;
  trainings: {
    training_name: string;
  };
}

interface AnalysisItem {
  title: string;
  description: string;
  evidence?: string;
  priority?: string;
  impact?: string;
}

interface Analysis {
  id: string;
  summary: string;
  strengths: AnalysisItem[];
  weaknesses: AnalysisItem[];
  recommendations: AnalysisItem[];
  evaluationsCount: number;
  trainingName: string;
}

const Evaluations = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [selectedTraining, setSelectedTraining] = useState<string>("all");
  const [canDeleteEvaluations, setCanDeleteEvaluations] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [acceptingItem, setAcceptingItem] = useState<string | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchData();
      checkDeletePermission(user.email || "");
    }
  }, [user]);

  const checkDeletePermission = async (userEmail: string) => {
    // Admin always has permission - check via profiles table
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("user_id", currentUser.id)
        .single();
      if ((profile as unknown as { is_admin?: boolean })?.is_admin) {
        setCanDeleteEvaluations(true);
        return;
      }
    }

    // Check app_settings for allowed emails
    const { data } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "can_delete_evaluations_emails")
      .single();

    if (data?.setting_value) {
      const allowedEmails = data.setting_value
        .split(",")
        .map((email: string) => email.trim().toLowerCase());
      setCanDeleteEvaluations(allowedEmails.includes(userEmail.toLowerCase()));
    }
  };

  const fetchData = async () => {
    // Fetch trainings
    const { data: trainingsData } = await supabase
      .from("trainings")
      .select("id, training_name")
      .order("start_date", { ascending: false });

    if (trainingsData) {
      setTrainings(trainingsData);
    }

    // Fetch evaluations
    fetchEvaluations();
  };

  const fetchEvaluations = async (trainingId?: string) => {
    let query = supabase
      .from("training_evaluations")
      .select(`
        id,
        training_id,
        first_name,
        last_name,
        company,
        email,
        appreciation_generale,
        recommandation,
        message_recommandation,
        objectifs_evaluation,
        objectif_prioritaire,
        delai_application,
        freins_application,
        rythme,
        equilibre_theorie_pratique,
        amelioration_suggeree,
        conditions_info_satisfaisantes,
        formation_adaptee_public,
        qualification_intervenant_adequate,
        appreciations_prises_en_compte,
        consent_publication,
        remarques_libres,
        etat,
        date_soumission,
        trainings!inner(training_name)
      `)
      .eq("etat", "soumis")
      .order("date_soumission", { ascending: false });

    if (trainingId && trainingId !== "all") {
      query = query.eq("training_id", trainingId);
    }

    const { data } = await query;
    if (data) {
      setEvaluations(data as unknown as Evaluation[]);
    }
  };

  const handleTrainingChange = (value: string) => {
    setSelectedTraining(value);
    fetchEvaluations(value);
    setAnalysis(null);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-evaluations", {
        body: { trainingId: selectedTraining === "all" ? null : selectedTraining },
      });

      if (error) throw error;

      if (data?.analysis) {
        setAnalysis(data.analysis);
        setShowAnalysis(true);
      } else {
        toast({
          title: "Aucune donnée",
          description: data?.message || "Aucune évaluation à analyser",
        });
      }
    } catch (error: unknown) {
      console.error("Analysis error:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAcceptRecommendation = async (item: AnalysisItem, category: string) => {
    const itemKey = `${category}-${item.title}`;
    setAcceptingItem(itemKey);

    try {
      const { error } = await supabase.from("improvements").insert({
        training_id: selectedTraining === "all" ? null : selectedTraining,
        title: item.title,
        description: item.description,
        category: category,
        source_analysis_id: analysis?.id,
        status: "pending",
        created_by: user?.id,
      });

      if (error) throw error;

      toast({
        title: "Amélioration acceptée",
        description: `"${item.title}" a été ajoutée aux améliorations`,
      });

      // Remove from current analysis display
      if (analysis) {
        const updatedAnalysis = { ...analysis };
        if (category === "weakness") {
          updatedAnalysis.weaknesses = updatedAnalysis.weaknesses.filter(
            (w) => w.title !== item.title
          );
        } else if (category === "recommendation") {
          updatedAnalysis.recommendations = updatedAnalysis.recommendations.filter(
            (r) => r.title !== item.title
          );
        }
        setAnalysis(updatedAnalysis);
      }
    } catch (error: unknown) {
      console.error("Error accepting recommendation:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setAcceptingItem(null);
    }
  };

  const handleDeleteEvaluation = async (evaluationId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette évaluation ?")) return;

    try {
      const { error } = await supabase
        .from("training_evaluations")
        .delete()
        .eq("id", evaluationId);

      if (error) throw error;

      toast({
        title: "Évaluation supprimée",
        description: "L'évaluation a été supprimée avec succès",
      });

      // Refresh list
      fetchEvaluations(selectedTraining);
    } catch (error: unknown) {
      console.error("Error deleting evaluation:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleOpenDetail = (evaluation: Evaluation) => {
    setSelectedEvaluation(evaluation);
    setShowDetail(true);
  };

  const getStars = (rating: number | null) => {
    if (!rating) return null;
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
      />
    ));
  };

  const getRecommandationBadge = (recommandation: string | null) => {
    if (!recommandation) return null;
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      oui_avec_enthousiasme: "default",
      oui: "secondary",
      non: "destructive",
    };
    const labels: Record<string, string> = {
      oui_avec_enthousiasme: "Recommande vivement",
      oui: "Recommande",
      non: "Ne recommande pas",
    };
    return (
      <Badge variant={variants[recommandation] || "secondary"}>
        {labels[recommandation] || recommandation}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  return (
    <ModuleLayout>
      {/* Main content */}
      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        <PageHeader icon={Star} title="Évaluations" />

        {/* Filters and Actions */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedTraining} onValueChange={handleTrainingChange}>
              <SelectTrigger className="w-full sm:w-[300px]">
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

          <Button
            onClick={handleAnalyze}
            disabled={analyzing || evaluations.length === 0}
          >
            {analyzing ? (
              <Spinner className="mr-2" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Analyser avec l'IA
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Évaluations complètes</CardDescription>
              <CardTitle className="text-3xl">{evaluations.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Note moyenne</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                {evaluations.length > 0
                  ? computeAvgRating(evaluations).toFixed(1)
                  : "-"}
                <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Taux de recommandation</CardDescription>
              <CardTitle className="text-3xl">
                {evaluations.length > 0
                  ? computeRecommendationRate(evaluations)
                  : 0}
                %
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Evaluations List */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des évaluations</CardTitle>
          </CardHeader>
          <CardContent>
            {evaluations.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Aucune évaluation complète trouvée
              </p>
            ) : (
              <div className="space-y-4">
                {evaluations.map((evaluation) => (
                  <div
                    key={evaluation.id}
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => handleOpenDetail(evaluation)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">
                          {evaluation.first_name || evaluation.last_name
                            ? `${evaluation.first_name || ""} ${evaluation.last_name || ""}`
                            : "Anonyme"}
                          {evaluation.company && (
                            <span className="text-muted-foreground ml-2">
                              ({evaluation.company})
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {evaluation.trainings.training_name}
                        </div>
                        {evaluation.message_recommandation && (
                          <p className="text-sm mt-2 italic">
                            "{evaluation.message_recommandation}"
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex">{getStars(evaluation.appreciation_generale)}</div>
                          {canDeleteEvaluations && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEvaluation(evaluation.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {getRecommandationBadge(evaluation.recommandation)}
                        {evaluation.date_soumission && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(evaluation.date_soumission).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}{" "}
                            à{" "}
                            {new Date(evaluation.date_soumission).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evaluation Detail Dialog */}
        <EvaluationDetailDialog
          open={showDetail}
          onOpenChange={setShowDetail}
          evaluation={selectedEvaluation}
          trainingName={selectedEvaluation?.trainings.training_name}
        />

        {/* Analysis Dialog */}
        <Dialog open={showAnalysis} onOpenChange={setShowAnalysis}>
          <DialogContent className="w-full sm:max-w-4xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Analyse IA des évaluations
              </DialogTitle>
              <DialogDescription>
                {analysis?.trainingName} • {analysis?.evaluationsCount} évaluation
                {(analysis?.evaluationsCount || 0) > 1 ? "s" : ""} analysée
                {(analysis?.evaluationsCount || 0) > 1 ? "s" : ""}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[65vh] pr-4">
              {analysis && (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="bg-primary/5 rounded-lg p-4">
                    <p className="text-sm">{analysis.summary}</p>
                  </div>

                  {/* Strengths */}
                  <div>
                    <h3 className="font-semibold flex items-center gap-2 mb-3">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      Points forts ({analysis.strengths.length})
                    </h3>
                    <div className="space-y-3">
                      {analysis.strengths.map((item, idx) => (
                        <div key={idx} className="border rounded-lg p-4 bg-green-50/50">
                          <div className="font-medium text-green-800">{item.title}</div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.description}
                          </p>
                          {item.evidence && (
                            <p className="text-xs italic mt-2 text-green-600">
                              "{item.evidence}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Weaknesses */}
                  <div>
                    <h3 className="font-semibold flex items-center gap-2 mb-3">
                      <AlertCircle className="h-5 w-5 text-orange-600" />
                      Points faibles ({analysis.weaknesses.length})
                    </h3>
                    <div className="space-y-3">
                      {analysis.weaknesses.map((item, idx) => (
                        <div
                          key={idx}
                          className="border rounded-lg p-4 bg-orange-50/50 flex justify-between items-start gap-4"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-orange-800">{item.title}</div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {item.description}
                            </p>
                            {item.evidence && (
                              <p className="text-xs italic mt-2 text-orange-600">
                                "{item.evidence}"
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:bg-green-50"
                              onClick={() => handleAcceptRecommendation(item, "weakness")}
                              disabled={acceptingItem === `weakness-${item.title}`}
                            >
                              {acceptingItem === `weakness-${item.title}` ? (
                                <Spinner />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div>
                    <h3 className="font-semibold flex items-center gap-2 mb-3">
                      <Lightbulb className="h-5 w-5 text-blue-600" />
                      Recommandations ({analysis.recommendations.length})
                    </h3>
                    <div className="space-y-3">
                      {analysis.recommendations.map((item, idx) => (
                        <div
                          key={idx}
                          className="border rounded-lg p-4 bg-blue-50/50 flex justify-between items-start gap-4"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-blue-800">{item.title}</span>
                              {item.priority && (
                                <Badge
                                  variant={
                                    item.priority === "high"
                                      ? "destructive"
                                      : item.priority === "medium"
                                        ? "default"
                                        : "secondary"
                                  }
                                  className="text-xs"
                                >
                                  {item.priority === "high"
                                    ? "Haute"
                                    : item.priority === "medium"
                                      ? "Moyenne"
                                      : "Basse"}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {item.description}
                            </p>
                            {item.impact && (
                              <p className="text-xs mt-2 text-blue-600">
                                Impact attendu : {item.impact}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:bg-green-50"
                              onClick={() => handleAcceptRecommendation(item, "recommendation")}
                              disabled={acceptingItem === `recommendation-${item.title}`}
                            >
                              {acceptingItem === `recommendation-${item.title}` ? (
                                <Spinner />
                              ) : (
                                <Check className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </main>
    </ModuleLayout>
  );
};

export default Evaluations;
