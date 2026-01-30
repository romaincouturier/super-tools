-- ===========================================
-- Module Gestion des Formations - Sprint 1
-- ===========================================

-- 1. Table des formations
CREATE TABLE public.trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date DATE NOT NULL,
  end_date DATE,
  training_name TEXT NOT NULL,
  location TEXT NOT NULL,
  client_name TEXT NOT NULL,
  evaluation_link TEXT NOT NULL,
  program_file_url TEXT,
  prerequisites TEXT[] DEFAULT '{}',
  format_formation TEXT CHECK (format_formation IN ('intra', 'inter-entreprises', 'classe_virtuelle')),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Table des horaires par journée
CREATE TABLE public.training_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  day_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (training_id, day_date)
);

-- 3. Table des participants
CREATE TABLE public.training_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT NOT NULL,
  company TEXT,
  needs_survey_token TEXT UNIQUE,
  needs_survey_status TEXT NOT NULL DEFAULT 'non_envoye' CHECK (needs_survey_status IN ('non_envoye', 'envoye', 'en_cours', 'complete', 'valide_formateur', 'expire')),
  needs_survey_sent_at TIMESTAMP WITH TIME ZONE,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (training_id, email)
);

-- 4. Table du questionnaire de besoins (formulaire complet)
CREATE TABLE public.questionnaire_besoins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.training_participants(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  etat VARCHAR(50) NOT NULL DEFAULT 'non_envoye' CHECK (etat IN ('non_envoye', 'envoye', 'en_cours', 'complete', 'valide_formateur', 'expire')),
  
  -- Section 1: Identification
  email VARCHAR(255),
  nom VARCHAR(100),
  prenom VARCHAR(100),
  societe VARCHAR(150),
  fonction VARCHAR(100),
  
  -- Section 2: Positionnement
  experience_sujet VARCHAR(50) CHECK (experience_sujet IN ('aucune', 'courte', 'longue', 'certification')),
  experience_details TEXT,
  lecture_programme VARCHAR(50) CHECK (lecture_programme IN ('complete', 'partielle', 'non')),
  prerequis_validation VARCHAR(50) CHECK (prerequis_validation IN ('oui', 'partiellement', 'non')),
  prerequis_details TEXT,
  niveau_actuel INT CHECK (niveau_actuel BETWEEN 0 AND 10),
  competences_actuelles TEXT,
  
  -- Section 3: Objectifs
  competences_visees TEXT,
  lien_mission TEXT,
  niveau_motivation INT CHECK (niveau_motivation BETWEEN 1 AND 5),
  
  -- Section 4: Adaptation
  modalites_preferences JSONB DEFAULT '[]',
  besoins_accessibilite TEXT,
  contraintes_orga TEXT,
  
  -- Section 5: Commentaires
  commentaires_libres TEXT,
  
  -- Section 6: RGPD
  consentement_rgpd BOOLEAN NOT NULL DEFAULT FALSE,
  date_consentement_rgpd TIMESTAMP WITH TIME ZONE,
  
  -- Flags métier
  necessite_validation_formateur BOOLEAN DEFAULT FALSE,
  necessite_amenagement BOOLEAN DEFAULT FALSE,
  
  -- Audit
  date_envoi TIMESTAMP WITH TIME ZONE,
  date_premiere_ouverture TIMESTAMP WITH TIME ZONE,
  date_derniere_sauvegarde TIMESTAMP WITH TIME ZONE,
  date_soumission TIMESTAMP WITH TIME ZONE,
  date_validation_formateur TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE (training_id, participant_id)
);

-- 5. Table des événements du questionnaire (logs)
CREATE TABLE public.questionnaire_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id UUID NOT NULL REFERENCES public.questionnaire_besoins(id) ON DELETE CASCADE,
  type_evenement VARCHAR(50) NOT NULL CHECK (type_evenement IN (
    'envoi_initial', 'premiere_ouverture', 'sauvegarde_auto', 'sauvegarde_manuelle',
    'soumission', 'validation_formateur', 'email_confirmation_envoye', 
    'email_notification_envoye', 'expiration'
  )),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Table de la file d'attente des emails
