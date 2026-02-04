-- Create email snippets table for pre-configured text blocks
CREATE TABLE IF NOT EXISTS email_snippets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'Général',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE email_snippets ENABLE ROW LEVEL SECURITY;

-- RLS policies - all authenticated users can read snippets
CREATE POLICY "Users can view all email snippets" ON email_snippets
  FOR SELECT USING (true);

CREATE POLICY "Users can create email snippets" ON email_snippets
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update email snippets" ON email_snippets
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete email snippets" ON email_snippets
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Index for faster queries
CREATE INDEX idx_email_snippets_category ON email_snippets(category);
CREATE INDEX idx_email_snippets_position ON email_snippets(position);

-- Insert some default snippets
INSERT INTO email_snippets (name, content, category, position) VALUES
  ('Référence Formation Agile', 'Je vous propose une formation sur les méthodes agiles, adaptée à vos besoins spécifiques. Cette formation couvre les fondamentaux de Scrum, Kanban et les pratiques de gestion de projet moderne.', 'Formations', 1),
  ('Référence Formation Management', 'Notre formation en management permet de développer les compétences essentielles pour diriger une équipe efficacement : leadership, communication, délégation et motivation des collaborateurs.', 'Formations', 2),
  ('Référence Mission Coaching', 'Je vous accompagne dans une mission de coaching personnalisé pour renforcer vos pratiques managériales et atteindre vos objectifs professionnels.', 'Missions', 3),
  ('Référence Mission Transformation', 'Cette mission de transformation organisationnelle vise à accompagner votre entreprise dans sa transition vers des méthodes de travail plus agiles et collaboratives.', 'Missions', 4),
  ('Signature', E'Bien cordialement,\n\n[Votre nom]\n[Votre titre]', 'Général', 10);
