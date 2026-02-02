-- Qualiopi Module Migration
-- Ce module permet de suivre la conformite Qualiopi avec ses 7 criteres et 32 indicateurs

-- Table des criteres Qualiopi
CREATE TABLE IF NOT EXISTS qualiopi_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  criterion_number INTEGER NOT NULL CHECK (criterion_number BETWEEN 1 AND 7),
  title TEXT NOT NULL,
  description TEXT,
  compliance_status TEXT DEFAULT 'not_evaluated' CHECK (compliance_status IN ('compliant', 'partial', 'non_compliant', 'not_evaluated')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, criterion_number)
);

-- Table des indicateurs Qualiopi (32 indicateurs)
CREATE TABLE IF NOT EXISTS qualiopi_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  criterion_id UUID REFERENCES qualiopi_criteria(id) ON DELETE CASCADE,
  indicator_number INTEGER NOT NULL CHECK (indicator_number BETWEEN 1 AND 32),
  title TEXT NOT NULL,
  description TEXT,
  requirements TEXT, -- Ce qui est attendu
  evidence_required TEXT, -- Preuves a fournir
  compliance_status TEXT DEFAULT 'not_evaluated' CHECK (compliance_status IN ('compliant', 'partial', 'non_compliant', 'not_evaluated', 'not_applicable')),
  notes TEXT,
  action_plan TEXT,
  responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, indicator_number)
);

-- Table des documents Qualiopi
CREATE TABLE IF NOT EXISTS qualiopi_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  indicator_id UUID REFERENCES qualiopi_indicators(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_type TEXT NOT NULL, -- procedure, formulaire, rapport, preuve, etc.
  description TEXT,
  file_path TEXT,
  file_url TEXT,
  version TEXT DEFAULT '1.0',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived', 'obsolete')),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des preuves liees aux fonctionnalites de l'application
CREATE TABLE IF NOT EXISTS qualiopi_evidence_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  indicator_id UUID REFERENCES qualiopi_indicators(id) ON DELETE CASCADE,
  feature_type TEXT NOT NULL, -- evaluations, formations, certificates, improvements, etc.
  feature_description TEXT NOT NULL,
  auto_compliance BOOLEAN DEFAULT false, -- Si la fonctionnalite apporte une conformite automatique
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des audits internes
CREATE TABLE IF NOT EXISTS qualiopi_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  audit_type TEXT NOT NULL CHECK (audit_type IN ('internal', 'certification', 'surveillance', 'renewal')),
  audit_date DATE NOT NULL,
  auditor_name TEXT,
  auditor_organization TEXT,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  overall_result TEXT CHECK (overall_result IN ('passed', 'passed_with_conditions', 'failed', NULL)),
  report_summary TEXT,
  next_audit_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des non-conformites et actions correctives
CREATE TABLE IF NOT EXISTS qualiopi_non_conformities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  audit_id UUID REFERENCES qualiopi_audits(id) ON DELETE CASCADE,
  indicator_id UUID REFERENCES qualiopi_indicators(id) ON DELETE SET NULL,
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'major', 'critical')),
  description TEXT NOT NULL,
  root_cause TEXT,
  corrective_action TEXT,
  preventive_action TEXT,
  responsible_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed', 'verified')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fonction pour initialiser les criteres et indicateurs Qualiopi pour une organisation
CREATE OR REPLACE FUNCTION initialize_qualiopi_for_organization(org_id UUID)
RETURNS void AS $$
DECLARE
  criterion_id UUID;