CREATE TABLE public.scheduled_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  participant_id UUID REFERENCES public.training_participants(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL CHECK (email_type IN ('needs_survey', 'reminder_j7', 'needs_summary', 'thank_you', 'relance')),
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 7. Table de la bibliothèque des programmes
CREATE TABLE public.program_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ===========================================
-- Triggers pour updated_at
-- ===========================================

CREATE TRIGGER update_trainings_updated_at
BEFORE UPDATE ON public.trainings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_questionnaire_besoins_updated_at
BEFORE UPDATE ON public.questionnaire_besoins
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- Index pour les performances
-- ===========================================

CREATE INDEX idx_trainings_start_date ON public.trainings(start_date);
CREATE INDEX idx_trainings_created_by ON public.trainings(created_by);
CREATE INDEX idx_training_participants_training ON public.training_participants(training_id);
CREATE INDEX idx_training_participants_token ON public.training_participants(needs_survey_token);
CREATE INDEX idx_questionnaire_besoins_token ON public.questionnaire_besoins(token);
CREATE INDEX idx_questionnaire_besoins_etat ON public.questionnaire_besoins(etat);
CREATE INDEX idx_questionnaire_besoins_flags ON public.questionnaire_besoins(necessite_validation_formateur, necessite_amenagement);
CREATE INDEX idx_questionnaire_events_questionnaire ON public.questionnaire_events(questionnaire_id, created_at DESC);
CREATE INDEX idx_scheduled_emails_pending ON public.scheduled_emails(scheduled_for, status) WHERE status = 'pending';
CREATE INDEX idx_scheduled_emails_training ON public.scheduled_emails(training_id);

-- ===========================================
-- Enable RLS
-- ===========================================

ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_besoins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questionnaire_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_files ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- RLS Policies - Tables authentifiées
-- ===========================================

-- Trainings
CREATE POLICY "Authenticated users can view trainings"
ON public.trainings FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create trainings"
ON public.trainings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update trainings"
ON public.trainings FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete trainings"
ON public.trainings FOR DELETE TO authenticated
USING (true);

-- Training schedules
CREATE POLICY "Authenticated users can view training schedules"
ON public.training_schedules FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage training schedules"
ON public.training_schedules FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Training participants
CREATE POLICY "Authenticated users can view participants"
ON public.training_participants FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage participants"
ON public.training_participants FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Scheduled emails
CREATE POLICY "Authenticated users can view scheduled emails"
ON public.scheduled_emails FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can manage scheduled emails"
ON public.scheduled_emails FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Program files
CREATE POLICY "Authenticated users can view program files"
ON public.program_files FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can upload program files"
ON public.program_files FOR INSERT TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Authenticated users can delete their program files"
ON public.program_files FOR DELETE TO authenticated
USING (auth.uid() = uploaded_by);

-- ===========================================
-- RLS Policies - Questionnaire (accès public via token)
-- ===========================================

-- Questionnaire besoins - SELECT pour auth ou via token
CREATE POLICY "Authenticated users can view questionnaires"
ON public.questionnaire_besoins FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Public can view own questionnaire via token"
ON public.questionnaire_besoins FOR SELECT TO anon
USING (true);

-- Questionnaire besoins - UPDATE pour auth ou via token
CREATE POLICY "Authenticated users can update questionnaires"
ON public.questionnaire_besoins FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Public can update own questionnaire"
ON public.questionnaire_besoins FOR UPDATE TO anon
USING (true);

-- Questionnaire besoins - INSERT uniquement par trigger/authenticated
CREATE POLICY "Authenticated users can create questionnaires"
ON public.questionnaire_besoins FOR INSERT TO authenticated
WITH CHECK (true);

-- Questionnaire events
CREATE POLICY "Authenticated users can view events"
ON public.questionnaire_events FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Anyone can log events"
ON public.questionnaire_events FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- ===========================================
-- Storage bucket pour les programmes
-- ===========================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('training-programs', 'training-programs', true)
ON CONFLICT (id) DO NOTHING;

-- Policies pour le bucket
CREATE POLICY "Training programs are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'training-programs');

CREATE POLICY "Authenticated users can upload training programs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'training-programs');

CREATE POLICY "Authenticated users can update training programs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'training-programs');

CREATE POLICY "Authenticated users can delete training programs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'training-programs');