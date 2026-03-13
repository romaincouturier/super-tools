import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserPositioning } from "@/types/reseau";

interface PositioningCardProps {
  positioning: UserPositioning;
  onSave?: (data: { pitch_one_liner: string; key_skills: string[]; target_client: string }) => void;
}

const PositioningCard = ({ positioning, onSave }: PositioningCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [pitch, setPitch] = useState(positioning.pitch_one_liner || "");
  const [skills, setSkills] = useState(positioning.key_skills.join(", "));
  const [target, setTarget] = useState(positioning.target_client || "");

  const handleSave = () => {
    onSave?.({
      pitch_one_liner: pitch,
      key_skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
      target_client: target,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setPitch(positioning.pitch_one_liner || "");
    setSkills(positioning.key_skills.join(", "));
    setTarget(positioning.target_client || "");
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Ma fiche de positionnement</CardTitle>
        {onSave && !isEditing && (
          <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4" />
          </Button>
        )}
        {isEditing && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={handleSave}>
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          <>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Pitch one-liner</label>
              <Textarea value={pitch} onChange={(e) => setPitch(e.target.value)} rows={2} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Compétences clés (séparées par des virgules)
              </label>
              <Input value={skills} onChange={(e) => setSkills(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Client cible</label>
              <Input value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Pitch</p>
              <p className="text-sm">{positioning.pitch_one_liner || "Non défini"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Compétences clés</p>
              <div className="flex flex-wrap gap-1.5">
                {positioning.key_skills.length > 0 ? (
                  positioning.key_skills.map((skill) => (
                    <Badge key={skill} variant="secondary">
                      {skill}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Non défini</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Client cible</p>
              <p className="text-sm">{positioning.target_client || "Non défini"}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PositioningCard;
