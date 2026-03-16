import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OKRAICheckInDraftProps {
  objectiveId: string;
  year: number;
  onDraftReady: (draft: {
    suggested_progress: number;
    suggested_confidence: number;
    suggested_notes: string;
  }) => void;
}

const OKRAICheckInDraft = ({ objectiveId, year, onDraftReady }: OKRAICheckInDraftProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const generateDraft = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("okr-ai-assistant", {
        body: {
          mode: "draft_checkin",
          objectiveId,
          year,
        },
      });

      if (error) throw error;

      // Parse JSON from the response
      const answer = data.answer;
      let parsed;

      try {
        // Try to extract JSON from the response (may be wrapped in markdown code block)
        const jsonMatch = answer.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON found");
        }
      } catch {
        toast({
          title: "Suggestion IA",
          description: answer.slice(0, 200),
        });
        return;
      }

      onDraftReady({
        suggested_progress: Math.min(100, Math.max(0, parsed.suggested_progress || 0)),
        suggested_confidence: Math.min(100, Math.max(0, parsed.suggested_confidence || 50)),
        suggested_notes: parsed.suggested_notes || "",
      });

      toast({ title: "Brouillon IA généré", description: "Les valeurs ont été pré-remplies" });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de générer le brouillon",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={generateDraft}
      disabled={isLoading}
      className="gap-1"
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5 text-purple-500" />
      )}
      Pré-remplir avec l'IA
    </Button>
  );
};

export default OKRAICheckInDraft;
