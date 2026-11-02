# Existant du module Réseau (origin/main, 2026-11-02)

Construit en une journée le 2026-03-12 (v0.1 à v0.4). Ensuite, seulement de la maintenance transverse. Jamais utilisé.

## Tables (`20260312130000_create_reseau_module.sql`, `20260312140000_network_cooling_tracking.sql`)

| Table | Colonnes utiles | Manques pour la spec |
| --- | --- | --- |
| `network_contacts` | user_id, name, context, warmth (`hot`/`warm`/`cold`, figé), linkedin_url, last_contact_date, notes | email, company, role, formal_address, source, thèmes, report, exclusion |
| `network_actions` | contact_id, action_type (libre), message_draft, scheduled_week, status (`pending`/`done`/`skipped`), result, done_at | raison, utilité offerte, statut de réponse |
| `network_interactions` | contact_id, interaction_type (libre), notes | aucun contrôle de type |
| `user_positioning` | pitch_one_liner, key_skills[], target_client, cooling_thresholds (14/30/60 j) | |
| `network_conversation` | historique des chats IA (onboarding, cartographie) | |

- **RLS** : propriétaire seul (`auth.uid() = user_id`) sur toutes les tables. Aucun accès staff.
- **Trigger** : chaque `network_interactions` insérée met à jour `last_contact_date`.
- **MCP** : `network_contacts`, `network_actions` et `network_interactions` sont lisibles par `query_database` (`agent_schema_registry`). Aucun outil réseau dédié.

## Écrans (`src/pages/Reseau.tsx`, `src/components/reseau/`)

- **Parcours** : onboarding IA (positionnement), puis cartographie IA (le chat liste les contacts, ajout un par un), puis tableau de bord.
- **Tableau de bord** : positionnement, compteurs par chaleur, alertes de refroidissement (0,7 × seuil, puis seuil dépassé), actions hebdomadaires, liste de contacts (ajout manuel, pas d'édition), stats et score de santé.
- **Actions hebdomadaires** : `network-generate-actions` produit 3 à 5 actions avec brouillon. Le brouillon est copié dans le presse-papiers. Types : linkedin_message, email, phone_call, coffee_invite, share_content.
- **Accès aux données** : les hooks (`src/hooks/useReseau*.ts`) appellent Supabase directement. Il n'y a pas de couche `src/services/` pour le réseau.
- **Test** : `src/lib/networkUtils.test.ts` uniquement.

## Edge functions

- `network-ai-assistant` : JWT vérifié, IA Anthropic (repli Lovable). La sortie structurée est extraite par regex. Aucune écriture en base.
- `network-generate-actions` : **pas de vérification d'appelant, `verify_jwt = false`**. N'importe qui peut déclencher un appel IA payant.

## Points d'accroche

- **Actions quotidiennes** : `generate-daily-actions` + `_shared/daily-data-fetchers.ts`, upsert dans `daily_actions` sur (user_id, action_date, category, entity_type, entity_id). Aucune catégorie réseau aujourd'hui.
- **Post-événement** : la catégorie `evenements_synthese` couvre les `events` actifs des 60 derniers jours avec `summary_notes IS NULL`. La synthèse est stockée dans `events.summary_notes`. Il n'y a pas de table des participants à un événement.
- **Sources d'import** :
  - `crm_cards` : first_name, last_name, email, company, title, linkedin_url, sales_status, won_at.
  - `mission_contacts` : nom, email, role, is_sponsor, formal_address ; pas de colonne company.
  - `trainings` : sponsor_*, admin_contact_*, client_name.
  - Évaluations : `training_evaluations`, `sponsor_cold_evaluations`, `testimonials`, `testimonial_requests`.
- **Origine des leads** : `crm_cards.acquisition_source` (valeurs `recommandation`, `reseau`, `ancien_client`…) et `source_metadata` JSONB. Aucun champ « recommandé par ».
- **Gmail** : `_shared/gmail.ts` est en lecture seule. Aucune création de brouillon n'existe.
