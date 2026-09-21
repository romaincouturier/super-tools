# Module Veille

Page `/veille`. Contenus collectés à la main depuis l'application ou déposés par
un agent via le connecteur MCP (voir `docs/mcp-connector.md`, section « Veille :
publier depuis un agent »).

## Ce qui compose le module

| Objet | Rôle |
| --- | --- |
| `watch_items` | Les contenus : titre, corps, commentaire, tags, lien source, fichier, embedding, score de fraîcheur |
| `watch_clusters` | Regroupements de contenus proches, avec la synthèse proposée pour Slack |
| `watch_digests` | Historique des digests hebdomadaires, un par semaine |
| bucket `watch` | Images, audio et PDF déposés avec un contenu |
| `watch-process-item` | Enrichissement d'un contenu ajouté depuis l'application : scraping d'URL, OCR, transcription audio et podcast, titre et tags automatiques, embedding |
| `watch-check-duplicate` | Contrôle de doublon avant enregistrement, appelé par le formulaire d'ajout |
| `watch-cluster-analysis` | Cherche les groupes de 3 contenus proches et crée les clusters |
| `watch-weekly-digest` | Rédige le digest de la semaine écoulée et le poste sur Slack |
| `decay_watch_relevance()` | Recalcule le score de fraîcheur de chaque contenu |

Un contenu déposé par l'agent MCP ne passe pas par `watch-process-item` : il
arrive déjà titré, résumé et taggé, et son embedding est calculé au dépôt. Il
entre donc dans le clustering et le digest comme les autres.

## Ce qui tourne automatiquement

`decay-watch-relevance`, tous les jours à 03h40 UTC, planifié par la migration
`20260921120000_schedule_watch_relevance_decay.sql`. SQL pur, aucun secret : sa
place est dans une migration versionnée.

Le score vaut 100 au dépôt et perd 0,5 par jour écoulé depuis la dernière mise à
jour, plancher à 0 au bout de 200 jours. Il est **recalculé** à chaque passage,
jamais décrémenté : rejouer le travail dix fois dans la journée donne le même
score. La page Veille trie par score puis par date, le digest hebdomadaire
retient les contenus les mieux notés.

Les deux crons ci-dessous appellent une edge function, donc portent un secret :
règle [036], ils se posent **directement en base**, jamais dans une migration.
Tant qu'ils ne sont pas posés, le clustering et le digest ne tournent pas.

## Poser les deux crons (SQL Editor)

Les deux fonctions de veille attendent leur propre secret, `VEILLE_CRON_SECRET`,
à poser dans les secrets d'edge function. Pas `CRON_SECRET` : ce dernier sert
déjà à cinq crons posés en base (`process-scheduled-emails`,
`check-daily-actions-completion`, `process-live-reminders`,
`process-logistics-reminders`, `send-booking-reminder`) qui en portent la valeur
en clair dans leur SQL. Comme un secret d'edge function ne se relit pas, le
remplacer pour en retrouver la valeur ferait passer ces cinq crons en 401, sans
bruit. Un secret par domaine, comme `SEO_CRON_SECRET` et
`EDITORIAL_CRON_SECRET`.

Poser d'abord `VEILLE_CRON_SECRET` (chaîne longue et aléatoire), puis reporter
la même valeur dans les deux placeholders ci-dessous :

```sql
-- Clustering : une passe par nuit sur les contenus non regroupés des 30 derniers jours
SELECT cron.unschedule('watch-cluster-analysis-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'watch-cluster-analysis-daily');

SELECT cron.schedule('watch-cluster-analysis-daily', '10 2 * * *', $$
  SELECT net.http_post(
    url := 'https://<PROJET>.supabase.co/functions/v1/watch-cluster-analysis',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', '<VEILLE_CRON_SECRET>'),
    timeout_milliseconds := 120000,
    body := '{}'::jsonb);
$$);

-- Digest de la semaine écoulée, le lundi matin
SELECT cron.unschedule('watch-weekly-digest')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'watch-weekly-digest');

SELECT cron.schedule('watch-weekly-digest', '0 7 * * 1', $$
  SELECT net.http_post(
    url := 'https://<PROJET>.supabase.co/functions/v1/watch-weekly-digest',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', '<VEILLE_CRON_SECRET>'),
    timeout_milliseconds := 120000,
    body := '{}'::jsonb);
$$);
```

Les `unschedule` gardés rendent le bloc rejouable : le repasser après une
rotation de secret remplace les travaux au lieu d'échouer sur un nom déjà pris.

`timeout_milliseconds` est indispensable : les deux fonctions appellent OpenAI et
dépassent largement les 5 secondes de pg_net par défaut.

Le digest est idempotent par semaine : s'il existe déjà une ligne
`watch_digests` pour la semaine visée, la fonction s'arrête sans rien écrire. Un
rejeu ne produit donc pas un second post Slack.

## Vérifier après la pose

```sql
-- Les trois travaux de veille et leur prochaine exécution
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE '%watch%';

-- Résultat des dernières exécutions
SELECT j.jobname, d.status, d.start_time, d.return_message
FROM cron.job_run_details d
JOIN cron.job j ON j.jobid = d.jobid
WHERE j.jobname LIKE '%watch%'
ORDER BY d.start_time DESC
LIMIT 20;
```

Un `status = 'succeeded'` sur `net.http_post` signifie que la requête est
partie, pas que la fonction a réussi : le résultat de la fonction se lit dans
ses journaux d'edge function.

## Authentification des deux fonctions

Trois voies (règle [036]), via `_shared/cron-auth.ts` :

- `x-cron-secret` égal à `VEILLE_CRON_SECRET` — le cron ;
- `x-internal-secret` égal à la service_role — un appel d'une edge function à
  une autre ;
- à défaut, un JWT d'utilisateur connecté — un déclenchement manuel.

Un secret absent ne vaut jamais autorisation. `watch-weekly-digest` laissait
auparavant passer tout appel sans en-tête d'autorisation, sur une fonction
publique (`verify_jwt = false`) qui déclenche une génération OpenAI et un post
Slack : n'importe qui pouvait la déclencher.
