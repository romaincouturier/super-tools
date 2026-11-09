---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-11-05'
---

# Test design : Epic 1 - Planifier et rédiger tous les contenus dans un calendrier

**Date :** 2026-11-05
**Auteur :** Romain (rédigé par l'architecte de test BMAD TEA, mode epic)
**Statut :** Brouillon

---

## Résumé

**Périmètre :** plan de test de niveau epic pour l'Epic 1 du module Contenus sociaux (stories 1.1 à 1.6 ; FR1, FR2, FR3, FR4, FR5, FR6, FR8 partiel, FR9, FR19, FR20, FR22, FR31, FR32 ; UX-DR1 à UX-DR5, UX-DR7, UX-DR8 ; critères communs de l'Overview). Le module n'existe pas encore : toute table, fonction, composant ou fichier de test nommé ici sans chemin vérifié est **à créer**.

**Risques :**

- Risques identifiés : 18 (5 élevés, 10 moyens, 3 faibles)
- Risques élevés (score ≥ 6) : 5 (R-01 à R-05)
- Catégories critiques : SEC (RLS `supertilt_fr`) et DATA (groupe de posts : synchro, date de groupe, sauvegarde continue)
- Aucun risque de score 9 : pas de blocage automatique de la porte

**Couverture :**

- P0 : 7 scénarios (~18 à 30 h)
- P1 : 28 scénarios (~25 à 40 h)
- P2 : 17 scénarios (~8 à 14 h)
- P3 : 5 scénarios (~2 à 5 h)
- **Total : 57 scénarios, ~55 à 90 h, soit ~1,5 à 2,5 semaines pour une personne**

---

## Hors périmètre

| Élément | Raison | Traitement du risque |
| --- | --- | --- |
| Axe validation, échelle complète (En validation, Approuvé), actions quotidiennes, commentaires, historique | Epic 2 | Le calcul du statut affiché est livré dès l'epic 1 sous forme de fonction pure (1.2-UNIT-004) pour que l'epic 2 l'étende au lieu de la réécrire (R-07) |
| Campagnes, bandeau de campagne, vues Liste et Aperçus, vues enregistrées, grille Instagram | Epic 3 | Les onglets Liste et Aperçus sont seulement présents et inactifs (1.2-COMP-002) |
| Outils MCP (lecture des alertes, création de brouillons) | Epic 4 | La règle d'alerte est placée dans `supabase/functions/_shared/` et testée là, pour être reprise telle quelle par le MCP (1.3-UNIT-006) |
| Migration des 6 cartes `content_cards` de type post | Epic 5 | Aucune donnée existante n'est touchée par l'epic 1 |
| Publication native vers les réseaux | Non-goal (NFR2) | Le statut publié se marque à la main (story 1.5) |
| Performance sous charge | Deux utilisateurs, quelques dizaines de posts par mois | Un seul contrôle P3 sur le nombre de requêtes de la vue mois (X-PERF-001) |
| Serveur MCP (`supabase/functions/mcp-server/index.ts`) | Non modifié par l'epic 1 ; non testable à l'import (relevé dans `test-design-progress.md`) | Reporté au plan de l'epic 4 |

---

## Évaluation des risques

Échelles (`probability-impact.md`) : probabilité 1 (peu probable), 2 (possible), 3 (probable) ; impact 1 (mineur), 2 (dégradé), 3 (critique : fuite de données, perte de contenu, contenu publié au mauvais jour). Score = P × I. 1 à 3 : documenter ; 4 et 5 : surveiller ; 6 à 8 : mitiger avant livraison ; 9 : bloquer.

### Risques élevés (score ≥ 6)

| ID | Catégorie | Description | P | I | Score | Mitigation | Responsable | Échéance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **R-01** | SEC | Une des cinq nouvelles tables (canaux, groupes de posts, posts, thèmes, notes) est créée sans RLS, avec une policy recopiée au lieu de `has_module_access(auth.uid(), 'supertilt_fr')` / `is_admin`, ou avec un `USING` sans `WITH CHECK` : un compte authentifié sans le droit (un apprenant LMS, par exemple) lit ou écrit les contenus. Piège propre au dépôt : la définition en vigueur de `has_module_access` (`supabase/migrations/20261103100000_supertilt_fr_module.sql`) renvoie vrai pour `romain@supertilt.fr` quel que soit `user_module_access`, donc un test fait avec ce compte ne prouve rien | 2 | 3 | **6** | Tests pgTAP par table et par opération (1.1-PGTAP-001 à 004), avec un compte sans droit, un compte avec droit autre que Romain, un admin et `anon` | Dev | Avant merge de la story 1.1 ; étendu en 1.4 (thèmes) et 1.6 (notes) |
| **R-02** | DATA | Synchro du texte dans un groupe : une modification n'atteint pas toutes les déclinaisons synchronisées, ou atteint une déclinaison dont la synchro est coupée et écrase son texte propre. Le même mécanisme porte le visuel partagé (story 1.3) et sera réutilisé par le MCP (epic 4) | 2 | 3 | **6** | Porter la propagation en base (fonction SQL ou trigger, à créer) plutôt que dans le navigateur, et la tester sur Postgres réel (1.1-SQL-003, 1.1-SQL-004, 1.3-SQL-001) | Dev | Story 1.1 |
| **R-03** | DATA | Glisser-déposer : la date n'est posée que sur une partie du groupe (N écritures successives depuis le navigateur, une échoue), ou le statut de publication n'est pas passé à « programmé » sur toutes les déclinaisons | 2 | 3 | **6** | Une seule opération atomique côté base pour dater un groupe (fonction SQL à créer, 1.2-SQL-001, 1.2-SQL-002) ; le service ne fait qu'un appel | Dev | Story 1.2 |
| **R-04** | DATA | Fuseau horaire : la suite Vitest tourne en `TZ=UTC` (`package.json`), l'équipe est en Europe/Paris. Un post à 00:30 heure de Paris (veille en UTC) s'affiche sur le mauvais jour, ou un glisser-déposer change l'heure au passage d'un changement d'heure (fin mars, fin octobre) | 3 | 2 | **6** | Fonctions pures de regroupement par jour et de calcul de la date cible, testées avec des instants explicites en Europe/Paris et autour des changements d'heure (1.2-UNIT-002, 1.2-UNIT-003) ; la note de calendrier est un jour sans heure (1.6-SQL-001) | Dev | Story 1.2 |
| **R-05** | DATA | Sauvegarde continue : `useAutoSaveForm` enregistre après un délai (800 ms par défaut) ; fermer le composeur avant ce délai perd la dernière frappe si `flushAndGetPending` n'est pas branché, et un premier enregistrement qui n'a pas encore rendu l'identifiant du groupe peut en créer un second au tick suivant (brouillon dupliqué dans « Non planifiés ») | 2 | 3 | **6** | Test composant avec horloge simulée : rouvrir retrouve le texte et un seul groupe existe (1.1-COMP-001) ; fermeture avant le délai (1.1-COMP-002) | Dev | Story 1.1 |

