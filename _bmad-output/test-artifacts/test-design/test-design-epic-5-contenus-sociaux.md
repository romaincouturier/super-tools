---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-11-05'
---

# Test design : Epic 5 - Sortir les posts du kanban newsletter

**Date :** 2026-11-05
**Auteur :** Romain (rédigé par l'architecte de test BMAD TEA, mode epic)
**Statut :** Brouillon

---

## Résumé

**Périmètre :** plan de test de niveau epic pour l'Epic 5 du module Contenus sociaux (story 5.1 : migration des cartes post et redirection des points d'entrée, FR25 ; story 5.2 : lien entre carte éditoriale et contenus, FR26 ; critères communs de l'Overview ; exigence « script idempotent, joué une fois en production après la publication du front » des Additional Requirements). Tout ce qui est nommé ici sans chemin vérifié (fonction de migration, rapport, contrainte, colonne de lien, service de brouillon social, outils MCP de l'epic 4) est **à créer**.

**Faits relevés dans le code et la base (5 novembre 2026) :**

- Les 6 cartes sont bien là : 4 `post` et 1 `post_linkedin` en « Diffusion Terminée », 1 `post_linkedin` en « Idées » (requête en lecture seule via le connecteur). **Aucune n'a d'échéance (`deadline`), de visuel (`image_url`) ni de PDF.** La règle « échéance vers date » ne donne donc aucune date pour les 6 cartes (Q-1).
- `content_cards.card_type` est un `text` libre, sans contrainte (`supabase/migrations/20260205093150_dbe499d0-42a8-4586-acf1-a6a76e0ff4f8.sql`). D'autres valeurs que `post` et `post_linkedin` peuvent donc exister : `SendToContentBoardButton.tsx` écrit `post_instagram`, `newsletter`, `video` ; `src/components/transcripts/TranscriptGenerationPanel.tsx` écrit `linkedin`.
- Supprimer une carte déclenche `ON DELETE CASCADE` sur `content_reviews`, `review_comments` et `newsletter_cards` (sommaire des newsletters, y compris envoyées), et `ON DELETE SET NULL` sur `editorial_recommendations.card_id` (`supabase/migrations/20260702120000_editorial_engine.sql`).
- Points d'entrée qui créent aujourd'hui une carte post, au-delà des trois de la story : `TranscriptGenerationPanel.tsx` (`sendToBoard`, type `linkedin`) et l'outil MCP `prepare_newsletter`, qui crée des cartes à la volée par `insertCard` avec `card_type` parmi `CARD_TYPES` (`supabase/functions/_shared/editorial-tools.ts`).
- `add_content_card` (`addContentCard`, `supabase/functions/_shared/ops-tools.ts`) n'a pas de paramètre `card_type` : la carte part avec la valeur par défaut `article`. `create_content_card` valide le type par `validateNewCard` (même fichier `editorial-tools.ts`), déjà testé dans `editorial-tools.test.ts`.
- `useDecideRecommendation` (`src/hooks/useEditorialRecommendations.ts`) crée une carte `post` (et non `post_linkedin`) dans « Idées » quand `format_recommande` vaut `post_linkedin`, puis écrit `card_id` sur la recommandation.
- `ContentCardDialog.tsx` propose « Article » et « Post réseaux sociaux » (`post`) ; l'auto-sauvegarde de `src/hooks/useContentCardData.ts` écrit `card_type: values.cardType || "article"`.
- `readFunctionSql` de `supabase/tests/helpers/db.ts` cherche aussi dans `supabase/migrations-apres-front/` : une fonction livrée dans ce dossier est testable en PGlite sans être jouée au push. En revanche `rls-tests.yml` (pgTAP) ne rejoue que `supabase/migrations/`.

**Risques :**

- Risques identifiés : 17 (6 élevés, 8 moyens, 3 faibles)
- Risques élevés (score ≥ 6) : 6 (R-01 à R-06)
- Catégories critiques : DATA (migration à un coup, perte et doublons) et OPS (ordre de déploiement)
- Aucun risque de score 9

**Couverture :**

- P0 : 6 scénarios (~14 à 24 h)
- P1 : 27 scénarios (~25 à 40 h)
- P2 : 6 scénarios (~4 à 8 h)
- P3 : 2 scénarios (~1 à 3 h)
- **Total : 41 scénarios, ~45 à 75 h, soit ~1 à 2 semaines pour une personne**

---

## Hors périmètre

| Élément | Raison | Traitement du risque |
| --- | --- | --- |
| Tables, RLS, composeur, calendrier, alertes | Epic 1 | Pré-requis en production avant l'epic 5 ; leurs tests restent au vert (Interfonctionnement) |
| Table d'historique d'un contenu | Epic 2 (FR16) | Pré-requis de 5.1-SQL-008 ; si l'epic 2 n'est pas livré, l'entrée « migré depuis la carte » n'a pas où s'écrire (R-17) |
| Outils MCP de brouillon et de lecture de contenu | Epic 4 | Leur nom est cité dans le message de refus (5.1-UNIT-001) ; la carte liée renvoyée par la lecture est testée ici (5.2-UNIT-001) |
| Serveur MCP en entier (`supabase/functions/mcp-server/index.ts`) | Démarre un serveur à l'import, non testable (`test-design-progress.md`) | Les règles de refus sont testées sur les helpers `_shared` qu'il appelle |
| Articles du kanban | Restent au kanban (Assumptions de la spec) | Non-régression des chemins article : 5.1-COMP-003, 5.1-UNIT-005 |
| Performance | 6 cartes à migrer, deux utilisateurs | Aucun test |

