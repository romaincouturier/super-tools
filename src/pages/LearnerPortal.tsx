import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, GraduationCap, FileText, ClipboardCheck,
  Calendar, MapPin, Download, ExternalLink, BookOpen,
  CheckCircle2, Clock, AlertCircle, MessageSquare, Video,
} from "lucide-react";
import SupertiltLogo from "@/components/SupertiltLogo";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import LearnerMessaging from "@/components/learner/LearnerMessaging";
import CoachingBooking from "@/components/learner/CoachingBooking";

interface Training {
  training_id: string;
  training_name: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  format: string | null;
  participant_id: string;
  first_name: string;
  last_name: string;
  needs_survey_status: string | null;
  evaluation_status: string | null;
  program_file_url?: string | null;
  supports_url?: string | null;
}

interface Questionnaire {
  token: string;
  training_id: string;
  etat: string;
}

interface LearnerData {
  email: string;
  trainings: Training[];
  questionnaires: Questionnaire[];
  evaluations: Questionnaire[];
}

const statusBadge = (status: string | null) => {
  switch (status) {
    case "complete":
    case "soumis":
      return <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 border"><CheckCircle2 className="w-3 h-3 mr-1" /> Complété</Badge>;
    case "en_cours":
      return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> En cours</Badge>;
    case "non_envoye":
    case "envoye":
      return <Badge variant="outline"><AlertCircle className="w-3 h-3 mr-1" /> À compléter</Badge>;
    default:
      return null;
  }
};

export default function LearnerPortal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LearnerData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");
    const savedEmail = sessionStorage.getItem("learner_email");

    if (token) {
      validateToken(token);
    } else if (savedEmail) {
      loadData(savedEmail);
    } else {
      navigate("/apprenant");
    }
  }, [searchParams, navigate]);

  const validateToken = async (token: string) => {
    try {
      const { data: result, error } = await supabase.rpc("validate_learner_token", { p_token: token });
      if (error) throw error;
      const parsed = result as any;
      if (parsed.status === "invalid") {
        setError("Ce lien n'est plus valide. Veuillez en demander un nouveau.");
        setLoading(false);
        return;
      }
      if (parsed.status === "expired") {
        setError("Ce lien a expiré. Veuillez en demander un nouveau.");
        setLoading(false);
        return;
      }
      sessionStorage.setItem("learner_email", parsed.email);
      // Remove token from URL
      window.history.replaceState({}, "", "/espace-apprenant");
      loadData(parsed.email);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const loadData = async (email: string) => {
    try {
      const { data: result, error } = await supabase.rpc("get_learner_portal_data", { p_email: email });
      if (error) throw error;
      setData(result as any);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem("learner_email");
    navigate("/apprenant");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 space-y-4">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-muted-foreground">{error}</p>
            <Button asChild>
              <Link to="/apprenant">Demander un nouveau lien</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const firstName = data.trainings?.[0]?.first_name || "";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <SupertiltLogo className="h-7" />
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:block">{data.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>Déconnexion</Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Welcome */}
        <div>
          <h1 className="text-2xl font-bold">
            Bonjour {firstName} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Retrouvez ici toutes vos formations, documents et questionnaires.
          </p>
        </div>

        {/* Trainings */}
        {data.trainings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Aucune formation trouvée pour cet email.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {data.trainings.map((training) => {
              const questionnaire = data.questionnaires?.find(q => q.training_id === training.training_id);
              const evaluation = data.evaluations?.find(e => e.training_id === training.training_id);

              return (
                <Card key={`${training.training_id}-${training.participant_id}`} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{training.training_name}</CardTitle>
                          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                            {training.start_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {format(new Date(training.start_date), "d MMM yyyy", { locale: fr })}
                                {training.end_date && ` — ${format(new Date(training.end_date), "d MMM yyyy", { locale: fr })}`}
                              </span>
                            )}
                            {training.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {training.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {training.format && (
                        <Badge variant="outline" className="shrink-0">{training.format}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Documents */}
                      {training.program_file_url && (
                        <a
                          href={training.program_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-sm"
                        >
                          <Download className="w-4 h-4 text-primary" />
                          <span>Programme de formation</span>
                          <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
                        </a>
                      )}
                      {training.supports_url && (
                        <a
                          href={training.supports_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-sm"
                        >
                          <FileText className="w-4 h-4 text-primary" />
                          <span>Supports de formation</span>
                          <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
                        </a>
                      )}

                      {/* Questionnaire besoins */}
                      {questionnaire && (
                        <Link
                          to={`/questionnaire/${questionnaire.token}`}
                          className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-sm"
                        >
                          <ClipboardCheck className="w-4 h-4 text-primary" />
                          <span>Questionnaire des besoins</span>
                          <span className="ml-auto">{statusBadge(questionnaire.etat)}</span>
                        </Link>
                      )}

                      {/* Evaluation */}
                      {evaluation && (
                        <Link
                          to={`/evaluation/${evaluation.token}`}
                          className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-sm"
                        >
                          <ClipboardCheck className="w-4 h-4 text-primary" />
                          <span>Évaluation à chaud</span>
                          <span className="ml-auto">{statusBadge(evaluation.etat)}</span>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
