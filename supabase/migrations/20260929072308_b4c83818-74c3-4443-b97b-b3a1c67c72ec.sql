UPDATE public.email_templates
SET html_content = CASE template_type
      WHEN 'funder_reminder_tu' THEN E'Bonjour,\n\nIl faut que tu prennes contact avec {{financeur_name}}, à cette adresse : {{financeur_url}}\n\nRetrouve le suivi qualité et les évaluations SuperTools depuis la fiche de la formation :\n{{training_url}}'
      WHEN 'funder_reminder_vous' THEN E'Bonjour,\n\nIl faut prendre contact avec {{financeur_name}}, à cette adresse : {{financeur_url}}\n\nRetrouvez le suivi qualité et les évaluations SuperTools depuis la fiche de la formation :\n{{training_url}}'
      ELSE html_content
    END,
    updated_at = now()
WHERE template_type IN ('funder_reminder_tu', 'funder_reminder_vous');