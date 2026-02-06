-- Add sale amount per participant for inter-enterprise trainings
ALTER TABLE public.training_participants
ADD COLUMN sold_price_ht numeric DEFAULT NULL;