---

## Évaluation des risques

Échelles (`probability-impact.md`) : probabilité 1 (peu probable), 2 (possible), 3 (probable) ; impact 1 (mineur), 2 (dégradé), 3 (critique : perte de contenu ou d'historique, doublon publié, kanban pollué durablement). Score = P × I. 1 à 3 : documenter ; 4 et 5 : surveiller ; 6 à 8 : mitiger avant livraison ; 9 : bloquer.

### Risques élevés (score ≥ 6)

| ID | Catégorie | Description | P | I | Score | Mitigation | Responsable | Échéance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **R-01** | DATA | Perte de données au retrait de la carte d'origine : carte retirée alors que le contenu n'a pas été créé, ou suppression qui emporte en cascade les commentaires (`review_comments`), les relectures (`content_reviews`) et la place de la carte dans le sommaire d'une newsletter déjà envoyée (`newsletter_cards`) | 2 | 3 | **6** | Création du contenu et retrait de la carte dans la même transaction, par carte ; retrait seulement si le contenu existe ; inventaire des dépendances dans le rapport avant exécution ; mode de retrait tranché en Q-2 (suppression ou archivage). Tests 5.1-SQL-003, 5.1-SQL-005 | Dev | Story 5.1, avant le passage en production |
| **R-02** | DATA | Rejeu non idempotent : une deuxième exécution (ou une reprise après échec partiel) crée un second contenu pour une carte déjà migrée, visible deux fois dans le calendrier | 2 | 3 | **6** | Clé d'origine unique sur le contenu migré (identifiant de la carte, colonne ou table à créer) ; la migration passe une carte déjà migrée et le dit dans le rapport. Tests 5.1-SQL-002, 5.1-SQL-007, 5.1-SQL-014 | Dev | Story 5.1 |
| **R-03** | DATA | Correspondance des colonnes fausse ou incomplète : aucune des 6 cartes n'a d'échéance, donc les 5 « Diffusion Terminée » deviendraient « publié » sans date et n'apparaîtraient ni dans le calendrier ni dans la grille Instagram ; règle de composition du texte (titre puis description, description vide, Markdown) non fixée ; `image_url` est une URL alors que les posts référencent la Médiathèque ; `tags` n'a pas d'équivalent tant que la liste des thèmes est vide (FR22) | 3 | 2 | **6** | Règle écrite et testée colonne par colonne (5.1-SQL-001, 5.1-SQL-011, 5.1-SQL-013, 5.1-SQL-015) ; date des publiés tranchée en Q-1 avant l'écriture du script | Dev, Romain | Avant le développement de la story 5.1 |
| **R-04** | BUS | Canal non confirmé : un `post` ne dit pas son réseau, un `post_linkedin` ne dit pas quel compte LinkedIn (Romain, Emmanuelle, page SuperTilt). Un canal deviné publie la fiche sur le mauvais compte dans le calendrier | 2 | 3 | **6** | Correspondance carte vers canal fournie explicitement et confirmée par Romain avant l'exécution ; une carte sans canal confirmé, ou avec un canal inexistant, est ignorée, laissée au kanban et listée dans le rapport. Tests 5.1-SQL-004, 5.1-SQL-012 | Romain, Dev | Avant l'exécution en production |
| **R-05** | TECH | Des points d'entrée hors de la liste de la story recréent des cartes post après la migration : `TranscriptGenerationPanel.tsx` (type `linkedin`), MCP `prepare_newsletter`, création directe en base ou par Lovable. Le kanban se repeuple de posts sans que les tests des trois points d'entrée le voient | 3 | 2 | **6** | Contrainte en base sur `content_cards.card_type` qui refuse les types post, posée par la migration après le retrait des cartes (à créer, 5.1-SQL-006) ; refus applicatif dans `validateNewCard` et `addContentCard` (5.1-UNIT-001 à 003) ; périmètre des points d'entrée tranché en Q-4 | Dev | Story 5.1 |
| **R-06** | OPS | Ordre de déploiement : migration jouée avant la publication du front (l'ancien front recrée des cartes post, ou se heurte à la contrainte de R-05 sans message exploitable), jamais jouée (le push n'applique rien, `supabase/migrations-apres-front/README.md`), ou jouée sans sauvegarde récente | 2 | 3 | **6** | Fichier placé dans `supabase/migrations-apres-front/` et ajouté au tableau de son README ; procédure manuelle X-OPS-001 (front publié, sauvegarde vérifiée, exécution à blanc, correspondance signée, exécution, relecture du rapport) ; garde d'exécution 5.1-SQL-012 | Romain | Jour de la mise en production |

### Risques moyens (score 3 à 4)

| ID | Catégorie | Description | P | I | Score | Mitigation | Responsable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-07 | OPS | Rapport de migration éphémère (simple `RAISE NOTICE` perdu avec la session SQL) : aucune preuve des 6 cartes traitées, des contenus créés et des cartes ignorées | 2 | 2 | 4 | Rapport persistant et lisible après coup (table ou entrées d'historique, à créer). 5.1-SQL-009 | Dev |
| R-08 | DATA | Sélection des cartes : un filtre exact sur `post` et `post_linkedin` ignore en silence des cartes `linkedin` ou `post_instagram` créées entre le relevé du 3 novembre et l'exécution, qui restent au kanban sans être signalées ; ou un filtre trop large touche un article | 2 | 2 | 4 | Rapport qui liste tout type non `article` trouvé, migré ou non ; aucun article touché. 5.1-SQL-010 ; Q-4 | Dev |
| R-09 | BUS | Régression des articles : la redirection de `SendToContentBoardButton` et de `useDecideRecommendation` casse le chemin article (colonne cible, ordre, tags, `card_id` de la recommandation) | 2 | 2 | 4 | 5.1-COMP-003, 5.1-UNIT-005, 5.1-COMP-008 | Dev |
| R-10 | DATA | Lien carte et contenu à la suppression : supprimer la carte supprime les contenus (cascade mal orientée) ou échoue ; supprimer un contenu laisse un lien fantôme dans le détail de la carte | 2 | 2 | 4 | Clé étrangère à comportement explicite (mise à NULL côté contenu, à confirmer en Q-7). 5.2-SQL-002, 5.2-SQL-003 | Dev |
| R-11 | TECH | Fenêtre entre la publication du front et la migration : ouvrir une carte post héritée dans `ContentCardDialog` sans l'option « Post » ; si l'état retombe sur `article`, l'auto-sauvegarde de `useContentCardData` réécrit `card_type` et la carte sort de la sélection de la migration sans trace | 2 | 2 | 4 | 5.1-COMP-005 ; fenêtre courte (X-OPS-001) | Dev |
| R-12 | BUS | Traçabilité des recommandations : `editorial_recommendations.card_id` ne peut viser qu'une carte. Une recommandation `post_linkedin` acceptée perd son lien vers ce qu'elle a produit ; l'alignement (`useEditorialAlignment`) reste juste, mais l'écran ne mène plus au contenu | 2 | 2 | 4 | Lien à créer ou à abandonner (Q-6). 5.1-UNIT-004 | Romain, Dev |
| R-13 | OPS | Pas de sauvegarde exploitable des 6 cartes et de leurs dépendances au moment de l'exécution. Les tables concernées sont dans `scheduled-backup` et `backup-export`, mais rien n'oblige à vérifier la sauvegarde du jour | 1 | 3 | 3 | Étape de X-OPS-001 : `backup_runs.db_status` du jour au vert, ou export ciblé des 6 cartes et de leurs lignes dépendantes avant exécution | Romain |
| R-14 | SEC | Le MCP travaille en service role (`brownfield.md`) : le refus des types post n'y repose que sur la validation applicative ; les écritures redirigées (brouillon social depuis un événement ou une recommandation) doivent passer par les services et la RLS `supertilt_fr` de l'epic 1, pas par un accès direct | 1 | 3 | 3 | Contrainte en base (5.1-SQL-006) qui vaut aussi pour le service role ; si le lien carte et contenu vit dans une table de liaison, pgTAP 5.2-PGTAP-001 | Dev |

### Risques faibles (score 1 à 2)

| ID | Catégorie | Description | P | I | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-15 | TECH | `SendToContentBoardButton` appelle `supabase.from()` depuis le composant (AD-5) ; la redirection doit passer par un hook et un service | 1 | 2 | 2 | Surveiller : contrôles de `check-rules.sh` |
| R-16 | DATA | Index de recherche : `trg_index_content_card` (`20260331200100_create_indexation_triggers.sql`) ne se déclenche qu'en INSERT et UPDATE ; des cartes supprimées peuvent rester dans `document_embeddings` et remonter dans la recherche | 1 | 2 | 2 | Surveiller : X-EXPL-001 (P3) |
| R-17 | BUS | L'entrée d'historique « migré depuis la carte … » dépend de la table d'historique de l'epic 2 | 1 | 2 | 2 | Critère d'entrée : epic 2 en production |

### Légende des catégories

- **TECH** : architecture, intégration
- **SEC** : contrôle d'accès, exposition de données
- **PERF** : performance
- **DATA** : intégrité, perte, incohérence
- **BUS** : logique métier, expérience utilisateur
- **OPS** : déploiement, configuration, sauvegarde

### Risque résiduel

Après mitigation, R-01, R-02 et R-05 tombent à une probabilité de 1 (score 3) si leurs tests P0 passent. R-03 et R-04 restent dépendants de décisions de Romain (Q-1, Q-3) : tant qu'elles manquent, le script ne peut pas être écrit. R-06 ne se mitige que par la discipline de la procédure manuelle, faute de mécanisme automatique pour jouer une migration différée.

---

## Critères d'entrée

- [ ] Epics 1 et 2 en production (tables des contenus, canaux, historique) ; noms des outils MCP de l'epic 4 connus
- [ ] Questions Q-1 à Q-7 tranchées par Romain
- [ ] Correspondance des 6 cartes vers leur canal confirmée par Romain, par identifiant de carte
- [ ] Base PGlite de test : schéma réduit de `content_columns`, `content_cards`, `content_reviews`, `review_comments`, `newsletters`, `newsletter_cards`, `editorial_recommendations`, puis fichiers de migration de l'epic 1 joués comme `supabase/tests/watch-sources.test.ts`
- [ ] Fixtures des 6 cartes reproduisant l'état relevé (types, colonnes, sans échéance ni visuel), plus une carte `linkedin`, une `post_instagram`, un article et une carte liée à une newsletter envoyée

## Critères de sortie

- [ ] 100 % des P0 passent
- [ ] ≥ 95 % des P1 passent, tout échec trié et accepté par Romain
- [ ] Aucun bug ouvert de sévérité haute sur la migration ou la non-régression des articles
- [ ] R-01 à R-06 mitigés
- [ ] Migration jouée en production selon X-OPS-001 ; rapport relu : 6 cartes listées, 6 contenus créés ou chaque carte ignorée justifiée
- [ ] `list_content_board` ne renvoie plus aucune carte de type post (Success signal de la spec)
- [ ] `npm run typecheck`, `bash scripts/check-rules.sh` et `npm test` passent ; la PR explicite l'impact sécurité du changement de `supabase/`

---

## Plan de couverture

**Note :** P0 à P3 expriment la priorité, c'est-à-dire le risque et la criticité, pas le moment d'exécution. Le moment d'exécution est traité dans la section Stratégie d'exécution.

### Niveaux de test du dépôt

| Niveau | Outil et emplacement | Ce qu'il prouve dans cet epic |
| --- | --- | --- |
| **Unit** | Vitest, `supabase/functions/_shared/**/*.test.ts`, `src/**/*.test.ts` | Refus des types post par les helpers MCP ; logique de décision d'une recommandation (client Supabase simulé) ; carte liée renvoyée par la lecture MCP |
| **SQL-PGlite** | Vitest + PGlite, `supabase/tests/*.test.ts`. La fonction de migration est chargée par `loadFunctions`, qui lit aussi `supabase/migrations-apres-front/` ; la contrainte et les clés étrangères sont jouées depuis le fichier entier | Migration de données, idempotence, transactions, rapport, contrainte de type, comportement du lien à la suppression |
| **pgTAP** | `supabase/tests/*.test.sql`, `rls-tests.yml` | RLS d'une éventuelle table de liaison carte et contenu (5.2-PGTAP-001) ; ne joue pas les migrations différées |
| **Component** | Vitest en jsdom + Testing Library, services simulés | Redirection des boutons, options du dialogue de carte, affichage des liens |
| **E2E** | Playwright, `e2e/*.spec.ts` avec interception réseau (`page.route`, comme `e2e/connexion.spec.ts`) | Un parcours : événement vers brouillon social |
| **Manuel** | Procédure en production | Exécution unique de la migration |

Contrainte de forme : `readFunctionSql` attend `CREATE OR REPLACE FUNCTION public.<nom>(...) AS $tag$ ... $tag$;`. Une migration écrite en bloc `DO $$ ... $$` ne serait pas testable par ce harnais : la logique doit vivre dans une fonction nommée, appelée une fois à la fin du fichier.

### P0 (critique)

**Critères :** bloque l'objectif de l'epic, lié à un risque ≥ 6, sans contournement (la migration ne se joue qu'une fois en production).

| ID | Story / critère | Scénario | Niveau | Risque | Responsable |
| --- | --- | --- | --- | --- | --- |
| 5.1-SQL-001 | 5.1 / correspondance | Les 6 cartes de la fixture, canaux confirmés : 6 contenus créés, texte composé du titre puis de la description, canal égal à celui de la correspondance ; les 5 « Diffusion Terminée » en « marqué comme publié » (date selon Q-1), la carte « Idées » en brouillon sans date | SQL-PGlite | R-03, R-04 | Dev |
| 5.1-SQL-002 | 5.1 / idempotence | Deuxième exécution complète : aucun contenu créé, aucune carte touchée, le rapport marque les 6 cartes « déjà migrée » | SQL-PGlite | R-02 | Dev |
| 5.1-SQL-003 | 5.1 / pas de perte | La création du contenu d'une carte échoue (erreur injectée) : la carte reste au kanban avec ses dépendances, aucun contenu partiel ne reste, les autres cartes sont migrées, la carte en échec figure au rapport avec son motif | SQL-PGlite | R-01 | Dev |
| 5.1-SQL-004 | 5.1 / canal confirmé | Carte absente de la correspondance des canaux : ignorée, laissée au kanban, listée au rapport « canal non confirmé » ; aucun canal par défaut | SQL-PGlite | R-04 | Dev |
| 5.1-SQL-005 | 5.1 / dépendances | Carte présente dans le sommaire d'une newsletter envoyée et portant des commentaires : après la migration, le sommaire envoyé et les commentaires restent lisibles (archivage) ou la carte est ignorée et signalée, selon Q-2 ; jamais de suppression en cascade silencieuse | SQL-PGlite | R-01 | Dev |
| 5.1-SQL-006 | 5.1 / garde en base | Après la migration, insérer ou modifier une carte en `post`, `post_linkedin`, `post_instagram` ou `linkedin` est refusé, y compris en service role ; `article` reste accepté | SQL-PGlite | R-05, R-14 | Dev |

**Total P0 : 6 scénarios**, soit 15 % du total, au-dessus de la cible de 10 % : la migration est irréversible et unique, ses règles de données ne peuvent pas être vérifiées après coup.

### P1 (haute)

**Critères :** fonctionnalité importante ou parcours fréquent, risque moyen, ou couverture complémentaire d'un risque ≥ 6.

| ID | Story / critère | Scénario | Niveau | Risque | Responsable |
| --- | --- | --- | --- | --- | --- |
| 5.1-SQL-007 | 5.1 / reprise | Première exécution avec une carte ignorée (canal manquant), puis canal confirmé et nouvelle exécution : la carte restante est migrée, les 5 autres ne sont pas dupliquées | SQL-PGlite | R-02 | Dev |
| 5.1-SQL-008 | 5.1 / historique | Chaque contenu migré porte une entrée d'historique « migré depuis la carte … » (titre et identifiant de la carte), datée et attribuée | SQL-PGlite | R-17 | Dev |
| 5.1-SQL-009 | 5.1 / rapport | Le rapport persiste après la session : une ligne par carte candidate avec carte, contenu créé ou motif d'ignorance ; 6 lignes sur la fixture nominale | SQL-PGlite | R-07 | Dev |
| 5.1-SQL-010 | 5.1 / sélection | Cartes `linkedin` et `post_instagram` présentes : migrées ou listées au rapport selon Q-4, jamais ignorées en silence ; aucun article lu ni modifié | SQL-PGlite | R-08 | Dev |
| 5.1-SQL-011 | 5.1 / visuel et thème | Carte avec `image_url` : règle retenue en Q-8 appliquée ; carte sans visuel (les 6 actuelles) : contenu sans visuel, alerte « visuel manquant » non bloquante ; tags : thème existant de même nom, sinon aucun thème créé | SQL-PGlite | R-03 | Dev |
| 5.1-SQL-012 | 5.1 / garde d'exécution | Tables de l'epic 1 absentes ou canal de la correspondance inexistant : la migration n'écrit rien et le dit (erreur explicite ou rapport) | SQL-PGlite | R-06, R-04 | Dev |
| 5.1-UNIT-001 | 5.1 / MCP `create_content_card` | `validateNewCard` refuse `post` et `post_linkedin` avec un message qui nomme les outils de l'epic 4 ; `article` accepté ; `CARD_TYPES` ne contient plus que `article` (le schéma de l'outil le reprend) | Unit | R-05 | Dev |
| 5.1-UNIT-002 | 5.1 / MCP `add_content_card` | `addContentCard` appelé avec un `card_type` post refuse avec le même message, sans insertion (aujourd'hui l'argument est ignoré et la carte part en `article`) | Unit | R-05 | Dev |
| 5.1-UNIT-003 | 5.1 / MCP `prepare_newsletter` | Une entrée nouvelle de type post dans `items` est refusée avant toute écriture : ni brouillon de newsletter, ni carte créés | Unit | R-05 | Dev |
| 5.1-UNIT-004 | 5.1 / recommandation | Accepter une recommandation `format_recommande = post_linkedin` crée un brouillon social sans date sur le canal retenu, n'insère rien dans `content_cards`, passe la recommandation en `accepted` avec le lien retenu en Q-6 | Unit | R-12, R-09 | Dev |
| 5.1-UNIT-005 | 5.1 / non-régression | Accepter une recommandation au format article crée toujours la carte `article` dans « Idées » et renseigne `card_id` ; colonne « Idées » absente : même erreur qu'aujourd'hui | Unit | R-09 | Dev |
| 5.1-COMP-001 | 5.1 / bouton événement | `SendToContentBoardButton`, choix « Post LinkedIn » : le service de brouillon social est appelé avec titre, description et canal LinkedIn retenu (Q-5) ; aucun appel à `content_cards` | Component | R-09, R-04 | Dev |
| 5.1-COMP-002 | 5.1 / bouton événement | Même bouton, choix « Post Instagram » : brouillon sur le canal Instagram | Component | R-09 | Dev |
| 5.1-COMP-003 | 5.1 / non-régression | Même bouton, choix Article (puis Newsletter, Vidéo) : carte créée dans la colonne choisie avec titre, description et tag « événement », comme aujourd'hui | Component | R-09 | Dev |
| 5.1-COMP-004 | 5.1 / dialogue de carte | `ContentCardDialog` en création et en modification d'un article : l'option « Post réseaux sociaux » n'est plus proposée | Component | R-05 | Dev |
| 5.1-COMP-005 | 5.1 / fenêtre de migration | `ContentCardDialog` ouvert sur une carte `post` héritée : l'auto-sauvegarde conserve `card_type` d'origine et ne le réécrit pas en `article` | Component | R-11 | Dev |
| 5.1-COMP-006 | 5.1 / transcripts | `TranscriptGenerationPanel`, envoi d'une variante de post LinkedIn : brouillon social au lieu d'une carte `linkedin` (si Q-4 l'inclut ; sinon le refus de 5.1-SQL-006 s'affiche en message lisible) | Component | R-05 | Dev |
| 5.1-E2E-001 | 5.1 / parcours | Session simulée : fiche événement, « Board contenus », Post LinkedIn ; le brouillon apparaît dans « Non planifiés » du calendrier ; aucune requête d'insertion vers `content_cards` | E2E | R-09 | Dev |
| X-OPS-001 | 5.1 / production | Procédure manuelle : front publié et page de connexion vérifiée ; sauvegarde du jour au vert ou export ciblé ; exécution à blanc qui liste cartes candidates et dépendances ; correspondance signée par Romain ; déplacement dans `supabase/migrations/` et exécution explicite ; relecture du rapport ; `list_content_board` sans post, 6 contenus visibles | Manuel | R-06, R-13 | Romain |
| 5.2-SQL-001 | 5.2 / lien | Rattacher un contenu à une carte article, lire les contenus d'une carte et la carte d'un contenu, retirer le lien | SQL-PGlite | R-10 | Dev |
| 5.2-SQL-002 | 5.2 / suppression de la carte | Supprimer la carte liée : les contenus restent, leur lien passe à NULL | SQL-PGlite | R-10 | Dev |
| 5.2-SQL-003 | 5.2 / suppression du contenu | Supprimer une déclinaison puis le groupe : la carte reste intacte et ne liste plus le contenu | SQL-PGlite | R-10 | Dev |
| 5.2-PGTAP-001 | 5.2 / RLS | Si le lien vit dans une table de liaison (à créer) : compte sans `supertilt_fr`, ni admin, ni Romain, ni `anon` ne lit ni n'écrit de lien. Sans table de liaison, scénario retiré (couvert par la RLS des posts de l'epic 1) | pgTAP | R-14 | Dev |
| 5.2-COMP-001 | 5.2 / décliner | « Décliner en posts » sur une carte : le composeur s'ouvre rattaché à la carte, titre en point de départ | Component | - | Dev |
| 5.2-COMP-002 | 5.2 / détail de carte | Le détail d'une carte liste les contenus liés avec leur statut affiché ; un clic ouvre le contenu | Component | R-10 | Dev |
| 5.2-COMP-003 | 5.2 / détail de contenu | Le détail d'un contenu affiche la carte liée ; un clic l'ouvre dans le kanban ; aucun bloc sans lien | Component | R-10 | Dev |
| 5.2-UNIT-001 | 5.2 / MCP | Le helper de lecture d'un contenu (story 4.2, à créer dans `_shared`) renvoie la carte liée (identifiant, titre, colonne), ou `null` sans lien | Unit | - | Dev |

**Total P1 : 27 scénarios.**

### P2 (moyenne)

**Critères :** cas limite, fonction secondaire, risque faible à moyen.

| ID | Story / critère | Scénario | Niveau | Risque | Responsable |
| --- | --- | --- | --- | --- | --- |
| 5.1-SQL-013 | 5.1 / texte | Description vide ou NULL : texte égal au titre, sans séparateur traînant ; Markdown et emojis de la description conservés tels quels | SQL-PGlite | R-03 | Dev |
| 5.1-SQL-014 | 5.1 / idempotence | Carte d'origine retirée à la main entre deux exécutions : le rejeu ne recrée rien et n'échoue pas | SQL-PGlite | R-02 | Dev |
| 5.1-SQL-015 | 5.1 / statut | Contenu migré publié : axe validation « non demandée » (aucune approbation fabriquée), axe publication « marqué comme publié », affiché Publié | SQL-PGlite | R-03 | Dev |
| 5.1-COMP-007 | 5.1 / fenêtre de migration | Une carte post héritée s'affiche sans erreur dans `KanbanBoard` et `ContentCard` jusqu'à la migration | Component | R-11 | Dev |
| 5.1-COMP-008 | 5.1 / erreur | Échec du service de brouillon depuis le bouton événement : erreur affichée par `toastError()`, dialogue ouvert, aucune carte créée en repli | Component | R-09 | Dev |
| 5.2-SQL-004 | 5.2 / lien invalide | Rattacher un contenu à une carte inexistante est refusé par la clé étrangère | SQL-PGlite | R-10 | Dev |

**Total P2 : 6 scénarios.**

### P3 (basse)

**Critères :** exploratoire, confort.

| ID | Story / critère | Scénario | Niveau | Responsable |
| --- | --- | --- | --- | --- |
| X-EXPL-001 | 5.1 / recherche | Après la migration, `search_content` ne remonte plus les cartes retirées (embeddings orphelins, R-16) | Manuel | Romain |
| 5.2-COMP-004 | 5.2 / volume | Carte liée à une dizaine de déclinaisons : liste lisible, statuts distincts | Component | Dev |

**Total P3 : 2 scénarios.**

### Garde contre les doublons

| Comportement | Niveau retenu | Pourquoi pas ailleurs |
| --- | --- | --- |
| Règles de la migration (correspondance, idempotence, transaction, rapport) | SQL-PGlite seul | Elles vivent dans le SQL livré ; X-OPS-001 vérifie l'exécution réelle, pas les règles |
| Refus des types post | SQL-PGlite pour la contrainte (tous chemins) ; Unit pour le message des trois outils MCP ; Component pour l'absence d'option à l'écran | Trois comportements distincts : garde, message d'orientation, offre de l'écran |
| Redirection des points d'entrée | Component (bouton, transcripts), Unit (recommandation) ; un seul E2E pour l'enchaînement jusqu'au calendrier | L'E2E ne rejoue pas les variantes de type |
| Comportement du lien à la suppression | SQL-PGlite seul | Les tests composant vérifient seulement l'affichage du lien |
| Accès Supabase hors hooks, listes de sauvegarde | Contrôles de `check-rules.sh` | Aucun test à écrire |

---

## Stratégie d'exécution

Principe : tout tourne à chaque PR tant que l'ensemble reste sous 15 minutes ; seul ce qui est manuel ou lié à la production est différé. Aucune suite lente : rien en nuit ni en semaine.

| Moment | Ce qui tourne | Mécanisme existant |
| --- | --- | --- |
| **PR** | Unit, SQL-PGlite, Component : `npm test` (inclut `supabase/tests/**/*.test.ts` et `supabase/functions/_shared/**/*.test.ts`, donc la fonction lue dans `migrations-apres-front/`) ; 5.1-E2E-001 dans le job navigateur ; `npm run typecheck` ; `bash scripts/check-rules.sh` | `.github/workflows/ci.yml` |
| **PR touchant `supabase/migrations/` ou `supabase/tests/`** | 5.2-PGTAP-001 si la table de liaison existe | `.github/workflows/rls-tests.yml` |
| **Nuit et semaine** | Rien de nouveau ; le scan hebdomadaire du mode démo couvre les écrans modifiés | `demo-scan.yml` |
| **Jour de la mise en production** | X-OPS-001, puis X-EXPL-001 | Manuel, Romain |

Playwright parallélise : un parcours de plus ne change pas la durée du job navigateur.

---

## Estimation

| Priorité | Nombre | Effort | Remarques |
| --- | --- | --- | --- |
| P0 | 6 | ~14 à 24 h | Schéma réduit du kanban et de ses dépendances dans PGlite, plus les migrations de l'epic 1 ; fixtures des 6 cartes ; injection d'erreur |
| P1 | 27 | ~25 à 40 h | Tests courts une fois la base de test écrite ; la procédure X-OPS-001 compte une demi-journée |
| P2 | 6 | ~4 à 8 h | Cas limites |
| P3 | 2 | ~1 à 3 h | Une vérification manuelle |
| **Total** | **41** | **~45 à 75 h** | **~1 à 2 semaines pour une personne** |

### Prérequis

**Données de test :** fixture des 6 cartes conforme au relevé (types, colonnes, sans échéance ni visuel) ; cartes de bord (`linkedin`, `post_instagram`, article, carte d'une newsletter envoyée avec commentaires) ; correspondance des canaux de test ; canaux et tables de l'epic 1 joués depuis leurs migrations.

**Outillage :** aucun nouvel outil. Vitest, PGlite, Testing Library, Playwright et pgTAP sont en place.

**Environnement :** accès SQL à la production pour Romain le jour de l'exécution ; Chromium Playwright.

---

## Portes de qualité

### Seuils

- **P0 :** 100 %, sans exception
- **P1 :** ≥ 95 %, tout échec accepté par écrit par Romain
- **P2 et P3 :** ≥ 90 %, informatif
- **Risques élevés :** R-01 à R-06 mitigés à 100 % avant l'exécution en production

### Couverture

- Règles de la migration : 100 % des scénarios P0 et P1 de la story 5.1 au vert avant X-OPS-001
- Points d'entrée : chacun des points d'entrée retenus en Q-4 a au moins un test de redirection et un test de non-régression article
- Logique métier nouvelle (helpers MCP, décision de recommandation) : ≥ 80 % de lignes couvertes
- Cas limites : ≥ 50 %

### Exigences non négociables

- [ ] Tous les P0 passent
- [ ] Aucun risque ≥ 6 sans mitigation
- [ ] Rapport de migration relu et archivé avec la PR
- [ ] Aucune carte de type post dans le kanban après l'exécution

---

## Plans de mitigation

### R-01 : perte de données au retrait de la carte (score 6)

**Stratégie :** une transaction par carte : créer le groupe et ses posts, écrire l'historique, puis retirer la carte ; toute erreur annule la carte en cours seulement. Avant exécution, la version à blanc liste pour chaque carte ses lignes dans `newsletter_cards`, `review_comments`, `content_reviews` et `editorial_recommendations`. Si Q-2 retient la suppression, une carte qui a des dépendances est ignorée et signalée plutôt que supprimée.
**Responsable :** Dev
**Échéance :** story 5.1
**Statut :** prévu
**Vérification :** 5.1-SQL-003, 5.1-SQL-005, rapport de X-OPS-001

### R-02 : rejeu sans doublon (score 6)

**Stratégie :** l'identifiant de la carte d'origine est stocké sur le contenu migré sous contrainte d'unicité (à créer) ; la fonction saute une carte déjà migrée, même si la carte a disparu.
**Responsable :** Dev
**Échéance :** story 5.1
**Statut :** prévu
**Vérification :** 5.1-SQL-002, 5.1-SQL-007, 5.1-SQL-014

### R-03 : correspondance des colonnes (score 6)

**Stratégie :** règle écrite avant le script : texte = titre, saut de ligne, description ; date selon Q-1 (aucune des 6 cartes n'a d'échéance) ; visuel selon Q-8 ; thème seulement s'il existe déjà. Chaque règle a son test.
**Responsable :** Dev, Romain (décisions)
**Échéance :** avant le développement de la story 5.1
**Statut :** prévu
**Vérification :** 5.1-SQL-001, 5.1-SQL-011, 5.1-SQL-013, 5.1-SQL-015

### R-04 : canal confirmé (score 6)

**Stratégie :** la correspondance carte vers canal est une liste explicite d'identifiants dans le fichier de migration, remplie après confirmation de Romain ; aucune valeur par défaut ; carte absente ou canal inconnu : carte ignorée, laissée au kanban, signalée.
**Responsable :** Romain (confirmation), Dev (garde)
**Échéance :** avant l'exécution
**Statut :** prévu
**Vérification :** 5.1-SQL-004, 5.1-SQL-012

### R-05 : points d'entrée résiduels (score 6)

**Stratégie :** la même migration, après le retrait des cartes, pose une contrainte sur `content_cards.card_type` qui n'accepte plus les types post ; les helpers MCP refusent avec un message d'orientation ; les écrans redirigent. La contrainte attrape tout chemin oublié, y compris Lovable et le service role.
**Responsable :** Dev
**Échéance :** story 5.1
**Statut :** prévu
**Vérification :** 5.1-SQL-006, 5.1-UNIT-001 à 003, 5.1-COMP-004, 5.1-COMP-006

### R-06 : ordre de déploiement (score 6)

**Stratégie :** fichier dans `supabase/migrations-apres-front/`, ligne ajoutée au tableau du README (« ce qu'il fait, pourquoi il attend ») ; X-OPS-001 suivi pas à pas le jour même ; garde 5.1-SQL-012 si les tables de l'epic 1 manquent.
**Responsable :** Romain
**Échéance :** jour de la mise en production
**Statut :** prévu
**Vérification :** X-OPS-001 coché et rapport archivé

---

## Hypothèses et dépendances

### Hypothèses

1. La migration est une fonction SQL nommée dans un fichier de `supabase/migrations-apres-front/`, appelée une fois en fin de fichier, pour rester testable par `loadFunctions`.
2. Un contenu migré est un groupe d'un seul post (un canal par carte).
3. Le lien carte et contenu porte sur le groupe (un contenu décliné), sauf décision contraire en Q-7.

### Questions ouvertes (à trancher par Romain avant la story 5.1)

- **Q-1 (R-03) :** aucune des 6 cartes n'a d'échéance. Quelle date reçoivent les 5 publiés : aucune (absents du calendrier et de la grille), la date de dernière modification, ou une date saisie dans la correspondance ?
- **Q-2 (R-01) :** « retirée du kanban » veut-il dire supprimée (cascade sur commentaires, relectures et sommaires de newsletters) ou archivée (déplacée ou marquée, à créer) ?
- **Q-3 (R-04) :** pour chacune des 6 cartes, quel canal ? Pour un `post_linkedin`, quel compte LinkedIn ?
- **Q-4 (R-05, R-08) :** `TranscriptGenerationPanel` et `prepare_newsletter` entrent-ils dans la redirection ? Les cartes `linkedin` et `post_instagram` éventuelles sont-elles migrées ou seulement signalées ?
- **Q-5 (R-04) :** depuis un événement, « Post LinkedIn » crée-t-il un brouillon sur LinkedIn Romain, LinkedIn Emmanuelle ou la page SuperTilt ? Le compte est-il choisi dans le dialogue ?
- **Q-6 (R-12) :** une recommandation acceptée en post garde-t-elle un lien vers le contenu créé (colonne à créer) ?
- **Q-7 (R-10) :** à la suppression de la carte, les contenus liés gardent-ils le lien à NULL ? Peut-on lier un contenu à plusieurs cartes ?
- **Q-8 (R-03) :** une carte future avec `image_url` : visuel ignoré, ou recherché dans la Médiathèque ?

### Dépendances

1. Epics 1 et 2 en production : avant l'écriture de 5.1-SQL-001 et 5.1-SQL-008
2. Noms des outils MCP de l'epic 4 : avant 5.1-UNIT-001
3. Réponses Q-1 à Q-8 : avant le développement de la story 5.1
4. Publication du front de l'epic 5 : avant X-OPS-001

### Risques pour le plan

- **Risque :** les tables dont dépendent les cartes ne sont pas dans la liste autorisée du connecteur (vérifié : `content_reviews`, `newsletter_cards`, `editorial_recommendations` refusés)
  - **Impact :** l'inventaire des dépendances des 6 cartes n'a pas pu être fait pour ce plan
  - **Contingence :** l'exécution à blanc de X-OPS-001 le produit en production avant toute écriture
- **Risque :** epic 2 non livré au moment de l'epic 5
  - **Impact :** 5.1-SQL-008 sans support
  - **Contingence :** écrire la mention dans le rapport et la reporter dans l'historique à la livraison de l'epic 2

---

## Interfonctionnement et régression

| Composant | Impact | Régression à garder au vert |
| --- | --- | --- |
| Kanban (`src/pages/ContentBoard.tsx`, `KanbanBoard`, `ContentCardDialog`, `useContentCardData`) | Option post retirée, cartes migrées retirées | 5.1-COMP-003, 5.1-COMP-004 ; parcours article manuel |
| Newsletters (`NewsletterSection`, `newsletter_cards`) | Cartes post retirées des sommaires selon Q-2 | 5.1-SQL-005 |
| Moteur éditorial (`useEditorialRecommendations`, `EditorialRecommendationsTab`) | Acceptation post redirigée | 5.1-UNIT-004, 5.1-UNIT-005 |
| Événements (`src/pages/EventDetail.tsx`, `SendToContentBoardButton`) | Post redirigé vers Contenus sociaux | 5.1-COMP-001 à 003, 5.1-E2E-001 |
| MCP (`editorial-tools.ts`, `ops-tools.ts`) | Types post refusés | `supabase/functions/_shared/editorial-tools.test.ts`, `ops-tools.test.ts` |
| Contenus sociaux (epics 1 et 2) | Reçoit 6 contenus et un lien vers les cartes | Suites des epics 1 et 2 |
| Sauvegarde (`scheduled-backup`, `backup-export`) | Toute table nouvelle (rapport, liaison) ajoutée aux listes | Contrôle [038] de `check-rules.sh` |

---

## Workflows suivants (manuels)

- Lancer `*atdd` pour générer les tests P0 en échec (workflow séparé, non lancé automatiquement).
- Lancer `*automate` une fois l'epic implémenté.
- Le registre des risques alimente la porte de `*trace` en fin d'epic.

---

## Approbation

- [ ] Produit : Romain, date :
- [ ] Responsable technique : à désigner, date :
- [ ] Qualité : à désigner, date :

**Commentaires :**

---

## Annexe

### Références de la base de connaissances

- `risk-governance.md` : classification et gouvernance des risques
- `probability-impact.md` : échelle de probabilité et d'impact
- `test-levels-framework.md` : choix du niveau de test, identifiants `{EPIC}.{STORY}-{NIVEAU}-{SEQ}`
- `test-priorities-matrix.md` : priorités P0 à P3

### Documents liés

- Epics : `_bmad-output/planning-artifacts/epics-contenus-sociaux.md` (Epic 5, critères communs, FR25, FR26, Additional Requirements)
- Spec : `_bmad-output/specs/spec-contenus-sociaux/SPEC.md`, `brownfield.md`
- Procédure des migrations différées : `supabase/migrations-apres-front/README.md`
- Harnais SQL : `supabase/tests/helpers/db.ts`
- Contexte de test : `_bmad-output/test-artifacts/test-design-progress.md`

---

**Produit par :** BMad TEA Agent, module Test Architect
**Workflow :** `bmad-testarch-test-design`
**Version :** 4.0 (BMad v6)
