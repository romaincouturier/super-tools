-- Lot 5 de la refonte de connexion apprenant.
-- Le mode d'accès e-learning disparaît comme voie d'accès (arbitrage Q4) :
-- un achat ou une inscription provisionne le compte et envoie un email
-- d'activation vers l'espace apprenant, quelle que soit la source.
-- Le réglage n'est plus lu par aucun code ; on retire la ligne.
DELETE FROM public.app_settings WHERE setting_key = 'elearning_access_mode';
