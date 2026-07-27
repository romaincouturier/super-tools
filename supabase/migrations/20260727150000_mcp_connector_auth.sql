-- Connecteur MCP lecture seule (claude.ai) — stockage OAuth.
-- Clients enregistrés dynamiquement, codes d'autorisation (PKCE),
-- tokens d'accès (hashés) et tentatives échouées (rate limiting).
-- Accès service_role uniquement : RLS activée sans policy.

CREATE TABLE public.mcp_oauth_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('client', 'code', 'token', 'auth_fail')),
  token_hash text UNIQUE,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX idx_mcp_oauth_kind ON public.mcp_oauth_records (kind, created_at DESC);

ALTER TABLE public.mcp_oauth_records ENABLE ROW LEVEL SECURITY;
