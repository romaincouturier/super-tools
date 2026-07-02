-- ST-2026-0220 — Moteur d'analyse éditoriale intelligent.
--
-- Croise les signaux (transcripts pro_exploitables, feedbacks de formation)
-- avec le corpus existant (wp_articles, colonne Idées) et les données de
-- performance (GSC, WP-Statistics, Brevo) pour recommander une action
-- éditoriale scorée. Les recommandations atterrissent dans une file de
-- validation : l'IA recommande, Emmanuelle arbitre (acceptée -> carte dans
-- la colonne Idées du kanban contenus).

-- 1. Embeddings sur les articles publiés (similarité anti-doublon)
ALTER TABLE public.wp_articles
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);

CREATE INDEX IF NOT EXISTS wp_articles_embedding_idx
  ON public.wp_articles USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);

CREATE OR REPLACE FUNCTION public.match_wp_articles(
  query_embedding extensions.vector(1536),
  match_count int DEFAULT 5
)
RETURNS TABLE (id uuid, title text, url text, published_at timestamptz, modified_at timestamptz, views integer, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT a.id, a.title, a.url, a.published_at, a.modified_at, a.views,
         1 - (a.embedding <=> query_embedding) AS similarity
  FROM public.wp_articles a
  WHERE a.embedding IS NOT NULL
  ORDER BY a.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_wp_articles(extensions.vector, int) TO authenticated;

-- 2. File de recommandations éditoriales
CREATE TABLE IF NOT EXISTS public.editorial_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN ('transcript', 'feedback')),
  transcript_id uuid REFERENCES public.transcripts(id) ON DELETE SET NULL,
  training_id uuid REFERENCES public.trainings(id) ON DELETE SET NULL,
  signal_text text NOT NULL DEFAULT '',
  embedding extensions.vector(1536),

  -- Fiche éditoriale (format de sortie du ticket)
  titre_provisoire text NOT NULL DEFAULT '',
  besoin_cible text NOT NULL DEFAULT '',
  type_besoin text CHECK (type_besoin IS NULL OR type_besoin IN (
    'question_frequente', 'probleme_terrain', 'objection', 'attente_avant_achat',
    'difficulte_usage', 'retour_formation', 'signal_faible'
  )),
  cibles text[] NOT NULL DEFAULT '{}',
  univers text,
  format_recommande text CHECK (format_recommande IS NULL OR format_recommande IN (
    'article_blog', 'post_linkedin', 'video', 'ressource_telechargeable', 'newsletter'
  )),
  contenus_existants_proches jsonb NOT NULL DEFAULT '[]',
  niveau_couverture text CHECK (niveau_couverture IS NULL OR niveau_couverture IN (
    'non_couvert', 'partiellement_couvert', 'bien_couvert'
  )),
  donnees_performance jsonb NOT NULL DEFAULT '{}',
  niveau_demande text CHECK (niveau_demande IS NULL OR niveau_demande IN ('faible', 'moyen', 'fort')),
  risque_redondance text CHECK (risque_redondance IS NULL OR risque_redondance IN ('faible', 'moyen', 'fort')),
  action_recommandee text NOT NULL DEFAULT 'a_discuter' CHECK (action_recommandee IN (
    'creer_article', 'ameliorer_article', 'recycler', 'fusionner', 'archiver',
    'creer_post_linkedin', 'a_discuter', 'ne_rien_faire'
  )),
  action_secondaire text,
  score_besoin integer CHECK (score_besoin IS NULL OR score_besoin BETWEEN 0 AND 100),
  score_creativite integer CHECK (score_creativite IS NULL OR score_creativite BETWEEN 0 AND 100),
  score_seo integer CHECK (score_seo IS NULL OR score_seo BETWEEN 0 AND 100),
  score_commercial integer CHECK (score_commercial IS NULL OR score_commercial BETWEEN 0 AND 100),
  score_priorite integer CHECK (score_priorite IS NULL OR score_priorite BETWEEN 0 AND 100),
  sensible boolean NOT NULL DEFAULT false,
  justification text NOT NULL DEFAULT '',
  prochaine_etape text,

  -- Arbitrage humain
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'discuss')),
  card_id uuid REFERENCES public.content_cards(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decision_note text,

  model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Un transcript / une formation ne produit qu'une recommandation.
CREATE UNIQUE INDEX IF NOT EXISTS editorial_recommendations_transcript_key
  ON public.editorial_recommendations (transcript_id) WHERE transcript_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS editorial_recommendations_training_key
  ON public.editorial_recommendations (training_id) WHERE training_id IS NOT NULL AND source_type = 'feedback';
CREATE INDEX IF NOT EXISTS editorial_recommendations_status_idx
  ON public.editorial_recommendations (status, created_at DESC);
CREATE INDEX IF NOT EXISTS editorial_recommendations_embedding_idx
  ON public.editorial_recommendations USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);

