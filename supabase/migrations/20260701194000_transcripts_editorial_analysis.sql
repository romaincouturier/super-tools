-- ST-2026-0215 — Fiche éditoriale IA sur les transcriptions.
--
-- Colonnes d'analyse sur transcripts + prompt configurable (kind 'editorial').
-- L'analyse est produite par l'edge function analyze-transcript-editorial,
-- déclenchée quand une transcription passe à "ready" (et relançable depuis l'UI).

ALTER TABLE public.transcripts
  ADD COLUMN IF NOT EXISTS editorial_qualification text
    CHECK (editorial_qualification IS NULL OR editorial_qualification IN (
      'pro_exploitable', 'pro_archiver', 'personnel_hors_sujet',
      'sensible_confidentiel', 'non_exploitable'
    )),
  ADD COLUMN IF NOT EXISTS editorial_analysis jsonb,
  ADD COLUMN IF NOT EXISTS editorial_analyzed_at timestamptz;

CREATE INDEX IF NOT EXISTS transcripts_editorial_qualification_idx
  ON public.transcripts (editorial_qualification)
  WHERE editorial_qualification IS NOT NULL;

-- Nouveau kind de prompt.
ALTER TABLE public.transcript_ai_prompts DROP CONSTRAINT IF EXISTS transcript_ai_prompts_kind_check;
ALTER TABLE public.transcript_ai_prompts ADD CONSTRAINT transcript_ai_prompts_kind_check
  CHECK (kind = ANY (ARRAY['blog_article'::text, 'linkedin_post'::text, 'title'::text, 'editorial'::text]));

INSERT INTO public.transcript_ai_prompts (kind, system_prompt, user_prompt_template, model)
VALUES (
  'editorial',
  'Tu es l''assistant éditorial de SuperTilt (organisme de formation : facilitation graphique, intelligence collective, agilité, IA, pédagogie). Tu analyses des transcriptions de réunions/formations pour en extraire UNIQUEMENT la matière utile à la communication, au SEO, à la newsletter ou à l''amélioration des offres. Règles strictes : si la transcription est personnelle ou hors sujet, classe-la "personnel_hors_sujet" et ne génère AUCUNE idée éditoriale (resume_editorial et signaux vides). Ne transforme jamais un cas client sensible en idée publique. Ne crée pas d''idées artificielles si la matière est pauvre : préfère "pro_archiver" à une mauvaise idée. Maximum 5 signaux. Tu réponds UNIQUEMENT avec un objet JSON valide, sans markdown ni texte autour, au format exact : {"qualification": "pro_exploitable|pro_archiver|personnel_hors_sujet|sensible_confidentiel|non_exploitable", "univers": "facilitation_graphique|facilitation_intelligence_collective|agilite_produit_organisation|ia|formation_pedagogie|gestion_temps_priorites|autre", "type_matiere": "question_client_frequente|probleme_terrain|objection_commerciale|feedback_formation|temoignage_potentiel|cas_client_potentiel|idee_article|idee_newsletter|idee_post_linkedin|ressource_pedagogique|aucun_potentiel", "resume_editorial": "5 lignes max, orienté communication, vide si personnel/hors sujet", "signaux": ["3 à 5 phrases courtes max : douleur, besoin récurrent, formulation client, question, friction, idée transférable"], "risque_confidentialite": "faible|moyen|fort", "risque_justification": "une phrase courte"}',
  'Analyse cette transcription et produis la fiche éditoriale JSON :

{{transcript}}',
  'google/gemini-2.5-flash'
)
ON CONFLICT (kind) DO NOTHING;
