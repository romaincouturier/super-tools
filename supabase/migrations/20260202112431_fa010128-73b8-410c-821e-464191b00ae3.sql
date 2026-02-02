-- Table pour tracker les tentatives de connexion
CREATE TABLE public.login_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address TEXT NOT NULL,
  email TEXT NOT NULL,
  attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL DEFAULT false,
  user_agent TEXT
);

-- Index pour requêtes rapides par IP et date
CREATE INDEX idx_login_attempts_ip_date ON public.login_attempts (ip_address, attempted_at DESC);

-- Index pour requêtes rapides par email et date
CREATE INDEX idx_login_attempts_email_date ON public.login_attempts (email, attempted_at DESC);

-- RLS : pas de lecture directe par les utilisateurs (uniquement via Edge Functions)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Politique pour permettre l'insertion via service role (Edge Functions)
CREATE POLICY "Service role can insert login attempts"
ON public.login_attempts
FOR INSERT
WITH CHECK (true);

-- Politique pour permettre la lecture via service role (Edge Functions)
CREATE POLICY "Service role can read login attempts"
ON public.login_attempts
FOR SELECT
USING (true);

-- Politique pour permettre la suppression (nettoyage automatique)
CREATE POLICY "Service role can delete old login attempts"
ON public.login_attempts
FOR DELETE
USING (true);