-- Agent — passage de l'assistant réactif au système qui poursuit un objectif.
--
-- Cible : « un système capable d'atteindre un objectif avec une supervision
-- limitée, en s'appuyant sur des agents IA et des outils ».
--
-- Le constat de départ est que la flotte d'outils existe déjà : 224 edge
-- functions, dont 36 d'analyse ou de génération IA et 21 processeurs cron.
-- Ce sont déjà des agents à tâche unique, mais chacun tourne dans son coin et
-- l'agent SuperTools ignore leur existence. Ce qui manque n'est pas de l'IA,
-- c'est la couche qui donne un but, déclenche, trace et permet de défaire.
--
-- Quatre tables :
--   agent_objectives      — un but qui survit à la conversation (AG-30)
--   agent_action_log      — ce que l'agent a fait seul, et comment l'annuler (AG-32)
--   agent_autonomy_policy — ce qu'il a le droit de faire seul (AG-34)
--   agent_memory          — ce qu'il retient d'une conversation à l'autre (AG-12)

-- ── AG-30 : objectifs persistants ────────────────────────────
--
-- L'unité de travail était la conversation : elle naît, elle meurt, rien ne
-- survit. Un objectif porte son critère de fin et le journal de ce qui a déjà
-- été tenté, pour ne pas refaire et ne pas boucler.

CREATE TABLE IF NOT EXISTS public.agent_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL CHECK (domain IN ('facilitateur', 'contenus', 'commerce', 'transformation')),
  title text NOT NULL,
  -- Critère de fin en langage naturel : ce qui permet de dire « atteint ».
  criterion text NOT NULL,
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'paused', 'met', 'failed')),
  -- Portée facultative : un objectif peut viser une entité précise.
  entity_type text,
  entity_id uuid,
  -- Réglage du rythme, en heures, pour ne pas rejouer un objectif à chaque tick.
  cadence_hours int NOT NULL DEFAULT 24,
  last_run_at timestamptz,
  last_result text,
  run_count int NOT NULL DEFAULT 0,
  -- Ce qui a déjà été tenté et produit, pour que le prochain passage sache.
  attempts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_objectives_due
  ON public.agent_objectives (state, last_run_at)
  WHERE state = 'active';

ALTER TABLE public.agent_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_objectives_service_role_all" ON public.agent_objectives
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "agent_objectives_select" ON public.agent_objectives
  FOR SELECT TO authenticated USING (true);

-- ── AG-32 : journal d'actions autonomes et réversibilité ─────
--
-- Condition non négociable de l'autonomie : agent_query_audit_log couvre les
-- lectures, rien ne couvrait les écritures. `before_state` rend l'annulation
-- possible sans avoir à deviner l'état antérieur.

CREATE TABLE IF NOT EXISTS public.agent_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id uuid REFERENCES public.agent_objectives(id) ON DELETE SET NULL,
  domain text,
  action text NOT NULL,
  -- Cible de l'écriture, pour pouvoir relire et défaire.
  target_table text,
  target_id uuid,
  before_state jsonb,
  after_state jsonb,
  -- Pourquoi l'agent a jugé cette action nécessaire.
  rationale text,
  autonomy_level text NOT NULL DEFAULT 'auto' CHECK (autonomy_level IN ('auto', 'notify', 'confirm')),
  succeeded boolean NOT NULL DEFAULT true,
  error_message text,
  reverted_at timestamptz,
  reverted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_action_log_recent
  ON public.agent_action_log (created_at DESC);

ALTER TABLE public.agent_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_action_log_service_role_all" ON public.agent_action_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "agent_action_log_select" ON public.agent_action_log
  FOR SELECT TO authenticated USING (true);

-- ── AG-34 : politique d'autonomie ────────────────────────────
--
-- Le prompt imposait une confirmation explicite avant TOUTE écriture, ce qui
-- est frontalement incompatible avec « supervision limitée ». La règle unique
-- devient une table, modifiable sans redéploiement.
--
-- Valeurs de départ, à ajuster : autonomie totale sur ce qui reste interne à
-- SuperTools, confirmation dès qu'un tiers reçoit quelque chose ou qu'un
-- montant change. Le choix appartient à l'utilisateur, pas au code.

