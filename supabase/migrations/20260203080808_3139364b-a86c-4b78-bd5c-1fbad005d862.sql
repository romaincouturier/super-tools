-- Add payment mode field for inter-enterprise participants
ALTER TABLE public.training_participants
ADD COLUMN payment_mode text NOT NULL DEFAULT 'invoice' CHECK (payment_mode IN ('online', 'invoice'));

-- online = paid online, invoice = needs post-training invoicing