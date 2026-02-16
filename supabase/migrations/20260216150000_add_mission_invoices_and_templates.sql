-- ============================================================
-- Mission enhancements: language, page templates, testimonials
-- ============================================================

-- 1. Add language setting to missions (default French)
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'fr';

-- 2. Add activity_id to mission_pages for linking pages to activities
ALTER TABLE public.mission_pages ADD COLUMN IF NOT EXISTS activity_id UUID REFERENCES public.mission_activities(id) ON DELETE SET NULL;

-- 3. Track testimonial email sending for missions
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS testimonial_status TEXT DEFAULT 'pending' CHECK (testimonial_status IN ('pending', 'google_review_sent', 'video_testimonial_sent', 'completed'));
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS testimonial_last_sent_at TIMESTAMP WITH TIME ZONE;

-- 4. Mission page templates table
CREATE TABLE IF NOT EXISTS public.mission_page_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL DEFAULT '',
  icon TEXT DEFAULT '📄',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.mission_page_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage page templates"
  ON public.mission_page_templates
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 5. Index for faster activity-linked pages lookup
CREATE INDEX IF NOT EXISTS idx_mission_pages_activity_id ON public.mission_pages(activity_id);

-- 6. Insert some default page templates
INSERT INTO public.mission_page_templates (name, description, content, icon, position) VALUES
  ('Compte-rendu de réunion', 'Template pour les comptes-rendus de réunion avec participants et actions', '<h2>Participants</h2><ul><li>Participant 1</li><li>Participant 2</li></ul><h2>Ordre du jour</h2><ol><li>Point 1</li><li>Point 2</li></ol><h2>Décisions prises</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false">Action 1 - Responsable</li><li data-type="taskItem" data-checked="false">Action 2 - Responsable</li></ul><h2>Prochaine réunion</h2><p>Date : À définir</p>', '📋', 0),
  ('Brief client', 'Résumé du besoin client et objectifs du projet', '<h2>Contexte</h2><p>Description du contexte et de la problématique...</p><h2>Objectifs</h2><ul><li>Objectif 1</li><li>Objectif 2</li></ul><h2>Livrables attendus</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false">Livrable 1</li><li data-type="taskItem" data-checked="false">Livrable 2</li></ul><h2>Planning</h2><p>Dates clés et jalons...</p><h2>Budget</h2><p>Budget alloué et conditions de facturation...</p>', '🎯', 1),
  ('Suivi de projet', 'Template de suivi avec avancement et risques', '<h2>État d''avancement</h2><p>Résumé global du projet...</p><h2>Tâches en cours</h2><ul data-type="taskList"><li data-type="taskItem" data-checked="false">Tâche 1</li><li data-type="taskItem" data-checked="false">Tâche 2</li></ul><h2>Risques et points de vigilance</h2><ul><li>Risque 1 : Impact / Mitigation</li></ul><h2>Prochaines étapes</h2><ol><li>Étape 1</li><li>Étape 2</li></ol>', '📊', 2),
  ('Page vierge', 'Page vierge sans contenu prédéfini', '', '📄', 3)
ON CONFLICT DO NOTHING;