### Risques moyens (score 3 à 4)

| ID | Catégorie | Description | P | I | Score | Mitigation | Responsable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-06 | BUS | Règle d'alerte : divergence entre l'écran et le futur MCP si la règle est dupliquée ; comptage faux (emojis, retours ligne) ; limite absente traitée comme 0 | 2 | 2 | 4 | Fonction pure unique dans `supabase/functions/_shared/` (à créer), sur le modèle de `_shared/micro-devis-followup.ts` déjà importé par `src/pages/MicroDevis.tsx` ; tests 1.3-UNIT-001 à 006 | Dev |
| R-07 | TECH | Échelle partielle : en epic 1, une date posée affiche « Programmé » ; en epic 2, « Programmé » exige « approuvé et daté », un post daté non approuvé redevient « Brouillon ». Une échelle codée en dur dans les composants serait à réécrire | 2 | 2 | 4 | Une seule fonction pure du statut affiché, appelée partout (1.2-UNIT-004) ; changement de sens à acter avec Romain avant l'epic 2 (question ouverte Q-1) | Dev, Romain |
| R-08 | DATA | Marquage publié appliqué à tout le groupe au lieu de la déclinaison, ou annulation qui ramène à « sans date » un post daté | 2 | 2 | 4 | 1.5-SQL-001, 1.5-SQL-002 | Dev |
| R-09 | DATA | Suppression : supprimer une déclinaison supprime tout le groupe (cascade mal orientée), ou supprimer la dernière laisse un groupe vide qui compte dans « Non planifiés » | 2 | 2 | 4 | 1.5-SQL-004, confirmation 1.5-COMP-002 ; la sauvegarde nocturne permet une reprise | Dev |
| R-11 | SEC | Mode démo : le texte des posts peut citer des clients ou des participants, l'auteur est une personne réelle. Le scan `e2e/demo-scan/` ne connaît les colonnes que par `src/integrations/supabase/types.ts` : si ce fichier n'est pas régénéré, les nouvelles tables n'ont pas de lignes canari et le scan ne voit rien | 2 | 2 | 4 | Régénérer `types.ts` (AD-8), masques `src/lib/demoMask.ts`, ratchet [065] de `check-rules.sh`, scan ciblé de la route (1.2-E2E-002) | Dev |
| R-12 | OPS | Migration non jouée en production, ou rejouée deux fois : canaux en double, écran cassé en ligne (le push n'applique pas les migrations, piège connu d'`AGENTS.md`) | 2 | 2 | 4 | Seed idempotent testé (1.1-SQL-001) ; rejeu complet des migrations par `rls-tests.yml` ; vérification manuelle après migration (X-EXPL-001) | Romain |
| R-15 | BUS | Ambiguïté d'affichage : une carte représente-t-elle un groupe (plusieurs badges canaux, UX-DR5) ou un post ? Statut et filtre d'une carte dont une déclinaison est publiée et l'autre non ; « barre des canaux » (FR3) et pastille « réseau » (UX-DR2) sont-elles un seul filtre ? | 2 | 2 | 4 | Questions ouvertes Q-2 et Q-3 tranchées avant la story 1.2 ; tests 1.2-UNIT-005, 1.4-UNIT-002 écrits sur la réponse | Romain |
| R-16 | TECH | Glisser-déposer (dnd-kit, déjà dans `package.json`) peu testable en jsdom ; aucun parcours E2E authentifié n'existe (`e2e/smoke.spec.ts` le note) : la mécanique de dépôt ne serait couverte par rien | 2 | 2 | 4 | Logique du dépôt sortie en fonction pure (1.2-UNIT-003) ; un seul E2E sur faux backend pour la mécanique (1.2-E2E-001) | Dev |
| R-18 | DATA | Visuel de la Médiathèque supprimé alors qu'un post le référence : erreur d'affichage au lieu de l'alerte « visuel manquant » | 2 | 2 | 4 | Clé étrangère vers `media` à comportement explicite (mise à NULL), testée (1.3-SQL-002) | Dev |
| R-10 | OPS | Nouvelles tables absentes de `TABLES_TO_BACKUP` de `scheduled-backup` et `backup-export` | 1 | 3 | 3 | Déjà contrôlé statiquement : règle [038], `scripts/check-backup-tables.sh`, exécuté par `check-rules.sh` en CI. Aucun test à écrire | Dev |

