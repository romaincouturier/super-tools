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

-- Isolation apprenant (migration 20260529100000) : la policy SELECT ci-dessus
-- est permissive pour tout `authenticated`, ce qui inclut les apprenants du
-- LMS. La policy RESTRICTIVE ci-dessous est ce qui les exclut réellement,
-- comme sur crm_cards et les autres tables métier. Sans elle, un apprenant
-- connecté lirait les appels d'offres.
DROP POLICY IF EXISTS staff_only_select ON public.tender_opportunities;
CREATE POLICY staff_only_select ON public.tender_opportunities
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.is_staff_user());

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

-- ── Tag CRM ──────────────────────────────────────────────────
-- Les appels d'offres restent dans le pipeline commercial commun : ce tag est
-- ce qui permet de les isoler dans les rapports, leur cycle de vie (retrait du
-- DCE, mémoire technique, attente d'attribution) n'étant pas celui du gré à gré.

INSERT INTO public.crm_tags (name, color, category)
SELECT 'Marché public', '#0ea5e9', 'origine'
WHERE NOT EXISTS (SELECT 1 FROM public.crm_tags WHERE name = 'Marché public');

-- ── Allowlist agent SQL / connecteur MCP ─────────────────────

INSERT INTO public.agent_schema_registry (table_name, description, display_order) VALUES
  (
    'tender_opportunities',
    'Appels d''offres publics détectés (BOAMP, PLACE, AWS) avant qualification. status : raw (reçu), to_review (à décider), go (promu en carte CRM), no_go (écarté, motif dans no_go_reason), expired (date limite dépassée sans décision). decision porte le titulaire sortant, le montant, la durée, la pondération des critères, les lots et l''URL du DCE.',
    170
  )
ON CONFLICT (table_name) DO NOTHING;

-- ── Écriture depuis les connecteurs ──────────────────────────
--
-- Un `upsert` PostgREST réécrit TOUTES les colonnes fournies, `status`
-- compris : la synchronisation quotidienne remettrait donc en revue un avis
-- déjà écarté, et le No Go reviendrait chaque matin. Cette fonction met à jour
-- le contenu de l'avis (un rectificatif peut prolonger la date limite) sans
-- jamais toucher à la décision humaine.

CREATE OR REPLACE FUNCTION public.upsert_tender_opportunity(
  p_source text,
  p_source_ref text,
  p_payload jsonb,
  p_initial_status text DEFAULT 'to_review'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.tender_opportunities (
    source, source_ref, source_email_id, url_avis, objet, acheteur, nature,
    type_marche, famille_libelle, code_departement, cpv_codes, dateparution,
    datelimitereponse, decision, matched_on, dedup_key, raw, parse_error, status
  )
  VALUES (
    p_source,
    p_source_ref,
    nullif(p_payload->>'source_email_id', '')::uuid,
    p_payload->>'url_avis',
    p_payload->>'objet',
    p_payload->>'acheteur',
    p_payload->>'nature',
    p_payload->>'type_marche',
    p_payload->>'famille_libelle',
    coalesce(
      (SELECT array_agg(value::text) FROM jsonb_array_elements_text(coalesce(p_payload->'code_departement', '[]'::jsonb)) AS value),
      '{}'
    ),
    coalesce(
      (SELECT array_agg(value::text) FROM jsonb_array_elements_text(coalesce(p_payload->'cpv_codes', '[]'::jsonb)) AS value),
      '{}'
    ),
    nullif(p_payload->>'dateparution', '')::date,
    nullif(p_payload->>'datelimitereponse', '')::timestamptz,
    coalesce(p_payload->'decision', '{}'::jsonb),
    coalesce(
      (SELECT array_agg(value::text) FROM jsonb_array_elements_text(coalesce(p_payload->'matched_on', '[]'::jsonb)) AS value),
      '{}'
    ),
    p_payload->>'dedup_key',
    p_payload->'raw',
    p_payload->>'parse_error',
    p_initial_status
  )
  ON CONFLICT (source, source_ref) DO UPDATE SET
    url_avis          = excluded.url_avis,
    objet             = excluded.objet,
    acheteur          = excluded.acheteur,
    nature            = excluded.nature,
    type_marche       = excluded.type_marche,
    famille_libelle   = excluded.famille_libelle,
    code_departement  = excluded.code_departement,
    cpv_codes         = excluded.cpv_codes,
    dateparution      = excluded.dateparution,
    -- Un rectificatif prolonge souvent le délai : c'est la seule raison de
    -- réécrire cette colonne.
    datelimitereponse = excluded.datelimitereponse,
    decision          = excluded.decision,
    matched_on        = excluded.matched_on,
    dedup_key         = excluded.dedup_key,
    raw               = excluded.raw,
    parse_error       = excluded.parse_error,
    updated_at        = now()
    -- status, no_go_reason, no_go_detail, reviewed_at, reviewed_by et
    -- crm_card_id sont volontairement absents : ils appartiennent à la
    -- décision humaine, une synchronisation ne les écrase jamais.
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

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

-- ── Droits sur les fonctions ─────────────────────────────────
-- Elles sont SECURITY DEFINER, donc elles contournent la RLS. Exposées telles
-- quelles par PostgREST, n'importe quel compte authentifié — apprenant compris
-- — pourrait écrire dans la table ou déclencher l'expiration. Seuls les
-- connecteurs (service_role) et le cron (postgres) en ont besoin.

REVOKE ALL ON FUNCTION public.upsert_tender_opportunity(text, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_tender_opportunity(text, text, jsonb, text) FROM anon;
REVOKE ALL ON FUNCTION public.upsert_tender_opportunity(text, text, jsonb, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_tender_opportunity(text, text, jsonb, text) TO service_role;

REVOKE ALL ON FUNCTION public.link_tender_duplicates() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_tender_duplicates() FROM anon;
REVOKE ALL ON FUNCTION public.link_tender_duplicates() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.link_tender_duplicates() TO service_role;

REVOKE ALL ON FUNCTION public.expire_tender_opportunities() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_tender_opportunities() FROM anon;
REVOKE ALL ON FUNCTION public.expire_tender_opportunities() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.expire_tender_opportunities() TO service_role;