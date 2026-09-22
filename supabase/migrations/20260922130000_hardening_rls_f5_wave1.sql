-- Durcissement RLS F5 (vague 1) : tables sensibles exposees a tout compte
-- authenticated via des policies USING(true), sans garde is_staff_user().
-- Contexte : audit red team (RED_TEAM_ASSESSMENT.md). is_staff_user() est
-- correctement defini (admin OU acces module ; ni un apprenant, ni un compte
-- auto-inscrit sur /signup). Ces tables n'ont aucun parcours apprenant/public :
--   - document_embeddings : corpus RAG transverse (missions, CRM, emails).
--   - transcripts : transcriptions de reunions (features editoriales/CRM staff).
--   - testimonials : geres via la page staff /temoignages.
--   - indexation_queue : monitoring d'indexation (admin).
-- Les ecritures se font en service_role (agent, Fireflies, poll-drive), qui
-- ignore la RLS ; les acces staff passent is_staff_user(). Un compte auto-inscrit
-- ou un apprenant perd l'acces (comportement voulu).

-- document_embeddings : lecture staff uniquement (writes deja service_role).
DROP POLICY IF EXISTS "doc_embeddings_select" ON public.document_embeddings;
CREATE POLICY "doc_embeddings_select" ON public.document_embeddings
  FOR SELECT TO authenticated USING (public.is_staff_user());

-- transcripts : lecture/ecriture/suppression staff uniquement.
DROP POLICY IF EXISTS "Authenticated users can view transcripts" ON public.transcripts;
CREATE POLICY "Authenticated users can view transcripts"
  ON public.transcripts FOR SELECT TO authenticated
  USING (public.is_staff_user());

DROP POLICY IF EXISTS "Authenticated users can update transcripts" ON public.transcripts;
CREATE POLICY "Authenticated users can update transcripts"
  ON public.transcripts FOR UPDATE TO authenticated
  USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

DROP POLICY IF EXISTS "Authenticated users can delete transcripts" ON public.transcripts;
CREATE POLICY "Authenticated users can delete transcripts"
  ON public.transcripts FOR DELETE TO authenticated
  USING (public.is_staff_user());

-- testimonials : gestion staff uniquement (poll-drive ecrit en service_role).
DROP POLICY IF EXISTS "Authenticated users can manage testimonials" ON public.testimonials;
CREATE POLICY "Authenticated users can manage testimonials"
  ON public.testimonials FOR ALL TO authenticated
  USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

-- indexation_queue : monitoring staff uniquement (writes deja service_role).
DROP POLICY IF EXISTS "indexation_queue_select" ON public.indexation_queue;
CREATE POLICY "indexation_queue_select" ON public.indexation_queue
  FOR SELECT TO authenticated USING (public.is_staff_user());
