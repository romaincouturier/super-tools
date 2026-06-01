-- Add page_type to mission_pages
ALTER TABLE public.mission_pages ADD COLUMN IF NOT EXISTS page_type text NOT NULL DEFAULT 'page';

-- Survey definitions
CREATE TABLE IF NOT EXISTS public.mission_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_page_id uuid REFERENCES public.mission_pages(id) ON DELETE CASCADE NOT NULL,
  mission_id uuid REFERENCES public.missions(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL DEFAULT '',
  intro_message text,
  thank_you_message text NOT NULL DEFAULT 'Merci pour vos réponses !',
  public_token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  recipient_emails jsonb NOT NULL DEFAULT '[]',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by text
);

-- Survey questions
CREATE TABLE IF NOT EXISTS public.mission_survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES public.mission_surveys(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('text','textarea','single_choice','multiple_choice','rating','nps','date')),
  label text NOT NULL DEFAULT '',
  description text,
  required boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  options jsonb,
  settings jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Survey responses (one per participant)
CREATE TABLE IF NOT EXISTS public.mission_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES public.mission_surveys(id) ON DELETE CASCADE NOT NULL,
  respondent_name text,
  respondent_email text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

-- Individual answers
CREATE TABLE IF NOT EXISTS public.mission_survey_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid REFERENCES public.mission_survey_responses(id) ON DELETE CASCADE NOT NULL,
  question_id uuid REFERENCES public.mission_survey_questions(id) ON DELETE CASCADE NOT NULL,
  value text,
  values jsonb
);

-- RLS
ALTER TABLE public.mission_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_survey_answers ENABLE ROW LEVEL SECURITY;

-- Staff full access
CREATE POLICY "staff_all_mission_surveys" ON public.mission_surveys FOR ALL TO authenticated USING (is_staff_user()) WITH CHECK (is_staff_user());
CREATE POLICY "staff_all_survey_questions" ON public.mission_survey_questions FOR ALL TO authenticated USING (is_staff_user()) WITH CHECK (is_staff_user());
CREATE POLICY "staff_all_survey_responses" ON public.mission_survey_responses FOR ALL TO authenticated USING (is_staff_user()) WITH CHECK (is_staff_user());
CREATE POLICY "staff_all_survey_answers" ON public.mission_survey_answers FOR ALL TO authenticated USING (is_staff_user()) WITH CHECK (is_staff_user());

-- Public read survey by token (anon)
CREATE POLICY "public_read_survey_by_token" ON public.mission_surveys FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "public_read_survey_questions" ON public.mission_survey_questions FOR SELECT TO anon USING (true);

-- Public submit responses (anon)
CREATE POLICY "public_insert_survey_responses" ON public.mission_survey_responses FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "public_insert_survey_answers" ON public.mission_survey_answers FOR INSERT TO anon WITH CHECK (true);

-- Insert "Sondage" template
INSERT INTO public.mission_page_templates (name, description, content, icon, position)
VALUES ('Sondage', 'Créez un sondage à partager par lien ou email', '', '📊', 99)
ON CONFLICT DO NOTHING;
