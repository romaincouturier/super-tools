-- Agent — élargissement de l'allowlist aux tables métier manquantes.
--
-- Le registre ne couvrait que 44 tables sur 232 : l'agent ignorait des pans
-- entiers du métier (actions de mission, actions quotidiennes, formateurs,
-- enquêtes, LMS, réclamations, commandes…). Sont volontairement EXCLUES :
-- l'infrastructure (files d'indexation, embeddings, caches, journaux,
-- jetons, quotas), les données sensibles (profils, sécurité, abonnements,
-- clés d'API) et les signatures manuscrites.
--
-- Les colonnes ne sont pas déclarées ici : elles sont générées depuis le
-- catalogue PostgreSQL (voir 20260727190000_agent_schema_from_catalog.sql).

INSERT INTO public.agent_schema_registry (table_name, description, display_order) VALUES

-- ── Missions ────────────────────────────────────────────────
('mission_actions',            'Actions à mener sur une mission (titre, statut, ordre)', 50),
('mission_contacts',           'Contacts rattachés à une mission', 51),
('mission_credits',            'Crédits / enveloppes de jours vendus sur une mission', 52),

-- ── Suivi du travail ────────────────────────────────────────
('daily_actions',              'Actions quotidiennes datées, rattachables à n''importe quelle entité (entity_type / entity_id) : le système de rappels de SuperTools', 53),
('time_entries',               'Temps passé saisi par les collaborateurs', 54),

-- ── Formations : intervenants et qualité ────────────────────
('trainers',                   'Formateurs et intervenants', 60),
('trainer_evaluations',        'Évaluations des formateurs', 61),
('trainer_training_adequacy',  'Adéquation formateur / formation (exigence qualité)', 62),
('reclamations',               'Réclamations clients et apprenants (exigence qualité)', 63),
('improvements',               'Actions d''amélioration continue issues des analyses d''évaluations', 64),
('stakeholder_appreciations',  'Appréciations des parties prenantes', 65),
('sponsor_cold_evaluations',   'Évaluations à froid des commanditaires', 66),
('bpf_reports',                'Bilans pédagogiques et financiers (BPF)', 67),
('post_evaluation_emails',     'Emails envoyés après évaluation', 68),

-- ── Formations : logistique et supports ─────────────────────
('training_documents',         'Documents attachés à une formation', 70),
('training_supports',          'Supports de formation', 71),
('training_live_meetings',     'Sessions live rattachées à une formation', 72),
('training_venues',            'Lieux de formation', 73),
('training_formulas',          'Formules tarifaires proposées sur une formation', 74),
('formation_formulas',         'Catalogue des formules de formation', 75),
('logistics_checklist_items',  'Points de checklist logistique d''une formation', 76),
('participant_files',          'Fichiers déposés par ou pour un participant', 77),
('program_files',              'Programmes de formation (fichiers)', 78),
('training_actions',           'Actions à mener sur une formation', 79),

-- ── Enquêtes ────────────────────────────────────────────────
('training_surveys',           'Enquêtes rattachées aux formations', 80),
('training_survey_questions',  'Questions des enquêtes de formation', 81),
('training_survey_responses',  'Réponses (une par répondant) aux enquêtes de formation', 82),
('training_survey_answers',    'Réponses détaillées, question par question', 83),

-- ── LMS ─────────────────────────────────────────────────────
('lms_enrollments',            'Inscriptions des apprenants aux cours', 90),
('lms_progress',               'Progression des apprenants dans les leçons', 91),
('lms_lesson_blocks',          'Blocs de contenu des leçons (texte, média, quiz…)', 92),
('lms_quizzes',                'Quiz e-learning', 93),
('lms_quiz_questions',         'Questions des quiz', 94),
('lms_quiz_attempts',          'Tentatives de quiz des apprenants', 95),
('lms_assignments',            'Devoirs e-learning', 96),
('lms_assignment_submissions', 'Rendus de devoirs des apprenants', 97),
('lms_work_deposits',          'Dépôts de travaux des apprenants', 98),
('lms_forum_posts',            'Messages des forums de cours', 99),
('lms_messages',               'Messages échangés avec les apprenants', 100),

-- ── Commercial et finances ──────────────────────────────────
('crm_scheduled_emails',       'Emails CRM programmés', 110),
('monthly_reports',            'Rapports mensuels d''activité', 111),
('balance_sheets',             'Bilans comptables importés', 112),
('cashflow_forecast',          'Prévisionnel de trésorerie', 113),

-- ── Dropshipping / SuperTilt ────────────────────────────────
('woocommerce_orders',         'Commandes WooCommerce', 120),
('order_items',                'Lignes des commandes', 121),
('game_expenses',              'Dépenses rattachées aux jeux', 122),
('game_restocks',              'Réapprovisionnements de jeux', 123),
('game_restock_items',         'Lignes de réapprovisionnement', 124),
('supertilt_actions',          'Actions du kanban SuperTilt', 125),

-- ── Réseau ──────────────────────────────────────────────────
('network_contacts',           'Contacts du réseau professionnel', 130),
('network_actions',            'Actions de suivi réseau', 131),
('network_interactions',       'Interactions enregistrées avec les contacts réseau', 132),

-- ── Contenu et veille ───────────────────────────────────────
('ideas',                      'Idées de contenu', 140),
('newsletters',                'Newsletters', 141),
('watch_items',                'Éléments de veille collectés', 142),
('wp_articles',                'Articles WordPress publiés', 143),
('practice_posts',             'Publications de la communauté de pratique', 144),

-- ── Divers ──────────────────────────────────────────────────
('faq_items',                  'Questions fréquentes', 150),
('checklist_templates',        'Modèles de checklists', 151),
('checklist_template_items',   'Points des modèles de checklists', 152),
('okr_check_ins',              'Points d''avancement des OKR', 153)

ON CONFLICT (table_name) DO NOTHING;
