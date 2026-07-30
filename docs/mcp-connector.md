# Connecteur MCP SuperTools (lecture seule)

Permet d'interroger les données SuperTools depuis claude.ai ou Claude Desktop,
et de les croiser avec les connecteurs natifs (Google Drive, Notion).

## Modèle de sécurité

- **Tools exposés (15)** : `query_database` (via `agent_sql_query` : SELECT
  uniquement, tables allowlistées du registry, 100 lignes max),
  `search_content` (recherche hybride, filtrable par mission via
  `mission_id`), `list_schema`, `get_mission_dossier` (mission + pages +
  activités + documents + galerie), `get_client_dossier`, `read_media_image`
  (photo de galerie en image, redimensionnée côté serveur, 3 Mo max),
  `read_document`, `read_mission_page`, `read_mission_documents`,
  `save_mission_note`, `save_mission_document`, et les quatre outils
  d'audience décrits ci-dessous. Tous sont journalisés dans
  `agent_query_audit_log`.
- **Instructions du serveur** : le champ `instructions` du protocole MCP,
  renvoyé à l'initialisation, décrit à Claude le métier, les données
  disponibles, l'outil à choisir selon la question et la méthode attendue
  (croiser les sources, dater les chiffres, ne pas extrapoler). Sans lui, le
  client ignore ce qui existe : c'est ce qui produisait des réponses évasives
  du type « Search Console n'est pas accessible d'ici » alors que les données
  sont en base.
