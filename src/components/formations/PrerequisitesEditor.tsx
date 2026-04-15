import { useState } from "react";
import { Plus, X, ListChecks, Sparkles } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PrerequisitesEditorProps {
  prerequisites: string[];
  onPrerequisitesChange: (prerequisites: string[]) => void;
  programFileUrl?: string;
}

const PrerequisitesEditor = ({ prerequisites, onPrerequisitesChange, programFileUrl }: PrerequisitesEditorProps) => {
  const [newPrerequisite, setNewPrerequisite] = useState("");
  const [extracting, setExtracting] = useState(false);
  const { toast } = useToast();

  const addPrerequisite = () => {
    if (!newPrerequisite.trim()) return;
    onPrerequisitesChange([...prerequisites, newPrerequisite.trim()]);
    setNewPrerequisite("");
  };

  const removePrerequisite = (index: number) => {
    onPrerequisitesChange(prerequisites.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addPrerequisite();
    }
  };

  const extractPrerequisitesFromPdf = async () => {
    if (!programFileUrl) return;
    
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-objectives-from-pdf", {
        body: { pdfUrl: programFileUrl, extractType: "prerequisites" },
      });

      if (error) throw error;

      if (data?.prerequisites && Array.isArray(data.prerequisites) && data.prerequisites.length > 0) {
        // Merge with existing prerequisites, avoiding duplicates
        const combined = [...prerequisites, ...data.prerequisites];
        onPrerequisitesChange([...new Set(combined)]);
        toast({
          title: "Prérequis extraits",
          description: `${data.prerequisites.length} prérequis extrait(s) du programme. Vous pouvez les modifier.`,
        });
      } else {
        toast({
          title: "Aucun prérequis trouvé",
          description: "L'IA n'a pas pu extraire de prérequis du PDF. Ajoutez-les manuellement.",
          variant: "default",
        });
      }
    } catch (error: unknown) {
      console.error("Error extracting prerequisites:", error);
      toast({
        title: "Extraction impossible",
        description: "Impossible d'extraire les prérequis automatiquement. Ajoutez-les manuellement.",
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
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              Prérequis
            </CardTitle>
            <CardDescription className="mt-1">
              Ajoutez les prérequis nécessaires pour cette formation (optionnel)
            </CardDescription>
          </div>
          {programFileUrl && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={extractPrerequisitesFromPdf}
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
      <CardContent>
        <div className="space-y-4">
          {/* Input for new prerequisite */}
          <div className="flex gap-2">
            <Input
              value={newPrerequisite}
              onChange={(e) => setNewPrerequisite(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ex: Connaissance de base en Product Management"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={addPrerequisite}
              disabled={!newPrerequisite.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* List of prerequisites */}
          {prerequisites.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {prerequisites.map((prereq, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-sm py-1.5 px-3 gap-2"
                >
                  {prereq}
                  <button
                    type="button"
                    onClick={() => removePrerequisite(index)}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {prerequisites.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucun prérequis défini
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PrerequisitesEditor;
