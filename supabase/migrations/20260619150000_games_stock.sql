-- Stock management for catalog games.
-- Stock decrements automatically when a sale is imported into game_sales.

ALTER TABLE public.games
  ADD COLUMN stock INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.decrement_game_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.game_id IS NOT NULL THEN
    UPDATE public.games
    SET stock = GREATEST(0, stock - NEW.quantity)
    WHERE id = NEW.game_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER game_sales_decrement_stock
  AFTER INSERT ON public.game_sales
  FOR EACH ROW EXECUTE FUNCTION public.decrement_game_stock();
