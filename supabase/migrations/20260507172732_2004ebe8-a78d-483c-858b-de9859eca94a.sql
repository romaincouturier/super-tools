
-- 1. Table colonnes
CREATE TABLE public.supertilt_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_supertilt_columns_user_id ON public.supertilt_columns(user_id);

ALTER TABLE public.supertilt_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own supertilt columns" ON public.supertilt_columns
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own supertilt columns" ON public.supertilt_columns
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own supertilt columns" ON public.supertilt_columns
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own supertilt columns" ON public.supertilt_columns
  FOR DELETE USING (auth.uid() = user_id);

-- 2. Colonnes sur actions
ALTER TABLE public.supertilt_actions
  ADD COLUMN column_id uuid,
  ADD COLUMN position integer NOT NULL DEFAULT 0;

CREATE INDEX idx_supertilt_actions_column_id ON public.supertilt_actions(column_id);

-- 3. Backfill: créer 3 colonnes par défaut pour chaque user existant et placer toutes les actions dans la première
DO $$
DECLARE
  u_id uuid;
  todo_id uuid;
BEGIN
  FOR u_id IN SELECT DISTINCT user_id FROM public.supertilt_actions LOOP
    INSERT INTO public.supertilt_columns (user_id, name, position)
    VALUES (u_id, 'À faire', 0)
    RETURNING id INTO todo_id;

    INSERT INTO public.supertilt_columns (user_id, name, position) VALUES
      (u_id, 'En cours', 1),
      (u_id, 'Terminé', 2);

    UPDATE public.supertilt_actions a
    SET column_id = todo_id,
        position = sub.rn - 1
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
      FROM public.supertilt_actions WHERE user_id = u_id
    ) sub
    WHERE a.id = sub.id;
  END LOOP;
END $$;

-- 4. Trigger updated_at
CREATE TRIGGER update_supertilt_columns_updated_at
  BEFORE UPDATE ON public.supertilt_columns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
