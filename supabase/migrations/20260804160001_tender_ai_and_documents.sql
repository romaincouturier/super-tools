-- Synthèse IA d'un avis, et dépôt manuel du DCE.
--
-- Deux besoins distincts sur le même écran de revue :
--
--   1. L'avis BOAMP est déjà en base en entier (`full_text`, `raw`), mais il se
--      lit mal : prose administrative, critères noyés dans les clauses. Une
--      synthèse répond aux questions qui font basculer un Go / No Go.
--
--   2. Le DCE (CCTP, règlement de consultation, BPU) n'est PAS dans l'API : il
--      se retire sur PLACE ou AWS, qui n'ont pas d'API et demandent un compte.
--      Le récupérer automatiquement voudrait dire scraper une session
--      authentifiée, qui casse à chaque refonte de plateforme. Pour deux ou
--      trois réponses par an, le dépôt manuel coûte deux minutes et ne casse
--      jamais.
--
-- La synthèse est stockée et non recalculée : une relecture de fiche ne doit
-- pas repayer un appel au modèle. Le bouton reste disponible pour la refaire.

-- ── 1. Synthèse de l'avis ────────────────────────────────────

ALTER TABLE public.tender_opportunities
  ADD COLUMN IF NOT EXISTS ai_summary jsonb,
  ADD COLUMN IF NOT EXISTS ai_summary_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_summary_model text;

COMMENT ON COLUMN public.tender_opportunities.ai_summary IS
  'Synthèse produite à partir de l''avis : objet reformulé, attendus, critères, points de vigilance, adéquation au métier. Calculée à la demande, jamais à l''ingestion.';

-- ── 2. Documents déposés à la main ───────────────────────────

CREATE TABLE IF NOT EXISTS public.tender_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id uuid NOT NULL REFERENCES public.tender_opportunities(id) ON DELETE CASCADE,

  file_name text NOT NULL,
  -- URL publique, comme sur mission_documents : c'est ce que le gestionnaire de
  -- documents mutualisé attend pour le téléchargement.
  file_url text NOT NULL,
  -- Chemin dans le bucket, stocké séparément : l'analyse retélécharge le
  -- fichier, et redécouper l'URL publique pour retrouver le chemin serait un
  -- couplage inutile au format d'URL de Supabase.
  storage_path text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid,

  -- Analyse du document, même forme que ai_summary mais sur le contenu réel du
  -- DCE : ce qui est demandé, les contraintes, ce qui manque pour répondre.
  ai_analysis jsonb,
  ai_analysis_at timestamptz,
  ai_analysis_model text,
  -- Un PDF scanné ne rend aucun texte exploitable. L'échec est stocké plutôt
  -- qu'avalé, sinon le bouton semble ne rien faire.
  ai_error text,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tender_documents_tender
  ON public.tender_documents (tender_id, created_at DESC);

-- ── 3. RLS ───────────────────────────────────────────────────
-- Même périmètre que `tender_opportunities` : accès CRM en écriture, et la
-- policy RESTRICTIVE qui exclut réellement les apprenants du LMS (règle [031]).

ALTER TABLE public.tender_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tender_documents_select" ON public.tender_documents;
CREATE POLICY "tender_documents_select" ON public.tender_documents
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tender_documents_insert" ON public.tender_documents;
CREATE POLICY "tender_documents_insert" ON public.tender_documents
  FOR INSERT TO authenticated WITH CHECK (public.has_crm_access(auth.uid()));

DROP POLICY IF EXISTS "tender_documents_update" ON public.tender_documents;
CREATE POLICY "tender_documents_update" ON public.tender_documents
  FOR UPDATE TO authenticated USING (public.has_crm_access(auth.uid()));

DROP POLICY IF EXISTS "tender_documents_delete" ON public.tender_documents;
CREATE POLICY "tender_documents_delete" ON public.tender_documents
  FOR DELETE TO authenticated USING (public.has_crm_access(auth.uid()));

DROP POLICY IF EXISTS staff_only_select ON public.tender_documents;
CREATE POLICY staff_only_select ON public.tender_documents
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.is_staff_user());

-- ── 4. Stockage ──────────────────────────────────────────────
-- Bucket PRIVÉ. Il avait d'abord été déclaré public, comme `mission-documents`
-- et `training-documents` : un DCE est déjà publié par l'acheteur, il n'y a
-- rien à protéger. La politique de l'espace de travail interdit les buckets
-- publics, constaté au déploiement du 04/08/2026. Le gestionnaire de documents
-- mutualisé resigne donc l'URL au téléchargement (`resolveEntityDocumentUrl`),
-- ce qui marche aussi sur un bucket public : aucune branche par type d'entité.
-- Les formats acceptés sont ceux que `_shared/document-extract.ts` sait lire :
-- une archive ZIP, format habituel d'un DCE, doit être décompressée avant
-- dépôt — l'accepter donnerait un document que le modèle ne peut pas ouvrir.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tender-documents', 'tender-documents', false, 26214400,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
    'text/csv',
    'image/png',
    'image/jpeg'
  ]
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "tender_documents_storage_select" ON storage.objects;
-- Signer une URL demande un SELECT sur l'objet : la policy est donc ce qui
-- décide qui peut télécharger. Réservée au staff, comme `staff_only_select`
-- sur la table — sans quoi un apprenant pourrait se signer une pièce de DCE.
CREATE POLICY "tender_documents_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'tender-documents' AND public.is_staff_user());

DROP POLICY IF EXISTS "tender_documents_storage_insert" ON storage.objects;
CREATE POLICY "tender_documents_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tender-documents' AND public.has_crm_access(auth.uid()));

DROP POLICY IF EXISTS "tender_documents_storage_delete" ON storage.objects;
CREATE POLICY "tender_documents_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'tender-documents' AND public.has_crm_access(auth.uid()));
