-- Créer un bucket PRIVÉ dédié aux dossiers de preuve de signature
INSERT INTO storage.buckets (id, name, public)
VALUES ('signature-proofs', 'signature-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Politique RLS : seuls les admins (via service role) peuvent lire/écrire
-- Pas de politique SELECT publique = accès bloqué par défaut pour les anonymes
CREATE POLICY "Admin only read signature proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'signature-proofs' AND auth.role() = 'service_role');

CREATE POLICY "Admin only insert signature proofs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'signature-proofs' AND auth.role() = 'service_role');

-- Ajouter colonne proof_hash pour stocker le hash SHA-256 du dossier de preuve lui-même
ALTER TABLE public.convention_signatures
ADD COLUMN IF NOT EXISTS proof_hash TEXT;

-- Ajouter colonne journey_events pour stocker la timeline du parcours signataire
ALTER TABLE public.convention_signatures
ADD COLUMN IF NOT EXISTS journey_events JSONB DEFAULT '[]';