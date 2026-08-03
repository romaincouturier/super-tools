# Détection des appels d'offres (BOAMP, PLACE, AWS)

**Statut : spécification validée, développement non commencé.**
Document de reprise : il contient tout ce qui a été décidé, ce qui reste
ouvert, et l'état réel de l'existant vérifié en base. Écrit pour pouvoir
reprendre le sujet des semaines plus tard sans rien réinventer.

Dernière mise à jour : 03/08/2026.

---

## 1. Objectif

Surveiller en continu les marchés publics du domaine SuperTilt (facilitation
graphique, sketchnoting, intelligence collective, conduite du changement, IA
appliquée), et faire remonter les avis pertinents pour une décision Go / No Go
avant qu'ils n'entrent dans le CRM.

**La contrainte fondatrice** : le flux brut est massif et majoritairement hors
sujet. Rien ne doit atteindre `crm_cards` sans décision humaine explicite. Le
kanban CRM existant fonctionne, il ne doit pas être pollué.

## 2. Les trois sources, et pourquoi il en faut trois

| Source | Nature | Accès | Ce qu'elle apporte |
|---|---|---|---|
| **BOAMP** | Journal officiel des marchés publics (DILA) | API open data, sans clé, licence Etalab 2.0 | Tout ce qui dépasse les seuils, plus les avis d'attribution |
| **PLACE** | Profil d'acheteur de l'État | Alertes mail uniquement | Les MAPA de l'État, souvent absents du BOAMP |
| **AWS** | Profil d'acheteur privé (collectivités) | Alertes mail uniquement | Les MAPA des collectivités clientes d'AWS |

Les MAPA sous 90 k€ peuvent n'être publiés que sur le profil d'acheteur. BOAMP
ne remplace donc pas PLACE et AWS, il les complète. **Ni PLACE ni AWS n'offrent
d'API** : la seule voie d'entrée est le mail d'alerte.

## 3. Le workflow validé

```
1. RÉCEPTION (déterministe, jamais dépendante d'un agent)
   ├─ cron quotidien  → API BOAMP (avis + attributions)
   ├─ mail PLACE      → resend-inbound-webhook → table tampon
   └─ mail AWS        → resend-inbound-webhook → table tampon
        └─ écriture immédiate en statut `raw`, dédoublonnage, fusion inter-sources

2. ANALYSE (Claude Cowork via connecteur MCP)
   ├─ préfiltre déterministe (exclusions) AVANT tout appel modèle
   └─ enrichissement, scoring, passage en `to_review`
        └─ l'agent n'écrit QUE dans la table tampon, jamais dans crm_cards

3. NOTIFICATION (daily_actions, 7h)
   └─ priorisée par la date limite et la catégorie, pas par la date d'arrivée
   └─ plus une alerte de santé du flux (file `raw` qui stagne)

4. DÉCISION (sous-module CRM « Go / No Go »)
   ├─ No Go → motif obligatoire, archivage, conservé pour l'historique
   └─ Go    → carte crm_cards + tag + Slack, réversible

5. EXPIRATION automatique des avis non décidés après la date limite

6. CALIBRAGE du scoring sur les motifs de No Go accumulés
```

### Pourquoi la réception est séparée de l'analyse

Si l'agent fait aussi la réception, une session qui ne tourne pas égale des
alertes perdues, sans que personne le sache. Séparé, une analyse ratée se
rattrape en relançant sur la file, et le retard devient visible et mesurable
(« 12 avis en `raw` depuis 3 jours » est une alerte).

### Pourquoi l'agent n'écrit jamais dans le CRM

Le contenu d'un avis public et d'un mail d'alerte est du contenu externe non
contrôlé, traité par un agent qui dispose d'un droit d'écriture. C'est le point
de vigilance déjà documenté dans `docs/mcp-connector.md`. La barrière est la
décision humaine de l'étape 4 : aucun chemin ne doit la contourner.

## 4. Décisions actées