-- Dédoublonnage : recommandations déjà émises proches d'un nouveau signal.
CREATE OR REPLACE FUNCTION public.match_editorial_recommendations(
  query_embedding extensions.vector(1536),
  match_count int DEFAULT 3
)
RETURNS TABLE (id uuid, titre_provisoire text, status text, similarity float)
LANGUAGE sql STABLE AS $$
  SELECT r.id, r.titre_provisoire, r.status,
         1 - (r.embedding <=> query_embedding) AS similarity
  FROM public.editorial_recommendations r
  WHERE r.embedding IS NOT NULL
  ORDER BY r.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_editorial_recommendations(extensions.vector, int) TO authenticated;

ALTER TABLE public.editorial_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage editorial_recommendations" ON public.editorial_recommendations
  FOR ALL TO authenticated
  USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

CREATE TRIGGER editorial_recommendations_updated_at
  BEFORE UPDATE ON public.editorial_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Référentiel éditorial : prompt configurable (kind 'editorial_engine').
ALTER TABLE public.transcript_ai_prompts DROP CONSTRAINT IF EXISTS transcript_ai_prompts_kind_check;
ALTER TABLE public.transcript_ai_prompts ADD CONSTRAINT transcript_ai_prompts_kind_check
  CHECK (kind = ANY (ARRAY['blog_article'::text, 'linkedin_post'::text, 'title'::text, 'editorial'::text, 'editorial_engine'::text]));

