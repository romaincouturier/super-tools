
-- Add org_id to all key business tables, referencing organizations
ALTER TABLE public.trainings ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.crm_cards ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.improvements ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.formation_configs ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.content_cards ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id);

-- Backfill all existing rows with the default org
UPDATE public.trainings SET org_id = (SELECT id FROM public.organizations WHERE is_default = true LIMIT 1) WHERE org_id IS NULL;
UPDATE public.crm_cards SET org_id = (SELECT id FROM public.organizations WHERE is_default = true LIMIT 1) WHERE org_id IS NULL;
UPDATE public.missions SET org_id = (SELECT id FROM public.organizations WHERE is_default = true LIMIT 1) WHERE org_id IS NULL;
UPDATE public.events SET org_id = (SELECT id FROM public.organizations WHERE is_default = true LIMIT 1) WHERE org_id IS NULL;
UPDATE public.improvements SET org_id = (SELECT id FROM public.organizations WHERE is_default = true LIMIT 1) WHERE org_id IS NULL;
UPDATE public.formation_configs SET org_id = (SELECT id FROM public.organizations WHERE is_default = true LIMIT 1) WHERE org_id IS NULL;
UPDATE public.content_cards SET org_id = (SELECT id FROM public.organizations WHERE is_default = true LIMIT 1) WHERE org_id IS NULL;
UPDATE public.media SET org_id = (SELECT id FROM public.organizations WHERE is_default = true LIMIT 1) WHERE org_id IS NULL;

-- Create indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_trainings_org_id ON public.trainings(org_id);
CREATE INDEX IF NOT EXISTS idx_crm_cards_org_id ON public.crm_cards(org_id);
CREATE INDEX IF NOT EXISTS idx_missions_org_id ON public.missions(org_id);
CREATE INDEX IF NOT EXISTS idx_events_org_id ON public.events(org_id);
CREATE INDEX IF NOT EXISTS idx_improvements_org_id ON public.improvements(org_id);
CREATE INDEX IF NOT EXISTS idx_formation_configs_org_id ON public.formation_configs(org_id);
CREATE INDEX IF NOT EXISTS idx_content_cards_org_id ON public.content_cards(org_id);
CREATE INDEX IF NOT EXISTS idx_media_org_id ON public.media(org_id);
