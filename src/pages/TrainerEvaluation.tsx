import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, Star, CalendarDays, MapPin, Users, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import SupertiltLogo from "@/components/SupertiltLogo";

const TrainerEvaluation = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [trainingName, setTrainingName] = useState("");
  const [trainingDetails, setTrainingDetails] = useState<{
    startDate?: string; endDate?: string; location?: string;
    participants: { first_name: string; last_name: string }[];
  }>({ participants: [] });
  const [satisfaction, setSatisfaction] = useState(0);
  const [pointsForts, setPointsForts] = useState("");
  const [axesAmelioration, setAxesAmelioration] = useState("");
  const [commentaires, setCommentaires] = useState("");
  const [previousSuggestions, setPreviousSuggestions] = useState<{
    points_forts: string[];
    axes_amelioration: string[];
    commentaires: string[];
  }>({ points_forts: [], axes_amelioration: [], commentaires: [] });
  const { toast } = useToast();

  useEffect(() => {
    if (!token) return;
    const fetchEvaluation = async () => {
      const { data, error } = await (supabase as any)
        .from("trainer_evaluations")
        .select("*, trainings(training_name, start_date, end_date, location)")
        .eq("token", token)
        .maybeSingle();

      if (error || !data) {
        setLoading(false);
        return;
      }

      setEvaluation(data);
      setTrainingName(data.trainings?.training_name || "");

      // Fetch participants
      const training = data.trainings;
      if (training) {
        setTrainingDetails({
          startDate: training.start_date,
          endDate: training.end_date,
          location: training.location,
          participants: [],
        });
      }

      // Fetch participant list
      const { data: participants } = await (supabase as any)
        .from("training_participants")
        .select("first_name, last_name")
        .eq("training_id", data.training_id)
        .order("last_name");

      if (participants) {
        setTrainingDetails(prev => ({ ...prev, participants }));
      }

      if (data.status === "soumis") {
        setSubmitted(true);
      }

      // Fetch previous evaluations by same trainer for suggestions
      if (data.trainer_email) {
        const { data: prevEvals } = await (supabase as any)
          .from("trainer_evaluations")
          .select("points_forts, axes_amelioration, commentaires")
          .eq("trainer_email", data.trainer_email)
          .eq("status", "soumis")
          .neq("id", data.id);

        if (prevEvals && prevEvals.length > 0) {
          const extract = (field: string) => {
            const values = prevEvals
              .map((e: any) => e[field]?.trim())
              .filter((v: string | undefined): v is string => !!v);
            // Deduplicate
            return [...new Set(values)];
          };
          setPreviousSuggestions({
            points_forts: extract("points_forts"),
            axes_amelioration: extract("axes_amelioration"),
            commentaires: extract("commentaires"),
          });
        }
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

        {/* Training details */}
        {(trainingDetails.startDate || trainingDetails.location || trainingDetails.participants.length > 0) && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
            {trainingDetails.startDate && (
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  {trainingDetails.endDate && trainingDetails.endDate !== trainingDetails.startDate
                    ? `Du ${new Date(trainingDetails.startDate).toLocaleDateString("fr-FR")} au ${new Date(trainingDetails.endDate).toLocaleDateString("fr-FR")}`
                    : `Le ${new Date(trainingDetails.startDate).toLocaleDateString("fr-FR")}`}
                </span>
              </div>
            )}
            {trainingDetails.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{trainingDetails.location}</span>
              </div>
            )}
            {trainingDetails.participants.length > 0 && (
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">{trainingDetails.participants.length} participant{trainingDetails.participants.length > 1 ? "s" : ""}</span>
                  <ul className="mt-1 space-y-0.5 text-muted-foreground">
                    {trainingDetails.participants.map((p, i) => (
                      <li key={i}>{p.first_name} {p.last_name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

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
            {previousSuggestions.points_forts.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <History className="h-3 w-3" />
                  Vos retours précédents :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {previousSuggestions.points_forts.map((s, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors text-xs font-normal max-w-full"
                      onClick={() => setPointsForts(prev => prev ? `${prev}\n${s}` : s)}
                    >
                      <span className="truncate">{s.length > 80 ? s.slice(0, 80) + "…" : s}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
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
            {previousSuggestions.axes_amelioration.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <History className="h-3 w-3" />
                  Vos retours précédents :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {previousSuggestions.axes_amelioration.map((s, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors text-xs font-normal max-w-full"
                      onClick={() => setAxesAmelioration(prev => prev ? `${prev}\n${s}` : s)}
                    >
                      <span className="truncate">{s.length > 80 ? s.slice(0, 80) + "…" : s}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
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
            {previousSuggestions.commentaires.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <History className="h-3 w-3" />
                  Vos retours précédents :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {previousSuggestions.commentaires.map((s, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors text-xs font-normal max-w-full"
                      onClick={() => setCommentaires(prev => prev ? `${prev}\n${s}` : s)}
                    >
                      <span className="truncate">{s.length > 80 ? s.slice(0, 80) + "…" : s}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
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