- **Lecture seule, à deux exceptions près, toutes deux additives** : elles ne
  peuvent qu'**ajouter**. Aucun écrasement, aucune suppression, aucune autre
  table touchée.
  - `save_mission_note` crée ou met à jour **une page de mission**, titre
    préfixé « Note agent — », 200 000 caractères max (en mode `append`, le
    plafond porte sur la note résultante). Elle existe pour capitaliser un
    travail long (transcription de photos d'atelier, synthèse intermédiaire)
    hors de la conversation : le résultat survit à une saturation de contexte
    et devient indexé, donc cherchable ensuite comme le reste. Le HTML accepte
    le **SVG inline** (`svg`, `g`, `defs`, `marker`, `path`, `rect`, `circle`,
    `ellipse`, `line`, `polyline`, `polygon`, `text`, `tspan`) : un schéma
    vectoriel s'incruste directement dans la page. Le sanitizer
    (`src/lib/sanitizeLmsHtml.ts`) laisse passer ces balises et continue de
    retirer `script`, `foreignObject` et les handlers `on*` ; côté éditeur, le
    nœud TipTap `svgBlock` (`MissionPages.tsx`) conserve le balisage, sans
    quoi le premier auto-save réécrirait la page sans le schéma.
  - `save_mission_document` crée **un document de mission** : un fichier
    produit par l'agent, téléversé dans le bucket `mission-documents` au
    chemin `{mission_id}/docs/{timestamp}_{nom}` (même convention que l'upload
    de l'application), puis une ligne `mission_documents` avec l'URL publique.
    Le fichier devient un livrable visible, téléchargeable et envoyable au
    client. Garde-fous : allowlist de types (`image/png`, `image/svg+xml`,
    `text/html`, `text/markdown`, `application/pdf`), **3 Mo décodés** max —
    le base64 pèse un tiers de plus et voyage dans le corps JSON d'un unique
    appel MCP, le refus annonce la limite en clair —, chemin horodaté et
    `upsert: false` (deux appels ne peuvent pas viser le même objet), et
    retrait du fichier si l'insertion en base échoue (ni ligne orpheline, ni
    fichier orphelin). Deux envois du même nom créent deux documents : rien
    n'est jamais remplacé. Le paramètre `description` n'a pas de colonne
    dédiée, il est journalisé dans l'audit.

  Le plafond de 3 Mo est calé sur ce que le transport MCP encaisse
  (client → worker Cloudflare → edge function). Pour le réévaluer, la seule
  constante à changer est `DOCUMENT_MAX_BYTES` dans
  `supabase/functions/_shared/mission-tools.ts` — les descriptions des tools
  et les messages d'erreur la reprennent. Un upload en trois temps
  (`begin_upload` / `append_chunk` / `commit_upload`) reste possible si des
  PNG haute résolution butent réellement dessus ; tant que ce n'est pas
  constaté, la version simple suffit.
- **Lecture des documents** : `read_document` renvoie le contenu réel d'une
  pièce jointe (mission, CRM, support). Les PDF avec texte sont renvoyés en
  texte ; les **PDF scannés** sont renvoyés en images de pages, à lire
  visuellement ; les `.xlsx` sont convertis en CSV et les `.docx` en texte ;
  les fichiers audio renvoient leur transcription SuperTools si elle existe.
  Les fichiers Google Drive se lisent via le connecteur Drive natif de
  claude.ai, dans la même conversation.
- **Couverture intégrale d'une mission** : deux invariants garantissent qu'une
  réponse partielle ne peut pas passer pour une réponse complète.
  1. **Une page est livrée entière ou pas du tout.** `get_mission_dossier`
     remplit son budget (250 000 caractères) en commençant par les pages les
     plus courtes, pour qu'une page monumentale n'évince pas les petites.
     Aucune page tronquée, donc aucun contenu coupé pris pour du contenu
     complet.
  2. **Ce qui n'est pas livré figure dans `reading_plan`**, avec l'appel exact
     et le nombre de parties. `read_mission_page(page_id, part)` lit chaque
     page restante par tranches de 60 000 caractères, en annonçant
     `part N/M` et `next_part`.

  Le bloc `coverage` (`pages_total`, `pages_complete`, `chars_total`,
  `chars_delivered`, `remaining_calls`) chiffre ce qui manque, et le `hint`
  interdit explicitement de conclure tant que `reading_plan` n'est pas épuisé.

  Exemple mesuré, mission de 929 320 caractères sur 17 pages : 13 pages
  livrées intégralement, 4 pages dans le plan, 100 % atteignable en 14 appels.
  L'ancienne version en livrait 16 % sans le signaler.

  Les blocs annexes portent leur total exact (`activities_total`,
  `documents_total`, `gallery_total`) : une liste plafonnée à 100 lignes le
  dit. Documents : `read_document(document_id)` ou
  `read_mission_documents(mission)`. Photos : `read_media_image(media_id)`.
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

## Outils d'audience (SEO, GEO, éditorial)

Quatre outils lisent l'historique alimenté par les crons `gsc-sync` et
`wp-statistics-sync` (voir `docs/seo-analytics.md`). Ils partagent leur
implémentation avec la page Statistiques via
`supabase/functions/_shared/seo-tools.ts` : Claude et l'interface affichent
les mêmes chiffres.

- **`get_seo_performance`** — totaux, série journalière et détail par
  dimension (`query`, `page`, `page_query`, `country`, `device`,
  `appearance`), avec la comparaison ligne à ligne avec la période
  précédente de même longueur. Le bloc `data_coverage` indique jusqu'où
  remonte réellement l'historique : une tendance ne peut pas être annoncée
  au-delà.
- **`get_seo_opportunities`** — diagnostic calculé, pas estimé : quick wins
  (positions 4 à 20 avec les clics gagnés en atteignant la position 3), CTR
  anormalement bas pour la position (problème de titre ou de description),
  cannibalisation, pages en déclin, sujets en croissance, état d'indexation
  issu de l'API URL Inspection, erreurs de sitemap et visites venues des
  moteurs génératifs.
- **`get_content_performance`** — croisement article par article : vues
  WordPress sur la période, clics et impressions Search Console, position
  moyenne, requêtes d'entrée des dix premiers, état d'indexation, date de
  dernière modification.
- **`get_editorial_brief`** — dossier complet pour préparer une newsletter :
  newsletters passées et cartes déjà poussées, kanban éditorial, événements
  à venir, sessions de formation avec leur taux de remplissage, meilleurs
  contenus de la période et signaux d'audience. Un appel au lieu de dix
  requêtes SQL approximatives.

Les tables sous-jacentes (`gsc_metrics_daily`, `gsc_url_inspections`,
`gsc_sitemaps`, `wp_traffic_daily`) restent accessibles en SQL via
`query_database` pour les questions qui sortent de ces quatre cadres.

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
Le serveur SuperTools lui-même n'écrit que de façon additive
(`save_mission_note`, `save_mission_document`) : au pire, un contenu piégé
ferait créer une page ou un document de trop sur une mission — rien
d'existant ne peut être modifié ni supprimé. Un fichier HTML poussé par
`save_mission_document` est servi tel quel depuis le domaine de storage
Supabase, distinct de l'origine de l'application : il ne peut donc pas lire la
session SuperTools, exactement comme un HTML téléversé à la main dans les
documents d'une mission. Périmètre revu à chaque ajout de source dans
l'indexation.

## Suivi

Requêtes des 7 derniers jours :

```sql
SELECT created_at, explanation, query_text
FROM agent_query_audit_log
WHERE explanation LIKE '%MCP%' AND created_at > now() - interval '7 days'
ORDER BY created_at DESC;
```
