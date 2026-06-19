-- Fix: la migration précédente avait ajouté une colonne `stock` redondante
-- qui doublait `current_stock` (modèle de stock supertilt V3).
-- On supprime ce doublon et on branche l'auto-décrément sur `current_stock`.

DROP TRIGGER IF EXISTS game_sales_decrement_stock ON public.game_sales;
DROP FUNCTION IF EXISTS public.decrement_game_stock();
ALTER TABLE public.games DROP COLUMN IF EXISTS stock;

CREATE OR REPLACE FUNCTION public.decrement_game_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ne décrémente que les jeux dont le stock est suivi (current_stock non null).
  IF NEW.game_id IS NOT NULL THEN
    UPDATE public.games
    SET current_stock = GREATEST(0, current_stock - NEW.quantity)
    WHERE id = NEW.game_id
      AND current_stock IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER game_sales_decrement_stock
  AFTER INSERT ON public.game_sales
  FOR EACH ROW EXECUTE FUNCTION public.decrement_game_stock();
