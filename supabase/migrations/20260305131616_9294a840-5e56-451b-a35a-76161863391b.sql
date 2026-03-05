
-- Add coaching_sessions_count to formation_formulas
ALTER TABLE public.formation_formulas
  ADD COLUMN IF NOT EXISTS coaching_sessions_count integer NOT NULL DEFAULT 0;

-- Add coaching tracking fields to training_participants
ALTER TABLE public.training_participants
  ADD COLUMN IF NOT EXISTS coaching_sessions_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coaching_sessions_completed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coaching_deadline date;

-- Insert coaching email templates
INSERT INTO public.email_templates (template_type, template_name, subject, html_content, is_default)
VALUES
  ('coaching_first_invite', 'Invitation coaching (tu)', 
   'Ta séance de coaching t''attend !',
   '<p>Bonjour {{prenom}},</p><p>Ta formation <strong>{{formation}}</strong> est terminée, bravo ! 🎉</p><p>Tu bénéficies de <strong>{{coaching_sessions_total}} séance(s) de coaching individuel</strong> incluse(s) dans ta formule <strong>{{formule}}</strong>.</p><p>Tu as jusqu''au <strong>{{coaching_deadline}}</strong> pour en profiter.</p><p>Toutes les instructions pour réserver ta première séance sont disponibles dans ton espace personnel de formation.</p><p>À très vite !</p>',
   true),
  ('coaching_periodic_reminder', 'Rappel coaching périodique (tu)',
   'N''oublie pas tes séances de coaching !',
   '<p>Bonjour {{prenom}},</p><p>Un petit rappel : tu as encore <strong>{{coaching_sessions_remaining}} séance(s) de coaching</strong> à utiliser dans le cadre de ta formation <strong>{{formation}}</strong>.</p><p>Ces séances sont valables jusqu''au <strong>{{coaching_deadline}}</strong>.</p><p>N''hésite pas à réserver ta prochaine séance depuis ton espace personnel de formation.</p><p>À bientôt !</p>',
   true),
  ('coaching_final_reminder', 'Dernière relance coaching (tu)',
   '⚠️ Dernière chance pour tes séances de coaching',
   '<p>Bonjour {{prenom}},</p><p>Tes séances de coaching pour la formation <strong>{{formation}}</strong> expirent le <strong>{{coaching_deadline}}</strong>, c''est bientôt !</p><p>Il te reste <strong>{{coaching_sessions_remaining}} séance(s)</strong> non utilisée(s).</p><p>C''est le moment de réserver depuis ton espace personnel de formation avant qu''il ne soit trop tard.</p><p>À très vite !</p>',
   true)
ON CONFLICT DO NOTHING;
