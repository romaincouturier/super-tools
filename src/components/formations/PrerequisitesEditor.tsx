import { useState } from "react";
import { Plus, X, ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface PrerequisitesEditorProps {
  prerequisites: string[];
  onPrerequisitesChange: (prerequisites: string[]) => void;
}

const PrerequisitesEditor = ({ prerequisites, onPrerequisitesChange }: PrerequisitesEditorProps) => {
  const [newPrerequisite, setNewPrerequisite] = useState("");

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-5 w-5" />
          Prérequis
        </CardTitle>
        <CardDescription>
          Ajoutez les prérequis nécessaires pour cette formation (optionnel)
        </CardDescription>
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
