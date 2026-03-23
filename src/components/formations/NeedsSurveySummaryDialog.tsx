import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NeedsSurveySummaryDialogProps {
  trainingId: string;
  trainingName: string;
  completedCount: number;
}

const NeedsSurveySummaryDialog = ({
  trainingId,
  trainingName,
  completedCount,
}: NeedsSurveySummaryDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateSummary = async () => {
    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("summarize-needs-survey", {
        body: { trainingId },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setSummary(data.summary);
    } catch (e: unknown) {
      console.error("Error generating summary:", e);
      const errorMessage = e instanceof Error ? e.message : "Impossible de générer la synthèse.";
      setError(errorMessage);
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && !summary && !loading) {
      generateSummary();
    }
  };

  // Convert markdown-like formatting to simple HTML
  const formatSummary = (text: string) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^### (.+)$/gm, "<h3 class='text-lg font-semibold mt-4 mb-2'>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2 class='text-xl font-bold mt-6 mb-3'>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1 class='text-2xl font-bold mt-6 mb-3'>$1</h1>")
      .replace(/^- (.+)$/gm, "<li class='ml-4'>$1</li>")
      .replace(/^(\d+)\. (.+)$/gm, "<li class='ml-4'><strong>$1.</strong> $2</li>")
      .replace(/\n\n/g, "</p><p class='mb-3'>")
      .replace(/\n/g, "<br/>");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={completedCount === 0}
          className="w-full"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Résumer le recueil des besoins
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Synthèse IA du recueil des besoins
          </DialogTitle>
          <DialogDescription>
            {trainingName} • {completedCount} questionnaire{completedCount > 1 ? "s" : ""} analysé{completedCount > 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Analyse des questionnaires en cours...</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="text-destructive text-center">{error}</p>
              <Button variant="outline" onClick={generateSummary}>
                Réessayer
              </Button>
            </div>
          )}

          {summary && !loading && (
            <div
              className="prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: formatSummary(summary) }}
            />
          )}
        </ScrollArea>

        {summary && !loading && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={generateSummary}>
              <Sparkles className="h-4 w-4 mr-2" />
              Régénérer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NeedsSurveySummaryDialog;
