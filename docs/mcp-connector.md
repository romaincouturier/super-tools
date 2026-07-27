# Connecteur MCP SuperTools (lecture seule)

Permet d'interroger les données SuperTools depuis claude.ai ou Claude Desktop,
et de les croiser avec les connecteurs natifs (Google Drive, Notion).

## Modèle de sécurité

- **Lecture seule par construction** : 6 tools exposés — `query_database`
  (via `agent_sql_query` : SELECT uniquement, tables allowlistées du registry,
  100 lignes max), `search_content` (recherche hybride dans les contenus
  indexés), `list_schema`, `get_mission_dossier` (mission + pages complètes +
  activités + documents + galerie), `get_client_dossier` (missions,
  formations, devis, cartes CRM + commentaires, transcripts d'un client) et
  `read_media_image` (une photo de galerie renvoyée en image que Claude peut
  regarder, redimensionnée côté serveur, 3 Mo max). Aucun tool d'écriture
  n'existe sur ce serveur. Les tools dossier et image sont journalisés dans
  `agent_query_audit_log` comme les requêtes SQL.
- **Fichiers** : `get_mission_dossier` renvoie les métadonnées et URLs des
  documents ; les photos des galeries SuperTools se lisent avec
  `read_media_image` ; les fichiers Google Drive se lisent via le connecteur
  Drive natif de claude.ai, dans la même conversation.
- **Mono-utilisateur** : chaque appel est lié à `romain@supertilt.fr`,
  liste blanche d'un seul compte codée en dur dans
  `supabase/functions/mcp-server/index.ts` (`ALLOWED_EMAIL`). Modifier
  cette constante exige un commit.
- **OAuth 2.1 + PKCE** : requis par claude.ai. L'écran d'autorisation demande
  une clé personnelle (`MCP_PERSONAL_SECRET`, secret d'edge function, jamais
  dans le repo). 5 échecs en 15 minutes = blocage temporaire.
- **Tokens** : accès 30 jours, refresh 60 jours avec rotation, stockés hashés
  (SHA-256) dans `mcp_oauth_records` (table service-role only, exclue des
  backups car regénérable).
- **Audit** : toutes les requêtes SQL passent par `agent_query_audit_log`
  avec l'identité et l'explication de la requête.

## Proxy racine obligatoire pour claude.ai

Les clients MCP de claude.ai cherchent les endpoints OAuth (`/authorize`,
`/token`, `/register`, `/.well-known/*`) à la **racine du domaine**, en
ignorant le chemin. Sur `*.supabase.co` la racine ne nous appartient pas :
il faut donc servir le connecteur via un proxy dont on contrôle la racine.

Cloudflare Worker (gratuit, URL `*.workers.dev`, aucun DNS à configurer) :

```js
export default {
  fetch(request) {
    const url = new URL(request.url);
    const target =
      "https://yewffntzgrdgztrwtava.supabase.co/functions/v1/mcp-server" +
      url.pathname + url.search;
    return fetch(new Request(target, request));
  },
};
```

1. dash.cloudflare.com > Workers > Create Worker > coller le script > Deploy.
2. Noter l'URL du worker (ex : `https://supertools-mcp.xxx.workers.dev`).
3. `supabase secrets set MCP_PUBLIC_URL=https://supertools-mcp.xxx.workers.dev`
   puis redéployer `mcp-server` (le serveur annonce alors ses endpoints
   OAuth sur cette URL racine).
4. Dans claude.ai, l'URL du connecteur devient **l'URL du worker** (pas
   celle de la fonction Supabase).

## Installation (une fois)

1. Poser le secret (choisir une clé longue, gestionnaire de mots de passe) :
   `supabase secrets set MCP_PERSONAL_SECRET=<clé longue aléatoire>`
2. Appliquer la migration `20260727150000_mcp_connector_auth.sql` et déployer
   la fonction `mcp-server`.
3. Dans claude.ai : Paramètres > Connecteurs > Ajouter un connecteur custom,
   URL : `https://<project-ref>.supabase.co/functions/v1/mcp-server`
4. Claude ouvre l'écran d'autorisation : entrer la clé personnelle.

## Révocation

- Un connecteur : le supprimer dans claude.ai, puis
  `DELETE FROM mcp_oauth_records WHERE kind = 'token';` (SQL Editor).
- Tout couper : `supabase secrets unset MCP_PERSONAL_SECRET` (les tokens en
  cours restent valides jusqu'à expiration — vider aussi la table) ou
  supprimer la fonction.

## Point de vigilance connu

Le contenu lu depuis SuperTools (au premier chef les emails si un jour les
inbound emails sont activés) est traité par Claude comme du contexte : un
contenu piégé pourrait tenter de faire écrire Claude vers Notion/Drive.
Le serveur SuperTools lui-même est en lecture seule, rien ne peut y être
modifié. Périmètre revu à chaque ajout de source dans l'indexation.

## Suivi

Requêtes des 7 derniers jours :

```sql
SELECT created_at, explanation, query_text
FROM agent_query_audit_log
WHERE explanation LIKE '%MCP%' AND created_at > now() - interval '7 days'
ORDER BY created_at DESC;
```