| Sujet | Décision |
|---|---|
| Une table par source ? | **Non.** Une seule table pour les trois sources, avec une colonne `source`. Sinon : trois scorings, trois écrans, trois lignes de backup. |
| Doublons inter-sources | Fusion **à l'ingestion**, ligne canonique + sources rattachées. Pas un filtre à l'affichage. Le même marché arrive par PLACE et par BOAMP, souvent le même jour. |
| Pipeline CRM | **Les AO restent dans le pipeline existant**, pas de colonne dédiée. Distingués par le tag « Marché public ». |
| Scoring | En **données** (table ou `app_settings`), pas en dur. Les pondérations bougeront tous les mois. |
| Attributions BOAMP | **Ingérées dès le début**, pas « plus tard ». Le titulaire sortant est le signal de décision le plus fort, et c'est une requête de plus sur la même API. |
| Ordre scoring / ingestion | **Ingérer deux semaines avant d'écrire le scoring.** Calibrer sur des données réelles, pas sur des pondérations devinées. |
| No Go hors AO | Action « No Go » disponible sur **toutes** les opportunités CRM, pas seulement les AO. |
| Statut du No Go | `sales_status = 'LOST'` avec `loss_reason = 'no_go'`. Pas de nouveau statut pour l'instant. À réévaluer si le forecast doit séparer « renoncé » de « perdu ». |
| `acquisition_source` | Une seule valeur `marche_public`, pas une par source, sinon les rapports d'acquisition se fragmentent. |

### Intitulés des actions programmées (validés)

- À la création de la carte : `waiting_next_action_text` = « Retirer le DCE et
  décider de candidater », date du jour, `expected_close_date` = date limite de
  remise des offres.
- À J-7 de la date limite : bascule sur « Déposer l'offre avant le {date
  limite} », remontée quotidienne dans les alertes tant que non cochée.
- Tag CRM « Marché public » pour isoler ces cartes dans les rapports.

### Aide à la décision : ce qui fait basculer un Go / No Go

Par ordre d'importance décroissante, c'est ce que le sous-module doit afficher :

