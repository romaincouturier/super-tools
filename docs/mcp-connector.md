# Connecteur MCP SuperTools (lecture seule)

Permet d'interroger les données SuperTools depuis claude.ai ou Claude Desktop,
et de les croiser avec les connecteurs natifs (Google Drive, Notion).

## Modèle de sécurité

- **Tools exposés (8)** : `query_database` (via `agent_sql_query` : SELECT
  uniquement, tables allowlistées du registry, 100 lignes max),
  `search_content` (recherche hybride, filtrable par mission via
  `mission_id`), `list_schema`, `get_mission_dossier` (mission + pages +
  activités + documents + galerie), `get_client_dossier`, `read_media_image`
  (photo de galerie en image, redimensionnée côté serveur, 3 Mo max),
  `read_document` et `save_mission_note`. Tous sont journalisés dans
  `agent_query_audit_log`.
- **Lecture seule, à une exception près** : `save_mission_note` est la SEULE
  écriture du serveur. Elle crée ou met à jour **une page de mission**, titre
  préfixé « Note agent — », 200 000 caractères max. Elle ne peut rien
  supprimer, ni toucher une autre table. Elle existe pour capitaliser un
  travail long (transcription de photos d'atelier, synthèse intermédiaire)
  hors de la conversation : le résultat survit à une saturation de contexte et
  devient indexé, donc cherchable ensuite comme le reste.
- **Lecture des documents** : `read_document` renvoie le contenu réel d'une
  pièce jointe (mission, CRM, support). Les PDF avec texte sont renvoyés en
  texte ; les **PDF scannés** sont renvoyés en images de pages, à lire
  visuellement ; les `.xlsx` sont convertis en CSV et les `.docx` en texte ;
  les fichiers audio renvoient leur transcription SuperTools si elle existe.
  Les fichiers Google Drive se lisent via le connecteur Drive natif de
  claude.ai, dans la même conversation.
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
  async fetch(request) {
    const url = new URL(request.url);
    const target =
      "https://yewffntzgrdgztrwtava.supabase.co/functions/v1/mcp-server" +
      url.pathname + url.search;
    const upstream = await fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      // Les redirections OAuth (302 vers claude.ai) doivent revenir au
      // navigateur, pas être suivies par le worker
      redirect: "manual",
    });
    const headers = new Headers(upstream.headers);
    if (url.pathname === "/authorize") {
      // Le déploiement peut perdre le Content-Type et poser une CSP qui
      // bloque les styles inline : on rétablit les deux pour la page de clé
      headers.delete("content-security-policy");
      if (upstream.status === 200) {
        headers.set("Content-Type", "text/html; charset=utf-8");
      }
    }
    return new Response(upstream.body, { status: upstream.status, headers });
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