BEGIN
  -- Critere 1: Conditions d'information du public
  INSERT INTO qualiopi_criteria (organization_id, criterion_number, title, description)
  VALUES (org_id, 1, 'Conditions d''information du public',
          'Les conditions d''information du public sur les prestations proposees, les delais pour y acceder et les resultats obtenus.')
  RETURNING id INTO criterion_id;

  INSERT INTO qualiopi_indicators (organization_id, criterion_id, indicator_number, title, description, requirements) VALUES
  (org_id, criterion_id, 1, 'Information sur les prestations', 'Le prestataire diffuse une information accessible au public', 'Catalogue, site web, plaquettes avec objectifs, contenus, modalites, tarifs'),
  (org_id, criterion_id, 2, 'Indicateurs de resultats', 'Le prestataire diffuse des indicateurs de resultats adaptes', 'Taux de satisfaction, taux de reussite, taux d''insertion'),
  (org_id, criterion_id, 3, 'Resultats certifications', 'Le prestataire diffuse le taux d''obtention des certifications', 'Applicable aux formations certifiantes uniquement');

  -- Critere 2: Identification precise des objectifs
  INSERT INTO qualiopi_criteria (organization_id, criterion_number, title, description)
  VALUES (org_id, 2, 'Identification des objectifs et adaptation',
          'L''identification precise des objectifs des prestations et l''adaptation aux publics beneficiaires.')
  RETURNING id INTO criterion_id;

  INSERT INTO qualiopi_indicators (organization_id, criterion_id, indicator_number, title, description, requirements) VALUES
  (org_id, criterion_id, 4, 'Analyse du besoin', 'Le prestataire analyse le besoin du beneficiaire en lien avec l''entreprise', 'Questionnaires prealables, entretiens de positionnement'),
  (org_id, criterion_id, 5, 'Objectifs operationnels', 'Le prestataire definit les objectifs operationnels et evaluables', 'Programme detaille avec objectifs pedagogiques'),
  (org_id, criterion_id, 6, 'Contenus et modalites', 'Le prestataire etablit les contenus et modalites de mise en oeuvre', 'Supports pedagogiques, methodes d''animation'),
  (org_id, criterion_id, 7, 'Adequation contenu/certification', 'Le prestataire determine les procedures de positionnement', 'Applicable aux formations certifiantes'),
  (org_id, criterion_id, 8, 'Conditions de deroulement', 'Le prestataire determine les conditions de deroulement', 'Locaux, equipements, ressources techniques');

  -- Critere 3: Adaptation aux beneficiaires
  INSERT INTO qualiopi_criteria (organization_id, criterion_number, title, description)
  VALUES (org_id, 3, 'Adaptation aux beneficiaires',
          'L''adaptation aux publics beneficiaires des prestations et des modalites d''accueil, d''accompagnement, de suivi et d''evaluation.')
  RETURNING id INTO criterion_id;

  INSERT INTO qualiopi_indicators (organization_id, criterion_id, indicator_number, title, description, requirements) VALUES
  (org_id, criterion_id, 9, 'Information sur les conditions', 'Le prestataire informe sur les conditions d''acces, delais, accessibilite PSH', 'Convocations, informations prealables'),
  (org_id, criterion_id, 10, 'Adaptation des modalites', 'Le prestataire adapte les modalites d''accueil', 'Personnalisation des parcours'),
  (org_id, criterion_id, 11, 'Evaluation des acquis', 'Le prestataire evalue l''atteinte des objectifs', 'Tests, evaluations continues, certifications'),
  (org_id, criterion_id, 12, 'Engagement des parties prenantes', 'Le prestataire s''engage a impliquer les parties prenantes', 'Communication avec employeurs/financeurs'),
  (org_id, criterion_id, 13, 'Coordination des apprentissages', 'Le prestataire coordonne les intervenants internes/externes', 'Applicable si plusieurs intervenants'),
  (org_id, criterion_id, 14, 'Mise en oeuvre de l''accompagnement', 'Le prestataire met en oeuvre un accompagnement socio-professionnel', 'Applicable VAE et CFA'),
  (org_id, criterion_id, 15, 'Droit a la formation', 'Le prestataire informe sur les droits a la formation', 'Information CPF, alternance'),
  (org_id, criterion_id, 16, 'Reglement interieur', 'Le prestataire etablit le reglement interieur applicable', 'Reglement interieur conforme');

  -- Critere 4: Adequation des moyens
  INSERT INTO qualiopi_criteria (organization_id, criterion_number, title, description)
  VALUES (org_id, 4, 'Adequation des moyens',
          'L''adequation des moyens pedagogiques, techniques et d''encadrement aux prestations mises en oeuvre.')
  RETURNING id INTO criterion_id;

  INSERT INTO qualiopi_indicators (organization_id, criterion_id, indicator_number, title, description, requirements) VALUES
  (org_id, criterion_id, 17, 'Moyens humains et techniques', 'Le prestataire met a disposition des moyens adaptes', 'Equipements, ressources pedagogiques'),
  (org_id, criterion_id, 18, 'Coordination des intervenants', 'Le prestataire coordonne l''intervention des intervenants', 'Reunions pedagogiques, coordination'),
  (org_id, criterion_id, 19, 'Ressources pedagogiques', 'Le prestataire met a disposition des ressources pedagogiques', 'Supports, documentation, outils'),
  (org_id, criterion_id, 20, 'Referent handicap', 'Le prestataire dispose d''un referent handicap', 'Referent PSH identifie et forme');

  -- Critere 5: Qualification des personnels
  INSERT INTO qualiopi_criteria (organization_id, criterion_number, title, description)
  VALUES (org_id, 5, 'Qualification des personnels',
          'La qualification et le developpement des connaissances et competences des personnels.')
  RETURNING id INTO criterion_id;

  INSERT INTO qualiopi_indicators (organization_id, criterion_id, indicator_number, title, description, requirements) VALUES
  (org_id, criterion_id, 21, 'Competences des formateurs', 'Le prestataire determine les competences des intervenants', 'CV, diplomes, certifications'),
  (org_id, criterion_id, 22, 'Veille des competences', 'Le prestataire entretient les competences des intervenants', 'Plan de formation interne');

  -- Critere 6: Inscription dans l''environnement
  INSERT INTO qualiopi_criteria (organization_id, criterion_number, title, description)
  VALUES (org_id, 6, 'Inscription dans l''environnement professionnel',
          'L''inscription et l''investissement du prestataire dans son environnement professionnel.')
  RETURNING id INTO criterion_id;

  INSERT INTO qualiopi_indicators (organization_id, criterion_id, indicator_number, title, description, requirements) VALUES
  (org_id, criterion_id, 23, 'Veille legale et reglementaire', 'Le prestataire realise une veille sur les evolutions', 'Abonnements, formations, conferences'),
  (org_id, criterion_id, 24, 'Veille competences metiers', 'Le prestataire realise une veille sur les competences metiers', 'Contacts entreprises, branches professionnelles'),
  (org_id, criterion_id, 25, 'Veille innovation', 'Le prestataire realise une veille sur les innovations', 'Nouvelles technologies, methodes pedagogiques'),
  (org_id, criterion_id, 26, 'Mobilisation des partenaires', 'Le prestataire mobilise les partenaires exterieurs', 'Partenariats, conventions'),
  (org_id, criterion_id, 27, 'Reseau de pairs', 'Le prestataire developpe un reseau de pairs', 'Associations professionnelles, groupes de travail');

  -- Critere 7: Traitement des reclamations
  INSERT INTO qualiopi_criteria (organization_id, criterion_number, title, description)
  VALUES (org_id, 7, 'Amelioration continue',
          'Le recueil et la prise en compte des appreciations et des reclamations formulees par les parties prenantes.')
  RETURNING id INTO criterion_id;

  INSERT INTO qualiopi_indicators (organization_id, criterion_id, indicator_number, title, description, requirements) VALUES
  (org_id, criterion_id, 28, 'Recueil des appreciations', 'Le prestataire recueille les appreciations des parties prenantes', 'Questionnaires de satisfaction'),
  (org_id, criterion_id, 29, 'Traitement des reclamations', 'Le prestataire traite les difficultes rencontrees', 'Procedure de reclamation'),
  (org_id, criterion_id, 30, 'Actions d''amelioration', 'Le prestataire met en oeuvre des mesures d''amelioration', 'Plan d''actions correctives'),
  (org_id, criterion_id, 31, 'Veille satisfaction', 'Le prestataire organise la veille sur la satisfaction', 'Indicateurs de suivi'),
  (org_id, criterion_id, 32, 'Processus d''amelioration continue', 'Le prestataire met en oeuvre une demarche d''amelioration continue', 'Revue de direction, objectifs qualite');
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE qualiopi_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualiopi_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualiopi_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualiopi_evidence_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualiopi_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualiopi_non_conformities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for qualiopi_criteria
CREATE POLICY "Users can view criteria in their organization"
  ON qualiopi_criteria FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage criteria in their organization"
  ON qualiopi_criteria FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

