-- Create newsletters table
CREATE TABLE public.newsletters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  scheduled_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create newsletter_cards junction table
CREATE TABLE public.newsletter_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  newsletter_id UUID NOT NULL REFERENCES public.newsletters(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.content_cards(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(newsletter_id, card_id)
);

-- Enable RLS
ALTER TABLE public.newsletters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_cards ENABLE ROW LEVEL SECURITY;

-- RLS policies for newsletters (authenticated users can CRUD)
CREATE POLICY "Authenticated users can view newsletters"
  ON public.newsletters FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create newsletters"
  ON public.newsletters FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update newsletters"
  ON public.newsletters FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete newsletters"
  ON public.newsletters FOR DELETE TO authenticated USING (true);

-- RLS policies for newsletter_cards
CREATE POLICY "Authenticated users can view newsletter_cards"
  ON public.newsletter_cards FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create newsletter_cards"
  ON public.newsletter_cards FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update newsletter_cards"
  ON public.newsletter_cards FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete newsletter_cards"
  ON public.newsletter_cards FOR DELETE TO authenticated USING (true);

-- Create indexes
CREATE INDEX idx_newsletters_scheduled_date ON public.newsletters(scheduled_date);
CREATE INDEX idx_newsletters_status ON public.newsletters(status);
CREATE INDEX idx_newsletter_cards_newsletter_id ON public.newsletter_cards(newsletter_id);
CREATE INDEX idx_newsletter_cards_card_id ON public.newsletter_cards(card_id);