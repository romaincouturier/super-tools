-- Table pour stocker les configurations des formations
CREATE TABLE public.formation_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  formation_name TEXT NOT NULL UNIQUE,
  prix DECIMAL(10,2) NOT NULL DEFAULT 0,
  duree_heures INTEGER NOT NULL DEFAULT 0,
  programme_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.formation_configs ENABLE ROW LEVEL SECURITY;

-- Politique pour lecture publique (les configs sont accessibles à tous les utilisateurs authentifiés)
CREATE POLICY "Authenticated users can view formation configs"
ON public.formation_configs
FOR SELECT
TO authenticated
USING (true);

-- Politique pour modification par les utilisateurs authentifiés
CREATE POLICY "Authenticated users can update formation configs"
ON public.formation_configs
FOR UPDATE
TO authenticated
USING (true);

-- Politique pour insertion par les utilisateurs authentifiés
CREATE POLICY "Authenticated users can insert formation configs"
ON public.formation_configs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Trigger pour updated_at
CREATE TRIGGER update_formation_configs_updated_at
BEFORE UPDATE ON public.formation_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insérer les formations par défaut
INSERT INTO public.formation_configs (formation_name, prix, duree_heures, programme_url) VALUES
('Développement et déploiement de formations tutorées', 1490.00, 14, NULL),
('Création de formations digitales avec Genially', 1490.00, 14, NULL),
('Créer des jeux pédagogiques avec Genially', 1490.00, 14, NULL),
('Gamifier l''apprentissage avec Genially', 1490.00, 14, NULL),
('Créer des parcours pédagogiques interactifs', 1490.00, 14, NULL),
('Créer des formations interactives avancées avec Genially', 1490.00, 14, NULL);