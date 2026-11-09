-- Page publique de session : rétablir les instructions spécifiques.
--
-- `specific_instructions` avait été ajoutée à get_training_summary_info en
-- avril (20260408120000), puis la refonte du 23 avril a réécrit la fonction
-- sans la reprendre. Depuis, src/pages/TrainingSummary.tsx lit le champ et
-- affiche un bloc « Instructions spécifiques » qui ne peut jamais apparaître :
-- la valeur est toujours absente de la réponse.
--
-- Le référentiel attend que les conditions de déroulement soient formalisées
-- et diffusées (indicateur 9). Une consigne saisie sur la session et jamais
-- affichée au participant n'est pas diffusée.
--
-- Seul ajout : la clé manquante. Les autres champs sont inchangés.

CREATE OR REPLACE FUNCTION public.get_training_summary_info(p_training_id uuid)
RETURNS json LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'id', id, 'training_name', training_name, 'client_name', client_name,
    'start_date', start_date, 'end_date', end_date, 'location', location,
    'program_file_url', program_file_url, 'supports_url', supports_url,
    'supports_type', supports_type, 'supports_lms_course_id', supports_lms_course_id,
    'trainer_id', trainer_id, 'objectives', objectives, 'prerequisites', prerequisites,
    'format_formation', format_formation, 'session_type', session_type,
    'session_format', session_format, 'specific_instructions', specific_instructions
  ) FROM trainings WHERE id = p_training_id;
$$;
