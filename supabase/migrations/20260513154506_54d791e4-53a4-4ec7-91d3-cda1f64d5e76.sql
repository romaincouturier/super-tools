CREATE TABLE public.transcript_ai_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL UNIQUE CHECK (kind IN ('blog_article','linkedin_post')),
  system_prompt text NOT NULL DEFAULT '',
  user_prompt_template text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT 'claude-sonnet-4-6',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transcript_ai_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read transcript prompts" ON public.transcript_ai_prompts
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins write transcript prompts" ON public.transcript_ai_prompts
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_transcript_ai_prompts_updated_at
  BEFORE UPDATE ON public.transcript_ai_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.transcript_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id uuid NOT NULL REFERENCES public.transcripts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('blog_article','linkedin_post')),
  content text NOT NULL DEFAULT '',
  title_suggestion text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  model text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_transcript_generations_transcript ON public.transcript_generations(transcript_id);

ALTER TABLE public.transcript_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read transcript generations"
  ON public.transcript_generations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert transcript generations"
  ON public.transcript_generations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by OR public.is_admin(auth.uid()));
CREATE POLICY "Authors or admins update transcript generations"
  ON public.transcript_generations FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin(auth.uid()))
  WITH CHECK (auth.uid() = created_by OR public.is_admin(auth.uid()));
CREATE POLICY "Authors or admins delete transcript generations"
  ON public.transcript_generations FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.is_admin(auth.uid()));

CREATE TRIGGER trg_transcript_generations_updated_at
  BEFORE UPDATE ON public.transcript_generations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.transcript_ai_prompts (kind, system_prompt, user_prompt_template, model) VALUES
('blog_article',
 'Tu es un rédacteur expert pour SuperTilt, un organisme de formation spécialisé dans l''organisation du travail, l''intelligence collective, l''intelligence artificielle et la facilitation graphique. Tu écris en français, ton ton est clair, incarné, accessible mais expert. Tu structures avec un titre accrocheur, une introduction, des sous-titres H2, et une conclusion.',
 'À partir de la transcription suivante (titre : {{title}}), propose un article de blog complet en markdown.

Domaines Supertilt disponibles pour le tagging : {{tags_list}}.
Choisis 1 à 3 tags pertinents parmi cette liste uniquement.

TRANSCRIPTION :
{{transcript}}',
 'claude-sonnet-4-6'),
('linkedin_post',
 'Tu es un expert LinkedIn pour SuperTilt. Tu écris des posts engageants en français : accroche forte en 1ère ligne, format aéré, émojis pertinents avec parcimonie, question ou appel à l''action en fin. 1300 caractères max.',
 'À partir de la transcription suivante (titre : {{title}}), propose un post LinkedIn percutant.

Domaines Supertilt disponibles pour le tagging : {{tags_list}}.
Choisis 1 à 3 tags pertinents parmi cette liste uniquement.

TRANSCRIPTION :
{{transcript}}',
 'claude-sonnet-4-6');

INSERT INTO public.app_settings (setting_key, setting_value)
VALUES ('supertilt_content_tags', '["organisation du travail","intelligence collective","intelligence artificielle","facilitation graphique"]')
ON CONFLICT (setting_key) DO NOTHING;