import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";
import {
  Loader2,
  ClipboardList,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import ModuleLayout from "@/components/ModuleLayout";
import ParticipantSearchDrawer from "@/components/participants/ParticipantSearchDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "@/components/PageHeader";

interface NeedsSurvey {
  id: string;
  participant_id: string;
  training_id: string;
  etat: string;
  nom: string | null;
  prenom: string | null;
  email: string | null;
  societe: string | null;
  fonction: string | null;
  competences_actuelles: string | null;
  competences_visees: string | null;
  experience_sujet: string | null;
  experience_details: string | null;
  lien_mission: string | null;
  contraintes_orga: string | null;
  besoins_accessibilite: string | null;
  necessite_amenagement: boolean | null;
  commentaires_libres: string | null;
  date_soumission: string | null;
  niveau_actuel: number | null;
  niveau_motivation: number | null;
  lecture_programme: string | null;
  prerequis_validation: string | null;
  prerequis_details: string | null;
  modalites_preferences: Record<string, unknown> | null;
  training: {
    training_name: string;
    start_date: string;
    client_name: string;
  };
}

const BesoinsParticipants = () => {
  const { user, loading } = useAuth();
  const [surveys, setSurveys] = useState<NeedsSurvey[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [participantDrawerOpen, setParticipantDrawerOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user) fetchSurveys();
  }, [user]);

  const fetchSurveys = async () => {
    const allData: Record<string, unknown>[] = [];
    let offset = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("questionnaire_besoins")
        .select(`
          id,
          participant_id,
          training_id,
          etat,
          nom,
          prenom,
          email,
          societe,
          fonction,
          competences_actuelles,
          competences_visees,
          experience_sujet,
          experience_details,
          lien_mission,
          contraintes_orga,
          besoins_accessibilite,
          necessite_amenagement,
          commentaires_libres,
          date_soumission,
          niveau_actuel,
          niveau_motivation,
          lecture_programme,
          prerequis_validation,
          prerequis_details,
          modalites_preferences,
          trainings:training_id (
            training_name,
            start_date,
            client_name
          )
        `)
        .eq("etat", "complete")
        .order("date_soumission", { ascending: false, nullsFirst: false })
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error("Error fetching surveys:", error);
        return;
      }

      if (data && data.length > 0) {
        allData.push(...data);
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    const transformed = allData.map((item: Record<string, unknown>) => ({
      ...item,
      training: item.trainings,
    }));

    setSurveys(transformed as any);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const runAnalysis = async () => {
    const ids = filteredSurveys.map((s) => s.id);
    if (ids.length === 0) return;
    setAnalysisLoading(true);
    setAnalysisResult(null);
    setAnalysisOpen(true);

    try {
      const { data, error } = await supabase.functions.invoke("analyze-needs-survey", {
        body: { surveyIds: ids },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setAnalysisResult(data.analysis);
    } catch (e: unknown) {
      console.error("Analysis error:", e);
      toast({ title: "Erreur", description: e instanceof Error ? e.message : "Erreur inconnue", variant: "destructive" });
      setAnalysisOpen(false);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const filteredSurveys = surveys.filter((survey) => {
    return (
      searchTerm === "" ||
      survey.nom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      survey.prenom?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      survey.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      survey.societe?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      survey.training?.training_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      survey.training?.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ModuleLayout>
      <main className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <PageHeader
          icon={ClipboardList}
          title="Besoins des participants"
          subtitle="Vue consolidée de tous les recueils de besoins"
          actions={
            <>
              <Button
                variant="outline"
                onClick={runAnalysis}
                disabled={filteredSurveys.length === 0 || analysisLoading}
              >
                {analysisLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Analyser avec l'IA
              </Button>
              <Button variant="outline" onClick={() => setParticipantDrawerOpen(true)}>
                <GraduationCap className="h-4 w-4 mr-2" />
                Parcours apprenant
              </Button>
            </>
          }
        />

        {/* Stats */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <Badge className="bg-green-100 text-green-800 text-sm">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {surveys.length} recueil(s) complété(s)
              </Badge>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom, email, formation, client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recueils de besoins</CardTitle>
            <CardDescription>
              {filteredSurveys.length} résultat(s) sur {surveys.length} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredSurveys.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Aucun recueil de besoins trouvé</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead>Formation</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Date formation</TableHead>
                    <TableHead>Soumis le</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSurveys.map((survey) => (
                    <Collapsible key={survey.id} asChild>
                      <>
                        <TableRow 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleRow(survey.id)}
                        >
                          <TableCell>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                {expandedRows.has(survey.id) ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {survey.prenom} {survey.nom}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {survey.email}
                            </div>
                          </TableCell>
                          <TableCell>{survey.training?.training_name || "-"}</TableCell>
                          <TableCell>{survey.training?.client_name || "-"}</TableCell>
                          <TableCell>
                            {survey.training?.start_date
                              ? format(parseISO(survey.training.start_date), "d MMM yyyy", { locale: fr })
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {survey.date_soumission
                              ? format(parseISO(survey.date_soumission), "d MMM yyyy", { locale: fr })
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/formations/${survey.training_id}`);
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={7} className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Left column */}
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="font-medium text-sm text-muted-foreground mb-1">
                                      Fonction / Société
                                    </h4>
                                    <p>{survey.fonction || "-"} / {survey.societe || "-"}</p>
                                  </div>
                                  {(survey.niveau_actuel != null || survey.niveau_motivation != null) && (
                                    <div className="flex gap-4">
                                      {survey.niveau_actuel != null && (
                                        <div>
                                          <h4 className="font-medium text-sm text-muted-foreground mb-1">Niveau actuel</h4>
                                          <Badge variant="outline">{survey.niveau_actuel}/5</Badge>
                                        </div>
                                      )}
                                      {survey.niveau_motivation != null && (
                                        <div>
                                          <h4 className="font-medium text-sm text-muted-foreground mb-1">Motivation</h4>
                                          <Badge variant="outline">{survey.niveau_motivation}/5</Badge>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <div>
                                    <h4 className="font-medium text-sm text-muted-foreground mb-1">
                                      Compétences actuelles
                                    </h4>
                                    <p className="whitespace-pre-wrap">{survey.competences_actuelles || "-"}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-sm text-muted-foreground mb-1">
                                      Compétences visées
                                    </h4>
                                    <p className="whitespace-pre-wrap">{survey.competences_visees || "-"}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-sm text-muted-foreground mb-1">
                                      Expérience sur le sujet
                                    </h4>
                                    <p>{survey.experience_sujet || "-"}</p>
                                    {survey.experience_details && (
                                      <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{survey.experience_details}</p>
                                    )}
                                  </div>
                                  {survey.lecture_programme && (
                                    <div>
                                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Lecture du programme</h4>
                                      <p>{survey.lecture_programme}</p>
                                    </div>
                                  )}
                                  {survey.prerequis_validation && (
                                    <div>
                                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Prérequis</h4>
                                      <p>{survey.prerequis_validation}</p>
                                      {survey.prerequis_details && (
                                        <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{survey.prerequis_details}</p>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Right column */}
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="font-medium text-sm text-muted-foreground mb-1">
                                      Lien avec la mission
                                    </h4>
                                    <p className="whitespace-pre-wrap">{survey.lien_mission || "-"}</p>
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-sm text-muted-foreground mb-1">
                                      Contraintes organisationnelles
                                    </h4>
                                    <p className="whitespace-pre-wrap">{survey.contraintes_orga || "-"}</p>
                                  </div>
                                  {survey.modalites_preferences && (
                                    <div>
                                      <h4 className="font-medium text-sm text-muted-foreground mb-1">Préférences de modalités</h4>
                                      <p className="whitespace-pre-wrap">
                                        {typeof survey.modalites_preferences === 'object'
                                          ? Object.entries(survey.modalites_preferences)
                                              .filter(([, v]) => v)
                                              .map(([k]) => k)
                                              .join(", ") || "-"
                                          : String(survey.modalites_preferences)}
                                      </p>
                                    </div>
                                  )}
                                  {(survey.besoins_accessibilite || survey.necessite_amenagement) && (
                                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                                      <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                      <div>
                                        <h4 className="font-medium text-amber-800 mb-1">
                                          Besoins d'accessibilité
                                        </h4>
                                        <p className="text-amber-700 whitespace-pre-wrap">
                                          {survey.besoins_accessibilite || "Aménagement nécessaire (détails non précisés)"}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                  {survey.commentaires_libres && (
                                    <div>
                                      <h4 className="font-medium text-sm text-muted-foreground mb-1">
                                        Commentaires
                                      </h4>
                                      <p className="whitespace-pre-wrap">{survey.commentaires_libres}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      <ParticipantSearchDrawer
        open={participantDrawerOpen}
        onOpenChange={setParticipantDrawerOpen}
      />
      <Dialog open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Analyse IA des besoins
            </DialogTitle>
            <DialogDescription>
              {filteredSurveys.length} questionnaire{filteredSurveys.length > 1 ? "s" : ""} analysé{filteredSurveys.length > 1 ? "s" : ""}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {analysisLoading && (
              <div className="flex flex-col items-center justify-center py-12 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Analyse en cours...</p>
              </div>
            )}
            {analysisResult && !analysisLoading && (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{analysisResult}</ReactMarkdown>
              </div>
            )}
          </ScrollArea>
          {analysisResult && !analysisLoading && (
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={runAnalysis}>
                <Sparkles className="h-4 w-4 mr-2" />
                Régénérer
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ModuleLayout>
  );
};

export default BesoinsParticipants;
