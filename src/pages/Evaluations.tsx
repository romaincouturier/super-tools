import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import {
  Loader2,
  ArrowLeft,
  Star,
  Filter,
  Sparkles,
  Check,
  X,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  TrendingUp,
  Lightbulb,
  Trash2,
} from "lucide-react";
import AppHeader from "@/components/AppHeader";
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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        navigate("/auth");
      } else {
        setUser(session.user);
        fetchData();
        checkDeletePermission(session.user.email || "");
      }
      setLoading(false);
    });
  }, [navigate]);

  const checkDeletePermission = async (userEmail: string) => {
    // Admin always has permission - check via profiles table
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("user_id", currentUser.id)
        .single();
      if ((profile as any)?.is_admin) {
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
    } catch (error: any) {
      console.error("Analysis error:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de générer l'analyse",
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
    } catch (error: any) {
      console.error("Error accepting recommendation:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter l'amélioration",
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
    } catch (error: any) {
      console.error("Error deleting evaluation:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'évaluation",
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Main content */}
      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Évaluations</h1>
        </div>

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
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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
                  ? (
                      evaluations.reduce((sum, e) => sum + (e.appreciation_generale || 0), 0) /
                      evaluations.filter((e) => e.appreciation_generale).length
                    ).toFixed(1)
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
                  ? Math.round(
                      (evaluations.filter(
                        (e) =>
                          e.recommandation === "oui" ||
                          e.recommandation === "oui_avec_enthousiasme"
                      ).length /
                        evaluations.filter((e) => e.recommandation).length) *
                        100
                    )
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
        <Dialog open={showDetail} onOpenChange={setShowDetail}>
          <DialogContent className="max-w-3xl max-h-[85vh]">
            <DialogHeader>
              <DialogTitle>Détail de l'évaluation</DialogTitle>
              <DialogDescription>
                {selectedEvaluation?.first_name || selectedEvaluation?.last_name
                  ? `${selectedEvaluation?.first_name || ""} ${selectedEvaluation?.last_name || ""}`
                  : "Anonyme"}
                {selectedEvaluation?.company && ` - ${selectedEvaluation.company}`}
                {" • "}
                {selectedEvaluation?.trainings.training_name}
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="max-h-[65vh] pr-4">
              {selectedEvaluation && (
                <div className="space-y-6">
                  {/* Informations participant */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <span className="text-sm text-muted-foreground">Email</span>
                      <p className="font-medium">{selectedEvaluation.email || "—"}</p>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Date de soumission</span>
                      <p className="font-medium">
                        {selectedEvaluation.date_soumission
                          ? new Date(selectedEvaluation.date_soumission).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Appréciation générale */}
                  <div>
                    <h3 className="font-semibold mb-2">Appréciation générale</h3>
                    <div className="flex items-center gap-4">
                      <div className="flex">{getStars(selectedEvaluation.appreciation_generale)}</div>
                      <span className="text-lg font-bold">{selectedEvaluation.appreciation_generale}/5</span>
                      {getRecommandationBadge(selectedEvaluation.recommandation)}
                    </div>
                  </div>

                  {/* Objectifs pédagogiques */}
                  {selectedEvaluation.objectifs_evaluation && selectedEvaluation.objectifs_evaluation.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Atteinte des objectifs pédagogiques</h3>
                      <div className="space-y-2">
                        {selectedEvaluation.objectifs_evaluation.map((obj, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 border rounded">
                            <span className="text-sm flex-1">{obj.objectif}</span>
                            <div className="flex items-center gap-2">
                              <div className="flex">
                                {Array.from({ length: 5 }, (_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-3 w-3 ${i < obj.niveau ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                                  />
                                ))}
                              </div>
                              <span className="text-sm font-medium w-8">{obj.niveau}/5</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      {selectedEvaluation.objectif_prioritaire && (
                        <p className="text-sm mt-2">
                          <span className="text-muted-foreground">Objectif prioritaire :</span>{" "}
                          <span className="font-medium">{selectedEvaluation.objectif_prioritaire}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Application pratique */}
                  <div>
                    <h3 className="font-semibold mb-2">Application pratique</h3>
                    <div className="grid grid-cols-1 gap-2">
                      {selectedEvaluation.delai_application && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Délai d'application :</span>{" "}
                          <Badge variant="outline">
                            {selectedEvaluation.delai_application === "cette_semaine"
                              ? "Cette semaine"
                              : selectedEvaluation.delai_application === "ce_mois"
                                ? "Ce mois-ci"
                                : selectedEvaluation.delai_application === "3_mois"
                                  ? "Dans les 3 mois"
                                  : "Application incertaine"}
                          </Badge>
                        </p>
                      )}
                      {selectedEvaluation.freins_application && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Freins à l'application :</span>{" "}
                          <span className="italic">"{selectedEvaluation.freins_application}"</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Qualité pédagogique */}
                  <div>
                    <h3 className="font-semibold mb-2">Qualité pédagogique</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedEvaluation.rythme && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Rythme :</span>{" "}
                          <Badge variant={selectedEvaluation.rythme === "adapte" ? "default" : "secondary"}>
                            {selectedEvaluation.rythme === "trop_lent"
                              ? "Trop lent"
                              : selectedEvaluation.rythme === "adapte"
                                ? "Adapté"
                                : "Trop rapide"}
                          </Badge>
                        </p>
                      )}
                      {selectedEvaluation.equilibre_theorie_pratique && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Équilibre théorie/pratique :</span>{" "}
                          <Badge variant={selectedEvaluation.equilibre_theorie_pratique === "equilibre" ? "default" : "secondary"}>
                            {selectedEvaluation.equilibre_theorie_pratique === "trop_theorique"
                              ? "Trop théorique"
                              : selectedEvaluation.equilibre_theorie_pratique === "equilibre"
                                ? "Équilibré"
                                : "Pas assez structuré"}
                          </Badge>
                        </p>
                      )}
                    </div>
                    {selectedEvaluation.amelioration_suggeree && (
                      <p className="text-sm mt-2">
                        <span className="text-muted-foreground">Amélioration suggérée :</span>{" "}
                        <span className="italic">"{selectedEvaluation.amelioration_suggeree}"</span>
                      </p>
                    )}
                  </div>

                  {/* Conformité Qualiopi */}
                  <div>
                    <h3 className="font-semibold mb-2">Conformité et organisation</h3>
                    <div className="grid grid-cols-1 gap-2">
                      <p className="text-sm flex items-center gap-2">
                        <span className="text-muted-foreground">Conditions d'information satisfaisantes :</span>
                        {selectedEvaluation.conditions_info_satisfaisantes === true ? (
                          <Badge variant="default" className="bg-green-600">Oui</Badge>
                        ) : selectedEvaluation.conditions_info_satisfaisantes === false ? (
                          <Badge variant="destructive">Non</Badge>
                        ) : (
                          <span>—</span>
                        )}
                      </p>
                      <p className="text-sm flex items-center gap-2">
                        <span className="text-muted-foreground">Formation adaptée au public :</span>
                        {selectedEvaluation.formation_adaptee_public === true ? (
                          <Badge variant="default" className="bg-green-600">Oui</Badge>
                        ) : selectedEvaluation.formation_adaptee_public === false ? (
                          <Badge variant="destructive">Non</Badge>
                        ) : (
                          <span>—</span>
                        )}
                      </p>
                      <p className="text-sm flex items-center gap-2">
                        <span className="text-muted-foreground">Qualification intervenant adéquate :</span>
                        {selectedEvaluation.qualification_intervenant_adequate === true ? (
                          <Badge variant="default" className="bg-green-600">Oui</Badge>
                        ) : selectedEvaluation.qualification_intervenant_adequate === false ? (
                          <Badge variant="destructive">Non</Badge>
                        ) : (
                          <span>—</span>
                        )}
                      </p>
                      {selectedEvaluation.appreciations_prises_en_compte && (
                        <p className="text-sm flex items-center gap-2">
                          <span className="text-muted-foreground">Appréciations prises en compte :</span>
                          <Badge variant="outline">
                            {selectedEvaluation.appreciations_prises_en_compte === "oui"
                              ? "Oui"
                              : selectedEvaluation.appreciations_prises_en_compte === "non"
                                ? "Non"
                                : "Sans objet"}
                          </Badge>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Témoignage */}
                  {selectedEvaluation.message_recommandation && (
                    <div>
                      <h3 className="font-semibold mb-2">Témoignage</h3>
                      <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground">
                        "{selectedEvaluation.message_recommandation}"
                      </blockquote>
                      {selectedEvaluation.consent_publication !== null && (
                        <p className="text-xs mt-2 text-muted-foreground">
                          {selectedEvaluation.consent_publication
                            ? "✓ Consent à la publication"
                            : "✗ Ne consent pas à la publication"}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Remarques libres */}
                  {selectedEvaluation.remarques_libres && (
                    <div>
                      <h3 className="font-semibold mb-2">Remarques libres</h3>
                      <p className="text-sm italic text-muted-foreground">
                        "{selectedEvaluation.remarques_libres}"
                      </p>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* Analysis Dialog */}
        <Dialog open={showAnalysis} onOpenChange={setShowAnalysis}>
          <DialogContent className="max-w-4xl max-h-[85vh]">
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
                                <Loader2 className="h-4 w-4 animate-spin" />
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
                                <Loader2 className="h-4 w-4 animate-spin" />
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
    </div>
  );
};

export default Evaluations;
