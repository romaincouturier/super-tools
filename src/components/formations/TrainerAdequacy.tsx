import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Shield, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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

export default function TrainerAdequacy({ trainingId, trainerName }: TrainerAdequacyProps) {
  const [adequacy, setAdequacy] = useState<Adequacy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validatedBy, setValidatedBy] = useState("");
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAdequacy();
  }, [trainingId]);

  const fetchAdequacy = async () => {
    try {
      // First get trainer_id from training
      const { data: training } = await supabase
        .from("trainings")
        .select("trainer_name")
        .eq("id", trainingId)
        .single();

      if (!training) return;

      // Get trainer by name
      const nameParts = training.trainer_name.split(" ");
      const { data: trainers } = await (supabase as any)
        .from("trainers")
        .select("id")
        .limit(10);

      if (!trainers || trainers.length === 0) return;

      // Check adequacy for any trainer linked to this training
      const trainerIds = trainers.map((t: any) => t.id);
      const { data } = await (supabase as any)
        .from("trainer_training_adequacy")
        .select("*")
        .eq("training_id", trainingId)
        .in("trainer_id", trainerIds)
        .limit(1);

      if (data && data.length > 0) {
        setAdequacy(data[0]);
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

    setSaving(true);
    try {
      // Get trainer id
      const { data: trainers } = await (supabase as any)
        .from("trainers")
        .select("id")
        .limit(10);

      if (!trainers || trainers.length === 0) {
        toast({ title: "Erreur", description: "Aucun formateur trouvé.", variant: "destructive" });
        return;
      }

      // Use first trainer (or find match by name)
      const trainerId = trainers[0].id;

      const { error } = await (supabase as any)
        .from("trainer_training_adequacy")
        .upsert({
          trainer_id: trainerId,
          training_id: trainingId,
          validated_by: validatedBy.trim(),
          validated_at: new Date().toISOString().split("T")[0],
        }, { onConflict: "trainer_id,training_id" });

      if (error) throw error;

      toast({ title: "Adéquation validée" });
      setShowForm(false);
      fetchAdequacy();
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
        </CardTitle>
      </CardHeader>
      <CardContent>
        {adequacy ? (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="default" className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Validée
            </Badge>
            <span className="text-muted-foreground">
              par {adequacy.validated_by} le {format(new Date(adequacy.validated_at), "d MMMM yyyy", { locale: fr })}
            </span>
          </div>
        ) : showForm ? (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nom du validateur"
              value={validatedBy}
              onChange={(e) => setValidatedBy(e.target.value)}
              className="max-w-[200px]"
            />
            <Button size="sm" onClick={handleValidate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Valider
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button>
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
