ALTER TABLE public.game_sales
  ADD COLUMN IF NOT EXISTS amount_ht numeric(10,2),
  ADD COLUMN IF NOT EXISTS vat_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS bank_fees numeric(10,2),
  ADD COLUMN IF NOT EXISTS net_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'EUR';

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS shipped_confirmed_at timestamptz;

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS location_contract_url text;