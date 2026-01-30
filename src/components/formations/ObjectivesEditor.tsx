import { useState } from "react";
import { Plus, X, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ObjectivesEditorProps {
  objectives: string[];
  onObjectivesChange: (objectives: string[]) => void;
}

const ObjectivesEditor = ({ objectives, onObjectivesChange }: ObjectivesEditorProps) => {
  const [newObjective, setNewObjective] = useState("");

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Objectifs de la formation
        </CardTitle>
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
                <span className="truncate">{objective}</span>
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