1. Le titulaire sortant et le montant du marché précédent (vient des avis
   d'**attribution**).
2. La pondération des critères. Un marché à 70 % prix n'est pas pour SuperTilt.
3. L'allotissement : un lot accessible dans un marché global inaccessible.
4. La durée et les reconductions.
5. L'historique CRM avec cet acheteur, déjà en base.
6. La date limite et le volume de travail pour répondre.

## 5. Prérequis bloquant : la réception de mail

**C'est le sujet en cours au moment où ce document est écrit.** Le reste du
module peut avancer sans lui (BOAMP seul), mais PLACE et AWS en dépendent
entièrement.

### État constaté (vérifié en base le 03/08/2026)

- `inbound_emails` : **0 ligne**, aucune date de première ni de dernière
  réception. Le pipeline n'a jamais rien reçu.
- `resend-inbound-webhook` **rejette tout en 503** tant que
  `RESEND_WEBHOOK_SECRET` n'est pas posé
  (`supabase/functions/resend-inbound-webhook/index.ts:461`).

Rien n'est branché, mais rien n'est cassé : le code est écrit et déployé, il
attend deux réglages.

### Le risque, et pourquoi il n'existe pas ici

La crainte légitime est de casser la réception sur `romain@supertilt.fr`. Elle
porte sur le MX du domaine racine, **auquel on ne touche pas**.

Un enregistrement MX se résout sur le nom exact du domaine, pas par héritage.
Un mail vers `romain@supertilt.fr` interroge le MX de `supertilt.fr`. Un mail
vers `marches@inbound.supertilt.fr` interroge celui de `inbound.supertilt.fr`.
Deux jeux d'enregistrements DNS indépendants : ajouter le second ne lit, ne
modifie et ne remplace rien du premier. SPF, DKIM et DMARC de `supertilt.fr`
ne sont pas touchés non plus, ils concernent l'envoi.

**La seule opération dangereuse serait de poser ou de modifier un MX sur
`supertilt.fr` lui-même. Elle n'est jamais nécessaire.**

### Procédure, entièrement réversible

1. **Relever l'existant** : `dig MX supertilt.fr +short`, garder le résultat.
   C'est le témoin de non-régression.
2. **Resend** : ajouter `inbound.supertilt.fr` comme domaine de réception.
   Resend fournit un enregistrement MX à poser **sur ce sous-domaine
   uniquement**.
3. **Vérifier avant d'aller plus loin** : `dig MX supertilt.fr +short` doit
   rendre exactement le même résultat qu'à l'étape 1, et un mail envoyé à
   `romain@supertilt.fr` doit arriver normalement. Tant que ces deux contrôles
   ne sont pas verts, on s'arrête.
4. **Poser le secret** `RESEND_WEBHOOK_SECRET` et brancher le webhook Resend
   sur l'URL de la fonction `resend-inbound-webhook`.
5. **Tester à froid** : envoyer un mail à la main à
   `marches@inbound.supertilt.fr` et vérifier qu'une ligne apparaît dans
   `inbound_emails`. La table étant vide, le signal est sans ambiguïté.
6. **Ensuite seulement** : règle Gmail qui transfère les alertes PLACE et AWS
   vers cette adresse. Les comptes PLACE et AWS ne sont pas modifiés, les
   alertes continuent d'arriver normalement dans la boîte habituelle.

**Rollback** : supprimer l'enregistrement MX du sous-domaine. Les mails vers le
sous-domaine rebondissent, rien d'autre ne change.

### Garde-fous à respecter pendant toute la phase de test

- **`app_settings.crm_inbound_email` reste vide.** Tant qu'il l'est, il
  n'existe aucun chemin entre un mail entrant et une carte CRM
  (`resend-inbound-webhook/index.ts:238`, le routage est une simple égalité sur
  le destinataire).
- Le routage vers la table tampon passera par une **seconde clé**
  `app_settings.tender_inbound_email`, testée de la même façon.
- **Filtre expéditeur en ceinture** : un mail provenant de PLACE, d'AWS ou du
  BOAMP ne crée jamais de carte CRM, quelle que soit l'adresse destinataire.
  Ainsi, même une erreur de configuration ne peut pas polluer le CRM.

### Variante si le sous-domaine ne suffit pas à lever le doute

Un domaine séparé à dix euros l'an, même mécanique, zéro intersection avec
`supertilt.fr`. Non nécessaire techniquement, mais l'option existe.

## 6. Architecture technique

### 6.1 Table unique

```sql
create table tender_opportunities (
  id                uuid primary key default gen_random_uuid(),
  -- Origine
  source            text not null,          -- 'boamp' | 'place' | 'aws'
  source_ref        text not null,          -- idweb BOAMP, référence de consultation sinon
  source_email_id   uuid references inbound_emails(id),  -- si arrivé par mail
  url_avis          text,
  -- Rapprochement inter-sources
  dedup_key         text,                   -- normalisation acheteur + objet + date limite
  duplicate_of      uuid references tender_opportunities(id) on delete set null,
  -- Contenu
  objet             text,
  acheteur          text,
  nature            text,                   -- APPEL_OFFRE | ATTRIBUTION | RECTIFICATIF
  type_marche       text,
  code_departement  text[],
  cpv_codes         text[],
  dateparution      date,
  datelimitereponse timestamptz,
  -- Analyse
  matched_on        text[],                 -- quels CPV / mots-clés ont matché
  score             integer default 0,
  category          text,                   -- 'A' | 'B' | 'C'
  -- Cycle de vie
  status            text not null default 'raw',
    -- raw | to_review | go | no_go | expired
  no_go_reason      text,
  no_go_detail      text,
  reviewed_at       timestamptz,
  crm_card_id       uuid references crm_cards(id) on delete set null,
  -- Brut
  raw               jsonb,                  -- avis complet ou mail parsé
  parse_error       text,                   -- échec de parsing, jamais avalé en silence
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (source, source_ref)
);
```

Notes de conception :

- `unique (source, source_ref)` porte le dédoublonnage **intra**-source et rend
  l'`upsert` naturel. Les rectificatifs mettent à jour la ligne existante, en
  particulier `datelimitereponse` quand le délai est prolongé. Ne jamais
  insérer une seconde ligne pour un rectificatif.
- `dedup_key` + `duplicate_of` portent le rapprochement **inter**-sources, sur
  le modèle de `watch_items.is_duplicate` / `duplicate_of`
  (`supabase/migrations/20260331100000_create_watch_module.sql:26`).
- `parse_error` : sans lui, on ne saura jamais combien d'avis passent à côté du
  filtre faute d'un JSON mal formé.
- Les colonnes propres au BOAMP (`famille_libelle`, `descripteur_code`) vivent
  dans `raw`, pas en colonnes à plat.

### 6.2 Statuts

| Statut | Signification |
|---|---|
| `raw` | Reçu, stocké, pas encore analysé. Une file dans cet état qui stagne est une alerte. |
| `to_review` | Analysé et scoré, en attente de décision humaine. |
| `go` | Promu en carte CRM, `crm_card_id` renseigné. |
| `no_go` | Écarté, motif obligatoire. Conservé : sert au calibrage du scoring et à la production de contenu. |
| `expired` | Date limite dépassée sans décision. Passage automatique, sinon la liste se remplit de cadavres. |

### 6.3 Promotion vers le CRM

| `crm_cards` | Valeur |
|---|---|
| `title` | `objet` tronqué |
| `company` | `acheteur` |
| `service_type` | choix utilisateur au moment du Go (`formation` ou `mission`) |
| `acquisition_source` | `marche_public` |
| `expected_close_date` | `datelimitereponse` |
| `status_operational` | `WAITING` |
| `waiting_next_action_date` | date du jour |
| `waiting_next_action_text` | « Retirer le DCE et décider de candidater » |
| `next_action_type` | `other` |
| `source_metadata` | `{ source, source_ref, url_avis, cpv_codes, score, dateparution }` |
| `description_html` | résumé de l'avis + lien vers l'avis |
| `sales_status` | `OPEN` |
| `emoji`, `position` | comme les autres créations (emoji aléatoire, position max+1) |

Plus : tag « Marché public », notification Slack via
`postCrmOpportunityToSlack` avec un `source_label` explicite, ligne
`crm_activity_log` en `card_created`, et retour de `crm_card_id` sur la ligne
`tender_opportunities`.

**Réversibilité du Go** : il faut pouvoir repasser en `to_review`, et décider
quoi faire de la carte créée. Sans ça, une erreur laisse une ligne en `go` avec
un `crm_card_id` mort.

### 6.4 Chemins de code existants à réutiliser

| Besoin | Où |
|---|---|
| Création de carte CRM côté serveur, de référence | `supabase/functions/crm-elementor-webhook/index.ts:606` |
| Création de carte côté app | `src/hooks/crm/useCreateCard.ts:31` |
| Notification Slack | `supabase/functions/_shared/crm-slack.ts` (`postCrmOpportunityToSlack`) |
| Réception de mail | `supabase/functions/resend-inbound-webhook/index.ts` |
| Routage mail vers le CRM (à ne PAS déclencher) | `resend-inbound-webhook/index.ts:238` |
| Alertes du matin | table `daily_actions`, peuplée par `generate-daily-actions` à 7h. Index unique sur `(user_id, action_date, category, entity_type, entity_id)`, donc réémettre la même action chaque jour est gratuit. |
| Dédoublonnage par similarité | `watch_items` (pgvector déjà déployé) |
| Dialogue de motif de perte | `src/components/crm/LossReasonDialog.tsx`, déjà branché sur le kanban |
| Action « Supprimer » du drawer, où ajouter « No Go » | `src/components/crm/CardDetailDrawer.tsx:890` |

### 6.5 Modifications à prévoir sur l'existant

- **`AcquisitionSource`** (`src/types/crm.ts:6`) : ajouter `marche_public` au
  type **et** à `acquisitionSourceConfig`, sinon la fiche s'affiche sans
  libellé. Pas de contrainte CHECK en base, la colonne est un simple TEXT
  (`supabase/migrations/20260219110000_add_sales_coach_features.sql:32`).
- **Bouton « No Go »** dans le drawer de carte, à côté de « Supprimer », qui
  ouvre `LossReasonDialog` avec le motif `no_go` présélectionné et passe la
  carte en `LOST`. Vaut pour toutes les opportunités, AO ou non.
- **`resend-inbound-webhook`** : seconde clé de routage
  `tender_inbound_email`, plus le filtre expéditeur de sécurité.

## 7. L'API BOAMP

> Les noms de champs ci-dessous viennent de la spec initiale et **n'ont pas été
> vérifiés en direct**. Premier geste de l'implémentation : un
> `GET /records?limit=1` dans la console pour confirmer. La structure est
> stable depuis des années, mais on ne code pas sur une supposition.

Portail : `https://boamp-datadila.opendatasoft.com`, dataset `boamp`, API
Opendatasoft Explore v2.1 (ODSQL). Sans authentification, sans clé, licence
Etalab 2.0. Mise à jour quotidienne le matin.

| Usage | Endpoint |
|---|---|
| Requête paginée | `GET /api/explore/v2.1/catalog/datasets/boamp/records` |
| Export filtré (recommandé pour le batch) | `GET /api/explore/v2.1/catalog/datasets/boamp/exports/json` |
| Console interactive | `/api/explore/v2.1/console` |

`/records` plafonne à `limit=100` et `offset` ~10 000. `/exports/json` streame
tout sans pagination : c'est celui du batch.

### Champs utiles

| Champ | Contenu |
|---|---|
| `idweb` | Identifiant unique BOAMP, ex. `26-123456`. **Clé de dédoublonnage.** |
| `objet` | Objet du marché |
| `nomacheteur` | Acheteur public |
| `code_departement` | Départements d'exécution (tableau). Aucun filtre appliqué. |
| `dateparution` | Date de publication |
| `datelimitereponse` | Date limite de remise des offres |
| `nature` | `APPEL_OFFRE`, `ATTRIBUTION`, `RECTIFICATIF` |
| `famille` / `famille_libelle` | Régime de publication (JOUE, MAPA, national) |
| `type_marche` | `SERVICES` / `FOURNITURES` / `TRAVAUX` |
| `descripteur_code` / `descripteur_libelle` | Descripteurs métier BOAMP, alternative robuste aux CPV |
| `donnees` | **L'avis complet en JSON** (chaîne). C'est là que vivent les CPV, les lots, les montants, l'URL du DCE et les contacts. |
| `url_avis` | Lien vers l'avis sur boamp.fr |

Les CPV ne sont pas une colonne à plat, ils sont dans `donnees`. D'où les deux
requêtes complémentaires ci-dessous.

### Requêtes de référence

**A. Par CPV** (recherche plein texte, une chaîne entre guillemets doubles
cherche dans tous les champs, `donnees` inclus) :

```
/api/explore/v2.1/catalog/datasets/boamp/exports/json
  ?where=nature='APPEL_OFFRE'
    AND dateparution >= date'2026-08-02'
    AND ("80000000" OR "80500000" OR "80510000" OR "80511000"
      OR "80522000" OR "80532000" OR "80570000"
      OR "79400000" OR "79419000" OR "79822500"
      OR "79951000" OR "79952000" OR "79998000")
```

**B. Par mots-clés dans l'objet**, filet pour les marchés mal codés :

```
where=nature='APPEL_OFFRE' AND dateparution >= date'2026-08-02'
  AND (search(objet, 'facilitation') OR search(objet, 'intelligence collective')
    OR search(objet, 'sketchnote') OR search(objet, 'conduite du changement')
    OR search(objet, 'intelligence artificielle'))
```

Si `search()` n'est pas supporté sur ce portail, replier sur
`objet like '%facilitation%'`. À tester dans la console.

**C. Attributions**, pour le titulaire sortant et le radar des renouvellements :

```
where=nature='ATTRIBUTION' AND dateparution >= date'2022-01-01'
  AND dateparution <= date'2024-12-31'
  AND ("80500000" OR "79400000" OR ...)
```

Les marchés de formation attribués il y a deux à quatre ans sont les
renouvellements à venir. À croiser plus tard avec les DECP (data.gouv.fr) qui
donnent durée et montant exacts.

URL-encoder le `where` dans le code.

### Job d'ingestion

```
1. depuis = max(dateparution) en base − 2 jours     // recouvrement de sécurité
2. pour chacune des requêtes (CPV, mots-clés, attributions) :
     GET exports/json
3. pour chaque avis :
     - parser `donnees` → cpv_codes, montants, contacts (optional chaining partout)
     - en cas d'échec : stocker parse_error, ne pas jeter
     - upsert on conflict (source, source_ref)
     - RECTIFICATIF : mettre à jour l'avis d'origine, notamment datelimitereponse
     - calculer dedup_key, rattacher à une ligne existante le cas échéant
4. préfiltre déterministe : exclusions évidentes écartées avant tout appel modèle
5. marquer expired : status in ('raw','to_review') AND datelimitereponse < now()
6. alimenter daily_actions pour les catégories A et les échéances proches
```

Planification : quotidienne tôt le matin. Coût : deux à trois appels par jour.

### Scoring, première version à recalibrer

À implémenter **après** deux semaines d'ingestion brute, et en données, pas en
dur. Base de départ, additif sur `objet` + `donnees` :

| Signal | Points |
|---|---|
| Mot-clé niche (`facilitation graphique`, `intelligence collective`, `sketchnote`) | +40 |
| Mot-clé fort (`facilitation`, `co-construction`, `conduite du changement`, `intelligence artificielle`, `acculturation`) | +25 |
| CPV cœur (80511, 80532, 80522, 80570, 79951, 79998) | +20 |
| CPV chapeau seul (80000000, 80500000, 79400000) | +10 |
| `type_marche = 'SERVICES'` | +5 |
| Acheteur déjà présent dans `crm_cards` | +20 |
| Délai de réponse < 12 jours | −15 |
| Mots d'exclusion (`bâtiment`, `restauration collective`, `transport scolaire`) | −50 |

Catégories : **A ≥ 60** (revue obligatoire), **B 30-59** (revue rapide),
**C < 30** (archivé, consultable).

Piste ultérieure : le vrai gisement est l'historique de ce qui est gagné et
perdu dans `crm_cards` (`won_at`, `lost_at`, `loss_reason`). Une similarité
d'embeddings avec les affaires gagnées vaudra mieux qu'une liste pondérée.
L'infrastructure pgvector est déjà déployée.

## 8. Contraintes du dépôt à respecter

- **Règle [038]** : toute nouvelle table doit être ajoutée à `TABLES_TO_BACKUP`
  dans `backup-export` **et** `scheduled-backup`, ou exclue explicitement dans
  `scripts/backup-exclusions.txt`. `tender_opportunities` est une donnée
  métier : elle se backupe.
- **Règle [042]** : migration idempotente, `CREATE TABLE IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS` avant chaque
  `CREATE POLICY`, pas deux fichiers au même horodatage.
- **Règle [043]** : typecheck via `npm run typecheck`, jamais `tsc --noEmit`.
- `bash scripts/check-rules.sh` doit être vert avant tout commit, c'est un hook
  bloquant.

## 9. Ordre d'implémentation

1. Console BOAMP : valider les noms de champs et les trois requêtes.
2. Table `tender_opportunities` + ingestion BOAMP (avis et attributions), tout
   en `raw`, sans scoring ni UI. **Ne dépend d'aucun réglage externe.**
3. Deux semaines d'observation, revue via `query_database` depuis le connecteur
   MCP. Mesurer le volume réel et la proportion de bruit.
4. Réception mail (section 5), puis routage PLACE et AWS vers la même table.
5. Scoring calibré sur les données observées.
6. Sous-module CRM « Go / No Go » : liste triée par urgence, fiche de décision,
   Go / No Go, promotion, réversibilité.
7. Bouton « No Go » sur toutes les opportunités CRM.
8. Boucle de calibrage sur les motifs de No Go accumulés.

Les étapes 2 et 4 sont indépendantes et peuvent avancer en parallèle. Si
l'inbound mail ne se débloque pas, le module fonctionne en dégradé avec BOAMP
seul.

## 10. Limites connues

- BOAMP ne voit pas tous les MAPA sous 90 k€. Les alertes PLACE et AWS restent
  nécessaires, elles ne sont pas redondantes.
- `donnees` est un JSON issu d'XML : structure verbeuse, chemins variables
  selon le formulaire (national ou européen). Parsing défensif obligatoire.
- La recherche plein texte par CPV rate un avis sans aucun CPV renseigné, cas
  rare au BOAMP où le champ est obligatoire. Le filet mots-clés couvre ce cas.
- Quota API anonyme Opendatasoft : sans souci à deux ou trois appels par jour.
  Surveiller les en-têtes de rate-limit si la fréquence augmente.
- Le cycle de vie d'un appel d'offres (retrait du DCE, mémoire technique,
  dépôt, attente d'attribution pendant des semaines) diffère du gré à gré. Les
  cartes vont stagner dans le pipeline. Le tag permet de les isoler dans les
  rapports ; si la distorsion des indicateurs devient gênante, rouvrir la
  question de la colonne dédiée.

## 11. Questions restées ouvertes

- Statut distinct pour le No Go, si le forecast doit séparer « renoncé » de
  « perdu ». Reporté : la `loss_reason` suffit pour l'instant.
- Où stocker le DCE pour l'aide à la décision. Les mails d'alerte portent des
  liens, parfois des pièces jointes, mais `inbound_emails.attachments` ne
  stocke que les métadonnées, pas le contenu.
- Fréquence de la revue : quotidienne pour les catégories A et les échéances
  proches, hebdomadaire pour le reste. À confirmer à l'usage.