### Risques faibles (score 1 à 2)

| ID | Catégorie | Description | P | I | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-13 | TECH | Accès Supabase depuis une page ou un composant (AD-5) | 1 | 2 | 2 | Surveiller : contrôles existants de `check-rules.sh` |
| R-14 | PERF | Vue mois en N+1 (une requête par jour ou par visuel) | 1 | 2 | 2 | Surveiller : X-PERF-001 (P3) |
| R-17 | DATA | Ajout d'un canal sans limite de texte ou avec une abréviation en double | 1 | 2 | 2 | Surveiller : contrainte d'unicité couverte par 1.1-SQL-001 |

### Légende des catégories

- **TECH** : architecture, intégration
- **SEC** : contrôle d'accès, exposition de données
- **PERF** : performance
- **DATA** : intégrité, perte, incohérence
- **BUS** : logique métier, expérience utilisateur
- **OPS** : déploiement, configuration, sauvegarde

### Risque résiduel

Après mitigation, R-01 à R-05 tombent à une probabilité de 1 (score 3) si leurs tests P0 et P1 passent. Restent ouverts : R-07 et R-15, qui dépendent de décisions produit (Q-1 à Q-3), et R-11, que le scan hebdomadaire du mode démo ne détecte qu'avec un délai.

---

## Critères d'entrée

- [ ] Questions ouvertes Q-1 à Q-4 tranchées par Romain (section Hypothèses)
- [ ] Choix d'implémentation acté pour R-02 et R-03 : propagation du texte et datation de groupe portées par la base (fonction SQL ou trigger)
- [ ] Migration de la story 1.1 rejouable sur une base vide (`supabase db start`, comme `rls-tests.yml`)
- [ ] `src/integrations/supabase/types.ts` régénéré après chaque migration de l'epic (AD-8)
- [ ] Fixtures disponibles : comptes de test pgTAP (sans droit, avec droit autre que Romain, admin), lignes de canaux et de posts pour PGlite, session authentifiée simulée pour Playwright (à créer)

## Critères de sortie

- [ ] 100 % des P0 passent
- [ ] ≥ 95 % des P1 passent, tout échec trié et accepté par Romain
- [ ] Aucun bug ouvert de sévérité haute sur les données (groupe, date, sauvegarde) ou l'accès
- [ ] R-01 à R-05 mitigés (tests liés au vert)
- [ ] `npm run typecheck`, `bash scripts/check-rules.sh` et `npm test` passent ; ratchets [065] et [038] non dégradés
- [ ] Scan du mode démo de `/supertilt-fr/contenus-sociaux` sans fuite
- [ ] Migration jouée en production et vérifiée (X-EXPL-001)

---

## Plan de couverture

**Note :** P0 à P3 expriment la priorité, c'est-à-dire le risque et la criticité, pas le moment d'exécution. Le moment d'exécution est traité dans la section Stratégie d'exécution.

### Niveaux de test du dépôt

| Niveau | Outil et emplacement | Ce qu'il prouve dans cet epic |
| --- | --- | --- |
| **Unit** | Vitest, `src/**/*.test.ts` et `supabase/functions/_shared/**/*.test.ts` | Fonctions pures : alertes, statut affiché, grille, regroupement par jour, date de dépôt, filtres, sélection des non planifiés |
| **SQL-PGlite** | Vitest + PGlite, `supabase/tests/*.test.ts`. `loadFunctions` de `supabase/tests/helpers/db.ts` extrait une fonction de sa migration ; pour un trigger ou un seed, jouer le fichier de migration entier comme le fait `supabase/tests/watch-sources.test.ts` | Fonctions, triggers, contraintes et seed des nouvelles tables, sur le SQL livré |
| **pgTAP** | `supabase/tests/*.test.sql`, sur le modèle de `rls_learner_isolation.test.sql`, joué par `rls-tests.yml` | Comportement des policies RLS sur la base qui rejoue toutes les migrations, avec les vrais rôles `anon` et `authenticated` |
| **Component** | Vitest en jsdom + Testing Library (`vitest.config.ts`), services simulés | Rendu et interactions : composeur, carte, colonne, indicateur d'alerte, confirmation |
| **E2E** | Playwright. Parcours : `e2e/*.spec.ts` avec interception réseau (`page.route`, comme `e2e/connexion.spec.ts`). Mode démo : `e2e/demo-scan/` | Un parcours critique bout en bout et le scan du mode démo |

Le RLS n'est testé qu'en pgTAP, la logique SQL qu'en PGlite : les deux niveaux ne se recouvrent pas.

### P0 (critique)

**Critères :** bloque le parcours principal, lié à un risque ≥ 6, sans contournement.

