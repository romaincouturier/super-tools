import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Shield, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TrainerAdequacyProps {
  trainingId: string;
  trainerName: string;
}

interface Adequacy {
  id: string;
  validated_by: string;
  validated_at: string;
  notes: string | null;
}

interface TrainerData {
  id: string;
  first_name: string;
  last_name: string;
  competences: string[];
}

export default function TrainerAdequacy({ trainingId, trainerName }: TrainerAdequacyProps) {
  const [adequacy, setAdequacy] = useState<Adequacy | null>(null);
  const [trainer, setTrainer] = useState<TrainerData | null>(null);
  const [trainingObjectives, setTrainingObjectives] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validatedBy, setValidatedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [trainingId]);

  const fetchData = async () => {
    try {
      // Fetch training details (trainer_id if exists, objectives)
      const { data: training } = await supabase
        .from("trainings")
        .select("trainer_name, objectives, trainer_id")
        .eq("id", trainingId)
        .single();

      if (!training) return;

      if ((training as any).objectives) {
        setTrainingObjectives((training as any).objectives);
      }

      // Find the trainer by trainer_id or by name match
      let trainerId = (training as any).trainer_id;
      let trainerData: TrainerData | null = null;

      if (trainerId) {
        const { data } = await (supabase as any)
          .from("trainers")
          .select("id, first_name, last_name, competences")
          .eq("id", trainerId)
          .single();
        trainerData = data;
      }

      if (!trainerData && training.trainer_name) {
        // Fallback: match by name
        const parts = training.trainer_name.trim().split(/\s+/);
        if (parts.length >= 2) {
          const { data } = await (supabase as any)
            .from("trainers")
            .select("id, first_name, last_name, competences")
            .ilike("last_name", parts[parts.length - 1])
            .limit(1);
          if (data && data.length > 0) {
            trainerData = data[0];
            trainerId = data[0].id;
          }
        }
      }

      if (trainerData) {
        setTrainer({
          ...trainerData,
          competences: trainerData.competences || [],
        });

        // Fetch adequacy record
        const { data: adequacyData } = await (supabase as any)
          .from("trainer_training_adequacy")
          .select("*")
          .eq("training_id", trainingId)
          .eq("trainer_id", trainerId)
          .limit(1);

        if (adequacyData && adequacyData.length > 0) {
          setAdequacy(adequacyData[0]);
        }
      }
    } catch (error) {
      console.error("Error fetching adequacy:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!validatedBy.trim()) {
      toast({ title: "Erreur", description: "Veuillez saisir le nom du validateur.", variant: "destructive" });
      return;
    }
    if (!trainer) {
      toast({ title: "Erreur", description: "Aucun formateur trouvé.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("trainer_training_adequacy")
        .upsert({
          trainer_id: trainer.id,
          training_id: trainingId,
          validated_by: validatedBy.trim(),
          validated_at: new Date().toISOString().split("T")[0],
          notes: notes.trim() || null,
        }, { onConflict: "trainer_id,training_id" });

      if (error) throw error;

      toast({ title: "Adéquation validée" });
      setShowForm(false);
      fetchData();
    } catch (error) {
      console.error("Error validating adequacy:", error);
      toast({ title: "Erreur", description: "Impossible de valider l'adéquation.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Adéquation formateur / formation
          <Badge variant="outline" className="text-[10px]">Indicateurs 21 & 22</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Competency mapping */}
        {trainer && trainer.competences.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Compétences de {trainer.first_name} {trainer.last_name}
            </Label>
            <div className="flex flex-wrap gap-1">
              {trainer.competences.map((comp) => (
                <Badge key={comp} variant="secondary" className="text-xs">{comp}</Badge>
              ))}
            </div>
          </div>
        )}

        {trainingObjectives && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Objectifs de la formation</Label>
            <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2 whitespace-pre-wrap">
              {trainingObjectives}
            </p>
          </div>
        )}

        {/* Validation status */}
        {adequacy ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Validée
              </Badge>
              <span className="text-muted-foreground">
                par {adequacy.validated_by} le {new Date(adequacy.validated_at).toLocaleDateString("fr-FR")}
              </span>
            </div>
            {adequacy.notes && (
              <p className="text-xs text-muted-foreground italic bg-muted/30 rounded p-2">
                {adequacy.notes}
              </p>
            )}
          </div>
        ) : showForm ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nom du validateur *</Label>
              <Input
                placeholder="Nom du validateur"
                value={validatedBy}
                onChange={(e) => setValidatedBy(e.target.value)}
                className="max-w-[250px]"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Justification de l'adéquation</Label>
              <Textarea
                placeholder="En quoi les compétences du formateur correspondent aux objectifs de la formation..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleValidate} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                Valider
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-amber-600 border-amber-300">Non validée</Badge>
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              Valider l'adéquation
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
