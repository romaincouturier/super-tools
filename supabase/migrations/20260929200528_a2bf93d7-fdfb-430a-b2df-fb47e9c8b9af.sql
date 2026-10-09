ALTER TABLE public.training_participants
  ADD CONSTRAINT training_participants_type_stagiaire_bpf_check
  CHECK (type_stagiaire_bpf IS NULL OR type_stagiaire_bpf IN ('salarie_prive','apprenti','demandeur_emploi','particulier','autre'));
ALTER TABLE public.training_participants
  ADD CONSTRAINT training_participants_source_financement_bpf_check
  CHECK (source_financement_bpf IS NULL OR source_financement_bpf IN ('entreprise','opco_plan_competences','opco_cpf','opco_apprentissage','opco_professionnalisation','opco_alternance','opco_transition_pro','opco_demandeur_emploi','opco_tns','pouvoirs_publics_agents','etat','conseils_regionaux','france_travail','autres_publics','particulier','sous_traitance','autre'));