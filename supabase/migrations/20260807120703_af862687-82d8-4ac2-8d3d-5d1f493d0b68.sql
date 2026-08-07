INSERT INTO training_evaluations (training_id, participant_id, token, email, first_name, last_name, etat, date_envoi, learndash_course_id)
SELECT tp.training_id, tp.id,
  gen_random_uuid()::text || '-' || substr(md5(random()::text), 1, 16),
  tp.email, tp.first_name, tp.last_name, 'non_envoye', now(), 15749
FROM training_participants tp
WHERE tp.id = 'faa4bcea-2b11-4b2d-bf22-f6c236c14544'
  AND NOT EXISTS (SELECT 1 FROM training_evaluations e WHERE e.participant_id = tp.id);

INSERT INTO scheduled_emails (training_id, participant_id, email_type, scheduled_for, status)
SELECT '8b78800b-4f2c-409a-9cb2-2476b71408d8', 'faa4bcea-2b11-4b2d-bf22-f6c236c14544', 'evaluation_reminder_1', now(), 'pending'
WHERE NOT EXISTS (
  SELECT 1 FROM scheduled_emails
  WHERE participant_id = 'faa4bcea-2b11-4b2d-bf22-f6c236c14544'
    AND email_type = 'evaluation_reminder_1' AND status = 'pending'
);