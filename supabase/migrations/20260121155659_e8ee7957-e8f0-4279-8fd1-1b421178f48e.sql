-- Add display_order column to formation_configs
ALTER TABLE public.formation_configs 
ADD COLUMN display_order integer NOT NULL DEFAULT 0;

-- Update existing rows with sequential order based on formation_name
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY formation_name) as rn
  FROM public.formation_configs
)
UPDATE public.formation_configs 
SET display_order = ordered.rn
FROM ordered
WHERE public.formation_configs.id = ordered.id;