CREATE TABLE IF NOT EXISTS public.agent_autonomy_policy (
  action text PRIMARY KEY,
  level text NOT NULL CHECK (level IN ('auto', 'notify', 'confirm')),
  reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_autonomy_policy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_autonomy_policy_service_role_all" ON public.agent_autonomy_policy
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "agent_autonomy_policy_select" ON public.agent_autonomy_policy
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.agent_autonomy_policy (action, level, reason) VALUES
  -- Interne à SuperTools, réversible, aucun tiers : l'agent agit seul.
  ('add_mission_page',      'auto',    'Contenu interne, réversible, aucun tiers destinataire'),
  ('save_mission_note',     'auto',    'Contenu interne produit par l''agent'),
  ('add_content_card',      'auto',    'Brouillon éditorial interne, rien n''est publié'),
  ('add_crm_comment',       'auto',    'Note interne sur une opportunité'),
  ('add_support_note',      'auto',    'Note interne sur un ticket'),
  -- Modifie un état visible dans l'application : fait, puis notifié.
  ('update_mission',        'notify',  'Change l''état d''une mission, notamment son action datée'),
  ('update_crm_card',       'notify',  'Change l''état d''une opportunité'),
  ('move_crm_card',         'notify',  'Déplace une opportunité dans le pipeline'),
  ('update_mission_status', 'notify',  'Change le statut d''une mission'),
  ('update_ticket_status',  'notify',  'Change le statut d''un ticket'),
  -- Engage l'utilisateur vis-à-vis d'un tiers, ou touche un montant.
  ('update_quote_status',   'confirm', 'Un devis engage commercialement'),
  ('send_email',            'confirm', 'Un envoi est irréversible et engage la signature de l''utilisateur'),
  ('update_amount',         'confirm', 'Toute modification de montant')
ON CONFLICT (action) DO NOTHING;

COMMENT ON TABLE public.agent_autonomy_policy IS
  'Ce que l''agent a le droit de faire sans demander. auto = agit seul, '
  'notify = agit puis signale, confirm = demande avant. Modifiable sans déploiement.';

-- ── AG-12 : mémoire entre conversations ──────────────────────
--
-- Rien ne persistait d'une conversation à l'autre, hors le contexte métier
-- statique d'app_settings. Une mémoire n'a de valeur que si elle est bornée :
-- peu d'entrées, datées, remplaçables, et jamais de donnée sensible.

CREATE TABLE IF NOT EXISTS public.agent_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Clé stable : réapprendre un fait le remplace au lieu de l'empiler.
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  -- 'fait' (durable), 'preference' (façon de travailler), 'contexte' (périssable)
  kind text NOT NULL DEFAULT 'fait' CHECK (kind IN ('fait', 'preference', 'contexte')),
  source text,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  -- Au-delà, l'entrée n'est plus injectée dans le prompt.
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_live
  ON public.agent_memory (kind, confirmed_at DESC);

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_memory_service_role_all" ON public.agent_memory
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "agent_memory_select" ON public.agent_memory
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.agent_memory IS
  'Mémoire longue de l''agent : faits et préférences réutilisables, bornés et '
  'datés. Une clé unique par fait, pour remplacer au lieu d''empiler.';

-- ── Objectifs de départ, un par métier ───────────────────────
--
-- Créés en pause : ils décrivent la cible sans rien déclencher tant que
-- l'utilisateur n'a pas décidé du niveau d'autonomie qui lui convient.

INSERT INTO public.agent_objectives (domain, title, criterion, state, cadence_hours)
VALUES
  ('facilitateur',
   'Chaque atelier produit sa synthèse',
   'Toute mission ayant des photos d''atelier ou un transcript possède une note de synthèse à jour.',
   'paused', 6),
  ('contenus',
   'Le pipeline éditorial ne se vide jamais',
   'Au moins 5 cartes de contenu prêtes, et chaque transcript exploitable a produit une proposition.',
   'paused', 24),
  ('commerce',
   'Aucune opportunité ne dort',
   'Toute opportunité active a une action datée à venir, ou un brouillon de relance prêt.',
   'paused', 24),
  ('transformation',
   'Chaque mission a un livrable à jour et un budget maîtrisé',
   'Aucune mission en cours ne dépasse son budget sans alerte, ni ne reste sans activité depuis plus de 21 jours.',
   'paused', 24)
ON CONFLICT DO NOTHING;

-- ── Vue de rendu de compte ───────────────────────────────────

CREATE OR REPLACE VIEW public.agent_daily_digest AS
  SELECT
    date_trunc('day', l.created_at) AS day,
    l.domain,
    l.action,
    count(*) AS actions,
    count(*) FILTER (WHERE NOT l.succeeded) AS failures,
    count(*) FILTER (WHERE l.reverted_at IS NOT NULL) AS reverted
  FROM public.agent_action_log l
  GROUP BY 1, 2, 3
  ORDER BY 1 DESC, 4 DESC;

COMMENT ON VIEW public.agent_daily_digest IS
  'Rendu de compte quotidien des actions autonomes de l''agent.';

-- ── AG-31 : déclenchement événementiel ───────────────────────
--
-- L'agent ne s'exécutait que quand quelqu'un tapait. Un dépôt de photos sur
-- une mission rend l'objectif « facilitateur » immédiatement dû : on remet
-- last_run_at à NULL plutôt que d'attendre la fin de la cadence.
--
-- Pas d'appel HTTP depuis SQL ici : la règle [036] proscrit
-- vault.decrypted_secrets dans les migrations versionnées. Le tick périodique
-- est posé directement en base, documenté dans docs/agent-autonomy.md.

CREATE OR REPLACE FUNCTION public.wake_agent_objective()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.agent_objectives
     SET last_run_at = NULL
   WHERE domain = TG_ARGV[0]
     AND state = 'active';
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.wake_agent_objective() IS
  'Rend immédiatement dû l''objectif du métier passé en argument, sur événement métier.';

DROP TRIGGER IF EXISTS wake_facilitateur_on_media ON public.media;
CREATE TRIGGER wake_facilitateur_on_media
  AFTER INSERT ON public.media
  FOR EACH ROW
  WHEN (NEW.source_type = 'mission')
  EXECUTE FUNCTION public.wake_agent_objective('facilitateur');

DROP TRIGGER IF EXISTS wake_contenus_on_transcript ON public.transcripts;
CREATE TRIGGER wake_contenus_on_transcript
  AFTER INSERT ON public.transcripts
  FOR EACH ROW
  EXECUTE FUNCTION public.wake_agent_objective('contenus');
