# SEO, GEO et audience — architecture des données

## Le problème résolu

Avant cette évolution, Google Search Console et WP-Statistics étaient deux
proxys **live** : les données transitaient de l'API vers l'écran, sans jamais
être stockées. Trois conséquences :

1. **Le connecteur MCP n'avait accès à aucune donnée d'audience.** Interrogé
   sur les statistiques Search Console, Claude répondait qu'elles n'étaient pas
   accessibles et travaillait avec le champ figé `wp_articles.views`.
2. **Aucune comparaison de période possible** : un chiffre sans son antériorité
   ne dit pas si la situation s'améliore.
3. **Perte définitive au-delà des 16 mois** de rétention de Google.

## Les tables

| Table | Contenu | Alimentée par |
| --- | --- | --- |
| `gsc_metrics_daily` | Search Console jour par jour. `dimension` : `total`, `query`, `page`, `country`, `device`, `appearance`, `page_query`. `key_1` porte la valeur, `key_2` la requête pour `page_query` | `gsc-sync` mode `metrics` |
| `gsc_url_inspections` | État d'indexation par URL : indexée ou non, dernière exploration, canonique retenue par Google, résultats enrichis, erreurs | `gsc-sync` mode `inspect` |
| `gsc_sitemaps` | Sitemaps déclarés, dernière lecture par Google, erreurs et avertissements | `gsc-sync` mode `sitemaps` |
| `wp_traffic_daily` | Trafic WordPress figé chaque jour. `scope` : `total`, `page`, `referrer`, `search_engine`, `ai_referrer` | `wp-statistics-sync` |

Les quatre tables sont déclarées dans `agent_schema_registry` : l'agent SQL
interne et le connecteur MCP peuvent les interroger directement.

**Volume et purge.** Seul le croisement `page_query` est volumineux (jusqu'à
500 lignes par jour) : `purge_seo_history()` le supprime au-delà de 180 jours,
et le détail WP-Statistics au-delà de 2 ans. Tout le reste est conservé
indéfiniment — c'est précisément l'intérêt de l'historisation face aux 16 mois
de Google.

## Les fonctions d'agrégation

PostgREST ne sait pas faire de `GROUP BY` : les agrégations vivent en SQL et
servent à la fois l'interface et le connecteur MCP.

- `gsc_aggregate(from, to, dimension, search_type, limit, contains)` — position
  en moyenne pondérée par les impressions, comme dans l'interface Google.
- `gsc_daily_totals(from, to, search_type)` — série journalière du site.
- `seo_content_performance(from, to, limit, category)` — un article, ses vues
  WordPress, sa performance Search Console et son état d'indexation.
- `seo_cannibalisation(from, to, min_impressions, limit)` — requêtes servies
  par plusieurs pages.
- `seo_queries_for_page(from, to, page, limit)` — requêtes d'entrée d'une page.
- `normalize_url(text)` — rapproche les URL Search Console des URL WordPress
  (protocole, `www`, paramètres, slash final).

Les analyses composées (comparaison de période, quick wins, CTR anormal, pages
en déclin) sont dans `supabase/functions/_shared/seo-tools.ts`, partagé entre
`gsc-statistics` (interface) et `mcp-server` (Claude) : les deux servent les
mêmes chiffres.

## Les edge functions

### `gsc-statistics`

| Action | Source | Usage |
| --- | --- | --- |
| `live` (défaut) | API Google | Requête Search Analytics directe : toutes dimensions, filtres, type de recherche, pagination |
| `performance` | Historique | Totaux, série journalière, détail par dimension, comparaison avec la période précédente |
| `opportunities` | Historique | Quick wins, CTR anormal, cannibalisation, pages en déclin, sujets en croissance, indexation, référents IA |
| `content` | Historique | Croisement articles WordPress x audience |
| `indexation` | Historique | Inspections d'URL et sitemaps |
| `sites` | API Google | Propriétés Search Console accessibles au compte connecté |

### `gsc-sync`

```
{ "mode": "metrics", "days": 5 }                          fenêtre glissante
{ "mode": "metrics", "from": "2026-01-01", "to": "2026-01-31" }   rattrapage
{ "mode": "inspect", "limit": 60 }                        lot d'inspections
{ "mode": "sitemaps" }
{ "mode": "all" }
```