-- RLS Policies for qualiopi_indicators
CREATE POLICY "Users can view indicators in their organization"
  ON qualiopi_indicators FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage indicators in their organization"
  ON qualiopi_indicators FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

-- RLS Policies for qualiopi_documents
CREATE POLICY "Users can view documents in their organization"
  ON qualiopi_documents FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage documents in their organization"
  ON qualiopi_documents FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

-- RLS Policies for qualiopi_evidence_links
CREATE POLICY "Users can view evidence links in their organization"
  ON qualiopi_evidence_links FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage evidence links in their organization"
  ON qualiopi_evidence_links FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

-- RLS Policies for qualiopi_audits
CREATE POLICY "Users can view audits in their organization"
  ON qualiopi_audits FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage audits in their organization"
  ON qualiopi_audits FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

-- RLS Policies for qualiopi_non_conformities
CREATE POLICY "Users can view non-conformities in their organization"
  ON qualiopi_non_conformities FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can manage non-conformities in their organization"
  ON qualiopi_non_conformities FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  ));

-- Trigger pour mettre a jour updated_at
CREATE OR REPLACE FUNCTION update_qualiopi_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_qualiopi_criteria_timestamp
  BEFORE UPDATE ON qualiopi_criteria
  FOR EACH ROW EXECUTE FUNCTION update_qualiopi_timestamp();

CREATE TRIGGER update_qualiopi_indicators_timestamp
  BEFORE UPDATE ON qualiopi_indicators
  FOR EACH ROW EXECUTE FUNCTION update_qualiopi_timestamp();

CREATE TRIGGER update_qualiopi_documents_timestamp
  BEFORE UPDATE ON qualiopi_documents
  FOR EACH ROW EXECUTE FUNCTION update_qualiopi_timestamp();

CREATE TRIGGER update_qualiopi_audits_timestamp
  BEFORE UPDATE ON qualiopi_audits
  FOR EACH ROW EXECUTE FUNCTION update_qualiopi_timestamp();

CREATE TRIGGER update_qualiopi_non_conformities_timestamp
  BEFORE UPDATE ON qualiopi_non_conformities
  FOR EACH ROW EXECUTE FUNCTION update_qualiopi_timestamp();
