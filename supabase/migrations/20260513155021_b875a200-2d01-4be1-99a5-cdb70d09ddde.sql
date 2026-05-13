
ALTER TABLE public.transcripts ADD COLUMN IF NOT EXISTS ai_title text;

ALTER TABLE public.transcript_ai_prompts DROP CONSTRAINT IF EXISTS transcript_ai_prompts_kind_check;
ALTER TABLE public.transcript_ai_prompts ADD CONSTRAINT transcript_ai_prompts_kind_check
  CHECK (kind = ANY (ARRAY['blog_article'::text, 'linkedin_post'::text, 'title'::text]));

INSERT INTO public.transcript_ai_prompts (kind, system_prompt, user_prompt_template, model)
VALUES (
  'title',
  'Tu génères un titre court (6 à 10 mots maximum) en français qui résume le sujet principal d''une transcription. Réponds uniquement par le titre, sans guillemets, sans ponctuation finale, sans préfixe type "Titre :". Ton neutre, descriptif et explicite.',
  'Voici le début de la transcription :

{{transcript}}

Génère un titre court et explicite.',
  'google/gemini-2.5-flash'
)
ON CONFLICT (kind) DO NOTHING;
