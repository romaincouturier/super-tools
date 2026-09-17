# Revue pas à pas de la spécification de connexion

Méthode, pour chaque exigence : l'énoncé, le test qui la couvre, le résultat de
son exécution. Date : 2026-09-15.

Trois niveaux de preuve, nommés sans ambiguïté :

- **T** : un test automatisé nommé, qui échouerait si l'exigence tombait.
- **L** : vérification par lecture du code, avec la référence. Aucun test ne la garde.
- **M** : vérification manuelle ou opératoire, hors portée d'un test automatisé.

Exécution du 2026-09-17 : 2019 tests unitaires dont 70 SQL, 24 parcours Playwright,
tous verts. (Relevé initial du 2026-09-15 : 1980 tests, 23 parcours.)
Depuis cette revue, les règles portées par du SQL sont jouées sur un vrai
Postgres : `supabase/tests/` charge les fonctions telles que leur migration les
livre et les exerce. 70 tests SQL sur 8 suites.

---

## 1. Principes directeurs

| # | Exigence | Preuve | Test | Résultat |
|---|----------|--------|------|----------|
| PR1 | Une porte par public, et toute URL historique redirige au lieu d'échouer. | T | `l'ancienne URL /apprenant mène à la page de connexion`, `l'ancienne adresse de lien sans jeton mène à la connexion`, `l'ancienne adresse de réinitialisation mène au nouvel écran` | Vert |
| PR2 | Identifiant d'abord, méthode ensuite. | T | `la connexion demande l'adresse avant toute autre chose` | Vert |
| PR3 | Un lien reçu par email ouvre une session. | T | `un compte sans mot de passe reçoit un lien de connexion` + `stageFromResponse > connecte quand le serveur rend une empreinte` | Vert |
| PR4 | Le mot de passe est optionnel. | L | `src/pages/ConnexionLien.tsx`, action "Plus tard" | Lu |
| PR5 | Aucun cul-de-sac. | T | `une adresse inconnue propose des pistes, jamais un cul-de-sac`, `un lien expiré propose d'en recevoir un nouveau`, `une URL de lien sans jeton ne montre jamais d'erreur technique` | Vert |
| PR6 | La destination est conservée. | T | `une page protégée renvoie vers la connexion en mémorisant la destination` + 4 tests `sanitizeRedirect` | Vert |
| PR7 | L'identité vient de la session, jamais de l'URL. | T | 5 tests `resolveLearnerEmail`, 5 tests `get_learner_email`, 5 tests `get_learner_portal_data` | Vert |
| PR8 | Routage déterministe, calculé en un seul endroit. | T | 9 tests `resolvePostLoginPath` | Vert |
| PR9 | L'état d'un compte est porté, pas deviné. | T | 4 tests `fetchAccessLevel` + 6 tests `current_user_access_level` | Vert |

## 2. Workflows

| # | Exigence | Preuve | Test | Résultat |
|---|----------|--------|------|----------|
| W1 | Saisie de l'identifiant, puis aiguillage. | T | `la connexion demande l'adresse avant toute autre chose` | Vert |
| W2 | Compte avec mot de passe. | T | `un compte avec mot de passe mène à l'étape mot de passe` | Vert |
| W3 | Compte sans mot de passe : lien de connexion. | T | `un compte sans mot de passe reçoit un lien de connexion` | Vert |
| W4 | Email connu sans compte : lien d'activation. | T | `un participant sans compte reçoit un lien d'activation` | Vert |
| W5 | Activation depuis un email. | T | `un lien pré-cliqué par un robot de messagerie reste utilisable`, `un ancien lien reçu par email entre par la nouvelle ouverture de lien`, 5 tests `stageFromResponse` | Vert |
| W6 | Email inconnu. | T | `une adresse inconnue propose des pistes, jamais un cul-de-sac` | Vert |
| W7 | Création de compte en autonomie. | L | `src/pages/AcademySignup.tsx`, `create-academy-account` | Lu |
| W8 | Mot de passe oublié et définition. | T | `le mot de passe oublié est atteignable sans lien reçu`, `un lien de réinitialisation sans session propose d'en recevoir un nouveau` | Vert |
| W9 | Session déjà ouverte. | L | `src/pages/Connexion.tsx` effet de redirection, `LearnerPortal.handleLogout` | Lu |
| W10 | Liens invalides, expirés, déjà utilisés. | T | 4 parcours d'ouverture de lien | Vert |
| W11 | Routage après connexion et anti-boucle. | T | 9 tests `resolvePostLoginPath`, `un compte sans rattachement voit un écran explicite`, 6 tests `current_user_access_level` | Vert |
| W12 | Provisionnement à l'encaissement. | L | `_shared/learner-account.ts`, `add-training-participant` | Lu |
| W13 | Changement d'adresse email. | T | 10 tests `change_learner_email` | Vert |

