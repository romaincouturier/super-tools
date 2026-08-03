-- Détection des appels d'offres publics (BOAMP, PLACE, AWS)
--
-- Salle d'attente entre la détection et le pipeline commercial. Rien n'entre
-- dans crm_cards sans décision humaine : le flux brut est très majoritairement
-- hors sujet et noierait un kanban qui fonctionne.
--
-- Table unique pour les trois sources plutôt qu'une par source : le scoring,
-- l'écran de revue et la promotion vers le CRM s'écrivent une seule fois.
-- Ce qui est propre au BOAMP vit dans `raw`, pas en colonnes à plat.
--
-- Voir docs/marches-publics.md.

CREATE TABLE IF NOT EXISTS public.tender_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Origine ──────────────────────────────────────────────
  source text NOT NULL,                    -- 'boamp' | 'place' | 'aws'
  source_ref text NOT NULL,                -- idweb BOAMP, référence de consultation sinon
  source_email_id uuid REFERENCES public.inbound_emails(id) ON DELETE SET NULL,
  url_avis text,

  -- ── Rapprochement inter-sources ──────────────────────────
  -- Un marché au-dessus des seuils est publié au BOAMP ET visible sur PLACE :
  -- sans clé de rapprochement, la revue affiche deux fois le même avis et le
  -- No Go doit être fait deux fois.
  dedup_key text,
  duplicate_of uuid REFERENCES public.tender_opportunities(id) ON DELETE SET NULL,

  -- ── Contenu ──────────────────────────────────────────────
  objet text,
  acheteur text,
  nature text,                             -- APPEL_OFFRE | ATTRIBUTION | RECTIFICATIF
  type_marche text,
  famille_libelle text,
  code_departement text[] NOT NULL DEFAULT '{}',
  cpv_codes text[] NOT NULL DEFAULT '{}',
  dateparution date,
  -- Souvent absente de la colonne à plat du flux BOAMP : le connecteur la
  -- retrouve dans l'avis complet avant d'écrire ici.
  datelimitereponse timestamptz,

  -- ── Aide à la décision (extraite de l'avis) ──────────────
  -- titulaire sortant, montant, durée, reconduction, pondération des critères,
  -- lots, URL du DCE, contact acheteur.
  decision jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- ── Tri ──────────────────────────────────────────────────
  matched_on text[] NOT NULL DEFAULT '{}', -- quels CPV / mots-clés ont matché
  score integer NOT NULL DEFAULT 0,

  -- ── Cycle de vie ─────────────────────────────────────────
  status text NOT NULL DEFAULT 'raw',
  no_go_reason text,
  no_go_detail text,
  reviewed_at timestamptz,
  reviewed_by text,
  crm_card_id uuid REFERENCES public.crm_cards(id) ON DELETE SET NULL,

  -- ── Brut ─────────────────────────────────────────────────
  raw jsonb,
  -- Un échec de parsing stocké plutôt qu'avalé : sinon on ne saura jamais
  -- combien d'avis passent à côté du filtre.
  parse_error text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tender_opportunities_source_ref_unique UNIQUE (source, source_ref),
  CONSTRAINT tender_opportunities_status_check
    CHECK (status IN ('raw', 'to_review', 'go', 'no_go', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_tender_opportunities_status_deadline
  ON public.tender_opportunities (status, datelimitereponse);
CREATE INDEX IF NOT EXISTS idx_tender_opportunities_dateparution
  ON public.tender_opportunities (dateparution DESC);
CREATE INDEX IF NOT EXISTS idx_tender_opportunities_dedup
  ON public.tender_opportunities (dedup_key) WHERE dedup_key IS NOT NULL;

-- ── Horodatage ───────────────────────────────────────────────

DROP TRIGGER IF EXISTS update_tender_opportunities_updated_at ON public.tender_opportunities;
CREATE TRIGGER update_tender_opportunities_updated_at
BEFORE UPDATE ON public.tender_opportunities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS ──────────────────────────────────────────────────────
-- Même périmètre que le module CRM dont l'écran dépend. Règle [044] :
-- aucune lecture de auth.users, on passe par les fonctions SECURITY DEFINER.

ALTER TABLE public.tender_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tender_opportunities_select" ON public.tender_opportunities;
CREATE POLICY "tender_opportunities_select" ON public.tender_opportunities
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tender_opportunities_insert" ON public.tender_opportunities;
CREATE POLICY "tender_opportunities_insert" ON public.tender_opportunities
  FOR INSERT TO authenticated WITH CHECK (public.has_crm_access(auth.uid()));

DROP POLICY IF EXISTS "tender_opportunities_update" ON public.tender_opportunities;
CREATE POLICY "tender_opportunities_update" ON public.tender_opportunities
  FOR UPDATE TO authenticated USING (public.has_crm_access(auth.uid()));

DROP POLICY IF EXISTS "tender_opportunities_delete" ON public.tender_opportunities;
CREATE POLICY "tender_opportunities_delete" ON public.tender_opportunities
  FOR DELETE TO authenticated USING (public.has_crm_access(auth.uid()));

-- ── Réglages du filtre ───────────────────────────────────────
-- En données et non en dur : les codes et les mots-clés bougeront à chaque
-- revue, sans déploiement.

INSERT INTO public.app_settings (setting_key, setting_value, description) VALUES
  (
    'tender_cpv_codes',
    '80000000,80500000,80510000,80511000,80522000,80532000,80533100,80530000,80570000,79400000,79411000,79419000,79822500,79951000,79952000,79998000,79311300',
    'Codes CPV surveillés sur le BOAMP, séparés par des virgules'
  ),
  (
    'tender_keywords',
    'facilitation graphique,facilitation,intelligence collective,sketchnote,scribing,co-construction,codesign,design thinking,conduite du changement,acculturation,intelligence artificielle',
    'Mots-clés recherchés dans l''objet des avis BOAMP, séparés par des virgules'
  ),
  (
    'tender_exclusions',
    'bâtiment,travaux de construction,restauration collective,transport scolaire,voirie,assainissement,nettoyage,sécurité incendie,fourniture de carburant,espaces verts',
    'Mots qui écartent un avis avant tout traitement, séparés par des virgules'
  ),
  (
    'tender_inbound_email',
    '',
    'Adresse ou sous-domaine de réception des alertes de marchés publics (ex : @inbound.supertilt.fr). Les mails reçus sur cette adresse alimentent tender_opportunities et ne peuvent JAMAIS créer de carte CRM.'
  )
ON CONFLICT (setting_key) DO NOTHING;

-- ── Allowlist agent SQL / connecteur MCP ─────────────────────

INSERT INTO public.agent_schema_registry (table_name, description, display_order) VALUES
  (
    'tender_opportunities',
    'Appels d''offres publics détectés (BOAMP, PLACE, AWS) avant qualification. status : raw (reçu), to_review (à décider), go (promu en carte CRM), no_go (écarté, motif dans no_go_reason), expired (date limite dépassée sans décision). decision porte le titulaire sortant, le montant, la durée, la pondération des critères, les lots et l''URL du DCE.',
    170
  )
ON CONFLICT (table_name) DO NOTHING;

-- ── Rapprochement inter-sources ──────────────────────────────
-- Le même marché arrive par le BOAMP et par une alerte PLACE. Sans ce
-- rapprochement, la revue affiche deux fois le même avis et le No Go doit être
-- fait deux fois : c'est ce qui tue une revue, bien avant le volume brut.
-- La ligne la plus ancienne fait référence, les suivantes pointent dessus.

CREATE OR REPLACE FUNCTION public.link_tender_duplicates()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  touched integer;
BEGIN
  WITH canonique AS (
    SELECT dedup_key, min(created_at) AS premiere
      FROM public.tender_opportunities
     WHERE dedup_key IS NOT NULL
     GROUP BY dedup_key
    HAVING count(*) > 1
  ),
  reference AS (
    SELECT t.dedup_key, min(t.id::text)::uuid AS ref_id
      FROM public.tender_opportunities t
      JOIN canonique c ON c.dedup_key = t.dedup_key AND c.premiere = t.created_at
     GROUP BY t.dedup_key
  )
  UPDATE public.tender_opportunities t
     SET duplicate_of = r.ref_id
    FROM reference r
   WHERE t.dedup_key = r.dedup_key
     AND t.id <> r.ref_id
     AND t.duplicate_of IS DISTINCT FROM r.ref_id;
  GET DIAGNOSTICS touched = ROW_COUNT;
  RETURN touched;
END;
$$;

-- ── Expiration automatique ───────────────────────────────────
-- Sans elle, la liste de revue se remplit d'avis dont la date limite est
-- passée et devient inutilisable.

CREATE OR REPLACE FUNCTION public.expire_tender_opportunities()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  touched integer;
BEGIN
  UPDATE public.tender_opportunities
     SET status = 'expired'
   WHERE status IN ('raw', 'to_review')
     AND datelimitereponse IS NOT NULL
     AND datelimitereponse < now();
  GET DIAGNOSTICS touched = ROW_COUNT;
  RETURN touched;
END;
$$;

SELECT cron.unschedule('expire-tender-opportunities')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-tender-opportunities');

SELECT cron.schedule(
  'expire-tender-opportunities',
  '15 6 * * *',
  $$SELECT public.expire_tender_opportunities();$$
);

-- Le cron d'ingestion boamp-sync appelle une edge function et porte donc un
-- secret : règle [036], il se planifie directement en base, pas ici. Le SQL
-- exact est dans docs/marches-publics.md.
