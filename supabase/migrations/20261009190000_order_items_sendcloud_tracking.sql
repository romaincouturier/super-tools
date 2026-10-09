-- Rapprochement Sendcloud : suivi du colis sur les lignes expédiées par SuperTilt
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS sendcloud_parcel_id BIGINT,
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS tracking_url TEXT;
