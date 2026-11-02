# Relances e-learning

Remplace la relance annuelle « formations en ligne non démarrées et en cours »
qui tournait sur LearnDash.

## Deux relances automatiques

| Fonction | Quand | Qui |
|---|---|---|
| `process-elearning-start-reminders` | J+5 après l'inscription, une seule fois | Participants ayant payé en ligne, toujours à 0 % |
| `process-elearning-inactivity-reminders` | 6 mois sans activité | Tout participant e-learning non terminé |

## Relance après 6 mois sans activité

**Éligibilité**, évaluée chaque jour :

- formation au format `e_learning`, non annulée, déjà commencée (ou permanente,
  sans date de début), avec un cours LMS rattaché ;
- participant non repositionné sur une autre session ;
- inscription LMS existante pour ce cours et cette adresse. Les anciens inscrits
  LearnDash, sans inscription LMS, ne sont jamais relancés : ils sont gérés à la
  main ;
- parcours non terminé (moins de 100 %) ;
- dernière activité il y a 6 mois ou plus. La dernière activité est la mise à
  jour la plus récente dans `lms_progress`, ou la date d'inscription si
  l'apprenant n'a jamais ouvert de leçon.

**Fréquence** : une relance par période d'inactivité. Tant qu'il existe dans
`sent_emails_log` une relance postérieure à la dernière activité, rien ne part.
Si l'apprenant reprend puis décroche de nouveau 6 mois, il reçoit une nouvelle
relance.

**Destinataire** : l'apprenant seul (copie cachée habituelle de Paramètres >
Emails). Jamais le commanditaire.

**Email** : modèle éditable « Relance e-learning après 6 mois sans activité »
(Paramètres > Emails), tu ou vous selon la formation. Le texte change selon que
l'apprenant n'a jamais commencé ou en est à X %. Le bouton mène à l'espace
apprenant via `learnerAccessLink`.

**Envoi** : automatique, sans validation.

## Poser le cron (SQL Editor)

Règle [036] : le cron porte un secret, il se pose directement en base, jamais
dans une migration. Poser d'abord le secret d'edge function
`ELEARNING_CRON_SECRET` (chaîne longue et aléatoire), puis reporter sa valeur
ci-dessous.

Avant la première activation, lister ce qui partirait sans rien envoyer :

```sql
SELECT net.http_post(
  url := 'https://<PROJET>.supabase.co/functions/v1/process-elearning-inactivity-reminders',
  headers := jsonb_build_object('Content-Type', 'application/json',
                                'x-cron-secret', '<ELEARNING_CRON_SECRET>'),
  timeout_milliseconds := 120000,
  body := '{"dry_run": true}'::jsonb);
-- La réponse (liste "list") se lit dans net._http_response.
```

Puis planifier le passage quotidien :

```sql
SELECT cron.unschedule('elearning-inactivity-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'elearning-inactivity-reminders');

SELECT cron.schedule('elearning-inactivity-reminders', '15 8 * * *', $$
  SELECT net.http_post(
    url := 'https://<PROJET>.supabase.co/functions/v1/process-elearning-inactivity-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', '<ELEARNING_CRON_SECRET>'),
    timeout_milliseconds := 120000,
    body := '{}'::jsonb);
$$);
```

Vérifier la première exécution dans `cron.job_run_details`, puis le résultat de
la fonction dans ses journaux d'edge function.
