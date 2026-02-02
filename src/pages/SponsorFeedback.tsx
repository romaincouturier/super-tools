import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, Star, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SupertiltLogo from "@/components/SupertiltLogo";

interface TrainingData {
  id: string;
  training_name: string;
  client_name: string;
  start_date: string;
  end_date: string | null;
  sponsor_first_name: string | null;
  sponsor_feedback_received_at: string | null;
}

const SponsorFeedback = () => {
  const { trainingId } = useParams<{ trainingId: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [training, setTraining] = useState<TrainingData | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [score, setScore] = useState<number>(0);
  const [feedback, setFeedback] = useState("");
  const [hoveredScore, setHoveredScore] = useState<number>(0);

  const { toast } = useToast();

  useEffect(() => {
    const fetchTraining = async () => {
      if (!trainingId) {
        setError("Lien invalide");
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("trainings")
          .select("id, training_name, client_name, start_date, end_date, sponsor_first_name, sponsor_feedback_received_at")
          .eq("id", trainingId)
          .single();

        if (fetchError || !data) {
          setError("Formation introuvable");
          setLoading(false);
          return;
        }

        setTraining(data);

        if (data.sponsor_feedback_received_at) {
          setAlreadySubmitted(true);
        }
      } catch (err) {
        console.error("Error fetching training:", err);
        setError("Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    };

    fetchTraining();
  }, [trainingId]);

  const handleSubmit = async () => {
    if (score === 0) {
      toast({
        title: "Note requise",
        description: "Veuillez s\u00e9lectionner une note avant de soumettre.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const { error: updateError } = await supabase
        .from("trainings")
        .update({
          sponsor_feedback_score: score,
          sponsor_feedback_response: feedback || null,
          sponsor_feedback_received_at: new Date().toISOString(),
        })
        .eq("id", trainingId);

      if (updateError) {
        throw updateError;
      }

      // Log activity
      await supabase.from("activity_logs").insert({
        action_type: "sponsor_feedback_received",
        details: {
          training_id: trainingId,
          training_name: training?.training_name,
          score,
          has_comment: !!feedback,
        },
      });

      setSubmitted(true);
      toast({
        title: "Merci pour votre retour !",
        description: "Votre avis a \u00e9t\u00e9 enregistr\u00e9 avec succ\u00e8s.",
      });
    } catch (err) {
      console.error("Error submitting feedback:", err);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'envoi.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <SupertiltLogo className="h-12 mb-6" />
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (alreadySubmitted || submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <SupertiltLogo className="h-12 mb-6" />
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
            <h2 className="text-xl font-semibold">Merci pour votre retour !</h2>
            <p className="text-muted-foreground">
              Votre avis nous aide \u00e0 am\u00e9liorer continuellement nos formations.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <SupertiltLogo className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Votre avis compte</h1>
          <p className="text-muted-foreground mt-2">
            D\u00e9marche qualit\u00e9 Qualiopi
          </p>
        </div>

        {/* Training Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{training?.training_name}</CardTitle>
            <CardDescription>
              {training?.client_name} \u2022{" "}
              {training?.end_date && training.end_date !== training.start_date
                ? `Du ${formatDate(training.start_date)} au ${formatDate(training.end_date)}`
                : formatDate(training?.start_date || "")}
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Rating */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5" />
              Satisfaction globale
            </CardTitle>
            <CardDescription>
              Comment \u00e9valuez-vous cette action de formation ?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScore(value)}
                  onMouseEnter={() => setHoveredScore(value)}
                  onMouseLeave={() => setHoveredScore(0)}
                  className="p-1 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary rounded"
                >
                  <Star
                    className={`h-10 w-10 transition-colors ${
                      value <= (hoveredScore || score)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground mt-3">
              {score === 0 && "Cliquez pour noter"}
              {score === 1 && "Tr\u00e8s insatisfait"}
              {score === 2 && "Insatisfait"}
              {score === 3 && "Neutre"}
              {score === 4 && "Satisfait"}
              {score === 5 && "Tr\u00e8s satisfait"}
            </p>
          </CardContent>
        </Card>

        {/* Comment */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Commentaire (optionnel)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="feedback" className="sr-only">
              Votre commentaire
            </Label>
            <Textarea
              id="feedback"
              placeholder="Partagez vos remarques, suggestions ou points d'am\u00e9lioration..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
            />
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || score === 0}
          className="w-full"
          size="lg"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Envoyer mon avis
            </>
          )}
        </Button>

        {/* Privacy note */}
        <p className="text-xs text-muted-foreground text-center px-4">
          Vos donn\u00e9es sont trait\u00e9es dans le cadre de notre certification Qualiopi
          et conserv\u00e9es 3 ans conform\u00e9ment \u00e0 la r\u00e9glementation.
        </p>
      </div>
    </div>
  );
};

export default SponsorFeedback;
