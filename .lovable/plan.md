

# Plan : Intégration WP-Statistics REST API

## Contexte

Tu veux afficher les statistiques de supertilt.fr (visites, pages vues, navigateurs, sources de trafic, etc.) dans l'application via l'add-on **WP-Statistics REST API**.

L'add-on WP-Statistics REST API expose les endpoints suivants sur ton WordPress :
- `/wp-json/wp-statistics/v2/hits` — visites/pages vues
- `/wp-json/wp-statistics/v2/visitors` — visiteurs uniques
- `/wp-json/wp-statistics/v2/pages` — stats par page
- `/wp-json/wp-statistics/v2/browsers` — navigateurs
- `/wp-json/wp-statistics/v2/referrers` — sources de trafic
- `/wp-json/wp-statistics/v2/search` — moteurs de recherche
- `/wp-json/wp-statistics/v2/summary` — résumé global

L'authentification se fait par **token** généré dans WP-Statistics → Réglages → API.

## Prérequis à vérifier de ton côté

1. **Vérifie que l'add-on REST API est bien installé** : dans ton WordPress, va dans WP Statistics → Add-ons et vérifie que "REST API" est actif.
2. **Récupère le token API** : va dans WP Statistics → Réglages → onglet "API" → active le REST API → copie le token généré.
3. **Teste un endpoint** : dans ton navigateur, essaie `https://www.supertilt.fr/wp-json/wp-statistics/v2/summary?token=TON_TOKEN` — tu devrais voir du JSON.

## Plan d'implémentation

### Étape 1 — Stocker le token dans les paramètres

Ajouter dans **SettingsIntegrations.tsx** une carte "WP-Statistics" avec un champ pour le token API (clé `wp_statistics_api_token` dans `app_settings`). Même pattern que les clés WooCommerce existantes.

### Étape 2 — Créer l'Edge Function `wp-statistics-proxy`

Une edge function qui :
- Lit le token et l'URL du store depuis `app_settings` (réutilise `woocommerce_store_url` comme base WordPress)
- Proxie les requêtes vers les endpoints WP-Statistics en ajoutant le token
- Retourne les données JSON avec CORS
- Endpoints supportés : `summary`, `hits`, `visitors`, `pages`, `browsers`, `referrers`, `search`

### Étape 3 — Hook `useWpStatistics`

Un hook React qui appelle l'edge function pour récupérer les données des différents endpoints, avec React Query pour le cache.

### Étape 4 — Dashboard WP-Statistics

Créer une nouvelle page ou un onglet dans Statistiques avec :
- **Résumé** : visiteurs aujourd'hui, cette semaine, ce mois (endpoint `summary`)
- **Graphique de visites** : évolution des hits sur les 30 derniers jours
- **Top pages** : tableau des pages les plus visitées
- **Navigateurs** : camembert des navigateurs
- **Sources de trafic** : tableau des referrers
- **Moteurs de recherche** : répartition des visites depuis Google, Bing, etc.

## Détails techniques

- Le token API est stocké dans `app_settings` (champ masqué type `password`)
- L'URL de base WordPress = `woocommerce_store_url` déjà configuré (supertilt.fr)
- L'edge function évite d'exposer le token côté client
- Ajout dans `supabase/config.toml` : `[functions.wp-statistics-proxy] verify_jwt = false`

## Prochaine étape

**Avant que je code quoi que ce soit**, peux-tu vérifier les 3 points du prérequis ci-dessus ? En particulier, confirme que l'add-on REST API est bien installé et que tu as un token. Si tu me donnes le token, je le stockerai de manière sécurisée.

