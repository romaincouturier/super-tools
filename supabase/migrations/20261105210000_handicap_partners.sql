-- Réseau de partenaires du champ du handicap (indicateur 26).
--
-- Le référentiel attend que l'organisme démontre l'identification d'un réseau
-- de partenaires, experts et acteurs du handicap, mobilisable par les
-- personnels. Rien dans l'application ne le portait : le réseau existait dans
-- un classeur externe, invisible depuis SuperTools et absent des sauvegardes.
--
-- Les sept lignes insérées reprennent le tableau de contacts tenu hors de
-- l'application. Elles sont posées en ON CONFLICT DO NOTHING sur l'organisme,
-- donc une seconde exécution n'en duplique aucune et n'écrase aucune
-- modification ultérieure.
--
-- Additive et idempotente. Aucune donnée existante n'est modifiée.

CREATE TABLE IF NOT EXISTS public.handicap_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation text NOT NULL,
  -- Borné côté application (src/lib/handicapPartners.ts) ; la base accepte
  -- toute valeur pour qu'un type nouveau n'exige pas une migration.
  handicap_type text NOT NULL DEFAULT 'tous',
  address text,
  phone text,
  email text,
  url text,
  notes text,
  last_contact_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_handicap_partners_organisation
  ON public.handicap_partners(organisation);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.handicap_partners TO authenticated;
GRANT ALL ON public.handicap_partners TO service_role;

ALTER TABLE public.handicap_partners ENABLE ROW LEVEL SECURITY;

-- Même porte que le reste du module formations : le réseau sert à orienter un
-- bénéficiaire, il n'a aucune raison d'être public.
DROP POLICY IF EXISTS handicap_partners_staff ON public.handicap_partners;
CREATE POLICY handicap_partners_staff ON public.handicap_partners
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR has_module_access(auth.uid(), 'formations'))
  WITH CHECK (is_admin(auth.uid()) OR has_module_access(auth.uid(), 'formations'));

INSERT INTO public.handicap_partners (organisation, handicap_type, address, phone, email, url, notes)
VALUES
  ('AGEFIPH', 'tous',
   '24/28 Villa Baudran, 21/37 rue de Stalingrad, 94110 Arcueil',
   '0 800 11 10 09', NULL, 'https://www.agefiph.fr',
   'Aide les personnes handicapées dans leur vie professionnelle et accompagne les entreprises dans leurs projets de recrutement et de maintien dans l''emploi.'),
  ('Maison départementale des personnes handicapées (MDPH)', 'tous',
   '69 rue de la Victoire, 75009 Paris',
   '01 53 32 39 39', 'contact@mdph.paris.fr',
   'https://www.grandlyon.com/services/maison-departementale-et-metropolitaine-des-personnes-handicapees.html',
   'Informe sur les prestations possibles. Aide à formuler les projets de vie et les demandes de compensation. Contact Rhône : handicap@rhone.fr'),
  ('FIPHFP', 'tous', NULL, NULL, NULL,
   'https://www.fiphfp.fr/nos-regions/auvergne-rhone-alpes',
   'Fonds pour l''insertion des personnes handicapées dans la fonction publique. Contact territorial Auvergne-Rhône-Alpes.'),
  ('Cap emploi 69', 'tous',
   '3 avenue du Général Brosset, 69160 Tassin-la-Demi-Lune', NULL, NULL,
   'https://www.capemploi.info/nos-missions/',
   'Accompagnement et construction de parcours pour les publics nécessitant un accompagnement spécialisé. Conseille aussi les employeurs sur le recrutement et le maintien en emploi.'),
  ('CG Interprétation / Ex-aequo', 'auditif',
   '8 rue Rameau, BP 90235, 78002 Versailles Cedex',
   '01 39 24 88 55', 'info@cgtraduction.fr', 'http://ex-aequo.fr/',
   'Interprétation de réunions, formations et conférences en langue des signes française. Ex-aequo : 04 78 26 12 42, contact@ex-aequo.fr'),
  ('Laville Impressions / FIDEV', 'visuel',
   'CAP 18, 189 rue d''Aubervilliers, 75886 Paris — FIDEV, 12 rue Saint-Simon, 69009 Lyon',
   '01 40 38 84 80', 'devcom@lavilleimpressions.fr', NULL,
   'Braille et graphisme tactile : documents en caractères agrandis, braille et images tactiles. FIDEV : adaptation de poste, études ergonomiques, 04 72 73 22 10, fidev@fidev.asso.fr'),
  ('Axsol Location / Medinov', 'moteur',
   '45 avenue Georges Politzer, 78190 Trappes — 99 rue de Gerland, 69007 Lyon',
   '01 76 78 19 59', 'location@axsol.fr', NULL,
   'Rampes et plates-formes amovibles, monte-escaliers, location de matériel. Medinov couvre Lyon et 50 km, 04 37 28 08 14, contact@medinov.fr')
ON CONFLICT (organisation) DO NOTHING;

COMMENT ON TABLE public.handicap_partners IS
  'Réseau de partenaires du champ du handicap mobilisable pour accueillir, accompagner ou orienter un bénéficiaire (indicateur 26).';
