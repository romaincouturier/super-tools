import { useEffect, useState } from "react";
import { useEditableAppSetting } from "@/hooks/useAppSetting";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, RotateCcw } from "lucide-react";
import { toast } from "@/lib/toast";

const SETTING_KEY = "lms_audio_reformulation_prompt";

const DEFAULT_PROMPT = `Tu es un assistant pédagogique. Tu reçois la transcription d'enregistrements audio d'une formation, ainsi que la liste des leçons d'un e-learning.

Leçons disponibles :
{{lessons}}

Transcriptions audio :
{{transcripts}}

Pour chaque audio, tu dois :
1. Détecter si l'enregistrement traite d'un seul sujet ou de plusieurs sujets distincts correspondant à des leçons différentes.
2. Découper l'audio en segments thématiques : un segment par sujet réellement distinct. Si l'audio ne traite qu'un seul sujet, renvoie un seul segment. Ne découpe jamais artificiellement un propos continu.
3. Pour chaque segment : identifier la leçon la plus pertinente parmi celles listées. Si aucune ne correspond clairement, mettre lesson_id à null (le contenu ira dans une leçon "Ressources").
4. Pour chaque segment : reformuler le contenu de manière claire et pédagogique (style formation professionnelle, sans les hésitations orales) et extraire 3 à 6 points clés.
5. Donner à chaque segment un titre court qui résume son sujet.
6. Ne pas dupliquer un passage dans deux segments : chaque partie de la transcription appartient à un seul segment, dans l'ordre de l'enregistrement.

Réponds UNIQUEMENT en JSON valide avec ce format exact :
{
  "assignments": [
    {
      "audio_id": "id de l'audio",
      "segments": [
        {
          "title": "titre court du segment",
          "lesson_id": "id de la leçon ou null",
          "reformulated_text": "texte reformulé en HTML basique (<p>, <strong>, <em>)",
          "key_points": ["point 1", "point 2", "point 3"]
        }
      ]
    }
  ]
}`;

/**
 * Editor for the prompt used by the `lms-analyze-audio` edge function when it
 * reformulates uploaded audio into lesson blocks. Stored in `app_settings` so
 * the function reads the latest value on every invocation.
 */
export default function LmsAudioPromptSettings() {
  const [value, setValue] = useState<string>(DEFAULT_PROMPT);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, save: saveSetting } = useEditableAppSetting(SETTING_KEY);

  useEffect(() => {
    if (data && data.length > 0) setValue(data);
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      await saveSetting(value);
      toast.success("Prompt enregistré");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
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
