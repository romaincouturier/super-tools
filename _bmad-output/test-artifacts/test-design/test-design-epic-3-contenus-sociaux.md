---
stepsCompleted: ['step-01-detect-mode', 'step-02-load-context', 'step-03-risk-and-testability', 'step-04-coverage-plan', 'step-05-generate-output']
lastStep: 'step-05-generate-output'
lastSaved: '2026-11-05'
---

# Test Design : Epic 3 - Piloter par campagnes et par vues (Contenus sociaux)

**Date :** 2026-11-05
**Auteur :** architecte de test (BMAD TEA), pour Romain
**Statut :** Brouillon

---

## Synthèse

**Périmètre :** plan de test de niveau epic pour l'Epic 3 du module Contenus sociaux (stories 3.1 à 3.6 ; FR17, FR18, FR23, FR24, FR30 ; UX-DR2, UX-DR6, UX-DR9), plus les critères communs de l'Overview qui s'appliquent aux nouvelles tables et aux nouveaux écrans.

**Risques :**

- Risques identifiés : 18
- Risques élevés (score ≥ 6) : 6 ; aucun risque de score 9
- Catégories critiques : SEC (RLS des vues enregistrées et des campagnes), DATA (échange de dates dans la grille Instagram), BUS (bandeaux de campagne, filtres combinés, périmètre de l'échange sur un groupe)

**Couverture :**

- Scénarios P0 : 8 (~16 à 24 h)
- Scénarios P1 : 33 (~25 à 40 h)
- Scénarios P2 et P3 : 20 + 3 (~9 à 17 h)
- **Effort total** : ~50 à 81 h, soit ~1,5 à 2,5 semaines pour une personne

**Point relevé dans le code existant :** `has_module_access` (`supabase/migrations/20261103100000_supertilt_fr_module.sql`) renvoie vrai pour tout utilisateur dont l'e-mail est `romain@supertilt.fr`, même sans ligne dans `user_module_access`. Une policy de vues enregistrées fondée sur le seul droit de module exposerait donc les vues personnelles d'Emmanuelle à Romain. La visibilité personnelle doit reposer sur le propriétaire (`auth.uid()`), et les tests pgTAP doivent reproduire ce cas (R-001).

---

## Hors périmètre

| Élément | Raison | Traitement du risque |
| --- | --- | --- |
| Circuit de validation (transitions, remise en attente, Mes validations) | Livré et testé par l'Epic 2 | L'Epic 3 vérifie seulement que l'aperçu et l'échange de dates passent par la fonction de transition de l'Epic 2 (3.4-COMP-003, 3.6-SQL-003) |
| Calendrier, composeur, alertes, filtres par pastilles thème, réseau et statut | Livrés par l'Epic 1 (stories 1.2 à 1.4) | Le prédicat de filtre étendu en 3.3 garde ses tests de l'Epic 1 en régression ; aucun scénario n'est dupliqué ici |
| Outils MCP sur les campagnes et les vues | Epic 4 ; le MCP ne gère ni campagnes ni vues dans les FR27 à FR29 | Aucun |
| Publication native, statistiques par post | Non-goals de la spec | Aucun |
| Fidélité pixel du rendu réseau (aperçu) | Approximation assumée, pas de référence officielle versionnée | Revue visuelle manuelle à la recette ; risque R-017 en surveillance |
| Charge et performance | Deux utilisateurs, quelques centaines de posts par an | R-016 en surveillance, aucun test de charge |

---

## Évaluation des risques

Méthode : `risk-governance.md` et `probability-impact.md`. Probabilité et impact de 1 à 3, score = P × I. Score 6 à 8 : atténuation obligatoire avant la mise en production (statut CONCERNS au gate tant qu'elle manque). Score 9 : blocage. Score 4 à 5 : surveillance. Score 1 à 3 : documentation.

### Risques élevés (score ≥ 6)

| ID | Catégorie | Description | P | I | Score | Atténuation | Responsable | Échéance |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | SEC | Vues enregistrées : une vue personnelle est lue par l'autre membre, ou une vue partagée est modifiée ou supprimée par un non-auteur. Aggravé par `has_module_access`, qui laisse passer Romain par son e-mail | 2 | 3 | 6 | Policies `SELECT` sur `owner_id = auth.uid() OR (shared AND has_module_access(...))`, `UPDATE`/`DELETE` sur `owner_id = auth.uid()`, `WITH CHECK` sur le propriétaire ; tests pgTAP 3.5-PGTAP-001 à 005 | Dev story 3.5 | Avant merge de la story 3.5 |
| R-002 | SEC | Table des campagnes sans RLS effective, ou policy recopiée au lieu de `has_module_access(uid, 'supertilt_fr')` : un compte staff d'un autre module lit les briefs | 2 | 3 | 6 | Policy unique par `has_module_access` (AD-1) ; tests pgTAP 3.1-PGTAP-001 à 004 sur les rôles réels | Dev story 3.1 | Avant merge de la story 3.1 |
| R-003 | DATA | Échange de dates dans la grille Instagram fait en deux écritures depuis le navigateur : échange partiel en cas d'échec, post publié déplacé, ou approbation perdue si l'écriture passe par le chemin de modification du fond | 2 | 3 | 6 | Une fonction SQL d'échange à créer (`SECURITY DEFINER`, une transaction, contrôle du droit, refus des posts publiés, écriture des seules colonnes de date) ; tests 3.6-SQL-001 à 005 | Dev story 3.6 | Avant merge de la story 3.6 |
| R-004 | BUS | Périmètre de l'échange non spécifié pour un post Instagram qui appartient à un groupe multi-canaux : la story ne dit pas si les déclinaisons LinkedIn ou Facebook suivent | 3 | 2 | 6 | Décision de Romain avant développement, alignée sur la règle de déplacement d'un post daté de la story 1.2 ; test 3.6-SQL-006 écrit après la décision | Romain (décision), Dev story 3.6 | Avant le début de la story 3.6 |
| R-005 | BUS | Bandeaux de campagne posés sur les mauvais jours : date de fin exclue, campagne à cheval sur deux mois absente des jours hors mois ou du mois suivant, décalage d'un jour par conversion `Date` en UTC, campagne sans date affichée | 3 | 2 | 6 | Calcul des jours couverts dans une fonction pure à créer qui manipule des chaînes `YYYY-MM-DD` (date-fns, sans `new Date(chaîne)`), partagée par vues mois, semaine et calendrier de campagne ; tests 3.2-UNIT-001 à 006 | Dev story 3.2 | Avant merge de la story 3.2 |
| R-006 | BUS | Filtres combinés incohérents : logique OU entre familles au lieu de ET, filtre sur l'échelle affichée au lieu des axes stockés (un post « Programmé » approuvé exclu du filtre validation = approuvé), résultats différents entre liste, calendrier, Non planifiés et aperçus | 3 | 2 | 6 | Un seul prédicat pur à créer, extension de celui de la story 1.4, appelé par toutes les vues ; filtres validation et publication sur les axes stockés ; tests 3.3-UNIT-001 à 008 et 3.3-COMP-002 | Dev story 3.3 | Avant merge de la story 3.3 |

### Risques moyens (score 3 à 4)

| ID | Catégorie | Description | P | I | Score | Atténuation | Responsable |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-007 | DATA | Campagne stockée par post et non par groupe : deux déclinaisons d'un même contenu sur deux campagnes, ou un post sur deux campagnes | 2 | 2 | 4 | Campagne portée par le groupe, ou trigger qui l'impose à toutes les déclinaisons ; 3.2-SQL-001 et 002 | Dev story 3.2 |
| R-008 | TECH | Vue enregistrée qui référence un thème, une campagne ou un canal supprimé, ou dont le format de filtres a évolué : écran en erreur ou liste vide sans explication | 2 | 2 | 4 | Format de filtres versionné, désérialisation tolérante ; 3.5-UNIT-001 et 002 | Dev story 3.5 |
| R-009 | DATA | Ordre de la grille Instagram faux : posts à venir mêlés aux publiés, ordre inversé, posts sans date inclus | 2 | 2 | 4 | Fonction pure d'ordonnancement à créer ; 3.6-UNIT-001 à 003 | Dev story 3.6 |
| R-010 | SEC | Brief en texte riche (TipTap) rendu sans assainissement : HTML stocké exécuté dans l'écran | 2 | 2 | 4 | Rendu via DOMPurify (dépendance déjà présente) ; 3.1-UNIT-001 | Dev story 3.1 |
| R-011 | OPS | Nouveaux écrans (liste et fiche campagne, liste, aperçus, grille) qui affichent un nom d'auteur ou de compte sans masque `demoMask` | 2 | 2 | 4 | Ratchet [065] dans `check-rules.sh` et scan `e2e/demo-scan/` ; 3-E2E-001 | Dev de chaque story |
| R-013 | SEC | Gestes de validation de l'onglet Aperçus qui écrivent le statut en direct au lieu d'appeler la fonction de transition de l'Epic 2 (AD-11) | 1 | 3 | 3 | Réutiliser le hook de l'Epic 2 ; 3.4-COMP-003 | Dev story 3.4 |
| R-014 | DATA | Clé étrangère post vers campagne en `ON DELETE CASCADE` : supprimer une campagne supprime ses posts | 1 | 3 | 3 | `ON DELETE SET NULL` ; 3.2-SQL-003 | Dev story 3.2 |

### Risques faibles (score 1 à 2)

| ID | Catégorie | Description | P | I | Score | Action |
| --- | --- | --- | --- | --- | --- | --- |
| R-012 | BUS | Post composé depuis la fiche campagne non rattaché à la campagne | 1 | 2 | 2 | 3.2-COMP-002 |
| R-015 | OPS | Nouvelle table absente de `TABLES_TO_BACKUP` (`backup-export`, `scheduled-backup`) | 1 | 2 | 2 | `scripts/check-backup-tables.sh`, appelé par `check-rules.sh` |
| R-016 | PERF | Filtrage et recherche plein texte côté client lents sur l'historique | 1 | 2 | 2 | Surveillance ; volume faible |
| R-017 | BUS | Aperçu réseau infidèle au rendu réel (troncature, proportions) | 2 | 1 | 2 | Revue visuelle à la recette ; 3.4-UNIT-001 |
| R-018 | OPS | Migration de l'epic non jouée en production, ou `types.ts` non régénéré après la migration | 1 | 2 | 2 | Geste explicite (AD-8), mentionné dans la PR |

### Légende des catégories

- **TECH** : architecture, intégration
- **SEC** : sécurité, contrôle d'accès, exposition de données
- **PERF** : performance
- **DATA** : intégrité des données
- **BUS** : impact métier, logique, expérience
- **OPS** : déploiement, configuration, exploitation

### Risque résiduel

- R-001, R-002 : nul sur le comportement des policies une fois les pgTAP verts ; reste la dérive d'une policy modifiée plus tard sans toucher aux tests, couverte par le workflow `RLS tests` qui rejoue toutes les migrations.
- R-003 : faible ; un double clic qui lance deux échanges successifs ramène les dates d'origine, ce qui est visible et réversible.
- R-004 : nul après décision ; sans décision, la story 3.6 ne démarre pas.
- R-005, R-006 : faible ; les cas limites non listés (années bissextiles, campagne de plus d'un mois) sont couverts par la logique de chaînes de dates, sans test dédié.

---

## Niveaux de test

| Niveau | Outil existant | Usage dans cet epic |
| --- | --- | --- |
| Unit | Vitest (`npm test`, `TZ=UTC`), style de `src/lib/navUsage.test.ts` | Fonctions pures à créer dans `src/lib/` : jours couverts par une campagne, prédicat de filtres, sérialisation des vues, ordre de la grille, assainissement du brief |
| SQL-PGlite | Vitest + PGlite, `supabase/tests/helpers/db.ts` (`createTestDb`, `loadFunctions`, `actAs`), ou exécution du fichier de migration comme `supabase/tests/watch-sources.test.ts` | Contraintes, clés étrangères, trigger ou fonction de rattachement au groupe, fonction d'échange de dates. Le superutilisateur PGlite contourne la RLS : aucun test de policy à ce niveau |
| pgTAP | `supabase/tests/*.test.sql`, workflow `rls-tests.yml`, modèle `rls_learner_isolation.test.sql` | Comportement des policies RLS des campagnes et des vues enregistrées, sous les rôles `authenticated` et `anon` |
| Component | Vitest + Testing Library (jsdom, `src/test/setup.ts`), hooks mockés | Écrans : formulaire campagne, bandeau, liste, aperçus, vues, grille et son glisser-déposer (`@dnd-kit`, déjà en dépendance) |
| E2E | Playwright : `e2e/demo-scan/` (faux Supabase) et `playwright.config.ts` du smoke (`e2e/smoke.spec.ts`) | Scan du mode démo des nouvelles routes ; un parcours authentifié, dont le harnais est à créer |

Règle anti-doublon : un comportement est testé au niveau le plus bas qui le prouve. La logique (jours couverts, ET des filtres, ordre) est en Unit ; l'écran ne vérifie que le branchement (bon helper appelé, bon rendu). L'intégrité (atomicité, approbation conservée) est en SQL-PGlite ; la RLS est en pgTAP seulement.

---

## Critères d'entrée

- [ ] Epics 1 et 2 livrés : tables des posts, groupes et canaux, prédicat de filtres de la story 1.4, helper d'alertes de la story 1.3, fonction de transition et historique de l'Epic 2
- [ ] Décisions prises sur les questions ouvertes Q1 à Q4 (section Hypothèses)
- [ ] Migration de l'epic disponible dans `supabase/migrations/` pour PGlite et pgTAP
- [ ] Jeu de données pgTAP : Romain (`romain@supertilt.fr`, sans ligne `user_module_access`), Emmanuelle (ligne `supertilt_fr`), un staff d'un autre module, un appelant anonyme
- [ ] Fabriques de test (à créer) : campagne datée, campagne sans date, groupe multi-canaux, post Instagram programmé, publié, sans visuel
- [ ] `supabase db start` fonctionnel en local pour les pgTAP

## Critères de sortie

- [ ] Tous les P0 passent
- [ ] P1 à 95 % au moins, échecs triés avec dérogation datée
- [ ] Aucun bug ouvert de sévérité haute sur les risques R-001 à R-006
- [ ] Chaque critère d'acceptation des stories 3.1 à 3.6 est relié à au moins un scénario (matrice ci-dessous)
- [ ] Scan du mode démo sans fuite sur les nouvelles routes ; ratchet [065] non augmenté
- [ ] `npm run typecheck`, `bash scripts/check-rules.sh`, `npm test` verts

---

## Plan de couverture

**Note :** P0 à P3 expriment la priorité et le risque, pas le moment d'exécution. Le moment d'exécution est fixé dans la section Stratégie d'exécution.

Identifiants : `{epic}.{story}-{NIVEAU}-{numéro}` ; `3-E2E-xxx` pour les scénarios transverses. Responsable : Dev de la story, sauf mention.

### P0 (critique)

**Critères :** bloque le cœur du module, lié à un risque ≥ 6, sans contournement.

| ID | Story, critère | Scénario | Niveau | Risque |
| --- | --- | --- | --- | --- |
| 3.1-PGTAP-001 | 3.1, RLS `supertilt_fr` | Un staff sans `supertilt_fr` lit 0 campagne | pgTAP | R-002 |
| 3.1-PGTAP-002 | 3.1, RLS `supertilt_fr` | Un staff sans `supertilt_fr` ne peut ni créer, ni modifier, ni supprimer une campagne | pgTAP | R-002 |
| 3.5-PGTAP-001 | 3.5, vue personnelle | Une vue personnelle d'Emmanuelle est invisible pour Romain, alors que `has_module_access` le laisse passer par son e-mail ; et inversement | pgTAP | R-001 |
| 3.5-PGTAP-002 | 3.5, auteur seul renomme ou supprime | L'autre membre ne peut ni modifier ni supprimer une vue partagée dont il n'est pas l'auteur | pgTAP | R-001 |
| 3.6-SQL-001 | 3.6, échange des dates | Deux posts Instagram à venir échangent date et heure en un seul appel ; un échec au milieu laisse les deux posts inchangés | SQL-PGlite | R-003 |
| 3.6-SQL-002 | 3.6, publiés immobiles | Un échange qui implique un post marqué publié est refusé et ne modifie aucun des deux posts | SQL-PGlite | R-003 |
| 3.6-SQL-003 | 3.6, approbation conservée | Deux posts approuvés le restent après l'échange ; l'axe validation n'est pas réécrit | SQL-PGlite | R-003 |
| 3.6-SQL-004 | 3.6, droit `supertilt_fr` | La fonction d'échange (`SECURITY DEFINER`) refuse un appelant sans `supertilt_fr` | SQL-PGlite | R-003 |

**Total P0 :** 8 scénarios, ~16 à 24 h. Part du total : 12,5 %, au-dessus des 10 % indicatifs parce que l'epic introduit deux tables RLS et une écriture à double cible ; chaque P0 reste un contrôle de sécurité ou d'intégrité.

### P1 (haute)

**Critères :** parcours courant, logique complexe ou risque moyen, ou contrôle direct d'un risque ≥ 6 dont l'échec a un contournement.

| ID | Story, critère | Scénario | Niveau | Risque |
| --- | --- | --- | --- | --- |
| 3.1-PGTAP-003 | 3.1, RLS | Emmanuelle (ligne `supertilt_fr`) crée, lit, modifie et supprime une campagne | pgTAP | R-002 |
| 3.1-PGTAP-004 | 3.1, RLS | Un appelant `anon` ne lit aucune campagne | pgTAP | R-002 |
| 3.1-SQL-001 | 3.1, champs | Statut par défaut « préparation » ; seules les valeurs préparation, active, terminée sont acceptées ; dates nulles acceptées ; fin antérieure au début refusée | SQL-PGlite | - |
| 3.1-UNIT-001 | 3.1, brief texte riche | Le rendu du brief retire `<script>`, les attributs `on*` et les URL `javascript:` | Unit | R-010 |
| 3.1-COMP-001 | 3.1, création | Le formulaire propose icône, couleur, nom, statut (préparation présélectionné), dates facultatives, liens, brief ; l'enregistrement appelle le hook de création | Component | - |
| 3.2-SQL-001 | 3.2, une seule campagne | Rattacher une campagne à une déclinaison la rattache à tout le groupe | SQL-PGlite | R-007 |
| 3.2-SQL-002 | 3.2, une seule campagne | Choisir une autre campagne remplace la précédente sur tout le groupe ; aucun post ne porte deux campagnes | SQL-PGlite | R-007 |
| 3.2-SQL-003 | 3.2, intégrité | Supprimer une campagne conserve ses posts, dont la campagne devient nulle | SQL-PGlite | R-014 |
| 3.2-UNIT-001 | 3.2, bandeau jours couverts | Campagne du 10 au 12 : bandeau sur les 10, 11 et 12, date de fin incluse, rien le 9 ni le 13 | Unit | R-005 |
| 3.2-UNIT-002 | 3.2, bandeau à cheval | Campagne du 28 novembre au 3 décembre : en vue novembre, bandeau du 28 au 30 et sur les jours de décembre affichés hors mois ; en vue décembre, du 1er au 3 et sur les jours de novembre affichés hors mois | Unit | R-005 |
| 3.2-UNIT-003 | 3.2, campagne datée seulement | Campagne sans aucune date : aucun bandeau, ni en vue mois ni en vue semaine | Unit | R-005 |
| 3.2-UNIT-006 | 3.2, jours couverts | Les jours sont calculés sur des chaînes `YYYY-MM-DD` : fin le 30 novembre et période qui traverse le passage à l'heure d'hiver (25 octobre 2026) sans décalage d'un jour | Unit | R-005 |
| 3.2-COMP-002 | 3.2, bouton Composer | « Composer » depuis la fiche ouvre le composeur avec la campagne présélectionnée ; l'enregistrement transmet la campagne au service | Component | R-012 |
| 3.3-UNIT-001 | 3.3, tous les filtres | ET entre familles : un post qui correspond au thème et au canal mais pas à la validation est exclu | Unit | R-006 |
| 3.3-UNIT-002 | 3.3, tous les filtres | OU au sein d'une famille : deux canaux sélectionnés gardent les posts de l'un ou de l'autre (hypothèse Q5) | Unit | R-006 |
| 3.3-UNIT-003 | 3.3, axes séparés | Validation = approuvé garde les posts approuvés affichés « Approuvé », « Programmé » et « Publié » | Unit | R-006 |
| 3.3-UNIT-004 | 3.3, axes séparés | Publication = marqué publié garde un post publié non approuvé ; validation = en attente ET publication = programmé ne garde que leur intersection | Unit | R-006 |
| 3.3-COMP-001 | 3.3, tableau | La liste affiche statut affiché, date et heure, canaux, thème, campagne, auteur, début du texte, alertes, nombre de commentaires, triée par date | Component | - |
| 3.3-COMP-002 | 3.3, liste et calendrier | Un même état de filtres est appliqué à la liste, au calendrier et à la colonne Non planifiés ; changer d'onglet le conserve | Component | R-006 |
| 3.4-COMP-003 | 3.4, gestes de validation | Approuver ou refuser depuis Aperçus appelle le hook de transition de l'Epic 2 ; aucun appel d'écriture directe du statut | Component | R-013 |
| 3.5-PGTAP-003 | 3.5, RLS | Un staff sans `supertilt_fr` ne lit aucune vue, même partagée | pgTAP | R-001 |
| 3.5-PGTAP-004 | 3.5, partage | Une vue partagée par Emmanuelle est lisible par Romain, et inversement | pgTAP | R-001 |
| 3.5-PGTAP-005 | 3.5, propriétaire | Créer une vue au nom d'un autre propriétaire est refusé (`WITH CHECK`) | pgTAP | R-001 |
| 3.5-UNIT-001 | 3.5, réappliquer les filtres | Sérialiser puis relire une combinaison complète de filtres (8 familles) rend la même combinaison | Unit | R-008 |
| 3.5-UNIT-002 | 3.5, réappliquer les filtres | Une vue qui référence un thème, une campagne ou un canal supprimé se relit sans erreur, la valeur disparue est ignorée | Unit | R-008 |
| 3.5-COMP-001 | 3.5, enregistrer | Enregistrer les filtres actifs sous un nom ajoute la vue à la liste « Vue enregistrée » | Component | - |
| 3.5-COMP-002 | 3.5, sélectionner | Sélectionner une vue réapplique tous ses filtres, en calendrier comme en liste | Component | R-006 |
| 3.6-UNIT-001 | 3.6, ordre du profil | Posts à venir en tête, du plus lointain au plus proche, puis publiés du plus récent au plus ancien | Unit | R-009 |
| 3.6-SQL-005 | 3.6, traçabilité | L'échange écrit deux entrées d'historique « changement de date » avec la date précédente (story 2.3) | SQL-PGlite | R-003 |
| 3.6-SQL-006 | 3.6, groupe | L'échange applique au groupe la règle décidée en Q1 (déclinaison Instagram seule ou tout le groupe) | SQL-PGlite | R-004 |
| 3.6-COMP-001 | 3.6, grille | Trois cases carrées par ligne ; un post sans visuel est une case vide avec l'alerte « visuel manquant » du helper de la story 1.3 | Component | R-009 |
| 3.6-COMP-002 | 3.6, glisser-déposer | Déposer une case à venir sur une autre (capteur clavier de dnd-kit) appelle l'échange avec les deux identifiants ; une case publiée n'est ni déplaçable ni cible | Component | R-003 |
| 3-E2E-001 | Critères communs, mode démo | Le scan démo couvre les nouvelles routes (liste et fiche campagne, liste, aperçus, grille) sans donnée canari visible | E2E (demo-scan) | R-011 |

**Total P1 :** 33 scénarios, ~25 à 40 h.

### P2 (moyenne)

**Critères :** fonction secondaire, cas limite, risque faible.

| ID | Story, critère | Scénario | Niveau | Risque |
| --- | --- | --- | --- | --- |
| 3.1-UNIT-002 | 3.1, onglets de liste | Répartition des campagnes entre Toutes, Actives, En préparation, Terminées | Unit | - |
| 3.1-COMP-002 | 3.1, Vue d'ensemble | Modifier un champ de la fiche le persiste via le hook | Component | - |
| 3.2-UNIT-004 | 3.2, dates facultatives | Campagne avec une seule date (début ou fin) : bandeau selon la règle décidée en Q2 | Unit | R-005 |
| 3.2-UNIT-005 | 3.2, bandeau | Deux campagnes le même jour : bandeaux empilés dans un ordre stable (date de début, puis nom) | Unit | R-005 |
| 3.2-COMP-001 | 3.2, UX-DR6 | Le bandeau montre chevron et nom tronqué au-dessus des cartes ; le nom complet reste accessible (titre ou libellé) | Component | - |
| 3.2-COMP-003 | 3.2, calendrier de campagne | L'onglet Calendrier de la fiche passe le filtre campagne au calendrier | Component | - |
| 3.2-COMP-004 | 3.2, onglet Médias | L'onglet Médias liste une fois chaque visuel de la Médiathèque utilisé par les contenus de la campagne | Component | - |
| 3.2-COMP-005 | 3.2, une seule campagne | Le sélecteur de campagne du composeur et du détail est à valeur unique | Component | R-007 |
| 3.3-UNIT-005 | 3.3, validation | Validation = refusé garde les posts affichés « Brouillon » avec motif | Unit | - |
| 3.3-UNIT-006 | 3.3, période | Bornes de période incluses ; posts sans date exclus quand une période est active (hypothèse Q6) | Unit | R-006 |
| 3.3-UNIT-007 | 3.3, plein texte | Recherche insensible à la casse et aux accents (« creativite » trouve « Créativité ») | Unit | - |
| 3.3-UNIT-008 | 3.3, auteur et campagne | Filtres auteur et campagne isolés puis combinés | Unit | - |
| 3.4-COMP-001 | 3.4, rendu réseau | Chaque contenu est rendu avec visuel, texte et nom du compte de son canal | Component | R-017 |
| 3.4-COMP-002 | 3.4, ordinateur ou mobile | La bascule change le gabarit de rendu sans recharger les données | Component | - |
| 3.4-COMP-004 | 3.4, commentaires | Les commentaires du contenu sont affichés à côté de l'aperçu | Component | - |
| 3.4-COMP-005 | 3.4, filtres | Les filtres actifs réduisent les aperçus affichés | Component | R-006 |
| 3.5-COMP-003 | 3.5, partage, renommage | Partager, renommer et supprimer ne sont proposés qu'à l'auteur de la vue | Component | R-001 |
| 3.6-UNIT-002 | 3.6, périmètre | Grille limitée au canal Instagram ; posts sans date exclus ; un post daté dans le passé non marqué publié reste « à venir » (hypothèse Q4) | Unit | R-009 |
| 3.6-COMP-003 | 3.6, détail | Un clic sur une case ouvre le détail du contenu | Component | - |
| 3-E2E-002 | 3.1, 3.2, 3.3 | Parcours authentifié : créer une campagne datée, composer depuis la fiche, voir le bandeau au calendrier, filtrer la liste sur la campagne | E2E (harnais à créer) | R-005, R-006 |

**Total P2 :** 20 scénarios, ~8 à 14 h, hors harnais E2E authentifié (voir Prérequis).

### P3 (basse)

**Critères :** confort, exploratoire.

| ID | Story, critère | Scénario | Niveau |
| --- | --- | --- | --- |
| 3.3-COMP-003 | 3.3 | Liste vide sous filtres : message explicite et bouton de réinitialisation | Component |
| 3.4-UNIT-001 | 3.4 | Troncature « voir plus » à la longueur fixée par canal dans la story | Unit |
| 3.6-UNIT-003 | 3.6 | Deux posts à la même date et heure : ordre stable | Unit |

**Total P3 :** 3 scénarios, ~1 à 3 h.

### Traçabilité des critères d'acceptation

| Story | Critères d'acceptation | Scénarios | Unit | SQL-PGlite | pgTAP | Component | E2E |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3.1 Campagne et brief | Création, champs, onglets de liste ; fiche Vue d'ensemble ; RLS et sauvegarde | 9 | 2 | 1 | 4 | 2 | 0 |
| 3.2 Rattachement et bandeau | Une seule campagne par groupe ; bandeau sur jours couverts ; calendrier, Médias, Composer | 14 | 6 | 3 | 0 | 5 | 0 |
| 3.3 Liste et filtres | Tableau ; filtres combinés ET ; validation et publication séparées | 11 | 8 | 0 | 0 | 3 | 0 |
| 3.4 Aperçu réseau | Rendu par réseau, ordinateur ou mobile ; commentaires et gestes ; filtres | 6 | 1 | 0 | 0 | 5 | 0 |
| 3.5 Vues enregistrées | Enregistrer, réappliquer ; partager ou garder personnel ; renommer, supprimer | 10 | 2 | 0 | 5 | 3 | 0 |
| 3.6 Grille Instagram | Ordre, trois par ligne, case vide ; clic ; échange des dates, publiés immobiles, approbation conservée | 12 | 3 | 6 | 0 | 3 | 0 |
| Transverse | Mode démo ; parcours de bout en bout | 2 | 0 | 0 | 0 | 0 | 2 |
| **Total** | | **64** | **22** | **10** | **9** | **21** | **2** |

La présence des nouvelles tables dans les listes de sauvegarde (critère commun) et l'absence de `supabase.from()` dans les composants (AD-5) sont des contrôles de dépôt (`scripts/check-backup-tables.sh`, `scripts/check-rules.sh`), comptés comme portes de qualité et non comme scénarios.

---

## Stratégie d'exécution

Principe : tout tourne dans la PR tant que l'ensemble reste sous 15 minutes ; seul ce qui demande une infrastructure lourde est différé. Les suites Playwright se parallélisent (des centaines de tests en 10 à 15 minutes), ce n'est donc pas leur nombre qui justifie un report.

| Moment | Contenu | Support |
| --- | --- | --- |
| Chaque PR | Unit, SQL-PGlite et Component (`npm test`), `npm run typecheck`, `bash scripts/check-rules.sh` (ratchet [065], listes de sauvegarde) | `.github/workflows/ci.yml` |
| Chaque PR qui touche `supabase/migrations/` ou `supabase/tests/` | pgTAP (RLS campagnes et vues) | `.github/workflows/rls-tests.yml` |
| Chaque PR | Smoke Playwright existant (`npm run test:e2e`) | `ci.yml` |
| Nuit | 3-E2E-002, une fois le harnais authentifié créé, s'il exige une base Supabase peuplée ; sinon en PR | Workflow à créer |
| Semaine | Scan du mode démo 3-E2E-001 (lundi), et à la main avant le merge d'une story qui ajoute un écran | `.github/workflows/demo-scan.yml` (`workflow_dispatch`) |

---

## Estimation

| Priorité | Scénarios | Effort | Remarque |
| --- | --- | --- | --- |
| P0 | 8 | ~16 à 24 h | Jeu de données pgTAP à quatre identités, fonction d'échange avec cas d'échec |
| P1 | 33 | ~25 à 40 h | Fabriques partagées, tests de composants avec hooks mockés |
| P2 | 20 | ~8 à 14 h | Hors harnais E2E authentifié |
| P3 | 3 | ~1 à 3 h | |
| **Total** | **64** | **~50 à 81 h** | **~1,5 à 2,5 semaines** |

L'estimation inclut la mise en place des fabriques et du jeu pgTAP. Elle exclut le harnais E2E authentifié (comptes de test, base peuplée), absent du dépôt et à chiffrer à part (~1 à 3 jours), qui servira aussi aux autres epics.

### Prérequis

**Données de test :**

- Fabriques à créer : campagne (datée, sans date, à cheval sur deux mois), groupe multi-canaux avec déclinaison Instagram, post programmé, publié, approuvé, sans visuel, vue enregistrée personnelle et partagée
- Jeu pgTAP : quatre identités (Romain par e-mail seul, Emmanuelle avec `supertilt_fr`, staff d'un autre module, `anon`) ; grants posés dans la transaction comme dans `rls_learner_isolation.test.sql`

**Outillage :**

- Vitest et Testing Library pour Unit et Component ; capteur clavier de `@dnd-kit` pour le glisser-déposer en jsdom
- PGlite pour les fonctions et contraintes ; extension de schéma propre au test si `helpers/db.ts` ne suffit pas (le modèle `watch-sources.test.ts` exécute directement le fichier de migration)
- pgTAP via `supabase db start` puis `supabase test db`
- Faux Supabase de `e2e/demo-scan/fakeBackend.ts` pour le scan démo ; vérifier que les nouvelles tables y sont servies

**Environnement :**

- Node 20, `npm ci` ; Supabase CLI pour les pgTAP

---

## Portes de qualité

### Seuils

- **P0 :** 100 %, sans exception
- **P1 :** 95 % au moins, dérogation datée et signée pour chaque échec
- **P2 et P3 :** 90 % au moins, informatif
- **Risques ≥ 6 :** R-001 à R-006 atténués et vérifiés, ou dérogation acceptée par Romain

### Couverture

- **Critères d'acceptation :** 100 % des critères des stories 3.1 à 3.6 reliés à un scénario
- **Sécurité (SEC) :** 100 % des scénarios pgTAP et du contrôle de droit de la fonction d'échange verts
- **Logique pure nouvelle** (jours couverts, prédicat de filtres, sérialisation des vues, ordre de la grille) : 80 % de lignes au moins, mesuré avec `@vitest/coverage-v8` (déjà en dépendance)
- **Cas limites :** 50 % au moins des cas listés en P2 et P3

### Exigences non négociables

- [ ] Tous les P0 passent
- [ ] Aucun risque ≥ 6 sans atténuation
- [ ] pgTAP RLS des campagnes et des vues verts
- [ ] Ratchet [065] non augmenté, scan démo propre sur les nouvelles routes
- [ ] `check-backup-tables.sh` vert avec les nouvelles tables

---

## Plans d'atténuation

### R-001 : visibilité et écriture des vues enregistrées (score 6)

**Stratégie :**
1. Colonne propriétaire renseignée par défaut à `auth.uid()`, et booléen de partage.
2. `SELECT` : `owner_id = auth.uid() OR (shared AND has_module_access(auth.uid(), 'supertilt_fr'))`, avec une garde de module sur la première branche aussi.
3. `UPDATE` et `DELETE` : `owner_id = auth.uid()` ; `INSERT ... WITH CHECK (owner_id = auth.uid())`.
4. Ne jamais fonder la visibilité personnelle sur `has_module_access`, qui accepte Romain par son e-mail.

**Responsable :** Dev story 3.5
**Échéance :** avant merge de la story 3.5
**Statut :** prévu
**Vérification :** 3.5-PGTAP-001 à 005 verts, dont le cas Romain sans ligne `user_module_access`

### R-002 : RLS des campagnes (score 6)

**Stratégie :**
1. RLS activée à la création de la table, policies par `has_module_access(auth.uid(), 'supertilt_fr')` ou `is_admin`, sans logique recopiée (AD-1).
2. Aucune policy ouverte à `anon` (règle [009] de `check-rules.sh`).
3. Table ajoutée à `TABLES_TO_BACKUP` dans `backup-export` et `scheduled-backup`.

**Responsable :** Dev story 3.1
**Échéance :** avant merge de la story 3.1
**Statut :** prévu
**Vérification :** 3.1-PGTAP-001 à 004 verts ; `check-backup-tables.sh` vert

### R-003 : échange de dates dans la grille (score 6)

**Stratégie :**
1. Fonction SQL d'échange à créer, `SECURITY DEFINER`, qui vérifie `has_module_access` de l'appelant.
2. Verrouillage des deux lignes, refus si l'une est marquée publiée, échange des seules colonnes de date et d'heure dans la même transaction.
3. Aucune écriture de l'axe validation ; l'historique trace deux changements de date, conformément à la règle « changement de date seul : approbation conservée ».
4. Le navigateur appelle cette fonction par un service, jamais deux `update`.

**Responsable :** Dev story 3.6
**Échéance :** avant merge de la story 3.6
**Statut :** prévu
**Vérification :** 3.6-SQL-001 à 005 verts ; 3.6-COMP-002 vérifie l'appel unique

### R-004 : périmètre de l'échange sur un groupe (score 6)

**Stratégie :**
1. Romain tranche Q1 avant le développement de la story 3.6.
2. Proposition : appliquer la même règle que le déplacement d'un post daté dans le calendrier (story 1.2), pour qu'un même geste n'ait pas deux effets selon l'écran.
3. La décision est écrite dans la story 3.6 et codifiée par 3.6-SQL-006.

**Responsable :** Romain (décision), Dev story 3.6
**Échéance :** avant le début de la story 3.6
**Statut :** en attente de décision
**Vérification :** story 3.6 amendée ; 3.6-SQL-006 vert

### R-005 : jours couverts par les bandeaux (score 6)

**Stratégie :**
1. Fonction pure à créer dans `src/lib/`, qui reçoit les dates de campagne en `YYYY-MM-DD` et la liste des jours de la grille affichée (jours hors mois compris) et rend les bandeaux par jour.
2. Bornes incluses ; aucune conversion par `new Date(chaîne)`.
3. Même fonction pour la vue mois, la vue semaine et le calendrier de campagne.

**Responsable :** Dev story 3.2
**Échéance :** avant merge de la story 3.2
**Statut :** prévu
**Vérification :** 3.2-UNIT-001 à 006 verts

### R-006 : filtres combinés (score 6)

**Stratégie :**
1. Étendre le prédicat pur de la story 1.4 aux familles validation, publication, campagne, période, auteur et plein texte ; ET entre familles, OU au sein d'une famille.
2. Filtrer validation et publication sur les axes stockés, jamais sur l'échelle affichée.
3. Un état de filtres unique partagé par Calendrier, Non planifiés, Liste, Aperçus.

**Responsable :** Dev story 3.3
**Échéance :** avant merge de la story 3.3
**Statut :** prévu
**Vérification :** 3.3-UNIT-001 à 008 et 3.3-COMP-002 verts

---

## Hypothèses et dépendances

### Questions ouvertes (à trancher par Romain)

1. **Q1 :** l'échange de dates dans la grille Instagram s'applique-t-il à la seule déclinaison Instagram ou à tout son groupe ? Proposition : même règle que le déplacement d'un post daté (story 1.2).
2. **Q2 :** une campagne avec une seule date (début ou fin) a-t-elle un bandeau ? Proposition : aucun bandeau tant que la période n'est pas fermée ; la campagne reste visible dans sa fiche et la liste.
3. **Q3 :** une campagne « terminée » garde-t-elle son bandeau ? Proposition : oui, le bandeau dépend des dates seules.
4. **Q4 :** un post Instagram daté dans le passé et non marqué publié est-il « à venir » dans la grille, donc déplaçable ? Proposition : oui, « à venir » veut dire non marqué publié.

### Hypothèses

5. **Q5 :** au sein d'une même famille de filtres, plusieurs valeurs se combinent en OU ; entre familles, en ET (cohérent avec les pastilles de la story 1.4).
6. **Q6 :** un filtre de période exclut les posts sans date ; ils restent visibles dans Non planifiés si aucun filtre de période n'est actif.
7. Seul l'auteur d'une vue partagée la renomme ou la supprime (critère de la story 3.5) ; l'autre membre la lit et l'applique.
8. La campagne d'un contenu est une donnée du groupe, pas de la déclinaison.

### Dépendances

1. Epic 1 livré (posts, groupes, canaux, prédicat de filtres 1.4, helper d'alertes 1.3) : requis avant les stories 3.2, 3.3 et 3.6.
2. Epic 2 livré (fonction de transition, historique 2.3, commentaires 2.4) : requis avant les stories 3.4 et 3.6.
3. Harnais E2E authentifié (comptes de test, base peuplée) : requis pour 3-E2E-002, à créer.

### Risques pour le plan

- **Risque :** Q1 à Q4 non tranchées au démarrage des stories 3.2 et 3.6.
  - **Impact :** 3.2-UNIT-004 et 3.6-SQL-006 non écrits, R-004 ouvert.
  - **Contournement :** démarrer la story 3.6 par l'ordre et l'affichage de la grille, différer l'échange.
- **Risque :** pas de harnais E2E authentifié dans l'epic.
  - **Impact :** 3-E2E-002 non exécuté.
  - **Contournement :** la couverture Component et SQL suffit au gate ; 3-E2E-002 est P2 et n'est pas bloquant.

---

## Interactions et régression

| Composant | Impact | Périmètre de régression |
| --- | --- | --- |
| Prédicat de filtres de la story 1.4 | Étendu à de nouvelles familles | Ses tests de l'Epic 1 restent verts, notamment « famille vide = pas de filtre » |
| Fonction de transition et historique de l'Epic 2 | Appelés par l'aperçu et par l'échange de dates | Tests SQL de l'Epic 2 sur « changement de date seul : approbation conservée » |
| Calendrier mois et semaine (story 1.2) | Ajout des bandeaux au-dessus des cartes | Tests de composants de la story 1.2 (ordre horaire, jours hors mois) |
| Médiathèque (`media`, `src/pages/MediaLibrary.tsx`) | Lue par l'onglet Médias, sans écriture | Aucun changement attendu ; tests existants du module |
| `has_module_access` | Utilisée par les nouvelles policies, non modifiée | `supabase/tests/rls_learner_isolation.test.sql` |
| Sauvegardes (`backup-export`, `scheduled-backup`) | Deux tables ajoutées | `scripts/check-backup-tables.sh` |
| Scan démo (`e2e/demo-scan/`) | Nouvelles routes lues dans `src/App.tsx` | Rapport du scan sans régression sur les routes existantes |

---

## Suites (manuelles)

- `bmad-testarch-atdd` pour écrire les P0 en tests rouges, en commençant par 3.5-PGTAP-001 et 3.6-SQL-001 ; workflow distinct, non lancé ici.
- `bmad-testarch-automate` une fois les stories implémentées.

---

## Validation

**Plan approuvé par :**

- [ ] Romain (produit) Date :
- [ ] Responsable technique Date :
- [ ] Architecte de test Date :

---

## Annexe

### Références de la base de connaissances

- `risk-governance.md` : classification, seuils de mitigation
- `probability-impact.md` : échelle 1 à 3, score P × I
- `test-levels-framework.md` : choix des niveaux, garde anti-doublon
- `test-priorities-matrix.md` : critères P0 à P3

### Documents liés

- Epics : `_bmad-output/planning-artifacts/epics-contenus-sociaux.md` (Epic 3, critères communs, FR, NFR, UX-DR)
- Spec : `_bmad-output/specs/spec-contenus-sociaux/SPEC.md`, `statuts-et-validation.md`, `maquette-calendrier.md`, `brownfield.md`
- Contexte de test : `_bmad-output/test-artifacts/test-design-progress.md`
- Architecture : `_bmad-output/planning-artifacts/architecture/architecture-super-tools-2026-09-24/ARCHITECTURE-SPINE.md`

---

**Produit par :** BMad TEA, module Test Architect
**Workflow :** `bmad-testarch-test-design`, mode epic
**Version :** 4.0 (BMad v6)
