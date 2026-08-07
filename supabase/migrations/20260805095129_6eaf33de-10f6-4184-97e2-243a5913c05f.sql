-- Forme idempotente (règle [042]) : l'historique doit se rejouer de bout en
-- bout sur une base vierge. Contenu fonctionnel inchangé — seuls les gardes
-- de rejeu ont été ajoutés, la migration est déjà appliquée en production.
CREATE TABLE IF NOT EXISTS public.game_price_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  offer_type text NOT NULL CHECK (offer_type IN ('location','vente')),
  label text NOT NULL DEFAULT '',
  prix numeric NOT NULL DEFAULT 0,
  woocommerce_variation_id integer,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_price_options_game ON public.game_price_options(game_id, display_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_price_options TO authenticated;
GRANT ALL ON public.game_price_options TO service_role;

ALTER TABLE public.game_price_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_price_options_manage ON public.game_price_options;
CREATE POLICY game_price_options_manage ON public.game_price_options
  FOR ALL TO authenticated
  USING (has_module_access(auth.uid(), 'dropshipping') OR is_admin(auth.uid()))
  WITH CHECK (has_module_access(auth.uid(), 'dropshipping') OR is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_game_price_options_updated_at ON public.game_price_options;
CREATE TRIGGER trg_game_price_options_updated_at
  BEFORE UPDATE ON public.game_price_options
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