| ID | Story / critère | Scénario | Niveau | Risque | Responsable |
| --- | --- | --- | --- | --- | --- |
| 1.1-PGTAP-001 | 1.1 / RLS | Un compte authentifié sans `supertilt_fr`, ni admin, ni Romain, lit 0 ligne dans chacune des cinq tables (canaux, groupes, posts, thèmes, notes) | pgTAP | R-01 | Dev |
| 1.1-PGTAP-002 | 1.1 / RLS | Le même compte voit refuser INSERT, UPDATE et DELETE sur chacune des cinq tables (`WITH CHECK` compris) | pgTAP | R-01 | Dev |
| 1.1-SQL-003 | 1.1 / synchro | Groupe de trois posts synchronisés : modifier le texte met à jour les trois | SQL-PGlite | R-02 | Dev |
| 1.1-SQL-004 | 1.1 / synchro | Synchro coupée sur une déclinaison : son texte change seul, et une modification ultérieure du groupe ne l'écrase pas | SQL-PGlite | R-02 | Dev |
| 1.1-COMP-001 | 1.1 / sauvegarde continue | Saisie, attente du délai, fermeture puis réouverture du composeur : texte, canaux et format retrouvés, un seul groupe créé (horloge simulée, service simulé) | Component | R-05 | Dev |
| 1.2-SQL-001 | 1.2 / glisser-déposer | Dater un groupe sans date pose la même date et le statut « programmé » sur toutes ses déclinaisons, en une opération : si une écriture échoue, aucune ne reste | SQL-PGlite | R-03 | Dev |
| 1.2-E2E-001 | 1.1 + 1.2 / parcours critique | Session simulée avec droit : composer un contenu sur trois canaux sans date, le voir dans « Non planifiés · 1 », le glisser sur un jour, le voir dans la grille avec trois badges et le statut Programmé, colonne vide | E2E | R-16, R-03 | Dev |

**Total P0 : 7 scénarios.** Ils représentent 12 % du total, un peu au-dessus de la cible de 10 % : la moitié porte sur le RLS, que la checklist exige à 100 %.

### P1 (haute)

**Critères :** fonctionnalité importante ou parcours fréquent, risque moyen, ou couverture complémentaire d'un risque ≥ 6.