## 3. Règles de gestion

| # | Exigence | Preuve | Test | Résultat |
|---|----------|--------|------|----------|
| RG-01 | Email normalisé avant toute opération. | T | 3 tests `normalizeLearnerEmail` | Vert |
| RG-02 | Recherche couvrant toutes les origines. | T | `resolve_login_identity > propose l'activation à un participant connu`, `> à un inscrit Academy`, `current_user_access_level > reconnaît un apprenant à son rattachement` | Vert |
| RG-03 | Un email, un seul compte. | L | Unicité tenue par l'authentification, `ensureLearnerAccount` ne recrée jamais | Lu |
| RG-04 | Lien à usage unique, consommé à l'ouverture de session. | T | `un lien déjà utilisé explique pourquoi et relance le parcours` | Vert |
| RG-05 | Un lien ne change jamais un mot de passe existant. | L | `create-learner-account` répond 409, `redeem-learner-token` ne touche pas au mot de passe | Lu |
| RG-06 | Durées : 30 minutes, 7 jours, 1 heure. | T | 3 tests `linkExpiresAt` | Vert |
| RG-07 | Message de confirmation identique quel que soit le cas. | L | `ConnexionMotDePasseOublie`, envoi puis message unique | Lu |
| RG-08 | Quota d'envoi par adresse et par IP. | T | 7 tests `check_link_quota` | Vert |
| RG-09 | Compteur d'échecs commun apprenants et staff. | L | `useLoginAttempts` utilisé par `/connexion` et `/auth` | Lu |
| RG-10 | Destination interne uniquement. | T | 5 tests `sanitizeRedirect` | Vert |
| RG-11 | Identité issue de la session. | T | 5 tests `resolveLearnerEmail` + 5 tests `get_learner_email` | Vert |
| RG-12 | Pas d'information de compte avant validation. | T | `ne rend rien d'autre qu'un état d'aiguillage`, `journalise l'empreinte, jamais l'adresse en clair` | Vert |
| RG-13 | La déconnexion purge l'état local. | L | `SessionProvider.signOut`, `LearnerPortal.handleLogout` | Lu |
| RG-14 | Le rôle décide, pas la porte. | T | `laisse le staff rejoindre la destination mémorisée`, `ne renvoie jamais un apprenant vers une route back-office` | Vert |
| RG-15 | Durée annoncée dans chaque email. | T | 2 tests `linkValidityLabel` | Vert |
| RG-16 | `password_set` porté côté serveur. | T | 4 tests `fetchAccessLevel` + 4 tests `drapeaux du compte` | Vert |
| RG-17 | L'adresse n'est pas unique dans les référentiels. | L | Chapitre 16 de la spécification, mesuré en base | Lu |
| RG-18 | Pas de provisionnement sans adresse valide. | T | 3 tests `isUsableLearnerEmail` | Vert |
| RG-19 | Changement d'adresse atomique. | T | 10 tests `change_learner_email`, dont `ne change rien quand il refuse` | Vert |
| RG-20 | L'email reste dans le formulaire à l'étape mot de passe. | T | `un compte avec mot de passe mène à l'étape mot de passe` vérifie la valeur du champ | Vert |
| RG-21 | Un lien pré-cliqué reste utilisable. | T | `un lien pré-cliqué par un robot de messagerie reste utilisable` | Vert |
| RG-22 | L'email d'activation informe de la création du compte. | L | Migration 20260915130000, modèles et texte de repli | Lu |
| RG-23 | Comptes dormants signalés à trois ans. | T | 5 tests `list_dormant_learner_accounts` | Vert |
| RG-24 | Journaux conservés 30 jours au plus. | T | `purge_identity_resolution_log > efface les traces de plus de 30 jours` | Vert |
| RG-25 | Suppression traitée sous 30 jours. | M | Engagement de support, porté par la politique de confidentialité | Hors test |
| RG-26 | La résolution ne rend qu'un état d'aiguillage. | T | 8 tests `parseIdentityState` + `au-delà du quota, le message est uniforme` | Vert |

## 4. Service de résolution, chapitre 6

