import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  GraduationCap, FileText, ClipboardCheck, Calendar, MapPin, Download,
  ExternalLink, BookOpen, CheckCircle2, Clock, AlertCircle, MessageSquare,
  Video, Play, RotateCcw, Lock,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import SupertiltLogo from "@/components/SupertiltLogo";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import LearnerMessaging from "@/components/learner/LearnerMessaging";
import LearnerLmsMessaging from "@/components/learner/LearnerLmsMessaging";
import CoachingBooking from "@/components/learner/CoachingBooking";

interface NextEvent {
  id: string;
  title: string;
  scheduled_at: string;
  meeting_url: string | null;
  meeting_type: string;
}

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
  // E-Learning
  lms_course_id?: string | null;
  lms_course_title?: string | null;
  lms_completion?: number | null;
  last_lesson_id?: string | null;
  next_event?: NextEvent | null;
  is_coached?: boolean;
  is_permanent?: boolean;
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

const eventTypeLabel: Record<string, string> = {
  launch:  "Lancement",
  live:    "Live",
  closing: "Séance de clôture",
};

export default function LearnerPortal() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LearnerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestingCoach, setRequestingCoach] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.user_metadata?.role === "learner" && session.user.email) {
        window.history.replaceState({}, "", "/espace-apprenant");
        loadData(session.user.email);
        return;
      }

      if (token) {
        navigate(`/apprenant/connexion?token=${encodeURIComponent(token)}`, { replace: true });
        return;
      }

      const savedEmail = sessionStorage.getItem("learner_email");
      if (savedEmail) {
        loadData(savedEmail);
        return;
      }

      navigate("/apprenant");
    };

    init();
  }, [searchParams, navigate]);

  const loadData = async (email: string) => {
    try {
      const { data: result, error } = await supabase.rpc("get_learner_portal_data", { p_email: email });
      if (error) throw error;
      setData(result as unknown as LearnerData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? "Erreur inconnue";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    sessionStorage.removeItem("learner_email");
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.user_metadata?.role === "learner") {
      await supabase.auth.signOut();
    }
    navigate("/apprenant");
  };

  const handleRequestCoach = async (training: Training) => {
    if (!data || !training.lms_course_id) return;
    setRequestingCoach(training.training_id);
    try {
      // Fetch admin email from app_settings
      const { data: settings } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "sender_email")
        .single();
      const adminEmail = (settings?.setting_value as string) || "contact@supertilt.fr";

      await supabase.functions.invoke("request-coached-formula", {
        body: {
          learnerEmail: data.email,
          trainingName: training.training_name,
          courseTitle: training.lms_course_title ?? "",
          adminEmail,
        },
      });

      toast({
        title: "Demande envoyée",
        description: "Votre formateur a été notifié et reviendra vers vous rapidement.",
      });
    } catch {
      toastError(null, "Impossible d'envoyer la demande.");
    } finally {
      setRequestingCoach(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" className="text-primary" />
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
        <div>
          <h1 className="text-2xl font-bold">Bonjour {firstName} 👋</h1>
          <p className="text-muted-foreground mt-1">
            Retrouvez ici toutes vos formations, documents et questionnaires.
          </p>
        </div>

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
              const hasElearning = !!training.lms_course_id;
              const completion = training.lms_completion ?? 0;
              const hasStarted = !!training.last_lesson_id || completion > 0;
              const playerBase = `/formation-support/${training.training_id}/lms/${training.lms_course_id}`;
              const playerUrl = `${playerBase}?email=${encodeURIComponent(data.email)}${training.last_lesson_id ? `&lesson=${training.last_lesson_id}` : ""}`;

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
                          {hasElearning && training.lms_course_title && training.lms_course_title !== training.training_name && (
                            <p className="text-sm text-muted-foreground mt-0.5">{training.lms_course_title}</p>
                          )}
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
                      {/* Hide e_learning badge — show other formats */}
                      {training.format && !training.format.toLowerCase().includes("e_learning") && !hasElearning && (
                        <Badge variant="outline" className="shrink-0">{training.format}</Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-4">
                    {/* ── E-Learning section ── */}
                    {hasElearning && (
                      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                        {/* Progress bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Progression</span>
                            <span className="font-medium">{Math.round(completion)}%</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-2 bg-primary rounded-full transition-all"
                              style={{ width: `${completion}%` }}
                            />
                          </div>
                        </div>

                        {/* Next event (only for non-permanent sessions) */}
                        {!training.is_permanent && training.next_event && (
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-primary shrink-0" />
                            <span>
                              <span className="font-medium text-primary">
                                {eventTypeLabel[training.next_event.meeting_type] ?? "Prochain évènement"}
                              </span>
                              {" — "}
                              {format(new Date(training.next_event.scheduled_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                              {training.next_event.title && ` · ${training.next_event.title}`}
                            </span>
                            {training.next_event.meeting_url && (
                              <a
                                href={training.next_event.meeting_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-auto shrink-0"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Start / Resume button */}
                        <Button asChild className="w-full sm:w-auto" size="sm">
                          <Link to={playerUrl}>
                            {hasStarted ? (
                              <><RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reprendre ma formation</>
                            ) : (
                              <><Play className="w-3.5 h-3.5 mr-1.5" /> Commencer ma formation</>
                            )}
                          </Link>
                        </Button>
                      </div>
                    )}

                    {/* ── Tabs ── */}
                    <Tabs defaultValue="documents">
                      <TabsList className="mb-3">
                        <TabsTrigger value="documents">
                          <FileText className="w-3.5 h-3.5 mr-1" /> Documents
                        </TabsTrigger>
                        <TabsTrigger value="messages">
                          <MessageSquare className="w-3.5 h-3.5 mr-1" /> Messages
                        </TabsTrigger>
                        <TabsTrigger value="coaching">
                          <Video className="w-3.5 h-3.5 mr-1" /> Coaching
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="documents">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                      </TabsContent>

                      <TabsContent value="messages">
                        {hasElearning ? (
                          <LearnerLmsMessaging
                            courseId={training.lms_course_id!}
                            learnerEmail={data.email}
                          />
                        ) : (
                          <LearnerMessaging
                            trainingId={training.training_id}
                            participantId={training.participant_id}
                            learnerEmail={data.email}
                          />
                        )}
                      </TabsContent>

                      <TabsContent value="coaching">
                        {training.is_coached ? (
                          <CoachingBooking
                            trainingId={training.training_id}
                            participantId={training.participant_id}
                            learnerEmail={data.email}
                          />
                        ) : (
                          <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center space-y-4">
                            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                              <Lock className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">Coaching individuel non inclus</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Votre formule actuelle ne comprend pas de sessions de coaching.
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={requestingCoach === training.training_id}
                              onClick={() => handleRequestCoach(training)}
                            >
                              {requestingCoach === training.training_id ? (
                                <Spinner className="mr-2" />
                              ) : (
                                <Video className="w-3.5 h-3.5 mr-1.5" />
                              )}
                              Demander une formule coachée
                            </Button>
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
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
