-- Change duree_heures from integer to numeric to support decimal values
ALTER TABLE public.formation_configs 
ALTER COLUMN duree_heures TYPE numeric USING duree_heures::numeric;