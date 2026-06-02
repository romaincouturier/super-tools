-- ============================================================
-- Support : colonne "Boîte à idées"
-- ============================================================
--
-- Les tickets restés dans nouveau/qualification/vibe_coding depuis
-- plus de 30 jours sont automatiquement déplacés dans cette colonne.
-- Ils restent visibles dans le kanban mais n'entrent pas dans le calcul
-- des cartes de contrôle.

-- ── 1. Étendre le constraint statut ──────────────────────────────────────────

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_status_check;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_status_check
  CHECK (status = ANY (ARRAY[
    'nouveau'::text,
    'qualification'::text,
    'vibe_coding'::text,
    'resolu'::text,
    'boite_a_idees'::text
  ]));


-- ── 2. Fonction de déplacement automatique ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.move_stale_tickets_to_boite_a_idees()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_tickets
  SET
    status     = 'boite_a_idees',
    updated_at = now()
  WHERE
    archived_at IS NULL
    AND status NOT IN ('resolu', 'boite_a_idees')
    AND created_at < now() - INTERVAL '30 days';
END;
$$;


-- ── 3. Planifier via pg_cron (tous les jours à 03:00 UTC) ────────────────────

SELECT cron.schedule(
  'move-stale-support-tickets',
  '0 3 * * *',
  $$SELECT public.move_stale_tickets_to_boite_a_idees();$$
);