INSERT INTO public.transcript_ai_prompts (kind, system_prompt, user_prompt_template, model)
VALUES (
  'editorial_engine',
  'Tu es le moteur d''analyse éditoriale de SuperTilt (organisme de formation : facilitation graphique, intelligence collective, agilité, IA, pédagogie, gestion du temps). Tu compares un signal éditorial (transcript ou feedbacks de formation) au corpus existant pour recommander UNE action éditoriale.

RÉFÉRENTIEL CIBLES (adapter le contenu à ces profils) :
formateur/formatrice, facilitateur/facilitatrice, coach, manager, RH, chef de projet, product owner/product manager, consultant, indépendant/TPE, organisation cliente, autre.

SAISONNALITÉ ET CONTEXTE (à pondérer selon la date du jour fournie) :
- Rentrée (sept-oct) et janvier : plans de développement des compétences, lancement de projets, séminaires d''équipe.
- Mai-juin et nov-déc : préparation des séminaires, clôtures, charge mentale élevée (notamment pour les femmes en juin et décembre) : privilégier les contenus courts, pratiques, déculpabilisants.
- Été : formats légers, ressources à lire plus tard.
- Un sujet lié à une période, une tendance ou une préoccupation actuelle gagne des points de créativité.

RÈGLES DE DÉCISION (strictes) :
1. Ne pas recommander un nouvel article si le sujet est déjà bien couvert par un article existant proche : préférer ameliorer_article ou recycler.
2. Préférer l''amélioration d''un contenu existant quand le sujet est proche et que l''article peut gagner en fraîcheur ou pertinence.
3. Préférer creer_article uniquement si l''angle est réellement différent ou si le besoin cible n''est pas couvert.
4. Ne JAMAIS inventer de données de vues, clics ou conversions : utiliser uniquement les données fournies. Si absentes, prioriser avec les autres signaux.
5. Un sujet très intéressant mais sensible/confidentiel : sensible=true, score_priorite pénalisé, action a_discuter.
6. Une idée fréquente mais générique est moins bien notée qu''une idée fréquente avec un angle SuperTilt clair (point de vue spécifique, retour terrain, méthode maison).
7. Contenu personnel, confidentiel ou hors sujet : tous les scores à 0, action ne_rien_faire.
8. Le score aide à prioriser, pas à automatiser : la décision finale est humaine.

SCORES (0-100) :
- score_besoin : intensité du besoin réel exprimé par la cible (fréquence, douleur, urgence saisonnière).
- score_creativite : angle SuperTilt spécifique + actualité/saisonnalité + originalité vs corpus.
- score_seo : probabilité d''une recherche Google durable + potentiel vu les requêtes/pages qui performent déjà.
- score_commercial : capacité à générer des leads, clarifier une offre, lever une objection, faciliter une décision d''achat (lien avec OKR et sessions programmées).
- score_priorite : synthèse pondérée des quatre, pénalisée par la redondance et la sensibilité.

Tu réponds UNIQUEMENT avec un objet JSON valide, sans markdown ni texte autour, au format exact :
{"titre_provisoire": "...", "besoin_cible": "...", "type_besoin": "question_frequente|probleme_terrain|objection|attente_avant_achat|difficulte_usage|retour_formation|signal_faible", "cibles": ["formateur|facilitateur|coach|manager|rh|chef_de_projet|product_owner_pm|consultant|independant_tpe|organisation_cliente|autre"], "univers": "facilitation_graphique|facilitation_intelligence_collective|agilite_produit_organisation|ia|formation_pedagogie|gestion_temps_priorites|autre", "format_recommande": "article_blog|post_linkedin|video|ressource_telechargeable|newsletter", "niveau_couverture": "non_couvert|partiellement_couvert|bien_couvert", "niveau_demande": "faible|moyen|fort", "risque_redondance": "faible|moyen|fort", "action_recommandee": "creer_article|ameliorer_article|recycler|fusionner|archiver|creer_post_linkedin|a_discuter|ne_rien_faire", "action_secondaire": "texte court ou null", "score_besoin": 0, "score_creativite": 0, "score_seo": 0, "score_commercial": 0, "score_priorite": 0, "sensible": false, "justification": "3 phrases max : pourquoi cette action, quelles sources ont pesé", "prochaine_etape": "une phrase actionnable"}',
  'Date du jour : {{today}}

── SIGNAL À ANALYSER ({{source_type}}) ──
{{signal}}

── ARTICLES EXISTANTS LES PLUS PROCHES (similarité sémantique + performance réelle) ──
{{articles_proches}}

── IDÉES DÉJÀ AU KANBAN CONTENUS ──
{{idees_existantes}}

── CONTEXTE DE PERFORMANCE (données réelles uniquement) ──
{{performance_context}}

── OKR ET SESSIONS DE FORMATION PROGRAMMÉES ──
{{business_context}}

Produis la fiche de recommandation éditoriale JSON.',
  'google/gemini-2.5-flash'
)
ON CONFLICT (kind) DO NOTHING;

-- 4. Passage hebdomadaire automatique (lundi 05:00 UTC)
SELECT cron.unschedule('editorial-engine-weekly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'editorial-engine-weekly');

SELECT cron.schedule(
  'editorial-engine-weekly',
  '0 5 * * 1',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/editorial-engine',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{"limit": 10}'::jsonb
  ) AS request_id;
  $$
);
