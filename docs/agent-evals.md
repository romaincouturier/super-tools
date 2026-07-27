# Évals de l'agent SuperTools

Protocole de mesure de la qualité de l'agent. Sans mesure, aucune évolution
du prompt, du modèle, du registry ou de la recherche ne peut être qualifiée
d'amélioration.

## Quand rejouer les évals

Obligatoire après toute modification de :
- `supabase/functions/agent-chat/index.ts` (prompt, tools, modèle, compaction)
- `agent_schema_registry` (migration)
- `supabase/functions/index-documents/index.ts` (extracteurs)
- `match_documents` / `match_documents_hybrid`
- le contexte métier (`agent_business_context` dans Paramètres > Agent)

## Protocole

1. Ouvrir une **nouvelle conversation** par question (pas de contexte partagé).
2. Poser la question telle quelle, sans reformuler.
3. Vérifier la réponse contre la vérité terrain (requête SQL de contrôle ci-dessous,
   exécutée dans le SQL Editor Supabase).
4. Noter : `OK` (exact), `PARTIEL` (incomplet mais pas faux), `KO` (faux ou échec).
5. Reporter le score total dans le tableau de suivi en bas de ce fichier.

Règle de non-régression : un changement qui fait passer une question de OK à KO
est bloquant, quel que soit le gain ailleurs.

## Alimenter le jeu de questions

Les questions marquées pouce bas par les utilisateurs sont la première source :

```sql
SELECT created_at, user_prompt, assistant_response
FROM agent_feedback
WHERE rating = 'down'
ORDER BY created_at DESC
LIMIT 30;
```

Toute question pouce bas récurrente doit être ajoutée au jeu ci-dessous avec
sa vérité terrain.

## Jeu de questions

### Formations et évaluations

| # | Question | Vérité terrain |
|---|----------|----------------|
| 1 | Combien de formations ont eu lieu ce trimestre ? | `SELECT count(*) FROM trainings WHERE start_date >= date_trunc('quarter', now()) AND is_cancelled IS NOT true` |
| 2 | Quelle est la note moyenne des évaluations sur les 3 derniers mois ? | `SELECT round(avg(appreciation_generale), 1) FROM training_evaluations WHERE etat = 'soumis' AND date_soumission >= now() - interval '3 months'` |
| 3 | Quelle formation a la meilleure note moyenne (min 3 évaluations) ? | `SELECT t.training_name, avg(e.appreciation_generale) FROM training_evaluations e JOIN trainings t ON t.id = e.training_id WHERE e.etat = 'soumis' GROUP BY 1 HAVING count(*) >= 3 ORDER BY 2 DESC LIMIT 1` |
| 4 | Combien de participants au total cette année ? | `SELECT count(*) FROM training_participants tp JOIN trainings t ON t.id = tp.training_id WHERE t.start_date >= date_trunc('year', now())` |
| 5 | Quel est le taux de retour des évaluations (soumises / envoyées) ? | `SELECT round(100.0 * count(*) FILTER (WHERE etat = 'soumis') / count(*), 0) FROM training_evaluations WHERE date_envoi IS NOT NULL` |
| 6 | Quels freins à l'application reviennent le plus dans les évaluations ? | Lecture manuelle de `freins_application` — la réponse doit citer des verbatims réels |

### CRM et devis

| # | Question | Vérité terrain |
|---|----------|----------------|
| 7 | Combien d'opportunités ouvertes dans le pipeline, pour quel montant ? | `SELECT count(*), sum(estimated_value) FROM crm_cards WHERE sales_status = 'OPEN'` |
| 8 | Quel CA signé ce mois-ci ? | `SELECT sum(total_ht) FROM quotes WHERE status = 'signed' AND updated_at >= date_trunc('month', now())` (à ajuster selon la définition posée dans le contexte métier) |
| 9 | Quelles opportunités attendent une action de ma part ? | `SELECT title, waiting_next_action_text FROM crm_cards WHERE status_operational = 'TODAY' AND sales_status = 'OPEN'` |
| 10 | Quels devis expirent dans les 15 jours sans être signés ? | `SELECT quote_number, client_company, expiry_date FROM quotes WHERE status = 'sent' AND expiry_date BETWEEN now() AND now() + interval '15 days'` |
| 11 | Retrouve l'email où on parlait d'une remise avec [client réel] | La réponse doit citer l'email réel (recherche sémantique) |