| ID | Story / critère | Scénario | Niveau | Risque | Responsable |
| --- | --- | --- | --- | --- | --- |
| 1.1-PGTAP-003 | 1.1 / RLS | Contrôle positif : un compte avec `supertilt_fr` autre que Romain, puis un admin, lisent et écrivent dans les cinq tables | pgTAP | R-01 | Dev |
| 1.1-PGTAP-004 | 1.1 / RLS | Rôle `anon` : aucune lecture ni écriture sur les cinq tables | pgTAP | R-01 | Dev |
| 1.1-SQL-001 | 1.1 / canaux | Après migration : les 8 canaux de départ existent avec nom, abréviation et limite facultative ; rejouer le seed n'ajoute aucun doublon ; abréviation unique | SQL-PGlite | R-12, R-17 | Dev |
| 1.1-SQL-002 | 1.1 / composeur | Créer un contenu sur trois canaux crée un groupe et trois posts au statut « sans date », en une transaction | SQL-PGlite | R-02 | Dev |
| 1.1-COMP-002 | 1.1 / sauvegarde continue | Fermeture avant la fin du délai d'enregistrement : la dernière saisie est enregistrée (`flushAndGetPending`) | Component | R-05 | Dev |
| 1.1-UNIT-001 | 1.1 / Non planifiés | Sélection des contenus sans date et compteur N : un groupe compte une fois, les contenus datés et les notes sont exclus | Unit | R-15 | Dev |
| 1.1-COMP-003 | 1.1 / UX-DR3 | La colonne affiche « Non planifiés · N » et, sur chaque carte, les badges abrégés des canaux | Component | - | Dev |
| 1.2-UNIT-001 | 1.2 / UX-DR4 | Grille mensuelle du lundi au dimanche : mois commençant un lundi et un dimanche, février, mois sur six semaines ; jours hors mois et jour courant marqués | Unit | - | Dev |
| 1.2-UNIT-002 | 1.2 / aperçu | Regroupement des posts par jour en Europe/Paris et tri horaire : post à 00:30 heure de Paris, dernier dimanche d'octobre et de mars | Unit | R-04 | Dev |
| 1.2-UNIT-003 | 1.2 / glisser-déposer | Date cible d'un dépôt : jour cible et heure conservée, y compris à travers un changement d'heure ; brouillon sans heure (selon Q-4) | Unit | R-04, R-16 | Dev |
| 1.2-SQL-002 | 1.2 / déplacement | Déplacer un contenu daté : seule la date change, sur tout le groupe, heure conservée, statut toujours « programmé » | SQL-PGlite | R-03 | Dev |
| 1.2-UNIT-004 | 1.2 / FR8 partiel | Statut affiché : sans date donne Brouillon, programmé donne Programmé, marqué comme publié donne Publié ; écrit comme la première étape de l'échelle complète de `statuts-et-validation.md` | Unit | R-07 | Dev |
| 1.2-UNIT-005 | 1.2 / FR3 | Décocher un canal retire ses posts de la grille et de « Non planifiés » (même sélecteur pour les deux zones) ; cas d'un groupe multi-canaux selon Q-3 | Unit | R-15 | Dev |
| 1.2-COMP-001 | 1.2 / UX-DR5 | Carte de contenu : pastille de statut, heure, badges abrégés, liseré à la couleur du thème (neutre sans thème), début du titre tronqué | Component | - | Dev |
| 1.2-E2E-002 | 1.2 / mode démo | Scan de `/supertilt-fr/contenus-sociaux` par `e2e/demo-scan/` (la route est lue dans `src/App.tsx`), avec `DEMO_SCAN_ROUTES` ciblé, après régénération de `types.ts` : aucune fuite | E2E | R-11 | Dev |
| 1.3-UNIT-001 | 1.3 / FR31 | Post sans visuel : alerte « visuel manquant », pour tous les canaux, Blog et Le Déclic compris (NFR6) | Unit | R-06 | Dev |
| 1.3-UNIT-002 | 1.3 / FR31 | Texte au-delà de la limite : alerte avec la limite et le dépassement exacts ; texte égal à la limite : aucune alerte | Unit | R-06 | Dev |
| 1.3-UNIT-003 | 1.3 / FR31 | Canal sans limite : jamais d'alerte de longueur | Unit | R-06 | Dev |
| 1.3-UNIT-006 | 1.3 / fonction partagée | La règle vit dans `supabase/functions/_shared/` (fichier à créer), sans dépendance navigateur ni alias `@/`, et est importée par l'écran : son test tourne dans `npm test` | Unit | R-06 | Dev |
| 1.3-COMP-001 | 1.3 / UX-DR8 | L'indicateur d'alerte apparaît sur la carte du calendrier, la carte « Non planifiés » et le composeur, sans ouvrir le post | Component | R-06 | Dev |
| 1.3-COMP-002 | 1.3 / non bloquant | Avec une alerte active, enregistrer et marquer publié restent possibles | Component | R-06 | Dev |
| 1.3-SQL-001 | 1.3 / visuel partagé | Changer le visuel d'un groupe synchronisé le change sur toutes les déclinaisons synchronisées, et seulement elles | SQL-PGlite | R-02 | Dev |
| 1.4-UNIT-001 | 1.4 / UX-DR2 | Filtres combinés : ET entre familles (thème, réseau, statut), OU dans une famille, famille vide égale pas de filtre | Unit | - | Dev |
| 1.5-COMP-001 | 1.5 / détail | Clic sur une carte : le détail s'ouvre avec texte, visuel, canaux, thème, format, date et heure, modifiables | Component | - | Dev |
| 1.5-SQL-001 | 1.5 / FR9 | Marquer publié une déclinaison : elle seule passe « marqué comme publié », les autres déclinaisons ne changent pas | SQL-PGlite | R-08 | Dev |
| 1.5-SQL-002 | 1.5 / FR9 | Annuler le marquage : retour à « programmé » si une date est posée, « sans date » sinon ; le post reste modifiable | SQL-PGlite | R-08 | Dev |
| 1.5-SQL-004 | 1.5 / suppression | Supprimer une déclinaison laisse les autres ; supprimer la dernière supprime le groupe ; supprimer le groupe supprime toutes ses déclinaisons | SQL-PGlite | R-09 | Dev |
| 1.5-COMP-002 | 1.5 / suppression | La suppression passe par `useConfirm()` (`src/hooks/useConfirm.tsx`) ; annuler ne supprime rien ; le choix déclinaison ou groupe est transmis au service | Component | R-09 | Dev |

**Total P1 : 28 scénarios.**

### P2 (moyenne)

**Critères :** fonction secondaire, cas limite, risque faible à moyen.

| ID | Story / critère | Scénario | Niveau | Risque | Responsable |
| --- | --- | --- | --- | --- | --- |
| 1.1-UNIT-002 | 1.1 / composeur | Validation du composeur : au moins un canal, format parmi post, story, reel, date facultative | Unit | - | Dev |
| 1.1-COMP-004 | 1.1 / menu | Le sous-module « Contenus sociaux » apparaît dans le groupe supertilt.fr de `src/components/AppSidebar.tsx` pour un compte avec `supertilt_fr` et pas sans | Component | - | Dev |
| 1.1-COMP-005 | 1.1 / FR32 | La barre de canaux et le composeur affichent les canaux renvoyés par le hook (un 9e canal ajouté en base apparaît sans code) | Component | R-17 | Dev |
| 1.2-COMP-002 | 1.2 / UX-DR1, UX-DR7 | Onglets Calendrier (actif), Liste et Aperçus (inactifs) ; légende Brouillon, Programmé, Publié avec leur couleur | Component | R-07 | Dev |
| 1.2-COMP-003 | 1.2 / vue semaine | La vue semaine affiche les mêmes cartes sur sept jours | Component | - | Dev |
| 1.2-SQL-003 | 1.2 / cas limite | Dater ou déplacer un groupe dont une déclinaison est marquée publiée : comportement retenu en Q-2 | SQL-PGlite | R-08, R-15 | Dev |
| 1.3-UNIT-004 | 1.3 / comptage | Comptage des caractères : emojis, accents composés, retours ligne (règle à fixer, points de code ou graphèmes) | Unit | R-06 | Dev |
| 1.3-UNIT-005 | 1.3 / FR31 | Les deux alertes se cumulent ; un post corrigé n'a plus aucune alerte | Unit | R-06 | Dev |
| 1.3-COMP-003 | 1.3 / FR19 | Ajouter un visuel ouvre le choix dans la Médiathèque (`useMediaLibrary`, `src/hooks/useMedia.ts`, table `media`) ; aucun envoi vers le stockage | Component | - | Dev |
| 1.3-SQL-002 | 1.3 / visuel supprimé | Un media référencé supprimé : la référence du post passe à NULL, la règle d'alerte repasse « visuel manquant » | SQL-PGlite | R-18 | Dev |
| 1.4-COMP-001 | 1.4 / FR22 | Réglages des thèmes : créer, renommer, recolorer | Component | - | Dev |
| 1.4-SQL-001 | 1.4 / thème supprimé | Supprimer un thème attribué laisse les posts intacts, sans thème | SQL-PGlite | - | Dev |
| 1.4-UNIT-002 | 1.4 / filtre statut | Le filtre de statut porte sur le statut affiché ; groupe aux déclinaisons de statuts différents selon Q-2 | Unit | R-15 | Dev |
| 1.4-COMP-002 | 1.4 / UX-DR2 | Pastilles de thème à la couleur du thème ; activer une pastille filtre la grille et « Non planifiés » | Component | - | Dev |
| 1.5-SQL-003 | 1.5 / groupe partiellement publié | Modifier le texte synchronisé d'un groupe dont une déclinaison est publiée : comportement retenu en Q-2 | SQL-PGlite | R-02, R-15 | Dev |
| 1.6-COMP-001 | 1.6 / FR20 | Ajouter une note (texte, couleur) sur un jour : affichée sur ce jour, distincte des cartes de contenu | Component | - | Dev |
| 1.6-UNIT-001 | 1.6 / FR20 | Les notes sont ignorées par le statut affiché, les filtres de statut, le compteur « Non planifiés » et le comptage des posts | Unit | - | Dev |

