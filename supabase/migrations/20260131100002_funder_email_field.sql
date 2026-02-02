-- Add funder email field for OPCO/financial service communication
-- This allows sending invoices and documents directly to the funding organization

-- Add funder columns to trainings table
ALTER TABLE public.trainings
ADD COLUMN IF NOT EXISTS funder_name TEXT,
ADD COLUMN IF NOT EXISTS funder_email TEXT,
ADD COLUMN IF NOT EXISTS funder_type TEXT CHECK (funder_type IN ('opco', 'pole_emploi', 'entreprise', 'cpf', 'autre'));

-- Add index for funder queries
CREATE INDEX IF NOT EXISTS idx_trainings_funder_email ON public.trainings(funder_email) WHERE funder_email IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.trainings.funder_name IS 'Name of the funding organization (OPCO, P\u00f4le Emploi, etc.)';
COMMENT ON COLUMN public.trainings.funder_email IS 'Email address for sending invoices and administrative documents to the funder';
COMMENT ON COLUMN public.trainings.funder_type IS 'Type of funding: opco, pole_emploi, entreprise, cpf, autre';
