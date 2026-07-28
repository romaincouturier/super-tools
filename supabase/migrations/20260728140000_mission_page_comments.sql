-- Commentaires clients sur les pages livrables partagées (/mission-info/:missionId)
--
-- Identité : le lien de livraison est personnalisé par destinataire
-- (?c=<access_token>), le token identifie une ligne mission_contacts.
-- Aucun formulaire d'identité côté public.
--
-- Écritures : uniquement via l'edge function `mission-page-comment`
-- (service_role). Aucune policy anon en écriture, aucune policy anon
-- `USING (true)` — règle [009].

-- ── 1. Toggle « commentaires autorisés » par page livrable ───────────

ALTER TABLE public.mission_pages
  ADD COLUMN IF NOT EXISTS comments_enabled boolean NOT NULL DEFAULT false;

-- ── 2. Token d'accès par contact de mission ──────────────────────────

ALTER TABLE public.mission_contacts
  ADD COLUMN IF NOT EXISTS access_token text;

UPDATE public.mission_contacts
  SET access_token = encode(gen_random_bytes(16), 'hex')
  WHERE access_token IS NULL;

ALTER TABLE public.mission_contacts
  ALTER COLUMN access_token SET DEFAULT encode(gen_random_bytes(16), 'hex');

ALTER TABLE public.mission_contacts
  ALTER COLUMN access_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mission_contacts_access_token
  ON public.mission_contacts(access_token);

-- ── 3. Commentaires ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mission_page_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  page_id uuid NOT NULL REFERENCES public.mission_pages(id) ON DELETE CASCADE,
  -- NULL = commentaire racine (ouvre un fil), sinon réponse dans le fil
  parent_comment_id uuid REFERENCES public.mission_page_comments(id) ON DELETE CASCADE,
  -- Empreinte du bloc commenté, calculée à partir de son texte (voir
  -- src/lib/missionPageBlocks.ts). NULL = commentaire de page.
  block_id text,
  -- Texte du bloc au moment du commentaire : sert de citation quand la page
  -- est réécrite et que le bloc d'origine n'existe plus.
  quoted_text text,
  author_contact_id uuid REFERENCES public.mission_contacts(id) ON DELETE SET NULL,
  author_user_id uuid,
  author_name text NOT NULL,
  author_email text,
  is_staff boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  is_resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mission_page_comments_page
  ON public.mission_page_comments(page_id) WHERE NOT is_deleted;

CREATE INDEX IF NOT EXISTS idx_mission_page_comments_mission
  ON public.mission_page_comments(mission_id) WHERE NOT is_deleted;

CREATE INDEX IF NOT EXISTS idx_mission_page_comments_parent
  ON public.mission_page_comments(parent_comment_id);

ALTER TABLE public.mission_page_comments ENABLE ROW LEVEL SECURITY;

-- Le staff connecté lit et modère depuis l'app (règle [039] : le rôle
-- `authenticated` doit toujours conserver un chemin de lecture).
CREATE POLICY "Authenticated users can view mission page comments"
  ON public.mission_page_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can update mission page comments"
  ON public.mission_page_comments FOR UPDATE
  TO authenticated
  USING (true);

-- ── 4. Lecture publique ──────────────────────────────────────────────

-- Le contact identifié par son token (lien reçu par email).
CREATE OR REPLACE FUNCTION public.get_mission_contact_by_token(p_token text)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'id', id,
    'mission_id', mission_id,
    'first_name', first_name,
    'last_name', last_name,
    'email', email
  )
  FROM mission_contacts
  WHERE access_token = p_token
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_mission_contact_by_token(text) TO anon, authenticated, service_role;

-- Pages livrables : on expose désormais le toggle de commentaires.
CREATE OR REPLACE FUNCTION public.get_mission_pages_public_deliverables(p_mission_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', id,
        'title', title,
        'icon', icon,
        'content', content,
        'comments_enabled', comments_enabled,
        'created_at', created_at
      )
      ORDER BY created_at
    ),
    '[]'::json
  )
  FROM mission_pages
  WHERE mission_id = p_mission_id
    AND is_deliverable = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_mission_pages_public_deliverables(uuid) TO anon, authenticated, service_role;

-- Commentaires visibles par tous les visiteurs du lien : uniquement ceux des
-- pages livrables où les commentaires sont activés. L'email des auteurs n'est
-- pas exposé.
CREATE OR REPLACE FUNCTION public.get_mission_page_comments_public(p_mission_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', c.id,
        'page_id', c.page_id,
        'parent_comment_id', c.parent_comment_id,
        'block_id', c.block_id,
        'quoted_text', c.quoted_text,
        'author_name', c.author_name,
        'author_contact_id', c.author_contact_id,
        'is_staff', c.is_staff,
        'body', c.body,
        'is_resolved', c.is_resolved,
        'created_at', c.created_at
      )
      ORDER BY c.created_at
    ),
    '[]'::json
  )
  FROM mission_page_comments c
  JOIN mission_pages p ON p.id = c.page_id
  WHERE c.mission_id = p_mission_id
    AND NOT c.is_deleted
    AND p.is_deliverable = true
    AND p.comments_enabled = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_mission_page_comments_public(uuid) TO anon, authenticated, service_role;

-- ── 5. Durcissement : plus d'accès anon direct aux tables missions ────
--
-- Ces deux policies dataient d'avant la bascule vers les RPC SECURITY DEFINER
-- (migration 20260308202024) et n'avaient pas été supprimées : elles laissaient
-- lire TOUTES les missions et TOUTES les activités à n'importe quel visiteur
-- anonyme, pas seulement celles dont il connaît l'UUID. La page publique
-- /mission-info ne lit que par RPC, elles ne servent plus.

DROP POLICY IF EXISTS "Public can view missions by id" ON public.missions;
DROP POLICY IF EXISTS "Public can view mission activities" ON public.mission_activities;