**Total P2 : 17 scénarios.**

### P3 (basse)

**Critères :** confort, exploratoire, mesure.

| ID | Story / critère | Scénario | Niveau | Responsable |
| --- | --- | --- | --- | --- |
| 1.4-SQL-002 | 1.4 / liste vide | Après migration, aucun thème n'existe | SQL-PGlite | Dev |
| 1.6-COMP-002 | 1.6 / FR20 | Modifier, déplacer sur un autre jour et supprimer une note mettent le calendrier à jour | Component | Dev |
| 1.6-SQL-001 | 1.6 / jour | Une note est stockée comme un jour sans heure : aucun décalage de fuseau à la lecture | SQL-PGlite | Dev |
| X-PERF-001 | 1.2 / vue mois | Le nombre d'appels au service pour afficher un mois est constant (pas une requête par jour ni par visuel) | Component | Dev |
| X-EXPL-001 | 1.1 / production | Session manuelle après la migration de production : 8 canaux présents, accès refusé à un compte sans droit, sauvegarde nocturne contenant les nouvelles tables | Manuel | Romain |

**Total P3 : 5 scénarios.**

### Garde contre les doublons

| Comportement | Niveau retenu | Pourquoi pas ailleurs |
| --- | --- | --- |
| Accès aux tables | pgTAP seul | PGlite n'a ni les rôles ni l'historique complet des migrations ; un test composant ne prouve rien sur le RLS |
| Synchro, datation de groupe, marquage, suppression | SQL-PGlite seul | L'E2E vérifie l'enchaînement à l'écran, pas l'atomicité en base |
| Règle d'alerte, statut affiché, filtres, grille, date de dépôt | Unit seul | Les tests composant vérifient seulement que l'indicateur ou la valeur est rendu, sans rejouer les cas |
| Mécanique du glisser-déposer | E2E seul (1.2-E2E-001) | jsdom ne simule pas fidèlement dnd-kit |
| Sauvegarde continue | Component seul | Le comportement dépend du hook et du cycle d'ouverture du composeur |
| Tables dans les listes de sauvegarde, accès Supabase hors hooks, masques démo statiques | Contrôles existants de `check-rules.sh` ([038], [065]) | Aucun test à écrire |

---

## Stratégie d'exécution

Principe : tout tourne à chaque PR tant que l'ensemble reste sous 15 minutes ; seul ce qui est lent ou coûteux est différé. Les tests de l'epic s'ajoutent aux suites existantes, sans nouveau workflow.

| Moment | Ce qui tourne | Mécanisme existant |
| --- | --- | --- |
| **PR** | Unit, SQL-PGlite et Component : `npm test` (inclut `supabase/tests/**/*.test.ts` et `supabase/functions/_shared/**/*.test.ts`) ; `npm run typecheck` ; `bash scripts/check-rules.sh` ; E2E 1.2-E2E-001 dans le job navigateur (`npm run build` puis `npm run test:e2e`, qui prend tout `e2e/` sauf `demo-scan/`) | `.github/workflows/ci.yml` sur toute PR |
| **PR touchant `supabase/migrations/` ou `supabase/tests/`** | pgTAP 1.1-PGTAP-001 à 004 sur une base qui rejoue toutes les migrations | `.github/workflows/rls-tests.yml` |
| **PR de la story 1.2** | Scan ciblé 1.2-E2E-002, lancé à la main avec `DEMO_SCAN_ROUTES=/supertilt-fr/contenus-sociaux` | `.github/workflows/demo-scan.yml` (`workflow_dispatch`) |
| **Nuit** | Rien de nouveau : l'epic n'a pas de suite lente | - |
| **Semaine** | Scan complet du mode démo, qui inclut la nouvelle route sans modification | `demo-scan.yml`, planifié le lundi |
| **Après la migration de production** | X-EXPL-001 | Manuel |

