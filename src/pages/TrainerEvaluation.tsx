import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SupertiltLogo from "@/components/SupertiltLogo";

const TrainerEvaluation = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [trainingName, setTrainingName] = useState("");
  const [satisfaction, setSatisfaction] = useState(0);
  const [pointsForts, setPointsForts] = useState("");
  const [axesAmelioration, setAxesAmelioration] = useState("");
  const [commentaires, setCommentaires] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!token) return;
    const fetchEvaluation = async () => {
      const { data, error } = await (supabase as any)
        .from("trainer_evaluations")
        .select("*, trainings(training_name)")
        .eq("token", token)
        .maybeSingle();

      if (error || !data) {
        setLoading(false);
        return;
      }

      setEvaluation(data);
      setTrainingName(data.trainings?.training_name || "");

      if (data.status === "soumis") {
        setSubmitted(true);
      }
      setLoading(false);
    };
    fetchEvaluation();
  }, [token]);

  const handleSubmit = async () => {
    if (satisfaction === 0) {
      toast({ title: "Veuillez indiquer votre satisfaction globale", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from("trainer_evaluations")
        .update({
          satisfaction_globale: satisfaction,
          points_forts: pointsForts.trim() || null,
          axes_amelioration: axesAmelioration.trim() || null,
          commentaires: commentaires.trim() || null,
          status: "soumis",
          date_submitted: new Date().toISOString(),
        })
        .eq("token", token);

      if (error) throw error;
      setSubmitted(true);
    } catch (error) {
      console.error(error);
      toast({ title: "Erreur", description: "Impossible d'envoyer votre retour.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!evaluation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4 max-w-md">
          <SupertiltLogo className="h-12 mx-auto" />
          <h1 className="text-xl font-bold">Lien invalide</h1>
          <p className="text-muted-foreground">Ce lien de retour formateur n'est pas valide ou a expiré.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-4 max-w-md">
          <SupertiltLogo className="h-12 mx-auto" />
          <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
          <h1 className="text-xl font-bold">Merci pour votre retour !</h1>
          <p className="text-muted-foreground">
            Votre appréciation sur la formation « {trainingName} » a bien été enregistrée.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        <div className="text-center space-y-2">
          <SupertiltLogo className="h-10 mx-auto" />
          <h1 className="text-2xl font-bold">Retour formateur</h1>
          <p className="text-muted-foreground">
            Votre appréciation sur la formation « {trainingName} »
          </p>
        </div>

        <div className="space-y-6">
          {/* Satisfaction */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Satisfaction globale *</Label>
            <div className="flex items-center gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSatisfaction(val)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-10 w-10 ${
                      val <= satisfaction
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Points forts */}
          <div className="space-y-2">
            <Label>Points forts de la formation</Label>
            <Textarea
              value={pointsForts}
              onChange={(e) => setPointsForts(e.target.value)}
              placeholder="Ce qui a bien fonctionné..."
              className="min-h-[100px]"
            />
          </div>

          {/* Axes d'amélioration */}
          <div className="space-y-2">
            <Label>Axes d'amélioration</Label>
            <Textarea
              value={axesAmelioration}
              onChange={(e) => setAxesAmelioration(e.target.value)}
              placeholder="Ce qui pourrait être amélioré..."
              className="min-h-[100px]"
            />
          </div>

          {/* Commentaires */}
          <div className="space-y-2">
            <Label>Commentaires libres</Label>
            <Textarea
              value={commentaires}
              onChange={(e) => setCommentaires(e.target.value)}
              placeholder="Remarques complémentaires..."
              className="min-h-[80px]"
            />
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Envoyer mon retour
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <a href="/politique-confidentialite" target="_blank" className="underline">
            Politique de confidentialité
          </a>
        </p>
      </div>
    </div>
  );
};

export default TrainerEvaluation;
