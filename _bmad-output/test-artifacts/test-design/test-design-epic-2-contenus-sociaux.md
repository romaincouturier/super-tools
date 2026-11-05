---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-11-05'
---

# Test design : Epic 2 - Faire valider les contenus (module Contenus sociaux)

**Date :** 2026-11-05
**Auteur :** Murat (BMAD TEA), pour Romain
**Statut :** Brouillon, à relire avec Romain et Emmanuelle

---

## Résumé exécutif

**Périmètre :** plan de test de niveau epic pour l'Epic 2 (stories 2.1 à 2.5 ; FR7, FR8, FR10 à FR16 ; NFR4, NFR7, NFR8 ; AD-1, AD-9, AD-11, AD-14). Le module n'existe pas encore : tout ce qui est nommé dans ce plan comme fonction, table, trigger ou fichier propre au module est **à créer**. Les noms donnés sont provisoires.

**Synthèse des risques :**

- Risques identifiés : 19
- Risques élevés (score >= 6) : 6, dont un à 9 (R-001, écriture directe du statut)
- Catégories critiques : SEC (contournement du circuit, identité de l'acteur), DATA (cohérence du groupe, historique), BUS (règles de transition)

**Synthèse de la couverture :**

- Scénarios P0 : 14 (~20 à 32 h)
- Scénarios P1 : 39 (~28 à 45 h)
- Scénarios P2 / P3 : 13 / 3 (~8 à 17 h)
- **Effort total** : ~56 à 94 h, soit ~1,5 à 2,5 semaines pour un développeur

Le centre de gravité du plan est la base de données : la fonction de transition unique, les triggers de garde et de remise en attente, et l'historique se testent sur un vrai Postgres (PGlite en PR, pgTAP pour les rôles de la plateforme). Les écrans ne retestent pas ces règles : ils vérifient qu'ils appellent la fonction et qu'ils affichent ce qu'elle rend.

---

## Hors périmètre

| Élément | Raison | Traitement du risque |
| --- | --- | --- |
| Outils MCP de validation (story 4.4) et brouillons MCP (story 4.3) | Epic 4 | L'Epic 2 teste le **contrat** que l'Epic 4 réutilisera : appel de la fonction par `service_role` avec un acteur explicite (2.1-SQL-008), garde contre l'écriture directe y compris en `service_role` (2.1-PGTAP-002). Le plan de l'Epic 4 vérifiera que chaque outil appelle la fonction. |
| Calendrier, composeur, glisser-déposer, marquage publié | Epic 1 | Seuls leurs effets sur la validation sont couverts ici (date seule, payload du glisser-déposer, publié modifié). |
| Concurrence réelle entre deux sessions | PGlite est mono-connexion, pgTAP s'exécute dans une transaction | Couverte par un contrôle de version périmée, rejoué séquentiellement (2.5-SQL-005). Pas de test de charge. |
| Délai de notification dans la journée | Par conception, l'action quotidienne n'apparaît qu'au passage du matin (jours ouvrés, `skipIfNonWorkingDay`) | Documenté comme hypothèse ; le compteur de Mes validations est l'indicateur temps réel. |
| Parcours E2E authentifié automatisé | Aucun parcours authentifié n'existe (`e2e/smoke.spec.ts`, `e2e/connexion.spec.ts` interceptent le réseau) | Les règles sont prouvées en base ; le parcours bout en bout est une recette manuelle (2.5-E2E-002). |

---

## Évaluation des risques

Échelle : probabilité 1 (peu probable), 2 (possible), 3 (probable) ; impact 1 (mineur), 2 (dégradé), 3 (critique : un contenu non validé part, ou une trace est perdue). Seuils de `probability-impact.md` : 1 à 3 documenter, 4 à 5 surveiller, 6 à 8 atténuer, 9 bloquer.

### Risques élevés (score >= 6)

| ID | Cat. | Description | P | I | Score | Mitigation | Responsable | Échéance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | SEC | **Écriture directe du statut de validation** hors de la fonction unique. Une policy RLS `supertilt_fr` classique autorise l'UPDATE de toute la ligne : un composant, un service, une edge function en `service_role`, l'import de l'Epic 5 ou un futur outil MCP peut écrire `approuvé` sans passer par la fonction (contraire à AD-11). La RLS seule ne protège pas du `service_role`. | 3 | 3 | **9** | Trigger de garde sur les colonnes de validation (INSERT et UPDATE), qui refuse toute écriture ne venant pas de la fonction, quel que soit le rôle. Contrôle statique à ajouter dans `scripts/check-rules.sh`. Tests 2.1-PGTAP-001, 2.1-PGTAP-002. | Dev story 2.1 | Avant merge de 2.1 |
| R-002 | BUS | **Changement de fond sans remise en attente.** Le texte ou le visuel d'un post approuvé change par un chemin qui ne déclenche pas la règle : écriture directe, synchro du groupe, table des visuels séparée, `service_role`. Un texte non relu part comme « Approuvé ». | 2 | 3 | **6** | Remise en attente portée par un trigger sur les colonnes de fond et sur la table de liaison des visuels, déléguant à la fonction unique. Tests 2.3-SQL-001 à 003, 2.3-SQL-011. | Dev story 2.3 | Avant merge de 2.3 |
| R-003 | DATA | **Divergence de statut dans un groupe.** La validation porte sur le groupe mais est stockée par post (FR7) : une mise à jour partielle, une déclinaison ajoutée à un groupe approuvé ou une synchro coupée laissent des déclinaisons dans des états différents. | 2 | 3 | **6** | Une seule écriture par groupe dans la fonction ; invariant « un statut par groupe » vérifié après chaque opération par un test de séquences aléatoires. Test 2.1-SQL-011. | Dev story 2.1 | Avant merge de 2.1 |
| R-004 | SEC | **Identité de l'acteur.** Le serveur MCP s'exécute avec la clé `service_role` et lie chaque requête à `ALLOWED_EMAIL` (`supabase/functions/mcp-server/index.ts`) : `auth.uid()` y vaut NULL. Une fonction qui se fie à `auth.uid()` enregistre une approbation sans auteur ; une fonction qui accepte un paramètre d'acteur laisse le navigateur se faire passer pour l'autre approbateur. | 2 | 3 | **6** | Acteur = `auth.uid()` pour un appel authentifié ; paramètre d'acteur accepté **uniquement** en `service_role`, refusé sinon ; acteur jamais NULL. Tests 2.1-SQL-008, 2.3-SQL-015. | Dev story 2.1 | Avant merge de 2.1 |
| R-005 | BUS | **Table de transitions incomplète.** Une transition interdite est acceptée (approuver un refusé non modifié, refuser un approuvé, approuver un brouillon jamais soumis), ou un refus passe avec un motif vide ou fait d'espaces. | 2 | 3 | **6** | Table de transitions exhaustive en fixture partagée, jouée contre la fonction SQL et contre l'aide d'affichage des boutons (AD-14). Tests 2.1-SQL-001, 2.1-SQL-002, 2.2-SQL-001, 2.1-UNIT-004. | Dev story 2.1, Romain (questions Q1 à Q3) | Questions tranchées avant 2.1 |
| R-006 | TECH | **Notification perdue en silence.** Le critère 2.1 demande que la liste des approbateurs passe par `get_staff_directory`. Or cette RPC lève « Accès refusé » quand `is_staff_user()` est faux, et `is_staff_user()` exige `auth.uid()` non NULL : appelée par `generate-daily-actions` avec la clé `service_role`, elle échoue. Les fetchers de `supabase/functions/_shared/daily-data-fetchers.ts` journalisent l'erreur et renvoient une liste vide : aucune action « Contenu à valider » n'est créée, sans alerte. | 3 | 2 | **6** | Côté serveur, lire les approbateurs par une source qui fonctionne sans session (par exemple `fetchRecipients`, qui lit déjà `profiles` en `service_role`, ou une RPC dédiée). La règle [076] vise `src/`. Test 2.1-SQL-009 qui fixe le piège. Constructeur d'actions pur et testé (2.1-UNIT-010 à 015). | Dev story 2.1 | Avant merge de 2.1 |

### Risques moyens (score 3 à 4)

| ID | Cat. | Description | P | I | Score | Mitigation | Responsable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-007 | BUS | Approbation d'une version que l'approbateur n'a pas lue : l'auteur modifie pendant le mode revue, ou « Tout approuver » part d'une liste périmée. | 2 | 2 | 4 | La fonction reçoit la version attendue (horodatage ou empreinte) et refuse une version différente. Test 2.5-SQL-005. | Dev story 2.5 |
| R-008 | BUS | Échelle affichée fausse sur une combinaison des deux axes (refusé non affiché « Brouillon », motif absent, publié puis remis en attente). | 2 | 2 | 4 | Fonction pure partagée, testée sur les 16 combinaisons. Tests 2.1-UNIT-001, 2.1-UNIT-002. | Dev story 2.1 |
| R-009 | DATA | Fausse remise en attente : l'auto-sauvegarde (`useAutoSaveForm`) ou le glisser-déposer réécrit la ligne entière avec un texte identique et le trigger y voit une modification ; une approbation se perd sur un simple déplacement de date. | 2 | 2 | 4 | Comparaison `IS DISTINCT FROM` dans le trigger ; payload du glisser-déposer limité à la date. Tests 2.3-SQL-004, 2.3-SQL-006, 2.3-COMP-002. | Dev story 2.3 |
| R-010 | DATA | Historique incomplet, non attribué, inondé par l'auto-sauvegarde, ou sans version précédente pour un changement de texte ou de date. | 2 | 2 | 4 | Historique écrit côté base (trigger et fonction), pas par l'écran. Tests 2.3-SQL-013 à 015, 2.3-PGTAP-001. | Dev story 2.3 |
| R-011 | BUS | Compteur de Mes validations différent de la colonne « À valider » (compte par post au lieu de par groupe, oubli des contenus de l'utilisateur lui-même). | 2 | 2 | 4 | Une seule source SQL pour la colonne et le compteur. Tests 2.5-SQL-001, 2.5-SQL-004, 2.5-COMP-003. | Dev story 2.5 |
| R-012 | BUS | « Tout approuver » écrit en lot sans la fonction, ou annonce un succès global alors qu'un contenu a été refusé par la fonction. | 2 | 2 | 4 | Lot côté serveur qui appelle la fonction unitaire par groupe et rend le détail des échecs. Tests 2.5-SQL-005, 2.5-COMP-001. La garde de R-001 bloque déjà l'écriture en lot. | Dev story 2.5 |
| R-013 | BUS | Action quotidienne mal ciblée ou obsolète : « Contenu à valider » adressée à l'auteur, une action par déclinaison au lieu d'une par groupe, « Contenu refusé » sans motif, action maintenue après décision. | 2 | 2 | 4 | Constructeur pur à extraire de `generate-daily-actions/index.ts`, testé ; régénération qui supprime les actions non terminées du jour (comportement existant) testée sur la nouvelle catégorie. Tests 2.1-UNIT-010 à 015, 2.2-UNIT-001. | Dev story 2.1 et 2.2 |
| R-014 | SEC | Un membre du staff qui a le droit `supertilt_fr` sans être Romain ou Emmanuelle approuve (NFR4). L'ensemble des approbateurs n'est défini nulle part. | 2 | 2 | 4 | Source explicite des approbateurs (question Q4), vérifiée dans la fonction. Test 2.1-SQL-007. | Romain (décision), Dev |
| R-015 | OPS | Migration non jouée en production alors que le front est publié (RPC absente), ou trigger de garde qui casse une écriture du front de l'Epic 1 déjà en ligne. | 2 | 2 | 4 | Vérifier que le front de l'Epic 1 n'écrit aucune colonne de validation ; sinon passer par `supabase/migrations-apres-front/`. Test 2.1-SQL-012 (remplissage des posts existants). | Dev, Romain (mise en production) |
| R-016 | BUS | Changement de perception : avec l'échelle complète, un post daté non approuvé s'affiche « Brouillon » alors qu'il s'affichait « Programmé » depuis l'Epic 1 (story 1.2). | 2 | 2 | 4 | Assumé par la spec (« Programmé » exige « approuvé ») ; tests de l'Epic 1 à mettre à jour ; légende à cinq statuts. Tests 2.1-UNIT-001, 2.1-COMP-003. | Romain (validation du comportement) |
| R-017 | SEC | Historique ou commentaires lisibles par un compte sans droit `supertilt_fr`, ou historique modifiable après coup. | 1 | 3 | 3 | RLS sur chaque table, aucune policy UPDATE ou DELETE sur l'historique. Tests 2.1-PGTAP-005, 2.3-PGTAP-001. | Dev |
| R-018 | TECH | Un futur outil MCP (Epic 4) recopie les règles au lieu d'appeler la fonction. | 1 | 3 | 3 | Garde de R-001 (le `service_role` ne peut pas écrire le statut) et contrôle statique. Couvert ici par 2.1-PGTAP-002 ; reste à vérifier dans le plan de l'Epic 4. | Dev Epic 4 |

### Risques faibles (score 1 à 2)

| ID | Cat. | Description | P | I | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-019 | OPS | Fuite de données identifiantes dans les nouveaux écrans en mode démo (« Approuvé par … », mentions, historique). | 1 | 2 | 2 | Surveiller : faux backend du scan démo complété (2.5-E2E-001), ratchet [065]. |
| R-020 | PERF | Requête du compteur du menu lente ou exécutée à chaque rendu. Volume attendu : quelques dizaines de groupes. | 1 | 1 | 1 | Surveiller : index sur le statut de validation, mesure ponctuelle (2.5-SQL-006). |

Le registre compte 20 lignes : R-001 à R-019 sont des risques fonctionnels ou techniques, R-020 un risque de performance documenté pour mémoire. Le décompte retenu dans le résumé (19) exclut R-020, de score 1, que la checklist demande seulement de documenter.

### Légende des catégories

- **TECH** : architecture, intégration (edge functions, RPC)
- **SEC** : contrôle d'accès, identité, contournement du circuit
- **PERF** : temps de réponse, ressources
- **DATA** : intégrité, cohérence, perte de trace
- **BUS** : règle métier, effet sur l'usage
- **OPS** : déploiement, migration, mode démo

### Risque résiduel

Après mitigation, R-001 tombe à 1 x 3 = 3 si la garde est un trigger (indépendant des privilèges de table, qui relèvent de la plateforme et non des migrations, comme le rappelle `supabase/tests/rls_learner_isolation.test.sql`). Une garde fondée sur un `REVOKE UPDATE` de colonne ne serait pas démontrable sur une instance neuve : elle laisserait R-001 à 2 x 3 = 6. R-006 tombe à 1 x 2 = 2 si la source des approbateurs côté serveur est testée. R-007 reste à 1 x 2 si le contrôle de version n'est pas retenu, et devient alors une limite connue.

---

## Référentiels de test du circuit

Ces trois tables sont la spécification exécutable de l'epic. Elles vivent dans une fixture partagée (à créer, par exemple `supabase/tests/fixtures/social-validation.json`) jouée par les tests SQL et par les tests unitaires du front, sur le modèle des paires jumelles d'AD-14.

### Table de transitions de la fonction unique

États : ND (non demandée), EA (en attente), AP (approuvé), RE (refusé). « Interdit » signifie : erreur nommée, aucun changement d'état, aucune entrée d'historique, aucune action quotidienne.

| État \ Événement | Demander | Approuver | Retirer l'approbation | Refuser (motif) |
| --- | --- | --- | --- | --- |
| ND | EA | Interdit (Q1) | Interdit | Interdit |
| EA | Sans effet (idempotent, aucune entrée) | AP | Interdit | RE |
| AP | Interdit | Interdit (le second clic est un retrait) | ND | Interdit (Q2) |
| RE | Interdit (Q3) | Interdit | Interdit | Interdit |

Cellules autorisées : 4, plus 1 sans effet. Cellules interdites : 11. Chaque transition autorisée s'applique à toutes les déclinaisons du groupe, enregistre l'acteur et l'horodatage, et écrit une entrée d'historique.

### Effets des modifications (triggers)

| État | Texte ou visuel modifié | Date ou heure seule modifiée | Texte et date dans la même écriture | Écriture identique (aucun changement réel) |
| --- | --- | --- | --- | --- |
| ND | ND | ND | ND | Rien |
| EA | EA | EA | EA | Rien |
| AP | EA (tout le groupe) | AP conservé, approbateur conservé | EA | Rien |
| RE | EA (tout le groupe) | RE | EA | Rien |

Écriture directe des colonnes de validation (INSERT ou UPDATE, rôle `authenticated` ou `service_role`) : refusée dans tous les cas.

### Échelle affichée (fonction pure, 16 combinaisons)

Première condition vraie : Publié, Programmé (approuvé et daté), Approuvé, En validation, Brouillon.

| Validation \ Publication | Sans date | Programmé (daté) | Marqué publié, daté | Marqué publié, sans date (si autorisé) |
| --- | --- | --- | --- | --- |
| ND | Brouillon | Brouillon | Publié | Publié |
| EA | En validation | En validation | Publié | Publié |
| AP | Approuvé | Programmé | Publié | Publié |
| RE | Brouillon + motif | Brouillon + motif | Publié | Publié |

Si une contrainte de la base interdit « marqué publié sans date », la dernière colonne devient un test de contrainte (2.1-SQL-010) et sort du test de la fonction pure.

---

## Critères d'entrée

- [ ] Questions Q1 à Q6 tranchées par Romain (voir Hypothèses) ; la fixture de transitions reflète les réponses
- [ ] Epic 1 livré : tables de posts, de groupes et de visuels présentes dans `supabase/migrations/`
- [ ] Harnais PGlite étendu pour jouer une migration complète du module avec ses triggers (précédent : `supabase/tests/watch-sources.test.ts` joue un fichier de migration entier et bascule en `SET ROLE authenticated`) ; `createTestDb()` ne crée pas `user_module_access.module` ni le stub de `has_module_access` : le test les ajoute, comme `supabase/tests/rpc-trainer-evals-directory.test.ts` ajoute des colonnes à `profiles`
- [ ] Constructeur des actions « Contenu à valider » et « Contenu refusé » extrait de `supabase/functions/generate-daily-actions/index.ts` vers un module pur de `supabase/functions/_shared/` (à créer) : la logique actuelle est écrite dans le gestionnaire `serve()`, impossible à importer dans un test
- [ ] Données : deux approbateurs (Romain, Emmanuelle), un membre du staff non approbateur, un compte sans module, un groupe de trois déclinaisons, un groupe d'une déclinaison

## Critères de sortie

- [ ] 100 % des P0 passent ; >= 95 % des P1 passent, tout échec P1 ayant une dérogation écrite
- [ ] Aucun bug ouvert de sévérité haute sur le circuit de validation
- [ ] Les 15 cellules de la table de transitions et les 16 combinaisons de l'échelle sont jouées
- [ ] R-001 à R-006 atténués (tests verts) ou dérogation signée par Romain
- [ ] Recette manuelle du signal de succès (2.5-E2E-002) faite une fois sur l'environnement de prévisualisation
- [ ] `npm run typecheck`, `bash scripts/check-rules.sh`, `npm test` passent ; `RLS tests` vert sur la PR de migration

## Équipe

| Nom | Rôle | Responsabilités de test |
| --- | --- | --- |
| Romain | PM, tech lead, approbateur | Tranche les questions, valide la fixture de transitions, recette manuelle, mise en production de la migration |
| Emmanuelle | Approbatrice | Recette manuelle de Mes validations et du mode revue |
| Agent dev (bmad-dev) | Développement | Écrit et maintient les tests Unit, SQL-PGlite, pgTAP et Component |

---

## Plan de couverture

**Note :** P0 à P3 expriment la priorité, dérivée du risque. Le moment d'exécution est décrit dans la section « Stratégie d'exécution ».

**Niveaux :**

- **Unit** : Vitest, fonctions pures (`supabase/functions/_shared/**/*.test.ts` ou `src/**/*.test.ts`).
- **SQL-PGlite** : Vitest + PGlite (`supabase/tests/*.test.ts`), fonctions et triggers extraits de la migration, identité réglée par `actAs()`, rôle par `SET ROLE`.
- **pgTAP** : `supabase/tests/*.test.sql` sur l'instance locale qui rejoue toutes les migrations (workflow `RLS tests`), pour les rôles réels `anon`, `authenticated`, `service_role`.
- **Component** : Vitest + Testing Library (jsdom), hooks et services simulés.
- **E2E** : Playwright, réservé au scan du mode démo et à une recette manuelle.

**Règle anti-doublon :** une règle métier se prouve à un seul niveau, le plus bas possible. Les règles du circuit se prouvent en SQL ; l'écran vérifie seulement qu'il appelle la fonction et qu'il rend sa réponse. Deux recouvrements sont voulus et portent sur des aspects différents : le motif obligatoire (règle serveur en 2.2-SQL-001, bouton désactivé en 2.2-COMP-001) et la garde contre l'écriture directe (trigger testé en PGlite pour la logique, en pgTAP pour les rôles réels).

### P0 (critique)

**Critères :** bloque le circuit de validation, risque >= 6, aucun contournement.

| ID | Story / critère | Scénario | Niveau | Risque | Resp. |
| --- | --- | --- | --- | --- | --- |
| 2.1-SQL-001 | 2.1, toutes les transitions par une fonction | Les 4 transitions autorisées (ND demander, EA approuver, EA refuser, AP retirer) donnent l'état attendu sur tout le groupe, avec acteur et horodatage ; le retrait efface approbateur et date | SQL-PGlite | R-005 | DEV |
| 2.1-SQL-002 | 2.1, transitions | Les 11 transitions interdites lèvent une erreur nommée et ne changent ni l'état, ni l'historique ; EA demander est sans effet | SQL-PGlite | R-005 | DEV |
| 2.1-SQL-003 | 2.1, approbation de groupe | Approuver depuis une déclinaison passe les trois posts du groupe en AP avec le même approbateur | SQL-PGlite | R-003 | DEV |
| 2.1-SQL-004 | 2.1, auteur compris | Romain, auteur du groupe, l'approuve lui-même : accepté | SQL-PGlite | R-005 | DEV |
| 2.1-SQL-008 | 2.1, AD-11 (MCP) | Appel en `service_role` avec acteur explicite : l'acteur est enregistré ; appel authentifié avec un acteur différent de `auth.uid()` : refusé ; acteur NULL : refusé | SQL-PGlite | R-004 | DEV |
| 2.1-SQL-011 | 2.1, effet groupe | Invariant : après une séquence aléatoire à graine fixe (transitions, modifications sur des déclinaisons au hasard, ajout et suppression de déclinaison, synchro coupée), toutes les déclinaisons d'un groupe ont le même statut de validation | SQL-PGlite | R-003 | DEV |
| 2.1-PGTAP-001 | 2.1, aucun écran n'écrit le statut | Rôle `authenticated` avec droit `supertilt_fr`, après `GRANT` explicite des privilèges de table : UPDATE des colonnes de validation et INSERT d'un post « approuvé » échouent ; l'appel de la fonction par le même compte réussit (contrôle positif) | pgTAP | R-001 | DEV |
| 2.1-PGTAP-002 | 2.1, AD-11 | Rôle `service_role` (qui contourne la RLS) : UPDATE direct des colonnes de validation échoue | pgTAP | R-001, R-018 | DEV |
| 2.2-SQL-001 | 2.2, refus impossible sans motif | Motif NULL, vide ou fait d'espaces : erreur, état EA conservé | SQL-PGlite | R-005 | DEV |
| 2.2-SQL-002 | 2.2, refus de groupe | Refus avec motif : tout le groupe en RE, motif enregistré sans espaces de bord, acteur et date | SQL-PGlite | R-003 | DEV |
| 2.3-SQL-001 | 2.3, texte modifié | UPDATE direct du texte d'une déclinaison d'un groupe AP (sans passer par l'écran) : tout le groupe repasse EA | SQL-PGlite | R-002 | DEV |
| 2.3-SQL-002 | 2.3, visuel modifié | Ajout, remplacement et retrait d'un visuel (table de liaison) sur un groupe AP : EA | SQL-PGlite | R-002 | DEV |
| 2.3-SQL-003 | 2.3, refusé modifié | Texte ou visuel modifié sur un groupe RE : EA | SQL-PGlite | R-002 | DEV |
| 2.3-SQL-004 | 2.3, date seule | Changement de date, d'heure, pose ou retrait de la date sur un groupe AP : AP conservé, approbateur et date d'approbation inchangés | SQL-PGlite | R-009 | DEV |

**Total P0 : 14 scénarios, ~20 à 32 h** (harnais PGlite et fichier pgTAP compris)

Le ratio P0 (20 %) dépasse la référence de 10 % : l'epic est la zone de risque désignée du module, et tous les P0 sont des tests de base rapides.

### P1 (élevé)

**Critères :** parcours principal, risque moyen ou élevé, logique complexe ou point d'intégration.

| ID | Story / critère | Scénario | Niveau | Risque | Resp. |
| --- | --- | --- | --- | --- | --- |
| 2.1-UNIT-001 | 2.1, échelle complète | Les 16 combinaisons de l'échelle affichée, table pilotée par la fixture | Unit | R-008, R-016 | DEV |
| 2.1-UNIT-002 | FR8, refusé | Le motif n'est rendu que pour RE ; RE s'affiche « Brouillon » | Unit | R-008 | DEV |
| 2.1-UNIT-004 | 2.1, AD-14 | L'aide qui choisit les boutons (demander, approuver, retirer, refuser) selon l'état et le rôle concorde avec la fixture de transitions | Unit | R-005 | DEV |
| 2.1-UNIT-010 | 2.1, action pour l'autre approbateur | Groupe EA de Romain : une action « Contenu à valider » pour Emmanuelle avec lien vers le contenu, aucune pour Romain ; et inversement | Unit | R-013 | DEV |
| 2.1-UNIT-011 | 2.1, action quotidienne | Groupe de trois déclinaisons : une seule action, identifiée par le groupe | Unit | R-013 | DEV |
| 2.1-UNIT-012 | 2.1, disparition | Groupes ND, AP, RE : aucune action « Contenu à valider » ; un groupe remis en EA par une modification en reçoit une | Unit | R-013 | DEV |
| 2.1-UNIT-015 | 2.1, disparition au passage suivant | Régénération (suppression des actions non terminées du jour puis upsert, logique existante extraite) avec un client simulé : l'action d'un groupe décidé entre deux passages disparaît, une action cochée reste | Unit | R-013 | DEV |
| 2.1-SQL-006 | 2.1, AD-1 | Anonyme et compte sans `supertilt_fr` : la fonction lève 42501, état inchangé | SQL-PGlite | R-001 | DEV |
| 2.1-SQL-007 | NFR4 | Staff avec `supertilt_fr` non approbateur : demander accepté, approuver, retirer et refuser refusés | SQL-PGlite | R-014 | DEV |
| 2.1-SQL-009 | 2.1, liste des approbateurs | Sans session (`auth.uid()` NULL, cas de `generate-daily-actions`) : la source d'approbateurs retenue rend Romain et Emmanuelle ; `get_staff_directory` lève « Accès refusé » dans ce contexte (piège fixé par le test) | SQL-PGlite | R-006 | DEV |
| 2.1-SQL-010 | FR7 | Contraintes : valeurs de l'axe validation limitées aux quatre états ; RE exige un motif non vide ; « programmé » exige une date | SQL-PGlite | R-005 | DEV |
| 2.1-PGTAP-004 | 2.1, AD-11 | Privilèges : `anon` ne peut pas exécuter la fonction, `authenticated` et `service_role` le peuvent ; la fonction est `SECURITY DEFINER` avec `search_path` fixé | pgTAP | R-001 | DEV |
| 2.1-PGTAP-005 | Critères communs, AD-1 | Compte authentifié sans module : zéro ligne lue dans les nouvelles tables (historique, commentaires, vues de Mes validations) | pgTAP | R-017 | DEV |
| 2.1-COMP-001 | 2.1, demander | Le bouton « Demander une validation » appelle le service de la fonction, jamais une mise à jour de table ; le statut affiché passe à « En validation » au retour | Component | R-001 | DEV |
| 2.1-COMP-002 | 2.1, coche | Premier clic : approbation et « Approuvé par … le … » ; second clic : retrait | Component | R-005 | DEV |
| 2.2-UNIT-001 | 2.2, action pour l'auteur | Groupe RE : une action « Contenu refusé » pour l'auteur, motif dans la description ; aucune pour l'approbateur ; plus d'action après correction | Unit | R-013 | DEV |
| 2.2-COMP-001 | 2.2, motif obligatoire | Dialogue de refus : confirmation désactivée tant que le motif est vide ou fait d'espaces ; le motif saisi est transmis | Component | R-005 | DEV |
| 2.2-COMP-002 | 2.2, motif visible | Carte et détail d'un contenu refusé : « Brouillon » et motif affichés | Component | R-008 | DEV |
| 2.3-SQL-005 | 2.3 | Texte et date modifiés dans la même écriture sur AP : EA | SQL-PGlite | R-002 | DEV |
| 2.3-SQL-006 | 2.3, auto-sauvegarde | Réécriture de la ligne avec un texte et des visuels identiques : aucun changement d'état, aucune entrée d'historique | SQL-PGlite | R-009, R-010 | DEV |
| 2.3-SQL-007 | 2.3 | Modification d'un groupe ND ou EA : état inchangé, entrée « modification » écrite | SQL-PGlite | R-002 | DEV |
| 2.3-SQL-008 | 2.3, une déclinaison | Synchro active (trois posts mis à jour) ou coupée (un seul post modifié) : le groupe entier repasse EA, une seule entrée de remise en attente | SQL-PGlite | R-002, R-003 | DEV |
| 2.3-SQL-010 | FR9 et FR13 | Déclinaison marquée publiée dont le texte change : validation EA, publication inchangée | SQL-PGlite | R-002 | DEV |
| 2.3-SQL-011 | AD-11 | Modification du texte en `service_role` (chemin MCP, import) : remise en attente identique | SQL-PGlite | R-002 | DEV |
| 2.3-SQL-012 | 2.3, correction directe | L'approbateur corrige le texte d'un groupe EA ou AP : EA, puis il peut l'approuver, qu'il soit auteur ou non | SQL-PGlite | R-005 | DEV |
| 2.3-SQL-013 | FR16 | Une entrée datée et attribuée par type : création, demande, approbation, retrait, refus avec motif, modification, changement de date, marquage publié | SQL-PGlite | R-010 | DEV |
| 2.3-SQL-014 | FR16, version précédente | Changement de texte : texte précédent conservé ; changement de date : date et heure précédentes conservées | SQL-PGlite | R-010 | DEV |
| 2.3-SQL-015 | FR16, attribution | Acteur = `auth.uid()` en appel authentifié, utilisateur du connecteur et origine « MCP » en `service_role` ; jamais NULL | SQL-PGlite | R-004, R-010 | DEV |
| 2.3-PGTAP-001 | FR16 | Historique : `authenticated` ne peut ni le modifier, ni le supprimer, ni y insérer une entrée forgée | pgTAP | R-017 | DEV |
| 2.3-COMP-001 | 2.3, historique | Le panneau d'historique liste les entrées et affiche la version précédente pour un texte ou une date | Component | R-010 | DEV |
| 2.3-COMP-002 | 2.3, glisser-déposer | Le déplacement d'une carte approuvée envoie seulement la date et l'heure ; la carte reste « Programmé » | Component | R-009 | DEV |
| 2.5-SQL-001 | 2.5, À valider | Tous les groupes EA, y compris ceux de l'utilisateur | SQL-PGlite | R-011 | DEV |
| 2.5-SQL-002 | 2.5, Retour laissé | Groupes que l'utilisateur a refusés ou commentés (commentaire ouvert), non corrigés ; un groupe corrigé en sort | SQL-PGlite | R-011 | DEV |
| 2.5-SQL-003 | 2.5, Validé | Groupes que l'utilisateur a approuvés et qui sont encore AP ; un retrait ou une remise en attente les en sort | SQL-PGlite | R-011 | DEV |
| 2.5-SQL-004 | 2.5, compteur | Compteur = nombre de groupes de « À valider » pour l'utilisateur, 0 sans contenu en attente | SQL-PGlite | R-011 | DEV |
| 2.5-SQL-005 | 2.5, Tout approuver | Le lot appelle la fonction unitaire par groupe ; un groupe sorti de EA ou de version différente depuis le chargement n'est pas approuvé et figure dans les échecs rendus ; les autres sont approuvés | SQL-PGlite | R-007, R-012 | DEV |
| 2.5-COMP-001 | 2.5, Tout approuver | Confirmation `useConfirm()` obligatoire ; appel du service du lot ; échecs partiels affichés | Component | R-012 | DEV |
| 2.5-COMP-002 | 2.5, mode revue | Enchaînement un par un : approuver, refuser avec motif, commenter, passage au suivant ; un contenu sorti de EA entre-temps est sauté | Component | R-007 | DEV |
| 2.5-COMP-003 | 2.5, compteur du menu | Le badge de l'entrée Contenus sociaux de `src/components/AppSidebar.tsx` affiche la valeur du hook, disparaît à 0, se met à jour après une décision | Component | R-011 | DEV |

**Total P1 : 39 scénarios, ~28 à 45 h**

### P2 (moyen)

**Critères :** fonctions secondaires, risque faible, cas limites.

| ID | Story / critère | Scénario | Niveau | Risque | Resp. |
| --- | --- | --- | --- | --- | --- |
| 2.1-UNIT-013 | 2.1 | Auteur hors approbateurs : une action pour chacun des deux approbateurs (selon Q4) | Unit | R-013 | DEV |
| 2.1-SQL-012 | 2.1, migration | Remplissage : les posts existants de l'Epic 1 passent ND, aucun ne viole les contraintes | SQL-PGlite | R-015 | DEV |
| 2.1-COMP-003 | 2.1, légende | La légende du calendrier affiche les cinq statuts avec leur couleur | Component | R-016 | DEV |
| 2.1-COMP-004 | AD-5 | Une erreur de la fonction (transition interdite) passe par `toastError()` et l'état affiché revient à celui du serveur | Component | R-005 | DEV |
| 2.3-SQL-009 | 2.3 | Thème, format, campagne modifiés sur AP : approbation conservée (selon Q5) | SQL-PGlite | R-009 | DEV |
| 2.4-SQL-001 | 2.4, résolution | Résoudre un commentaire enregistre qui et quand ; le nombre de commentaires ouverts l'exclut | SQL-PGlite | - | DEV |
| 2.4-SQL-002 | 2.4 | Ajouter ou résoudre un commentaire ne change pas l'état de validation | SQL-PGlite | R-002 | DEV |
| 2.4-SQL-003 | 2.4, interne | Écriture de commentaire refusée sans droit `supertilt_fr` (`SET ROLE authenticated`) | SQL-PGlite | R-017 | DEV |
| 2.4-COMP-001 | 2.4, mention | La saisie de `@` propose les membres rendus par le service de `get_staff_directory` et insère la mention | Component | - | DEV |
| 2.4-COMP-002 | 2.4, résolu | Un commentaire résolu est replié | Component | - | DEV |
| 2.4-COMP-003 | 2.4, carte | Le nombre de commentaires ouverts apparaît sur la carte du calendrier | Component | - | DEV |
| 2.5-COMP-004 | 2.5, cartes | Carte de Mes validations : canaux, heure, visuel, début du texte, statut, nombre de commentaires | Component | - | DEV |
| 2.5-E2E-001 | NFR8, [065] | Scan du mode démo : les tables du module ajoutées au faux backend (`e2e/demo-scan/schema.ts`) ; Mes validations, le détail et l'historique ne montrent aucune donnée canari | E2E | R-019 | DEV |

**Total P2 : 13 scénarios, ~6 à 12 h**

### P3 (faible)

**Critères :** exploratoire, mesure, cas rares.

| ID | Story / critère | Scénario | Niveau | Resp. |
| --- | --- | --- | --- | --- |
| 2.2-UNIT-002 | 2.2 | Un approbateur refuse son propre contenu : l'action « Contenu refusé » lui revient | Unit | DEV |
| 2.5-SQL-006 | 2.5, compteur | Plan de la requête du compteur sur 1 000 groupes : index utilisé | SQL-PGlite | DEV |
| 2.5-E2E-002 | Signal de succès | Recette manuelle sur prévisualisation : cinq brouillons, quatre approuvés et un refusé depuis Mes validations, correction, remise en attente, approbation, actions du lendemain matin vérifiées | E2E (manuel) | Romain, Emmanuelle |

**Total P3 : 3 scénarios, ~2 à 5 h**

### Traçabilité des critères d'acceptation

| Story | Critère | Scénarios |
| --- | --- | --- |
| 2.1 | Axe validation indépendant, fonction unique `SECURITY DEFINER`, aucune écriture directe | 2.1-SQL-001, 002, 010, 2.1-PGTAP-001, 002, 004, 2.1-COMP-001 |
| 2.1 | Demande : groupe en attente, « En validation » | 2.1-SQL-001, 2.1-UNIT-001, 2.1-COMP-001 |
| 2.1 | Approbation de groupe, auteur compris, approbateur affiché, retrait | 2.1-SQL-001, 003, 004, 007, 008, 2.1-COMP-002 |
| 2.1 | Échelle complète, légende à cinq statuts | 2.1-UNIT-001, 002, 2.1-COMP-003 |
| 2.1 | Action « Contenu à valider », disparition, annuaire | 2.1-UNIT-010 à 013, 015, 2.1-SQL-009 |
| 2.2 | Refus impossible sans motif | 2.2-SQL-001, 2.2-COMP-001 |
| 2.2 | Groupe refusé, « Brouillon », motif visible, action pour l'auteur | 2.2-SQL-002, 2.2-COMP-002, 2.2-UNIT-001, 002 |
| 2.3 | Texte ou visuel modifié : groupe en attente, de nouveau à valider | 2.3-SQL-001, 002, 003, 005, 007, 008, 010, 011, 2.1-UNIT-012 |
| 2.3 | Date ou heure seule : approbation conservée | 2.3-SQL-004, 006, 009, 2.3-COMP-002 |
| 2.3 | Correction directe par l'approbateur, puis approbation | 2.3-SQL-012 |
| 2.3 | Historique daté, attribué, version précédente | 2.3-SQL-013, 014, 015, 2.3-PGTAP-001, 2.3-COMP-001 |
| 2.4 | Commentaire interne, mention par l'annuaire | 2.4-SQL-003, 2.4-COMP-001 |
| 2.4 | Résolution, compteur de la carte | 2.4-SQL-001, 002, 2.4-COMP-002, 003 |
| 2.5 | Trois colonnes, contenu des cartes | 2.5-SQL-001, 002, 003, 2.5-COMP-004 |
| 2.5 | Mode revue | 2.5-COMP-002 |
| 2.5 | Tout approuver par la même fonction | 2.5-SQL-005, 2.5-COMP-001 |
| 2.5 | Compteur du menu | 2.5-SQL-004, 006, 2.5-COMP-003 |
| Communs | RLS, sauvegarde, mode démo | 2.1-PGTAP-005, 2.5-E2E-001 ; sauvegarde par le contrôle [038] existant de `scripts/check-rules.sh` |

---

## Stratégie d'exécution

Principe : tout tourne en PR tant que la suite reste sous 15 minutes ; seul ce qui est coûteux ou manuel est différé. Les suites de cet epic sont surtout des tests Vitest en mémoire : elles ajoutent de l'ordre d'une à deux minutes. Playwright n'intervient que pour le scan démo ; s'il fallait plus de parcours, sa parallélisation garde des centaines de tests sous 10 à 15 minutes.

| Moment | Contenu | Où |
| --- | --- | --- |
| **PR** | Unit, SQL-PGlite et Component (P0 à P3, sauf manuel) ; test d'invariant avec graine fixe et une centaine de séquences | `npm test` dans `.github/workflows/ci.yml` |
| **PR touchant `supabase/migrations/` ou `supabase/tests/`** | pgTAP (2.1-PGTAP-001, 002, 004, 005, 2.3-PGTAP-001) | Workflow `RLS tests` (`.github/workflows/rls-tests.yml`, `supabase test db`) |
| **Nuit** | Facultatif : test d'invariant avec graines aléatoires et quelques milliers de séquences. Aucun workflow de nuit n'existe ; à créer seulement si l'invariant a déjà cassé une fois | À créer |
| **Semaine** | Scan du mode démo avec les nouvelles tables (2.5-E2E-001) ; contrôle de cohérence en production : groupes en attente du jour comparés aux actions « Contenu à valider » générées | `.github/workflows/demo-scan.yml` (lundi) ; requête de contrôle lancée à la main |
| **Par livraison** | Recette manuelle du signal de succès (2.5-E2E-002) | Prévisualisation |

---

## Estimation

| Priorité | Scénarios | Effort | Remarques |
| --- | --- | --- | --- |
| P0 | 14 | ~20 à 32 h | Inclut l'extension du harnais PGlite (migration complète, triggers, stubs) et le premier fichier pgTAP du module |
| P1 | 39 | ~28 à 45 h | Inclut l'extraction du constructeur d'actions quotidiennes et la fixture partagée |
| P2 | 13 | ~6 à 12 h | Inclut le complément du faux backend du scan démo |
| P3 | 3 | ~2 à 5 h | Dont une recette manuelle d'environ une heure |
| **Total** | **69** | **~56 à 94 h** | **~1,5 à 2,5 semaines** pour un développeur, en parallèle des stories |

### Prérequis

**Données de test :**

- Fabrique de groupes (à créer) : groupe de N déclinaisons dans un état donné, avec auteur, dates et visuels
- Comptes : Romain, Emmanuelle, staff non approbateur, compte sans module, appel `service_role`
- Fixture partagée des transitions et de l'échelle (à créer)

**Outillage :**

- `supabase/tests/helpers/db.ts` : `createTestDb`, `loadFunctions`, `actAs`, `createAuthUser` existent ; lecture d'une migration complète à ajouter (ou lecture directe du fichier, comme `supabase/tests/watch-sources.test.ts`)
- pgTAP : reprendre le schéma de `supabase/tests/rls_learner_isolation.test.sql` (transaction annulée, `GRANT` explicites avant de mesurer la garde)
- Testing Library (`@testing-library/react`) pour les composants
- Contrôle statique à ajouter dans `scripts/check-rules.sh` : aucune écriture des colonnes de validation dans `src/` ni dans `supabase/functions/` (AGENTS.md exige une règle de `IMPROVEMENTS.md` avec son contrôle)

**Environnement :**

- Node 20, `npm ci`, `TZ=UTC` (déjà dans `npm test`)
- Supabase CLI locale pour pgTAP (fournie par le workflow `RLS tests`)

---

## Portes de qualité

### Seuils

- **P0** : 100 %, sans exception
- **P1** : >= 95 %, dérogation écrite pour tout échec
- **P2 / P3** : >= 90 %, indicatif
- **Risques élevés** : R-001 à R-006 atténués à 100 % ou dérogation signée. R-001 (score 9) bloque la porte : FAIL tant que 2.1-PGTAP-001 et 2.1-PGTAP-002 ne passent pas.

### Couverture

- Table de transitions : 15 cellules sur 15 ; échelle affichée : 16 combinaisons sur 16
- Scénarios SEC : 100 %
- Modules purs nouveaux (échelle, aide des boutons, constructeur d'actions) : >= 90 % de lignes
- Chemins critiques : >= 80 % ; logique métier : >= 70 % ; cas limites : >= 50 %

### Exigences non négociables

- [ ] Tous les P0 passent
- [ ] Aucun risque >= 6 sans mitigation ou dérogation
- [ ] Tous les scénarios SEC passent
- [ ] Contrôle statique d'écriture du statut actif dans `scripts/check-rules.sh`
- [ ] PERF : sans objet chiffré ; 2.5-SQL-006 informatif

---

## Plans de mitigation

### R-001 : écriture directe du statut de validation (score 9)

**Stratégie :** trigger BEFORE INSERT OR UPDATE sur la table des posts, qui refuse toute valeur ou modification des colonnes de validation ne venant pas de la fonction unique, pour tous les rôles. Le mécanisme (indicateur local à la transaction posé par la fonction, ou autre) est un choix de développement ; le test est comportemental. INSERT : statut forcé à ND ou refusé. Contrôle statique dans `scripts/check-rules.sh`.
**Responsable :** Dev story 2.1
**Échéance :** avant merge de 2.1
**Statut :** prévu
**Vérification :** 2.1-PGTAP-001, 2.1-PGTAP-002 (avec contrôle positif), 2.1-PGTAP-004.

### R-002 : changement de fond sans remise en attente (score 6)

**Stratégie :** triggers sur les colonnes de texte et sur la table de liaison des visuels, avec `IS DISTINCT FROM`, qui délèguent la remise en attente à la fonction unique (un seul propriétaire, AD-11). Ils s'appliquent à tous les rôles, `service_role` compris.
**Responsable :** Dev story 2.3
**Échéance :** avant merge de 2.3
**Statut :** prévu
**Vérification :** 2.3-SQL-001, 002, 003, 005, 008, 011.

### R-003 : divergence de statut dans un groupe (score 6)

**Stratégie :** la fonction écrit le statut sur toutes les déclinaisons du groupe dans une seule instruction ; l'ajout d'une déclinaison à un groupe suit la règle de Q6. Test d'invariant sur séquences aléatoires à graine fixe.
**Responsable :** Dev story 2.1
**Échéance :** avant merge de 2.1
**Statut :** prévu
**Vérification :** 2.1-SQL-003, 2.1-SQL-011, 2.2-SQL-002, 2.3-SQL-008.

### R-004 : identité de l'acteur (score 6)

**Stratégie :** acteur = `auth.uid()` quand une session existe ; un paramètre d'acteur n'est lu qu'en `service_role` ; acteur NULL refusé. L'origine (écran ou MCP) est enregistrée dans l'historique.
**Responsable :** Dev story 2.1
**Échéance :** avant merge de 2.1
**Statut :** prévu
**Vérification :** 2.1-SQL-008, 2.3-SQL-015.

### R-005 : table de transitions incomplète (score 6)

**Stratégie :** Romain tranche Q1 à Q3 ; la fixture partagée encode la table ; la fonction SQL et l'aide des boutons sont testées contre elle ; le motif est vérifié par une contrainte et par la fonction.
**Responsable :** Romain (décisions), Dev story 2.1
**Échéance :** décisions avant le début de 2.1, tests avant merge
**Statut :** prévu
**Vérification :** 2.1-SQL-001, 002, 010, 2.1-UNIT-004, 2.2-SQL-001.

### R-006 : notification perdue en silence (score 6)

**Stratégie :** dans `generate-daily-actions`, lire les approbateurs par une source qui fonctionne sans session ; ne pas appeler `get_staff_directory` côté serveur. Extraire la construction des deux nouvelles catégories dans un module pur de `supabase/functions/_shared/`. Le contrôle hebdomadaire en production compare groupes en attente et actions générées.
**Responsable :** Dev story 2.1
**Échéance :** avant merge de 2.1
**Statut :** prévu
**Vérification :** 2.1-SQL-009, 2.1-UNIT-010 à 015, contrôle hebdomadaire.

---

## Hypothèses et dépendances

### Hypothèses

1. Le groupe reste l'unité de validation même quand la synchro du texte est coupée (story 2.3 : « modifie le texte ou le visuel d'une déclinaison, le groupe repasse en attente »).
2. Le marquage publié reste par déclinaison (story 1.5) ; l'échelle affichée se calcule donc par post.
3. L'action quotidienne apparaît au passage du matin suivant, les jours ouvrés seulement ; une décision prise dans la journée ne retire l'action qu'au passage suivant.
4. Le compteur et les colonnes de Mes validations comptent des groupes, pas des posts.
5. Une modification d'un post déjà en attente n'envoie pas de nouvelle notification : l'action existe déjà.

### Questions ouvertes (à trancher avant la story 2.1)

- **Q1** : un approbateur peut-il approuver directement un brouillon jamais soumis (ND vers AP) ? Le cycle de vie ne le prévoit pas ; le plan le traite comme interdit.
- **Q2** : peut-on refuser un contenu déjà approuvé (AP vers RE) ? Plan : interdit, il faut retirer puis le contenu repasse ND.
- **Q3** : un contenu refusé peut-il être resoumis sans modification (RE vers EA par « Demander ») ? Plan : interdit, seule une modification le remet en attente.
- **Q4** : comment la base sait-elle qui est approbateur (NFR4) ? Aucune source n'existe. Qui reçoit « Contenu à valider » quand l'auteur n'est pas approbateur ?
- **Q5** : thème, format, canaux et campagne remettent-ils en attente ? La spec ne cite que texte et visuel ; le plan suppose que non.
- **Q6** : une déclinaison ajoutée à un groupe approuvé (nouveau canal) remet-elle le groupe en attente ? Le plan suppose que oui, puisque du contenu non relu apparaît sur un nouveau réseau.
- **Q7** : le critère 2.1 impose `get_staff_directory` pour la liste des approbateurs ; cette RPC refuse les appels sans session (R-006). Faut-il reformuler le critère pour le côté serveur ?

### Dépendances

1. Epic 1 livré (tables de posts, groupes, visuels, composeur) : requis avant 2.1
2. Réponses à Q1 à Q7 : requises avant 2.1
3. Extension du harnais PGlite et premier fichier pgTAP du module : requis avant le premier P0
4. Extraction du constructeur d'actions quotidiennes : requise avant 2.1-UNIT-010

### Risques pour le plan

- **Risque :** les questions restent ouvertes et la fixture change en cours d'epic.
  - **Impact :** réécriture des tests de transitions.
  - **Contingence :** la fixture étant unique, seule elle change ; les tests sont pilotés par ses données.
- **Risque :** PGlite ne reproduit pas un comportement de Postgres de la plateforme (rôles, extensions).
  - **Impact :** faux positifs en PR.
  - **Contingence :** les scénarios qui dépendent des rôles réels sont en pgTAP.

---

## Interfonctionnement et régression

| Service / composant | Impact | Périmètre de régression |
| --- | --- | --- |
| `supabase/functions/generate-daily-actions/index.ts` | Deux catégories nouvelles ; extraction d'une partie de la construction | Les catégories existantes restent produites à l'identique ; les catégories « strictAssigned » existantes (`articles_relire`, `commentaires_contenu`) ne changent pas |
| `supabase/functions/_shared/daily-data-fetchers.ts` | Nouveau fetcher des groupes en attente et refusés | Tests `_shared` existants verts |
| Epic 1 (calendrier, composeur, glisser-déposer) | Le trigger de garde s'ajoute sur la table des posts ; l'échelle passe à cinq statuts | Tests de l'Epic 1 verts ; ceux qui attendaient « Programmé » pour un post daté non approuvé sont mis à jour (R-016) |
| `src/hooks/useAutoSaveForm.ts` | Écritures répétées sur un post approuvé | 2.3-SQL-006 ; tests existants de `useAutoSaveForm` verts |
| `src/components/AppSidebar.tsx` | Badge de compteur | Menu inchangé pour un compte sans `supertilt_fr` |
| `supabase/functions/mcp-server/index.ts` | Aucun changement dans l'Epic 2 | Le contrat de la fonction (2.1-SQL-008) sert de base au plan de l'Epic 4 |
| Sauvegarde | Nouvelles tables (historique, commentaires) | Contrôle [038] de `scripts/check-rules.sh` (`scripts/check-backup-tables.sh`) |
| Mode démo | Nouveaux écrans | Ratchet [065] de `scripts/check-rules.sh`, 2.5-E2E-001 |

---

## Suites (manuelles)

- `bmad-testarch-atdd` pour écrire les P0 en échec avant le code de la story 2.1 (workflow séparé, non lancé automatiquement).
- `bmad-testarch-automate` une fois le module en place, pour étendre la couverture.

---

## Approbation

- [ ] Product manager : Romain, date :
- [ ] Tech lead : Romain, date :
- [ ] Recette métier : Emmanuelle, date :

**Commentaires :**

---

## Annexe

### Références de la base de connaissances

- `risk-governance.md` : classification et gouvernance des risques
- `probability-impact.md` : notation et seuils (DOCUMENT, MONITOR, MITIGATE, BLOCK)
- `test-levels-framework.md` : choix des niveaux, garde anti-doublon
- `test-priorities-matrix.md` : critères P0 à P3

### Documents liés

- Epics : `_bmad-output/planning-artifacts/epics-contenus-sociaux.md` (Epic 2, critères communs, FR, NFR, AD-11)
- Spec : `_bmad-output/specs/spec-contenus-sociaux/SPEC.md`, `statuts-et-validation.md`, `brownfield.md`
- Architecture : `_bmad-output/planning-artifacts/architecture/architecture-super-tools-2026-09-24/ARCHITECTURE-SPINE.md` (AD-1, AD-5, AD-9, AD-11, AD-14)
- Contexte de test : `_bmad-output/test-artifacts/test-design-progress.md`

---

**Généré par :** BMad TEA Agent, module Test Architect
**Workflow :** `bmad-testarch-test-design`
**Version :** 4.0 (BMad v6)
