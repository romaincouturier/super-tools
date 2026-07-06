import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import LmsAudioPromptSettings from "./LmsAudioPromptSettings";

type Kind = "blog_article" | "linkedin_post" | "title" | "editorial" | "editorial_engine";

interface PromptRow {
  id: string;
  kind: Kind;
  system_prompt: string;
  user_prompt_template: string;
  model: string;
}

const LABELS: Record<Kind, string> = {
  title: "Titre auto (à la réception du transcript)",
  blog_article: "Article de blog",
  linkedin_post: "Post LinkedIn",
  editorial: "Fiche éditoriale (qualification des transcripts)",
  editorial_engine: "Moteur éditorial (référentiel cibles, saisonnalité, scoring)",
};

function PromptCard({ row, onSaved }: { row: PromptRow; onSaved: () => void }) {
  const [systemPrompt, setSystemPrompt] = useState(row.system_prompt);
  const [userPrompt, setUserPrompt] = useState(row.user_prompt_template);
  const [model, setModel] = useState(row.model);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSystemPrompt(row.system_prompt);
    setUserPrompt(row.user_prompt_template);
    setModel(row.model);
  }, [row.id]);

  const save = async () => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("transcript_ai_prompts")
      .update({ system_prompt: systemPrompt, user_prompt_template: userPrompt, model })
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Prompt enregistré");
      onSaved();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{LABELS[row.kind]}</CardTitle>
        <CardDescription>
          Variables disponibles : <code>{"{{transcript}}"}</code>, <code>{"{{title}}"}</code>, <code>{"{{tags_list}}"}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label>System prompt</Label>
          <Textarea rows={5} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>User prompt (template)</Label>
          <Textarea rows={8} value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Modèle</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="claude-sonnet-4-6" />
        </div>
        <Button size="sm" onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </CardContent>
    </Card>
  );
}

function TagsEditor() {
  const qc = useQueryClient();
  const [tags, setTags] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["supertilt_content_tags_admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("setting_value")
        .eq("setting_key", "supertilt_content_tags")
        .maybeSingle();
      try {
        const v = data?.setting_value as unknown;
        if (Array.isArray(v)) return v as string[];
        return JSON.parse((v as string) ?? "[]") as string[];
      } catch {
        return [] as string[];
      }
    },
  });

  useEffect(() => { if (data) setTags(data); }, [data]);

  const persist = async (next: string[]) => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ setting_key: "supertilt_content_tags", setting_value: JSON.stringify(next) as any }, { onConflict: "setting_key" });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      qc.invalidateQueries({ queryKey: ["supertilt_content_tags"] });
      qc.invalidateQueries({ queryKey: ["supertilt_content_tags_admin"] });
    }
  };

  const add = async () => {
    const t = input.trim().toLowerCase();
    if (!t || tags.includes(t)) return;
    const next = [...tags, t];
    setTags(next);
    setInput("");
    await persist(next);
  };

  const remove = async (t: string) => {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    await persist(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Domaines Supertilt (tags)</CardTitle>
        <CardDescription>Liste utilisée par l'IA pour tagger les contenus générés.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1">
              {t}
              <button onClick={() => remove(t)} className="hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Ajouter un domaine…"
          />
          <Button size="sm" onClick={add} disabled={saving}>
            <Plus className="h-4 w-4 mr-1" />Ajouter
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TranscriptPromptsSettings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["transcript_ai_prompts_admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("transcript_ai_prompts")
        .select("*")
        .order("kind");
      if (error) throw error;
      return data as PromptRow[];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  return (
    <div className="space-y-4">
      <TagsEditor />
      <LmsAudioPromptSettings />
      {data?.map((row) => (
        <PromptCard key={row.id} row={row} onSaved={() => qc.invalidateQueries({ queryKey: ["transcript_ai_prompts_admin"] })} />
      ))}
    </div>
  );
}
