ALTER TABLE public.trainings DROP CONSTRAINT trainings_format_formation_check;

ALTER TABLE public.trainings ADD CONSTRAINT trainings_format_formation_check 
  CHECK (format_formation = ANY (ARRAY['intra'::text, 'inter-entreprises'::text, 'classe_virtuelle'::text, 'e_learning'::text]));