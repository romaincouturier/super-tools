-- Perles clients : lien optionnel vers une mission ou une formation, et indexation
-- pour la recherche (search_content, source_type client_pearl).

ALTER TABLE public.client_pearls
  ADD COLUMN IF NOT EXISTS mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS training_id UUID REFERENCES public.trainings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS client_pearls_mission_id_idx ON public.client_pearls (mission_id) WHERE mission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS client_pearls_training_id_idx ON public.client_pearls (training_id) WHERE training_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_index_client_pearl ON public.client_pearls;
CREATE TRIGGER trg_index_client_pearl
  AFTER INSERT OR UPDATE OF title, message, message_fr, author_name, author_company
  ON public.client_pearls
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('client_pearl');

DROP TRIGGER IF EXISTS trg_delete_client_pearl_embedding ON public.client_pearls;
CREATE TRIGGER trg_delete_client_pearl_embedding
  AFTER DELETE ON public.client_pearls
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('client_pearl');
