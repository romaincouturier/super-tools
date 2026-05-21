-- ── Variation location WooCommerce ──────────────────────────────────────────
-- Allows a game registered as "supertilt" (or any other purchase type) to
-- also have a rental/location variation.  When a webhook order line matches
-- this variation ID, it is routed as game_type = 'location' regardless of
-- the game's own game_type field.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS location_variation_id INTEGER;

COMMENT ON COLUMN public.games.location_variation_id IS
  'WooCommerce variation ID for the location/rental variant of this product. '
  'When set, orders with this variation_id are treated as location orders '
  '(kanban_status = location_pending) even if game_type is not "location".';

-- ── Store the WooCommerce variation ID on each order line ────────────────────

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS wc_variation_id INTEGER;

COMMENT ON COLUMN public.order_items.wc_variation_id IS
  'WooCommerce variation_id from the line item payload (0 or NULL = no variation).';
