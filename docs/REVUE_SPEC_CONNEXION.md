# Revue pas à pas de la spécification de connexion

Méthode, pour chaque exigence : l'énoncé, le test qui la couvre, le résultat de
son exécution. Date : 2026-09-15.

Trois niveaux de preuve, nommés sans ambiguïté :

- **T** : un test automatisé nommé, qui échouerait si l'exigence tombait.
- **L** : vérification par lecture du code, avec la référence. Aucun test ne la garde.
- **M** : vérification manuelle ou opératoire, hors portée d'un test automatisé.

Exécution du 2026-09-15 : 1919 tests unitaires, 23 parcours Playwright, tous verts.

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
| PR7 | L'identité vient de la session, jamais de l'URL. | T | 5 tests `resolveLearnerEmail` | Vert |
| PR8 | Routage déterministe, calculé en un seul endroit. | T | 9 tests `resolvePostLoginPath` | Vert |
| PR9 | L'état d'un compte est porté, pas deviné. | T | 4 tests `fetchAccessLevel` | Vert |

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
| W11 | Routage après connexion et anti-boucle. | T | 9 tests `resolvePostLoginPath` + `un compte sans rattachement voit un écran explicite, sans boucle` | Vert |
| W12 | Provisionnement à l'encaissement. | L | `_shared/learner-account.ts`, `add-training-participant` | Lu |
| W13 | Changement d'adresse email. | L | `change_learner_email`, migration 20260915100000 | Lu |

## 3. Règles de gestion

| # | Exigence | Preuve | Test | Résultat |
|---|----------|--------|------|----------|
| RG-01 | Email normalisé avant toute opération. | T | 3 tests `normalizeLearnerEmail` | Vert |
| RG-02 | Recherche couvrant toutes les origines. | L | `resolve_login_identity`, `current_user_access_level` | Lu |
| RG-03 | Un email, un seul compte. | L | Unicité tenue par l'authentification, `ensureLearnerAccount` ne recrée jamais | Lu |
| RG-04 | Lien à usage unique, consommé à l'ouverture de session. | T | `un lien déjà utilisé explique pourquoi et relance le parcours` | Vert |
| RG-05 | Un lien ne change jamais un mot de passe existant. | L | `create-learner-account` répond 409, `redeem-learner-token` ne touche pas au mot de passe | Lu |
| RG-06 | Durées : 30 minutes, 7 jours, 1 heure. | T | 3 tests `linkExpiresAt` | Vert |
| RG-07 | Message de confirmation identique quel que soit le cas. | L | `ConnexionMotDePasseOublie`, envoi puis message unique | Lu |
| RG-08 | Quota d'envoi par adresse et par IP. | L | `check_link_quota`, appelé par `send-learner-magic-link` | Lu |
| RG-09 | Compteur d'échecs commun apprenants et staff. | L | `useLoginAttempts` utilisé par `/connexion` et `/auth` | Lu |
| RG-10 | Destination interne uniquement. | T | 5 tests `sanitizeRedirect` | Vert |
| RG-11 | Identité issue de la session. | T | 5 tests `resolveLearnerEmail` | Vert |
| RG-12 | Pas d'information de compte avant validation. | L | `resolve-login-identity` ne rend qu'un état | Lu |
| RG-13 | La déconnexion purge l'état local. | L | `SessionProvider.signOut`, `LearnerPortal.handleLogout` | Lu |
| RG-14 | Le rôle décide, pas la porte. | T | `laisse le staff rejoindre la destination mémorisée`, `ne renvoie jamais un apprenant vers une route back-office` | Vert |
| RG-15 | Durée annoncée dans chaque email. | T | 2 tests `linkValidityLabel` | Vert |
| RG-16 | `password_set` porté côté serveur. | T | 4 tests `fetchAccessLevel` (source serveur) + migration | Vert |
| RG-17 | L'adresse n'est pas unique dans les référentiels. | L | Chapitre 16 de la spécification, mesuré en base | Lu |
| RG-18 | Pas de provisionnement sans adresse valide. | T | 3 tests `isUsableLearnerEmail` | Vert |
| RG-19 | Changement d'adresse atomique. | L | `change_learner_email`, 26 tables dans une transaction | Lu |
| RG-20 | L'email reste dans le formulaire à l'étape mot de passe. | T | `un compte avec mot de passe mène à l'étape mot de passe` vérifie la valeur du champ | Vert |
| RG-21 | Un lien pré-cliqué reste utilisable. | T | `un lien pré-cliqué par un robot de messagerie reste utilisable` | Vert |
| RG-22 | L'email d'activation informe de la création du compte. | L | Migration 20260915130000, modèles et texte de repli | Lu |
| RG-23 | Comptes dormants signalés à trois ans. | L | `list_dormant_learner_accounts`, onglet Connexion | Lu |
| RG-24 | Journaux conservés 30 jours au plus. | L | `purge_identity_resolution_log`, cron quotidien | Lu |
| RG-25 | Suppression traitée sous 30 jours. | M | Engagement de support, porté par la politique de confidentialité | Hors test |
| RG-26 | La résolution ne rend qu'un état d'aiguillage. | T | 8 tests `parseIdentityState` + `au-delà du quota, le message est uniforme` | Vert |

## 4. Service de résolution, chapitre 6

| Exigence | Preuve | Test | Résultat |
|----------|--------|------|----------|
| Cinq états d'aiguillage | T | 5 parcours, un par état | Vert |
| Source de `password_set` | L | Migration 20260914170000 | Lu |
| Seuils 5 par adresse, 20 par IP | L | `resolve_login_identity` | Lu |
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

- **43 exigences sur 94 sont gardées par un test nommé.** Elles échoueraient au
  prochain build si le comportement changeait.
- **50 sont vérifiées par lecture du code.** Elles sont justes aujourd'hui, et
  rien n'empêchera une régression demain. La majorité vit dans des fonctions SQL
  et des fonctions serveur, que ce projet ne teste pas encore automatiquement.
- **1 est hors portée d'un test** : le délai de traitement d'une demande de
  suppression.

La lacune connue est le SQL : `resolve_login_identity`, `change_learner_email`,
`check_link_quota`, `current_user_access_level` et les policies portent une part
importante des règles, sans harnais. Les couvrir demanderait une base de test
jouable en intégration continue, qui n'existe pas dans ce projet.
