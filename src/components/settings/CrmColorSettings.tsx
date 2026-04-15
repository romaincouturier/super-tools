import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Palette, GraduationCap, Briefcase, Save } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useCrmSettings, useUpdateCrmSettings, ServiceTypeColors } from "@/hooks/useCrmBoard";

// Predefined color palette
const COLOR_PALETTE = [
  { name: "Bleu", value: "#3b82f6" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Rose", value: "#ec4899" },
  { name: "Rouge", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Jaune", value: "#eab308" },
  { name: "Vert", value: "#22c55e" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Gris", value: "#6b7280" },
  { name: "Indigo", value: "#6366f1" },
];

export default function CrmColorSettings() {
  const { data: settings, isLoading } = useCrmSettings();
  const updateSettings = useUpdateCrmSettings();

  const [formationColor, setFormationColor] = useState("#3b82f6");
  const [missionColor, setMissionColor] = useState("#8b5cf6");
  const [defaultColor, setDefaultColor] = useState("#6b7280");

  useEffect(() => {
    if (settings?.serviceTypeColors) {
      setFormationColor(settings.serviceTypeColors.formation);
      setMissionColor(settings.serviceTypeColors.mission);
      setDefaultColor(settings.serviceTypeColors.default);
    }
  }, [settings]);

  const handleSave = () => {
    const colors: ServiceTypeColors = {
      formation: formationColor,
      mission: missionColor,
      default: defaultColor,
    };
    updateSettings.mutate({
      key: "service_type_colors",
      value: colors,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          Couleurs des opportunités
        </CardTitle>
        <CardDescription>
          Personnalisez les couleurs des cartes CRM selon le type de prestation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Formation color */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4" />
            Formations
          </Label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map((c) => (
              <button
                key={`formation-${c.value}`}
                type="button"
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  formationColor === c.value
                    ? "border-foreground scale-110 ring-2 ring-offset-2"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: c.value }}
                onClick={() => setFormationColor(c.value)}
                title={c.name}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div
              className="w-1 h-10 rounded"
              style={{ backgroundColor: formationColor }}
            />
            <div>
              <div className="text-xs font-medium" style={{ color: formationColor }}>
                <GraduationCap className="h-3 w-3 inline mr-1" />
                Formation
              </div>
              <div className="text-sm font-medium">Exemple de carte formation</div>
            </div>
          </div>
        </div>

        {/* Mission color */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Missions de conseil
          </Label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map((c) => (
              <button
                key={`mission-${c.value}`}
                type="button"
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  missionColor === c.value
                    ? "border-foreground scale-110 ring-2 ring-offset-2"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: c.value }}
                onClick={() => setMissionColor(c.value)}
                title={c.name}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div
              className="w-1 h-10 rounded"
              style={{ backgroundColor: missionColor }}
            />
            <div>
              <div className="text-xs font-medium" style={{ color: missionColor }}>
                <Briefcase className="h-3 w-3 inline mr-1" />
                Mission
              </div>
              <div className="text-sm font-medium">Exemple de carte mission</div>
            </div>
          </div>
        </div>

        {/* Default color */}
        <div className="space-y-3">
          <Label>Non défini (par défaut)</Label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map((c) => (
              <button
                key={`default-${c.value}`}
                type="button"
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  defaultColor === c.value
                    ? "border-foreground scale-110 ring-2 ring-offset-2"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: c.value }}
                onClick={() => setDefaultColor(c.value)}
                title={c.name}
              />
            ))}
          </div>
        </div>

        {/* Save button */}
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? (
            <Spinner className="mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Enregistrer les couleurs
        </Button>
      </CardContent>
    </Card>
  );
}
