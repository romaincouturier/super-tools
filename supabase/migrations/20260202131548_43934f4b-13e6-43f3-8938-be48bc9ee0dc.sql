-- Create content_columns table
CREATE TABLE public.content_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create content_cards table
CREATE TABLE public.content_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id UUID NOT NULL REFERENCES public.content_columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create review_status enum
CREATE TYPE public.review_status AS ENUM ('pending', 'in_review', 'approved', 'changes_requested');

-- Create content_reviews table
CREATE TABLE public.content_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID NOT NULL REFERENCES public.content_cards(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),
  external_url TEXT,
  status public.review_status NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Create review_comments table
CREATE TABLE public.review_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.content_reviews(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.review_comments(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notification_type enum
CREATE TYPE public.notification_type AS ENUM ('review_requested', 'comment_added', 'review_status_changed');

-- Create content_notifications table
CREATE TABLE public.content_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type public.notification_type NOT NULL,
  reference_id UUID NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ai_brand_settings table
CREATE TABLE public.ai_brand_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_type TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default voice settings
INSERT INTO public.ai_brand_settings (setting_type, content) VALUES
  ('supertilt_voice', ''),
  ('romain_voice', '');

-- Insert default columns (Idées and Archive)
INSERT INTO public.content_columns (name, display_order, is_system) VALUES
  ('Idées', 0, true),
  ('Archive', 1000, true);

-- Enable RLS on all tables
ALTER TABLE public.content_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_brand_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for content_columns
CREATE POLICY "Users with contenu access can view columns"
  ON public.content_columns FOR SELECT
  USING (public.has_module_access(auth.uid(), 'contenu'));

CREATE POLICY "Users with contenu access can insert columns"
  ON public.content_columns FOR INSERT
  WITH CHECK (public.has_module_access(auth.uid(), 'contenu'));

CREATE POLICY "Users with contenu access can update columns"
  ON public.content_columns FOR UPDATE
  USING (public.has_module_access(auth.uid(), 'contenu'));

CREATE POLICY "Users with contenu access can delete non-system columns"
  ON public.content_columns FOR DELETE
  USING (public.has_module_access(auth.uid(), 'contenu') AND is_system = false);

-- RLS policies for content_cards
CREATE POLICY "Users with contenu access can view cards"
  ON public.content_cards FOR SELECT
  USING (public.has_module_access(auth.uid(), 'contenu'));

CREATE POLICY "Users with contenu access can insert cards"
  ON public.content_cards FOR INSERT
  WITH CHECK (public.has_module_access(auth.uid(), 'contenu'));

CREATE POLICY "Users with contenu access can update cards"
  ON public.content_cards FOR UPDATE
  USING (public.has_module_access(auth.uid(), 'contenu'));

CREATE POLICY "Users with contenu access can delete cards"
  ON public.content_cards FOR DELETE
  USING (public.has_module_access(auth.uid(), 'contenu'));

-- RLS policies for content_reviews
CREATE POLICY "Users with contenu access can view reviews"
  ON public.content_reviews FOR SELECT
  USING (public.has_module_access(auth.uid(), 'contenu'));

CREATE POLICY "Users with contenu access can insert reviews"
  ON public.content_reviews FOR INSERT
  WITH CHECK (public.has_module_access(auth.uid(), 'contenu'));

CREATE POLICY "Users with contenu access can update reviews"
  ON public.content_reviews FOR UPDATE
  USING (public.has_module_access(auth.uid(), 'contenu'));

CREATE POLICY "Users with contenu access can delete reviews"
  ON public.content_reviews FOR DELETE
  USING (public.has_module_access(auth.uid(), 'contenu'));

-- RLS policies for review_comments
CREATE POLICY "Users with contenu access can view comments"
  ON public.review_comments FOR SELECT
  USING (public.has_module_access(auth.uid(), 'contenu'));

CREATE POLICY "Users with contenu access can insert comments"
  ON public.review_comments FOR INSERT
  WITH CHECK (public.has_module_access(auth.uid(), 'contenu'));

CREATE POLICY "Users with contenu access can update own comments"
  ON public.review_comments FOR UPDATE
  USING (public.has_module_access(auth.uid(), 'contenu') AND author_id = auth.uid());

CREATE POLICY "Users with contenu access can delete own comments"
  ON public.review_comments FOR DELETE
  USING (public.has_module_access(auth.uid(), 'contenu') AND author_id = auth.uid());

-- RLS policies for content_notifications
CREATE POLICY "Users can view own notifications"
  ON public.content_notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users with contenu access can insert notifications"
  ON public.content_notifications FOR INSERT
  WITH CHECK (public.has_module_access(auth.uid(), 'contenu'));

CREATE POLICY "Users can update own notifications"
  ON public.content_notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON public.content_notifications FOR DELETE
  USING (user_id = auth.uid());

-- RLS policies for ai_brand_settings
CREATE POLICY "Users with contenu access can view ai settings"
  ON public.ai_brand_settings FOR SELECT
  USING (public.has_module_access(auth.uid(), 'contenu'));

CREATE POLICY "Users with contenu access can update ai settings"
  ON public.ai_brand_settings FOR UPDATE
  USING (public.has_module_access(auth.uid(), 'contenu'));

-- Create storage bucket for content images
INSERT INTO storage.buckets (id, name, public) VALUES ('content-images', 'content-images', true);

-- Storage policies for content-images bucket
CREATE POLICY "Anyone can view content images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'content-images');

CREATE POLICY "Users with contenu access can upload content images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'content-images' AND public.has_module_access(auth.uid(), 'contenu'));

CREATE POLICY "Users with contenu access can update content images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'content-images' AND public.has_module_access(auth.uid(), 'contenu'));

CREATE POLICY "Users with contenu access can delete content images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'content-images' AND public.has_module_access(auth.uid(), 'contenu'));

-- Create trigger for updated_at on content_cards
CREATE TRIGGER update_content_cards_updated_at
  BEFORE UPDATE ON public.content_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.content_notifications;