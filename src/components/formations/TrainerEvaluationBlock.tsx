import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Send, Star, GraduationCap, CheckCircle2, Loader2, Mail, RefreshCw } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface Props {
  trainingId: string;
  trainerName: string;
  trainerId?: string | null;
}

interface TrainerEval {
  id: string;
  token: string;
  status: string;
  trainer_name: string;
  trainer_email: string | null;
  email_sent_at: string | null;
  date_submitted: string | null;
  satisfaction_globale: number | null;
  points_forts: string | null;
  axes_amelioration: string | null;
  commentaires: string | null;
}

const TrainerEvaluationBlock = ({ trainingId, trainerName, trainerId }: Props) => {
  const [evaluation, setEvaluation] = useState<TrainerEval | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [trainerEmail, setTrainerEmail] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchEvaluation = async () => {
    const { data } = await supabase
      .from("trainer_evaluations")
      .select("*")
      .eq("training_id", trainingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setEvaluation(data || null);
    setLoading(false);
  };

  useEffect(() => {
    fetchEvaluation();
    // Fetch trainer email from trainers table
    if (trainerId) {
      supabase.from("trainers").select("email").eq("id", trainerId).maybeSingle()
        .then(({ data }) => { if (data?.email) setTrainerEmail(data.email); });
    }
  }, [trainingId, trainerId]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const token = uuidv4();
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("trainer_evaluations").insert({
        training_id: trainingId,
        trainer_name: trainerName,
        trainer_email: trainerEmail || null,
        token,
        status: "non_envoye",
        created_by: user?.id,
      });
      if (error) throw error;

      const url = `${window.location.origin}/evaluation-formateur/${token}`;
      navigator.clipboard.writeText(url);
      toast({ title: "Lien créé et copié", description: "Le lien du formulaire formateur a été copié." });
      fetchEvaluation();
    } catch (error) {
      console.error(error);
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = () => {
    if (!evaluation) return;
    const url = `${window.location.origin}/evaluation-formateur/${evaluation.token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Lien copié" });
  };

  const handleSendEmail = async () => {
    if (!evaluation) return;
    const email = evaluation.trainer_email || trainerEmail;
    if (!email) {
      toast({ title: "Pas d'email formateur", description: "Aucun email n'est renseigné pour ce formateur.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const evalLink = `${window.location.origin}/evaluation-formateur/${evaluation.token}`;

      // Fetch training details
      const { data: training } = await supabase
        .from("trainings")
        .select("training_name, client_name, start_date, end_date")
        .eq("id", trainingId)
        .maybeSingle();

      const trainingNameLabel = training?.training_name || "la formation";

      const { error } = await supabase.functions.invoke("send-trainer-evaluation-email", {
        body: {
          trainerEmail: email,
          trainerName: evaluation.trainer_name,
          trainingName: trainingNameLabel,
          evaluationLink: evalLink,
          evaluationId: evaluation.id,
          clientName: training?.client_name,
          startDate: training?.start_date,
          endDate: training?.end_date,
        },
      });

      if (error) throw error;

      // Update status
      await supabase
        .from("trainer_evaluations")
        .update({ status: "envoye", email_sent_at: new Date().toISOString(), trainer_email: email })
        .eq("id", evaluation.id);

      toast({ title: "Email envoyé", description: `Formulaire envoyé à ${email}` });
      fetchEvaluation();
    } catch (error) {
      console.error(error);
      toast({ title: "Erreur d'envoi", description: "Impossible d'envoyer l'email.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading) return null;

  const emailAvailable = evaluation?.trainer_email || trainerEmail;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GraduationCap className="h-5 w-5" />
          Retour formateur
          <span className="text-sm font-normal text-muted-foreground">(Indicateur 30)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!evaluation ? (
          <div className="text-center py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Aucun retour formateur demandé pour cette formation.
            </p>
            <Button onClick={handleCreate} disabled={creating} size="sm">
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Générer un lien de retour
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{evaluation.trainer_name}</span>
                <Badge variant={
                  evaluation.status === "soumis" ? "default" :
                  evaluation.status === "envoye" ? "secondary" : "outline"
                }>
                  {evaluation.status === "soumis" ? "Reçu" :
                   evaluation.status === "envoye" ? "Envoyé" : "Non envoyé"}
                </Badge>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyLink} title="Copier le lien">
                  <Copy className="h-4 w-4" />
                </Button>
                {evaluation.status !== "soumis" && emailAvailable && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleSendEmail}
                    disabled={sending}
                    title={evaluation.status === "envoye" ? "Renvoyer l'email" : "Envoyer par email"}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> :
                      evaluation.status === "envoye" ? <RefreshCw className="h-4 w-4" /> : <Mail className="h-4 w-4" />
                    }
                  </Button>
                )}
              </div>
            </div>

            {evaluation.email_sent_at && (
              <p className="text-xs text-muted-foreground">
                Envoyé le {new Date(evaluation.email_sent_at).toLocaleDateString("fr-FR")} à {evaluation.trainer_email}
              </p>
            )}

            {evaluation.status === "soumis" && (
              <div className="space-y-2 bg-muted/50 rounded-lg p-3">
                {evaluation.satisfaction_globale && (
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <Star
                        key={val}
                        className={`h-4 w-4 ${
                          val <= evaluation.satisfaction_globale!
                            ? "fill-primary text-primary"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                    <span className="text-sm ml-1">{evaluation.satisfaction_globale}/5</span>
                  </div>
                )}
                {evaluation.points_forts && (
                  <p className="text-sm"><strong>Points forts :</strong> {evaluation.points_forts}</p>
                )}
                {evaluation.axes_amelioration && (
                  <p className="text-sm"><strong>Axes d'amélioration :</strong> {evaluation.axes_amelioration}</p>
                )}
                {evaluation.commentaires && (
                  <p className="text-sm"><strong>Commentaires :</strong> {evaluation.commentaires}</p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TrainerEvaluationBlock;
