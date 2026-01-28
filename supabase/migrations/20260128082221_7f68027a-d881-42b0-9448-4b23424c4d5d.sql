-- Ajouter une colonne pour forcer le changement de mot de passe à la première connexion
-- Nous utilisons une table séparée pour stocker les métadonnées utilisateur liées à la sécurité

CREATE TABLE IF NOT EXISTS public.user_security_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_security_metadata ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own metadata
CREATE POLICY "Users can read their own security metadata"
ON public.user_security_metadata
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can update their own metadata (to clear must_change_password flag)
CREATE POLICY "Users can update their own security metadata"
ON public.user_security_metadata
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_user_security_metadata_updated_at
BEFORE UPDATE ON public.user_security_metadata
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();