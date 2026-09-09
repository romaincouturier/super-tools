-- Journal des consultations du récit d'un signalement (indicateur 12).
--
-- Le récit nominatif d'une victime est la donnée la plus sensible de
-- l'application. Savoir qui l'a lu et quand fait partie de son traitement :
-- c'est ce qui rend une consultation opposable, et ce qu'une personne
-- concernée peut légitimement demander.
--
-- La lecture passe par `read_vhd_narrative`, qui écrit la trace avant de
-- rendre le texte — et ne journalise rien quand il n'y a pas de récit. Pour que ce ne soit pas qu'une convention, la policy de
-- `vhd_report_narratives` perd son volet SELECT : écrire et effacer restent
-- possibles, lire ne l'est plus qu'à travers la fonction. Un accès avec la
-- clé de service reste hors de portée de ce journal, qui couvre l'usage de
-- l'application, pas la base elle-même.
--
-- Additive et idempotente : une table, ses policies protégées contre le
-- rejeu, et deux fonctions. Aucune donnée existante n'est touchée.

CREATE TABLE IF NOT EXISTS public.vhd_narrative_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.vhd_reports(id) ON DELETE CASCADE,
  user_id uuid,
  accessed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vhd_narrative_access_report
  ON public.vhd_narrative_access(report_id, accessed_at DESC);

GRANT SELECT ON public.vhd_narrative_access TO authenticated;
GRANT ALL ON public.vhd_narrative_access TO service_role;

ALTER TABLE public.vhd_narrative_access ENABLE ROW LEVEL SECURITY;

-- Lecture seule pour les administrateurs. Aucune policy d'écriture : les
-- lignes ne sont posées que par la fonction SECURITY DEFINER ci-dessous, donc
-- personne ne peut fabriquer ni retirer une trace depuis l'application.
DROP POLICY IF EXISTS vhd_narrative_access_read ON public.vhd_narrative_access;
CREATE POLICY vhd_narrative_access_read ON public.vhd_narrative_access
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

/**
 * Rend le récit d'un signalement et journalise la consultation.
 *
 * L'écriture du journal précède la lecture : si elle échoue, la fonction
 * échoue et le texte n'est pas rendu.
 */
CREATE OR REPLACE FUNCTION public.read_vhd_narrative(p_report_id uuid)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_narrative text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  SELECT narrative INTO v_narrative
  FROM public.vhd_report_narratives
  WHERE report_id = p_report_id;

  -- Un signalement sans récit n'a rien à consulter : le journaliser ferait
  -- dire au registre que des témoignages ont été lus là où il n'y en a pas.
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Le texte n'est rendu qu'une fois la trace écrite : si l'insertion échoue,
  -- la fonction échoue et rien n'est lu.
  INSERT INTO public.vhd_narrative_access (report_id, user_id)
  VALUES (p_report_id, auth.uid());

  RETURN v_narrative;
END;
$$;

REVOKE ALL ON FUNCTION public.read_vhd_narrative(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.read_vhd_narrative(uuid) TO authenticated;

/**
 * Consultations d'un signalement, de la plus récente à la plus ancienne, avec
 * le nom du lecteur quand il est connu.
 */
CREATE OR REPLACE FUNCTION public.get_vhd_narrative_access(p_report_id uuid)
RETURNS TABLE (accessed_at timestamptz, user_id uuid, reader text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Accès réservé aux administrateurs';
  END IF;

  RETURN QUERY
  SELECT a.accessed_at,
         a.user_id,
         COALESCE(
           NULLIF(TRIM(p.display_name), ''),
           NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
           p.email,
           ''
         )::text
  FROM public.vhd_narrative_access a
  LEFT JOIN public.profiles p ON p.user_id = a.user_id
  WHERE a.report_id = p_report_id
  ORDER BY a.accessed_at DESC
  LIMIT 200;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vhd_narrative_access(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_vhd_narrative_access(uuid) TO authenticated;

COMMENT ON TABLE public.vhd_narrative_access IS
  'Journal des consultations du récit d''un signalement. Écrit uniquement par read_vhd_narrative ; en lecture seule pour les administrateurs.';

-- ─── Le récit ne se lit plus qu'à travers la fonction ────────────────────────
--
-- L'ancienne policy était `FOR ALL`, donc elle ouvrait aussi la lecture
-- directe. On la remplace par les trois verbes d'écriture : `saveReport`
-- continue d'enregistrer et d'effacer un récit, mais aucun SELECT ne passe
-- plus sans journalisation.

DROP POLICY IF EXISTS vhd_report_narratives_admin ON public.vhd_report_narratives;

DROP POLICY IF EXISTS vhd_report_narratives_insert ON public.vhd_report_narratives;
CREATE POLICY vhd_report_narratives_insert ON public.vhd_report_narratives
  FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS vhd_report_narratives_update ON public.vhd_report_narratives;
CREATE POLICY vhd_report_narratives_update ON public.vhd_report_narratives
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS vhd_report_narratives_delete ON public.vhd_report_narratives;
CREATE POLICY vhd_report_narratives_delete ON public.vhd_report_narratives
  FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));
