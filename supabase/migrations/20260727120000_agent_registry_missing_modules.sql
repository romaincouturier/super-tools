-- [041] Agent — ajout au registry des modules décrits dans le prompt mais
-- absents de l'allowlist SQL : évaluations, transcripts, témoignages,
-- dropshipping, emails programmés. Sans ces entrées, agent_sql_query
-- rejetait toute requête sur ces tables.

INSERT INTO public.agent_schema_registry (table_name, description, columns, display_order) VALUES

('training_evaluations', 'Évaluations à chaud des formations remplies par les participants', '[
  {"name":"id","type":"UUID PK"},
  {"name":"training_id","type":"UUID FK→trainings"},
  {"name":"participant_id","type":"UUID FK→training_participants"},
  {"name":"first_name","type":"TEXT"},
  {"name":"last_name","type":"TEXT"},
  {"name":"company","type":"TEXT"},
  {"name":"email","type":"TEXT"},
  {"name":"appreciation_generale","type":"INT","description":"note globale de 1 à 5"},
  {"name":"recommandation","type":"TEXT","description":"oui_avec_enthousiasme, oui, non"},
  {"name":"message_recommandation","type":"TEXT"},
  {"name":"objectif_prioritaire","type":"TEXT"},
  {"name":"delai_application","type":"TEXT"},
  {"name":"freins_application","type":"TEXT"},
  {"name":"rythme","type":"TEXT"},
  {"name":"equilibre_theorie_pratique","type":"TEXT"},
  {"name":"amelioration_suggeree","type":"TEXT"},
  {"name":"remarques_libres","type":"TEXT"},
  {"name":"etat","type":"TEXT","description":"soumis = évaluation complète ; autres = en attente"},
  {"name":"date_envoi","type":"TIMESTAMPTZ"},
  {"name":"date_soumission","type":"TIMESTAMPTZ"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 40),

('transcripts', 'Transcripts de réunions et enregistrements (Fireflies, Google Drive)', '[
  {"name":"id","type":"UUID PK"},
  {"name":"source","type":"TEXT","description":"google_drive ou fireflies"},
  {"name":"title","type":"TEXT"},
  {"name":"raw_text","type":"TEXT","description":"texte intégral avec speakers"},
  {"name":"summary","type":"TEXT"},
  {"name":"tags","type":"TEXT[]"},
  {"name":"duration_seconds","type":"INT"},
  {"name":"status","type":"TEXT","description":"pending, processing, ready, error"},
  {"name":"metadata","type":"JSONB","description":"fireflies_date, meeting_id…"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 41),

('testimonials', 'Témoignages vidéo clients transcrits et analysés', '[
  {"name":"id","type":"UUID PK"},
  {"name":"client_name","type":"TEXT"},
  {"name":"company","type":"TEXT"},
  {"name":"service_type","type":"TEXT"},
  {"name":"raw_transcript","type":"TEXT"},
  {"name":"reviewer_notes","type":"TEXT"},
  {"name":"status","type":"TEXT","description":"pending_review, published, rejected"},
  {"name":"video_url","type":"TEXT"},
  {"name":"published_at","type":"TIMESTAMPTZ"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 42),

('game_authors', 'Auteurs de jeux (dropshipping) et leurs taux de royautés', '[
  {"name":"id","type":"UUID PK"},
  {"name":"name","type":"TEXT"},
  {"name":"email","type":"TEXT"},
  {"name":"company","type":"TEXT"},
  {"name":"royalty_rate","type":"NUMERIC","description":"taux de royauté entre 0 et 1"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 43),

('games', 'Jeux vendus en dropshipping', '[
  {"name":"id","type":"UUID PK"},
  {"name":"author_id","type":"UUID FK→game_authors"},
  {"name":"title","type":"TEXT"},
  {"name":"game_type","type":"TEXT"},
  {"name":"status","type":"TEXT"},
  {"name":"stock","type":"INT"},
  {"name":"cost_price","type":"NUMERIC"},
  {"name":"woocommerce_product_id","type":"INT"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 44),

('game_sales', 'Ventes de jeux (commandes WooCommerce) avec royautés calculées', '[
  {"name":"id","type":"UUID PK"},
  {"name":"game_id","type":"UUID FK→games"},
  {"name":"woocommerce_order_id","type":"TEXT"},
  {"name":"customer_name","type":"TEXT"},
  {"name":"customer_email","type":"TEXT"},
  {"name":"quantity","type":"INT"},
  {"name":"unit_price","type":"NUMERIC"},
  {"name":"total_amount","type":"NUMERIC"},
  {"name":"amount_ht","type":"NUMERIC"},
  {"name":"net_amount","type":"NUMERIC"},
  {"name":"royalty_amount","type":"NUMERIC"},
  {"name":"sale_date","type":"TIMESTAMPTZ"},
  {"name":"status","type":"TEXT","description":"pending, paid"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 45),

('scheduled_emails', 'Emails programmés liés aux formations (convocations, rappels, remerciements)', '[
  {"name":"id","type":"UUID PK"},
  {"name":"training_id","type":"UUID FK→trainings"},
  {"name":"participant_id","type":"UUID FK→training_participants"},
  {"name":"email_type","type":"TEXT"},
  {"name":"scheduled_for","type":"TIMESTAMPTZ"},
  {"name":"sent_at","type":"TIMESTAMPTZ"},
  {"name":"status","type":"TEXT"},
  {"name":"error_message","type":"TEXT"},
  {"name":"created_at","type":"TIMESTAMPTZ"}
]'::jsonb, 46)

ON CONFLICT (table_name) DO NOTHING;
