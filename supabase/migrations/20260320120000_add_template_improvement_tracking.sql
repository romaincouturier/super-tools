-- Track AI auto-improvements on email templates
ALTER TABLE public.email_templates
  ADD COLUMN IF NOT EXISTS last_improved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS improvement_count INTEGER NOT NULL DEFAULT 0;
