-- Add session_type (intra/inter) and session_format (presentiel/distanciel_synchrone/distanciel_asynchrone)
-- These replace the existing format_formation column which mixed business type and delivery method

ALTER TABLE public.trainings
  ADD COLUMN IF NOT EXISTS session_type TEXT CHECK (session_type IN ('intra', 'inter')),
  ADD COLUMN IF NOT EXISTS session_format TEXT CHECK (session_format IN ('presentiel', 'distanciel_synchrone', 'distanciel_asynchrone'));

-- Migrate existing data from format_formation
UPDATE public.trainings SET
  session_type = CASE
    WHEN format_formation = 'intra' THEN 'intra'
    WHEN format_formation = 'inter-entreprises' THEN 'inter'
    WHEN format_formation = 'e_learning' THEN 'inter'
    WHEN format_formation = 'classe_virtuelle' THEN 'intra'
    ELSE 'intra'
  END,
  session_format = CASE
    WHEN format_formation = 'intra' THEN 'presentiel'
    WHEN format_formation = 'inter-entreprises' THEN 'presentiel'
    WHEN format_formation = 'e_learning' THEN 'distanciel_asynchrone'
    WHEN format_formation = 'classe_virtuelle' THEN 'distanciel_synchrone'
    ELSE 'presentiel'
  END
WHERE format_formation IS NOT NULL AND session_type IS NULL;
