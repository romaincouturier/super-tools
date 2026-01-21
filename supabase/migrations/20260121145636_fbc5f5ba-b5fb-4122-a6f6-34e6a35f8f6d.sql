-- Add is_default column to formation_configs
ALTER TABLE public.formation_configs 
ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false;

-- Set the first formation as default
UPDATE public.formation_configs 
SET is_default = true 
WHERE id = (SELECT id FROM public.formation_configs ORDER BY formation_name LIMIT 1);