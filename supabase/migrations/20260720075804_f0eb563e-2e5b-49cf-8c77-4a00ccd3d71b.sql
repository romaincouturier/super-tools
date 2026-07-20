
-- Templates d'actions de réassort par jeu
CREATE TABLE public.game_restock_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT,
  instructions TEXT,
  unit_price_ht NUMERIC(10,2),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_restock_actions TO authenticated;
GRANT ALL ON public.game_restock_actions TO service_role;
ALTER TABLE public.game_restock_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_manage_game_restock_actions" ON public.game_restock_actions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_game_restock_actions_game ON public.game_restock_actions(game_id, position);

-- Fichiers joints aux actions template
CREATE TABLE public.game_restock_action_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_id UUID NOT NULL REFERENCES public.game_restock_actions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_restock_action_files TO authenticated;
GRANT ALL ON public.game_restock_action_files TO service_role;
ALTER TABLE public.game_restock_action_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_manage_game_restock_action_files" ON public.game_restock_action_files
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_game_restock_action_files_action ON public.game_restock_action_files(action_id);

-- Réassorts (runs)
CREATE TABLE public.game_restocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','cancelled')),
  notes TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_restocks TO authenticated;
GRANT ALL ON public.game_restocks TO service_role;
ALTER TABLE public.game_restocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_manage_game_restocks" ON public.game_restocks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_game_restocks_game ON public.game_restocks(game_id, started_at DESC);

-- Items du réassort (snapshot des actions)
CREATE TABLE public.game_restock_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restock_id UUID NOT NULL REFERENCES public.game_restocks(id) ON DELETE CASCADE,
  template_action_id UUID REFERENCES public.game_restock_actions(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  url TEXT,
  instructions TEXT,
  unit_price_ht NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','awaiting_delivery','received')),
  final_cost_ht NUMERIC(10,2),
  final_cost_ttc NUMERIC(10,2),
  completed_at TIMESTAMPTZ,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_restock_items TO authenticated;
GRANT ALL ON public.game_restock_items TO service_role;
ALTER TABLE public.game_restock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_manage_game_restock_items" ON public.game_restock_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_game_restock_items_restock ON public.game_restock_items(restock_id, position);

-- Triggers updated_at
CREATE TRIGGER trg_game_restock_actions_updated
  BEFORE UPDATE ON public.game_restock_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_game_restocks_updated
  BEFORE UPDATE ON public.game_restocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_game_restock_items_updated
  BEFORE UPDATE ON public.game_restock_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
