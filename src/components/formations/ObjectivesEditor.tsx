import { useState } from "react";
import { Plus, X, Target, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ObjectivesEditorProps {
  objectives: string[];
  onObjectivesChange: (objectives: string[]) => void;
  programFileUrl?: string;
}

const ObjectivesEditor = ({ objectives, onObjectivesChange, programFileUrl }: ObjectivesEditorProps) => {
  const [newObjective, setNewObjective] = useState("");
  const [extracting, setExtracting] = useState(false);
  const { toast } = useToast();

  const addObjective = () => {
    if (newObjective.trim()) {
      onObjectivesChange([...objectives, newObjective.trim()]);
      setNewObjective("");
    }
  };

  const removeObjective = (index: number) => {
    onObjectivesChange(objectives.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addObjective();
    }
  };

  const extractObjectivesFromPdf = async () => {
    if (!programFileUrl) return;
    
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-objectives-from-pdf", {
        body: { pdfUrl: programFileUrl, extractType: "objectives" },
      });

      if (error) throw error;

      if (data?.objectives && Array.isArray(data.objectives) && data.objectives.length > 0) {
        // Merge with existing objectives, avoiding duplicates
        const combined = [...objectives, ...data.objectives];
        onObjectivesChange([...new Set(combined)]);
        toast({
          title: "Objectifs extraits",
          description: `${data.objectives.length} objectif(s) extrait(s) du programme. Vous pouvez les modifier.`,
        });
      } else {
        toast({
          title: "Aucun objectif trouvé",
          description: "L'IA n'a pas pu extraire d'objectifs du PDF. Ajoutez-les manuellement.",
          variant: "default",
        });
      }
    } catch (error: unknown) {
      console.error("Error extracting objectives:", error);
      toast({
        title: "Extraction impossible",
        description: "Impossible d'extraire les objectifs automatiquement. Ajoutez-les manuellement.",
        variant: "default",
      });
    } finally {
      setExtracting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Objectifs de la formation
          </CardTitle>
          {programFileUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={extractObjectivesFromPdf}
              disabled={extracting}
            >
              {extracting ? (
                <>
                  <Spinner className="mr-2" />
                  Extraction...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Extraire avec l'IA
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ces objectifs seront affichés dans le formulaire de recueil des besoins pour les participants.
        </p>

        {/* Liste des objectifs */}
        {objectives.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {objectives.map((objective, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="flex items-center gap-1 py-1.5 px-3 max-w-full"
              >
                <span className="whitespace-normal break-words">{objective}</span>
                <button
                  type="button"
                  onClick={() => removeObjective(index)}
                  className="ml-1 hover:text-destructive transition-colors flex-shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Ajout d'un objectif */}
        <div className="flex gap-2">
          <Input
            value={newObjective}
            onChange={(e) => setNewObjective(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ajouter un objectif..."
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={addObjective}
            disabled={!newObjective.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ObjectivesEditor;