Playwright parallélise : le job navigateur garde de la marge même avec quelques parcours de plus.

---

## Estimation

| Priorité | Nombre | Effort | Remarques |
| --- | --- | --- | --- |
| P0 | 7 | ~18 à 30 h | Fixtures pgTAP pour cinq tables et quatre identités ; fixture de session simulée Playwright à créer (premier parcours authentifié du dépôt) |
| P1 | 28 | ~25 à 40 h | Majorité de tests unitaires et PGlite courts, une fois la base de test des nouvelles tables écrite |
| P2 | 17 | ~8 à 14 h | Cas limites, dont trois suspendus aux questions ouvertes |
| P3 | 5 | ~2 à 5 h | Dont une session manuelle |
| **Total** | **57** | **~55 à 90 h** | **~1,5 à 2,5 semaines pour une personne**, réparties sur les six stories |

### Prérequis

**Données de test :**

- Base PGlite des nouvelles tables : jouer le fichier de migration de la story 1.1 (puis 1.4 et 1.6) comme `supabase/tests/watch-sources.test.ts`, après `createTestDb()` ; fabrique de groupe (N posts, synchro active ou coupée) à créer dans le test
- Seed pgTAP : un compte sans droit, un compte avec `supertilt_fr` autre que `romain@supertilt.fr`, un admin ; grants posés dans la transaction annulée, comme `rls_learner_isolation.test.sql`
- Faux backend E2E : réponses PostgREST pour canaux, groupes et posts, session simulée ; `installFakeBackend` de `e2e/demo-scan/fakeBackend.ts` force `demo_mode: true`, il faut donc une variante sans mode démo ou des interceptions dédiées

**Outillage :** aucun nouvel outil. Vitest, PGlite, Testing Library, Playwright et pgTAP sont déjà en place.

**Environnement :** instance Supabase locale (`supabase db start`) pour jouer pgTAP en local ; Chromium Playwright.

---

## Portes de qualité

### Seuils

- **P0 :** 100 %, sans exception
- **P1 :** ≥ 95 %, tout échec accepté par écrit par Romain
- **P2 et P3 :** ≥ 90 %, informatif
- **Risques élevés :** R-01 à R-05 mitigés à 100 % avant la livraison de l'epic

### Couverture

