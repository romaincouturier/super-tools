-- Create table for formation dates
CREATE TABLE public.formation_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date_label TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.formation_dates ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view formation dates" 
ON public.formation_dates 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert formation dates" 
ON public.formation_dates 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update formation dates" 
ON public.formation_dates 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete formation dates" 
ON public.formation_dates 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_formation_dates_updated_at
BEFORE UPDATE ON public.formation_dates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();