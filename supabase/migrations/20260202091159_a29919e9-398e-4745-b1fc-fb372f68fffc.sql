-- Add formal address preference for participants
ALTER TABLE public.trainings
ADD COLUMN participants_formal_address boolean NOT NULL DEFAULT true;