### Transcripts et témoignages

| # | Question | Vérité terrain |
|---|----------|----------------|
| 12 | Combien de transcripts Fireflies avons-nous ? | `SELECT count(*) FROM transcripts WHERE source = 'fireflies'` |
| 13 | De quoi parlait la dernière réunion transcrite ? | `SELECT title, summary FROM transcripts WHERE status = 'ready' ORDER BY created_at DESC LIMIT 1` |
| 14 | Dans quel transcript a-t-on parlé de [sujet récent réel] ? | La réponse doit retrouver le bon transcript (recherche hybride) |
| 15 | Combien de témoignages sont publiés ? | `SELECT count(*) FROM testimonials WHERE status = 'published'` |

### Dropshipping

| # | Question | Vérité terrain |
|---|----------|----------------|
| 16 | Quel jeu s'est le mieux vendu ce trimestre ? | `SELECT g.title, sum(s.quantity) FROM game_sales s JOIN games g ON g.id = s.game_id WHERE s.sale_date >= date_trunc('quarter', now()) GROUP BY 1 ORDER BY 2 DESC LIMIT 1` |
| 17 | Combien de royautés doit-on à chaque auteur (ventes non payées) ? | `SELECT a.name, sum(s.royalty_amount) FROM game_sales s JOIN games g ON g.id = s.game_id JOIN game_authors a ON a.id = g.author_id WHERE s.status = 'pending' GROUP BY 1` |

### Missions, support, OKR

| # | Question | Vérité terrain |
|---|----------|----------------|
| 18 | Quelles missions sont en cours et où en est leur consommation ? | `SELECT title, consumed_amount, initial_amount FROM missions WHERE status = 'in_progress'` |
| 19 | Combien de tickets support non résolus ? | `SELECT count(*) FROM support_tickets WHERE status != 'resolu'` |
| 20 | Où en sont nos OKR ce trimestre ? | Comparer avec le module OKR (objectifs + progression des KR) |

### Transverse (le vrai test d'intelligence)

| # | Question | Vérité terrain |
|---|----------|----------------|
| 21 | Quels clients ont à la fois une formation cette année et une opportunité CRM ouverte ? | Jointure `trainings.client_name` × `crm_cards` (titre/contact) — tolérer le rapprochement par nom |
| 22 | Fais-moi le bilan du mois : formations, CA, pipeline, support | Doit combiner plusieurs requêtes ou utiliser get_business_health, chiffres vérifiables individuellement |
| 23 | Y a-t-il des formations à venir sans convention signée ? | `SELECT training_name, start_date FROM trainings WHERE start_date > now() AND convention_file_url IS NULL AND is_cancelled IS NOT true` |
| 24 | Quelles évaluations négatives (note <= 2) a-t-on reçues récemment, et sur quelles formations ? | `SELECT t.training_name, e.appreciation_generale, e.remarques_libres FROM training_evaluations e JOIN trainings t ON t.id = e.training_id WHERE e.etat = 'soumis' AND e.appreciation_generale <= 2 AND e.date_soumission >= now() - interval '2 months'` |

Les questions 6, 11, 14 et 21 n'ont pas de vérité terrain SQL exacte : juger
sur pièce (la réponse cite-t-elle des données réelles et pertinentes ?).

## Suivi des runs

| Date | Contexte du run | OK | PARTIEL | KO | Notes |
|------|-----------------|----|---------|----|-------|
| | (baseline à établir après déploiement des phases 1-3) | | | | |
