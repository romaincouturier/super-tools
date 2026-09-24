# Alertes actuelles du contrôle de sécurité (lecture seule, rien n'a été modifié)

Total : 131 alertes, 3 règles, toutes de catégorie SECURITY.

Méthode : l'outil de contrôle ne donne que le nombre d'alertes par règle. La liste des objets vient d'une requête en lecture seule sur les mêmes critères (schéma public). Ma requête trouve 79 fonctions pour la règle 0029, le contrôle en compte 78. Une des 79 est donc exclue par le contrôle, et je ne peux pas dire laquelle. Certaines signatures sont coupées par l'affichage.

## 1. 0008_rls_enabled_no_policy : INFO, 1 alerte
Message : "Detects cases where row level security (RLS) has been enabled on a table but no RLS policies have been created."
- table public.identity_resolution_log

## 2. 0028_anon_security_definer_function_executable : WARN, 52 alertes
Message : "Detects `SECURITY DEFINER` functions that are callable without signing in. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if it is not meant to be public."
Chacune de ces fonctions compte aussi dans la règle 0029.
Fonctions (schéma public) :
get_active_vhd_procedure(), get_app_setting_public(text), get_attendance_by_token(text), get_convention_signature_by_token(text), get_course_live_meetings(uuid), get_devis_signature_by_token(text), get_evaluation_by_token(text), get_learner_email(), get_learner_portal_data(text), get_location_signature_by_token(text), get_mission_actions_public(uuid), get_mission_activities_public(uuid), get_mission_contact_by_token(text), get_mission_documents_public(uuid), get_mission_media_public(uuid), get_mission_page_comments_public(uuid), get_mission_pages_public_deliverables(uuid), get_mission_public_summary(uuid), get_mission_survey_by_token(text), get_participant_public_info(uuid), get_public_contact(), get_questionnaire_by_token(text), get_reclamation_by_token(text), get_sponsor_evaluation_by_token(text), get_stakeholder_appreciation_by_token(text), get_trainer_evaluation_by_token(text), get_trainer_public(uuid), get_training_participants_list(uuid), get_training_public_info(uuid), get_training_schedule_for_date(uuid, ...), get_training_schedules_public(uuid), get_training_summary_info(uuid), get_training_survey_by_token(uuid), has_module_access(uuid, text), insert_questionnaire_event(uuid, ...), is_admin(uuid), is_signup_allowed(text), is_staff_user(), learner_evaluation_course_id(text, uuid), lms_learner_is_enrolled(uuid), mark_attendance_opened(text, text), mark_convention_opened(text, text), mark_devis_opened(text, text), mark_location_signature_opened(text, timestamp...), submit_training_survey(uuid, jsonb), update_evaluation_by_token(text, jsonb), update_participant_after_questionnaire(text, ...), update_questionnaire_by_token(text, jsonb), update_reclamation_by_token(text, jsonb), update_sponsor_evaluation_by_token(text, jsonb), update_stakeholder_appreciation_by_token(text, jsonb), update_trainer_evaluation_by_token(text, jsonb)

## 3. 0029_authenticated_security_definer_function_executable : WARN, 78 alertes
Message : "Detects `SECURITY DEFINER` functions that are callable by signed-in users. Revoke `EXECUTE`, switch the function to `SECURITY INVOKER`, or move it out of your exposed API schema if signed-in users should not call it."
Objets : les 52 fonctions de la règle 0028, plus les fonctions suivantes, appelables seulement par les utilisateurs connectés (27 trouvées, le contrôle en retient 26) :
change_learner_email(text, text, ...), connexion_indicators(integer), current_user_access_level(), get_api_usage_by_task(integer, integer), get_api_usage_daily(integer), get_api_usage_top_calls(integer, integer), get_course_training_sessions_admin(uuid), get_cron_status(), get_db_size(), get_nav_usage_counts(), get_previous_trainer_evaluations(text, ...), get_staff_directory(), get_staff_public_profiles(), get_user_org_id(uuid), get_vhd_narrative_access(uuid), has_crm_access(uuid), is_feature_enabled(text), learner_accounts_for_emails(text[]), list_dormant_learner_accounts(integer), mark_password_changed(), practice_popular_hashtags(integer), read_vhd_narrative(uuid), recompute_opportunity_estimated_value(uuid), request_password_change(), revoke_other_sessions(), upsert_profile(uuid, text, text, ...)

Aucune alerte ne vise un bucket, une policy ou un schéma entier.
