import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const SETTING_KEY = "lms_audio_reformulation_prompt";

const DEFAULT_PROMPT = `Tu es un assistant pédagogique. Tu reçois la transcription d'enregistrements audio d'une formation, ainsi que la liste des leçons d'un e-learning.

Leçons disponibles :
{{lessons}}

Transcriptions audio :
{{transcripts}}

Pour chaque audio, tu dois :
1. Identifier la leçon la plus pertinente parmi celles listées (en te basant sur le contenu)
2. Si aucune leçon ne correspond clairement, mettre lesson_id à null (le contenu ira dans une leçon "Ressources")
3. Reformuler le contenu de manière claire et pédagogique (style formation professionnelle, sans les hésitations orales)
4. Extraire les 3 à 6 points clés les plus importants

Réponds UNIQUEMENT en JSON valide avec ce format exact :
{
  "assignments": [
    {
      "audio_id": "id de l'audio",
      "lesson_id": "id de la leçon ou null",
      "reformulated_text": "texte reformulé en HTML basique (<p>, <strong>, <em>)",
      "key_points": ["point 1", "point 2", "point 3"]
    }
  ]
}`;

/**
 * Editor for the prompt used by the `lms-analyze-audio` edge function when it
 * reformulates uploaded audio into lesson blocks. Stored in `app_settings` so
 * the function reads the latest value on every invocation.
 */
export default function LmsAudioPromptSettings() {
  const qc = useQueryClient();
  const [value, setValue] = useState<string>(DEFAULT_PROMPT);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["app_setting", SETTING_KEY],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", SETTING_KEY)
        .maybeSingle();
      const raw = data?.setting_value as unknown;
      if (typeof raw === "string" && raw.trim().length > 0) return raw;
      return "";
    },
  });

  useEffect(() => {
    if (data && data.length > 0) setValue(data);
  }, [data]);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { setting_key: SETTING_KEY, setting_value: value as any, updated_at: new Date().toISOString() },
        { onConflict: "setting_key" },
      );
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Prompt enregistré");
      qc.invalidateQueries({ queryKey: ["app_setting", SETTING_KEY] });
    }
  };

  const resetDefault = () => setValue(DEFAULT_PROMPT);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Reformulation audio e-learning</CardTitle>
        <CardDescription>
          Prompt envoyé à l'IA pour reformuler les audios importés dans un cours e-learning et proposer une affectation à une leçon.
          Variables disponibles : <code>{"{{lessons}}"}</code>, <code>{"{{transcripts}}"}</code>. Le format de sortie JSON doit être conservé.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label>Prompt</Label>
          <Textarea
            rows={18}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={isLoading}
            className="font-mono text-xs"
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving || isLoading}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
          <Button size="sm" variant="outline" onClick={resetDefault} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Restaurer le prompt par défaut
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