| Exigence | Preuve | Test | Résultat |
|----------|--------|------|----------|
| Cinq états d'aiguillage | T | 5 parcours, un par état | Vert |
| Source de `password_set` | T | `aiguille vers le lien quand le compte n'a pas de mot de passe`, `considère qu'un compte antérieur au drapeau a un mot de passe` | Vert |
| Seuils 5 par adresse, 20 par IP | T | 4 tests de quota sur `resolve_login_identity` | Vert |
| Mode dégradé si panne | T | `si le service de résolution ne répond pas, l'écran bascule en mode dégradé` + 3 tests `parseIdentityState` | Vert |

## 5. Table de routage, chapitre 7

Les huit lignes sont couvertes par les 9 tests `resolvePostLoginPath`, hormis
"staff arrivant sur la porte apprenant" et "apprenant arrivant sur `/auth`",
vérifiés par lecture de `Connexion.tsx` et `Auth.tsx`. Résultat : vert pour les
six lignes testées, lu pour les deux autres.

## 6. Anti-boucle, chapitre 8

| Règle cible | Preuve | Test | Résultat |
|-------------|--------|------|----------|
| Un seul fournisseur d'état de session | L | `SessionProvider` monté au-dessus du routeur | Lu |
| Aucune redirection depuis un hook de données | L | `useAuth` ne navigue plus qu'à la déconnexion | Lu |
| Aucune redirection tant que l'état n'est pas résolu | L | Gardes : `status === "loading"` rend un indicateur | Lu |
| Rafraîchissement de jeton n'est pas une déconnexion | L | `SessionProvider`, seul `SIGNED_OUT` remet à zéro | Lu |
| Un compte sans rôle est un état terminal | T | `un compte sans rattachement voit un écran explicite, sans boucle` | Vert |
| Contrainte de mot de passe portée par une garde qui la relit | L | `ForcePasswordChange`, effet de libération | Lu |

## 7. Critères d'acceptation

Les 28 critères sont repris dans `docs/RECETTE_CONNEXION.md`, avec leur scénario
métier et leur verdict sur deux passes. Vingt sont couverts par un test nommé,
huit par lecture.

---

## Ce que cette revue dit honnêtement

Décompte sur les 58 exigences des tableaux ci-dessus, principes, workflows,
règles de gestion et service de résolution :

- **41 sont gardées par un test nommé.** Elles échoueraient au prochain build si
  le comportement changeait. Elles étaient 28 avant le harnais SQL.
- **16 sont vérifiées par lecture du code.** Ce sont désormais les fonctions
  serveur en TypeScript, les écrans dont le parcours n'est pas joué, et les
  enchaînements d'emails. Plus aucune règle SQL n'est dans ce cas.
- **1 est hors portée d'un test** : le délai de traitement d'une demande de
  suppression.

S'y ajoutent la table de routage, six lignes testées sur huit, et les 28
critères d'acceptation, dont le détail est dans `docs/RECETTE_CONNEXION.md`.

## Le harnais SQL

La lacune signalée à la première revue est comblée. `supabase/tests/` exécute
les fonctions sur un Postgres réel, en mémoire, sans conteneur : chaque fonction
est extraite du fichier de migration qui la livre, jamais recopiée. Modifier la
migration change donc le résultat du test.

| Suite | Ce qu'elle garde |
|-------|------------------|
| `resolution-identite` | Les cinq états d'aiguillage, les seuils, l'oubli à une heure, l'absence d'adresse en clair dans le journal |
| `identite-session` | L'identité issue du jeton, l'en-tête devenu sans effet, les quatre niveaux d'accès |
| `quota-liens` | Le quota d'envoi par adresse et par IP, la purge à 30 jours |
| `changement-adresse` | La propagation, les refus, le retour à l'état initial en cas de refus, la réserve à l'équipe |
| `comptes-et-indicateurs` | Les drapeaux du compte, la fermeture des autres sessions, les comptes dormants, les indicateurs |
| `portail-donnees` | L'interdiction de lire l'espace d'un tiers, la prévisualisation de l'équipe |

Ce qui reste hors du harnais : les policies de niveau ligne. **Correction du
2026-09-17** : la raison donnée ici, l'absence de rôles Postgres, était fausse.
PGlite crée des rôles, honore `SET ROLE` et applique réellement les policies, et
`auth.uid()` comme `auth.jwt()` sont déjà stubbés dans `helpers/db.ts`. Ce sont
donc des tests qui restent à écrire, pas des tests impossibles. 96 policies sur
53 tables s'appuient sur `get_learner_email()`.