- Parcours critique (composer, planifier, voir) : couvert par 1.2-E2E-001 et ses tests de niveau inférieur
- Sécurité : 100 % des scénarios SEC passent (pgTAP RLS et scan du mode démo)
- Logique métier (fonctions pures de l'epic) : ≥ 80 % de lignes couvertes
- Cas limites : ≥ 50 %

### Exigences non négociables

- [ ] Tous les P0 passent
- [ ] Aucun risque ≥ 6 sans mitigation
- [ ] Tests SEC à 100 %
- [ ] `check-rules.sh` vert, ratchets [038], [065] et [076] non dégradés

---

## Plans de mitigation

### R-01 : RLS `supertilt_fr` sur les cinq nouvelles tables (score 6)

**Stratégie :** chaque table active la RLS avec des policies qui appellent `has_module_access(auth.uid(), 'supertilt_fr')` ou `is_admin`, sans logique recopiée (AD-1). Un fichier pgTAP (à créer) vérifie, table par table, lecture et écriture pour quatre identités. Le compte « avec droit » n'est jamais `romain@supertilt.fr`, que `has_module_access` accepte sans ligne dans `user_module_access`.
**Responsable :** Dev
**Échéance :** story 1.1 pour canaux, groupes et posts ; stories 1.4 et 1.6 ajoutent thèmes et notes au même fichier
**Statut :** prévu
**Vérification :** 1.1-PGTAP-001 à 004 au vert dans `rls-tests.yml`

### R-02 : synchro du texte et du visuel dans un groupe (score 6)

**Stratégie :** une seule voie de propagation, en base, qui ne touche que les déclinaisons synchronisées. Le front et le futur MCP l'empruntent sans la recoder.
**Responsable :** Dev
**Échéance :** story 1.1, étendue au visuel en 1.3
**Statut :** prévu
**Vérification :** 1.1-SQL-003, 1.1-SQL-004, 1.3-SQL-001

### R-03 : date posée sur tout le groupe (score 6)

**Stratégie :** une fonction SQL (à créer) date ou déplace un groupe en une transaction et passe la publication à « programmé » ; le service l'appelle une fois par dépôt.
**Responsable :** Dev
**Échéance :** story 1.2
**Statut :** prévu
**Vérification :** 1.2-SQL-001, 1.2-SQL-002, 1.2-E2E-001

### R-04 : fuseau Europe/Paris (score 6)

**Stratégie :** regroupement par jour et calcul de la date de dépôt dans des fonctions pures qui reçoivent le fuseau en paramètre ; tests avec instants explicites, malgré `TZ=UTC` de la suite. Les notes sont stockées comme un jour.
**Responsable :** Dev
**Échéance :** story 1.2 (posts), story 1.6 (notes)
**Statut :** prévu
**Vérification :** 1.2-UNIT-002, 1.2-UNIT-003, 1.6-SQL-001

### R-05 : sauvegarde continue du composeur (score 6)

**Stratégie :** le composeur s'appuie sur `useAutoSaveForm` (règle [001]) ; la création du groupe n'a lieu qu'une fois, les enregistrements suivants mettent à jour le groupe connu ; la fermeture vide la file avec `flushAndGetPending`.
**Responsable :** Dev
**Échéance :** story 1.1
**Statut :** prévu
**Vérification :** 1.1-COMP-001, 1.1-COMP-002

---

## Hypothèses et dépendances

### Hypothèses

1. Les cinq tables sont : canaux, groupes de posts, posts (une ligne par déclinaison, axe publication), thèmes, notes. Leurs noms sont fixés en story 1.1.
2. Le statut de publication est stocké par post ; la date est commune au groupe tant qu'aucune décision contraire n'est prise (Q-2).
3. L'epic 1 n'écrit aucun axe validation : un post daté affiche « Programmé » sans approbation.

### Questions ouvertes (à trancher par Romain avant la story concernée)

- **Q-1 (story 1.2, R-07) :** en epic 2, un post daté non approuvé affichera « Brouillon » au lieu de « Programmé ». Ce changement visible est-il accepté, et faut-il l'annoncer dès l'epic 1 ?
- **Q-2 (stories 1.2 et 1.5, R-08, R-15) :** dans un groupe dont une déclinaison est marquée publiée, que deviennent un déplacement de date et une modification du texte synchronisé ? Et quel statut affiche la carte du groupe ?
- **Q-3 (story 1.2, R-15) :** une carte du calendrier représente-t-elle un groupe ou un post ? La barre des canaux (FR3) et la pastille « réseau » (UX-DR2) sont-elles le même filtre (LinkedIn Romain contre LinkedIn) ?
- **Q-4 (story 1.2) :** quelle heure reçoit un brouillon sans heure glissé sur un jour ?
- **Q-5 (story 1.1) :** la synchro coupée peut-elle être réactivée, et avec quel texte ? Aucun scénario n'est écrit tant que la réponse manque.

### Dépendances

1. Décision sur l'emplacement de la propagation et de la datation de groupe (base ou service) : avant le développement de la story 1.1
2. Régénération de `src/integrations/supabase/types.ts` à chaque migration : avant les tests composant et le scan démo
3. Migration jouée en production par Romain : avant X-EXPL-001

### Risques pour le plan

- **Risque :** premier parcours E2E authentifié du dépôt, sans fixture existante
  - **Impact :** 1.2-E2E-001 coûte plus que prévu
  - **Contingence :** s'appuyer sur la session simulée de `e2e/demo-scan/fakeBackend.ts` ; à défaut, ramener le P0 à 1.2-SQL-001 et aux tests composant, et tracer l'écart
- **Risque :** questions Q-1 à Q-5 non tranchées
  - **Impact :** 1.2-SQL-003, 1.4-UNIT-002 et 1.5-SQL-003 restent en attente
  - **Contingence :** les écrire sur la réponse la plus prudente (aucune modification d'une déclinaison publiée) et les marquer en attente

---

## Interfonctionnement et régression

| Composant | Impact | Régression à garder au vert |
| --- | --- | --- |
| `has_module_access` et module supertilt.fr | Nouvelles policies appuyées dessus | `supabase/tests/rls_learner_isolation.test.sql`, `supabase/tests/rpc-internes-staff.test.ts` |
| Menu `src/components/AppSidebar.tsx` et `src/App.tsx` | Nouvelle entrée et nouvelle route sous supertilt.fr | `e2e/smoke.spec.ts` ; scan du mode démo (routes lues dans `App.tsx`) |
| Médiathèque (`media`, `src/hooks/useMedia.ts`) | Lue par le composeur, référencée par les posts | Tests existants du module Médias ; aucune écriture nouvelle dans `media` |
| `useAutoSaveForm` | Nouveau consommateur | `src/hooks/useAutoSaveForm.test.ts` |
| Sauvegarde (`scheduled-backup`, `backup-export`) | Cinq tables ajoutées aux listes | Contrôle [038] de `check-rules.sh` |
| Kanban newsletter (`content_cards`) | Aucun en epic 1 | Rien à rejouer avant l'epic 5 |

---

## Workflows suivants (manuels)

- Lancer `*atdd` pour générer les tests P0 en échec (workflow séparé, non lancé automatiquement).
- Lancer `*automate` une fois l'epic implémenté, pour étendre la couverture.
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
- `test-levels-framework.md` : choix du niveau de test, format d'identifiant `{EPIC}.{STORY}-{NIVEAU}-{SEQ}`
- `test-priorities-matrix.md` : priorités P0 à P3

### Documents liés

- Epics : `_bmad-output/planning-artifacts/epics-contenus-sociaux.md` (Epic 1, critères communs)
- Spec : `_bmad-output/specs/spec-contenus-sociaux/SPEC.md`, `statuts-et-validation.md`, `maquette-calendrier.md`, `brownfield.md`
- Architecture : `_bmad-output/planning-artifacts/architecture/architecture-super-tools-2026-09-24/ARCHITECTURE-SPINE.md`
- Contexte de test : `_bmad-output/test-artifacts/test-design-progress.md`

---

**Produit par :** BMad TEA Agent, module Test Architect
**Workflow :** `bmad-testarch-test-design`
**Version :** 4.0 (BMad v6)
