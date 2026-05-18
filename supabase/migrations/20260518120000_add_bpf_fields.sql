-- Add NSF specialty code to training catalog
ALTER TABLE formation_configs
  ADD COLUMN IF NOT EXISTS code_specialite_nsf TEXT,
  ADD COLUMN IF NOT EXISTS label_specialite_nsf TEXT;

-- Add BPF participant type to participants
-- Values: 'salarie_prive' | 'apprenti' | 'demandeur_emploi' | 'particulier' | 'autre'
ALTER TABLE training_participants
  ADD COLUMN IF NOT EXISTS type_stagiaire_bpf TEXT;

-- Add BPF funding source to trainings
-- Values: 'entreprise' | 'opco_plan_competences' | 'opco_cpf' | 'opco_apprentissage' |
--         'opco_professionnalisation' | 'opco_alternance' | 'opco_transition_pro' |
--         'opco_demandeur_emploi' | 'opco_tns' |
--         'pouvoirs_publics_agents' | 'instances_europeennes' | 'etat' |
--         'conseils_regionaux' | 'france_travail' | 'autres_publics' |
--         'particulier' | 'sous_traitance' | 'autre'
ALTER TABLE trainings
  ADD COLUMN IF NOT EXISTS source_financement_bpf TEXT;

-- BPF annual reports table
CREATE TABLE IF NOT EXISTS bpf_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annee INTEGER NOT NULL,
  -- Section C: Revenues by source (manual override, auto-calculated otherwise)
  produits_ligne1 NUMERIC DEFAULT 0,       -- entreprises salariés
  produits_opco_a NUMERIC DEFAULT 0,       -- contrats apprentissage
  produits_opco_b NUMERIC DEFAULT 0,       -- contrats professionnalisation
  produits_opco_c NUMERIC DEFAULT 0,       -- alternance
  produits_opco_d NUMERIC DEFAULT 0,       -- transition professionnelle
  produits_opco_e NUMERIC DEFAULT 0,       -- CPF
  produits_opco_f NUMERIC DEFAULT 0,       -- demandeurs emploi
  produits_opco_g NUMERIC DEFAULT 0,       -- TNS
  produits_opco_h NUMERIC DEFAULT 0,       -- plan compétences / autres
  produits_ligne3 NUMERIC DEFAULT 0,       -- pouvoirs publics agents
  produits_ligne4 NUMERIC DEFAULT 0,       -- instances européennes
  produits_ligne5 NUMERIC DEFAULT 0,       -- État
  produits_ligne6 NUMERIC DEFAULT 0,       -- Conseils régionaux
  produits_ligne7 NUMERIC DEFAULT 0,       -- France Travail
  produits_ligne8 NUMERIC DEFAULT 0,       -- Autres ressources publiques
  produits_ligne9 NUMERIC DEFAULT 0,       -- particuliers à leurs frais
  produits_ligne10 NUMERIC DEFAULT 0,      -- autres OF (sous-traitance reçue)
  produits_ligne11 NUMERIC DEFAULT 0,      -- autres produits
  -- Section D: Charges (manual input)
  charges_total NUMERIC DEFAULT 0,
  charges_salaires_formateurs NUMERIC DEFAULT 0,
  charges_achats_prestations NUMERIC DEFAULT 0,
  -- Global CA
  chiffre_affaires_global NUMERIC,
  -- Metadata
  use_auto_calculation BOOLEAN DEFAULT true,  -- if true, C is auto-computed from trainings data
  bilan_comptable_pdf_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(annee)
);