La synchronisation des métriques **purge puis réinsère** chaque tranche
(jour, dimension) : elle est idempotente et rejouable sur n'importe quelle
période sans créer de doublon. Elle demande `dataState: "all"`, donc les jours
non encore consolidés par Google sont corrigés au passage suivant.

L'inspection d'URL est limitée par Google à **2000 URL par jour** : le cron
traite les URL jamais inspectées en priorité, puis rafraîchit les plus
anciennes.

### `wp-statistics-sync`

Fige la journée de la veille : vues par page, référents, moteurs de recherche
et **référents IA** (ChatGPT, Perplexity, Gemini, Copilot, Le Chat…). Ces
derniers sont la seule mesure factuelle de visibilité dans les moteurs
génératifs : aucune API ne publie les citations.

Le total du jour vient de l'endpoint `hits`, celui qui alimente la courbe de
WP-Statistics, et non de la somme des vues par page : le rapport « pages » ne
couvre pas tout le trafic (28/07/2026 : 107 vues cumulées sur les pages contre
296 affichées par WP-Statistics). La réponse de la fonction expose les deux
valeurs, `total_views` et `pages_sum` : un écart qui reste grand signifie que
le rapport « pages » tronque toujours, et il faut alors regarder la pagination
de cet endpoint.

## Planification des crons

Règle [036] : les crons qui appellent une edge function sont planifiés
**directement en base** avec leur secret inline, jamais dans une migration
versionnée. Poser d'abord le secret d'edge function `SEO_CRON_SECRET`, puis
exécuter ce SQL dans le SQL Editor en remplaçant les deux placeholders :

```sql
-- Search Console : fenêtre glissante de 5 jours, chaque nuit
SELECT cron.schedule('gsc-sync-daily', '20 4 * * *', $$
  SELECT net.http_post(
    url := 'https://<PROJET>.supabase.co/functions/v1/gsc-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', '<SEO_CRON_SECRET>'),
    body := '{"mode": "metrics", "days": 5}'::jsonb);
$$);

-- Inspection d'URL : un lot par heure (quota Google 2000/jour)
SELECT cron.schedule('gsc-inspect-hourly', '35 * * * *', $$
  SELECT net.http_post(
    url := 'https://<PROJET>.supabase.co/functions/v1/gsc-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', '<SEO_CRON_SECRET>'),
    body := '{"mode": "inspect", "limit": 60}'::jsonb);
$$);

-- Sitemaps : une fois par jour
SELECT cron.schedule('gsc-sitemaps-daily', '50 4 * * *', $$
  SELECT net.http_post(
    url := 'https://<PROJET>.supabase.co/functions/v1/gsc-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', '<SEO_CRON_SECRET>'),
    body := '{"mode": "sitemaps"}'::jsonb);
$$);

-- Trafic WordPress de la veille
SELECT cron.schedule('wp-statistics-sync-daily', '10 3 * * *', $$
  SELECT net.http_post(
    url := 'https://<PROJET>.supabase.co/functions/v1/wp-statistics-sync',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'x-cron-secret', '<SEO_CRON_SECRET>'),
    body := '{}'::jsonb);
$$);
```

Vérifier `cron.job_run_details` après la première exécution.

## Rattrapage de l'historique

Google conserve 16 mois. Pour les récupérer une fois pour toutes, appeler
`gsc-sync` mois par mois (depuis la page Statistiques ou en HTTP) :

```
{ "mode": "metrics", "from": "2025-04-01", "to": "2025-04-30" }
{ "mode": "metrics", "from": "2025-05-01", "to": "2025-05-31" }
...
```

Un mois par appel évite de dépasser le temps d'exécution d'une edge function :
sept appels à l'API Google par passe, plus un par jour pour l'apparence dans
les résultats.

## Ce que l'on ne mesure pas

- **Les citations dans les moteurs génératifs.** Aucune API ne les publie. Les
  seuls faits disponibles sont les visites référencées (`ai_referrer`), les
  apparences dans les résultats Google et l'état d'indexation. Toute autre
  affirmation sur le GEO est une recommandation, pas une mesure.
- **Les balises meta des articles.** WordPress ne les expose pas dans l'import
  actuel (`wp_articles` porte `excerpt`, pas la meta description). Le symptôme
  reste détectable par les données : une page bien positionnée dont le CTR est
  très inférieur à la norme de sa position a un problème de snippet — c'est le
  bloc `low_ctr_pages` de `get_seo_opportunities`.
