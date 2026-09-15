import { useEffect, useState } from "react";
import { useEditableAppSetting } from "@/hooks/useAppSetting";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save, RotateCcw } from "lucide-react";
import { toast } from "@/lib/toast";

const SETTING_KEY = "lms_transcript_lesson_prompt";

const DEFAULT_PROMPT = `Tu es un concepteur pédagogique. Tu reçois la transcription d'un échange (réunion, atelier, formation) et la liste des leçons déjà existantes d'un parcours e-learning.

Leçons existantes :
{{lessons}}

Transcriptions :
{{transcripts}}

Pour chaque transcription, tu dois :
1. Identifier les sujets réellement distincts et découper la matière en leçons cohérentes (1 à 6 leçons selon la richesse du contenu). Ne découpe jamais artificiellement un propos continu.
2. Donner à chaque leçon un titre court et explicite.
3. Rédiger pour chaque leçon une introduction de 2 à 4 phrases (HTML basique).
4. Structurer le corps de la leçon en 2 à 5 sections, chacune avec un intertitre et un texte reformulé de manière claire et pédagogique (style formation professionnelle, sans hésitations orales, sans marques d'oralité, sans nom de participant).
5. Extraire 3 à 6 points clés à retenir.
6. Si la leçon complète clairement une leçon existante, renseigner target_lesson_id avec son id ; sinon mettre null (une nouvelle leçon sera créée).
7. Ne jamais dupliquer un passage dans deux leçons.

Réponds UNIQUEMENT en JSON valide avec ce format exact :
{
  "proposals": [
    {
      "transcript_id": "id de la transcription",
      "lessons": [
        {
          "title": "titre de la leçon",
          "summary_html": "<p>introduction</p>",
          "sections": [
            { "heading": "intertitre", "html": "<p>texte reformulé</p>" }
          ],
          "key_points": ["point 1", "point 2", "point 3"],
          "target_lesson_id": null
        }
      ]
    }
  ]
}`;

/**
 * Prompt utilisé par l'edge function `lms-analyze-transcript` pour transformer
 * un transcript en leçons e-learning. Stocké dans `app_settings` : la fonction
 * relit la valeur à chaque appel.
 */
export default function LmsTranscriptPromptSettings() {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Leçons e-learning depuis un transcript</CardTitle>
        <CardDescription>
          Prompt envoyé à l'IA pour découper un transcript en leçons e-learning.
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
          <Button size="sm" variant="outline" onClick={() => setValue(DEFAULT_PROMPT)} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Restaurer le prompt par défaut
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
