import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import SupertiltLogo from "@/components/SupertiltLogo";

const AppreciationPublic = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [appreciation, setAppreciation] = useState<any>(null);

  const [satisfaction, setSatisfaction] = useState<string>("");
  const [pointsForts, setPointsForts] = useState("");
  const [axesAmelioration, setAxesAmelioration] = useState("");
  const [commentaires, setCommentaires] = useState("");

  const { toast } = useToast();

  useEffect(() => {
    if (!token) return;
    fetchAppreciation();
  }, [token]);

  const fetchAppreciation = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("stakeholder_appreciations")
        .select("*")
        .eq("token", token)
        .single();

      if (error || !data) {
        setNotFound(true);
        return;
      }

      if (data.status === "recu") {
        setSubmitted(true);
      }

      setAppreciation(data);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!satisfaction) {
      toast({ title: "Erreur", description: "Veuillez indiquer votre satisfaction globale.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await (supabase as any)
        .from("stakeholder_appreciations")
        .update({
          satisfaction_globale: parseInt(satisfaction),
          points_forts: pointsForts.trim() || null,
          axes_amelioration: axesAmelioration.trim() || null,
          commentaires: commentaires.trim() || null,
          status: "recu",
          date_reception: new Date().toISOString(),
        })
        .eq("token", token);

      if (error) throw error;
      setSubmitted(true);
    } catch (error) {
      console.error(error);
      toast({ title: "Erreur", description: "Impossible de soumettre votre appréciation.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const stakeholderLabels: Record<string, string> = {
    pedagogique: "en tant que membre de l'équipe pédagogique",
    financeur: "en tant que financeur",
    beneficiaire_froid: "en tant que bénéficiaire",
    entreprise: "en tant qu'entreprise",
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Ce lien d'appréciation est invalide ou a expiré.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
            <h2 className="text-xl font-bold">Merci pour votre retour !</h2>
            <p className="text-muted-foreground">Votre appréciation a bien été enregistrée.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <SupertiltLogo className="h-12 mx-auto mb-4" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Recueil d'appréciation</CardTitle>
            <CardDescription>
              Bonjour {appreciation.stakeholder_name}, merci de prendre quelques minutes pour nous donner votre retour{" "}
              {stakeholderLabels[appreciation.stakeholder_type] || ""}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Satisfaction globale */}
            <div className="space-y-3">
              <Label>Satisfaction globale *</Label>
              <RadioGroup value={satisfaction} onValueChange={setSatisfaction} className="flex gap-4">
                {[1, 2, 3, 4, 5].map((val) => (
                  <div key={val} className="flex flex-col items-center gap-1">
                    <RadioGroupItem value={val.toString()} id={`sat-${val}`} />
                    <Label htmlFor={`sat-${val}`} className="text-sm">{val}</Label>
                  </div>
                ))}
              </RadioGroup>
              <p className="text-xs text-muted-foreground">1 = Pas du tout satisfait • 5 = Très satisfait</p>
            </div>

            {/* Points forts */}
            <div className="space-y-2">
              <Label>Points forts</Label>
              <Textarea
                value={pointsForts}
                onChange={(e) => setPointsForts(e.target.value)}
                placeholder="Qu'avez-vous particulièrement apprécié ?"
                rows={3}
              />
            </div>

            {/* Axes d'amélioration */}
            <div className="space-y-2">
              <Label>Axes d'amélioration</Label>
              <Textarea
                value={axesAmelioration}
                onChange={(e) => setAxesAmelioration(e.target.value)}
                placeholder="Que pourrions-nous améliorer ?"
                rows={3}
              />
            </div>

            {/* Commentaires */}
            <div className="space-y-2">
              <Label>Commentaires libres</Label>
              <Textarea
                value={commentaires}
                onChange={(e) => setCommentaires(e.target.value)}
                placeholder="Autres remarques ou suggestions..."
                rows={3}
              />
            </div>

            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Envoyer mon appréciation
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          <a href="/politique-confidentialite" className="underline">Politique de confidentialité</a>
        </p>
      </div>
    </div>
  );
};

export default AppreciationPublic;
