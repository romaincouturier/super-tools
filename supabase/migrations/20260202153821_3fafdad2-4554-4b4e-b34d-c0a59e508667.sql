-- Create trainers table
CREATE TABLE public.trainers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  photo_url TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;

-- RLS policies - all authenticated users can read trainers
CREATE POLICY "Authenticated users can view trainers"
ON public.trainers FOR SELECT
TO authenticated
USING (true);

-- Only admins can modify trainers (via has_module_access or is_admin)
CREATE POLICY "Users with parametres access can manage trainers"
ON public.trainers FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid()) OR public.has_module_access(auth.uid(), 'parametres')
);

-- Add trainer_id to trainings table
ALTER TABLE public.trainings 
ADD COLUMN trainer_id UUID REFERENCES public.trainers(id);

-- Create trigger for updated_at
CREATE TRIGGER update_trainers_updated_at
BEFORE UPDATE ON public.trainers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default trainer (Romain Couturier)
INSERT INTO public.trainers (first_name, last_name, email, phone, is_default)
VALUES ('Romain', 'Couturier', 'romain@supertilt.fr', NULL, true);

-- Allow public access to trainers for the participant summary page
CREATE POLICY "Public can view trainers"
ON public.trainers FOR SELECT
TO anon
USING (true);