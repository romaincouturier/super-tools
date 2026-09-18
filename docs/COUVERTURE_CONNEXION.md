# Couverture de la refonte de connexion apprenant

> **Quel document ouvrir ?**
> `docs/SPEC_CONNEXION_APPRENANT.md` — la référence, ce qui doit être fait et pourquoi.
> `docs/RECETTE_FONCTIONNELLE.md` — **le seul à dérouler soi-même**, dans un navigateur, après publication.
> `docs/COUVERTURE_CONNEXION.md` — ce qui garde chaque exigence, et ce que vaut cette garde. Se lit, ne se joue pas.

**Ce document se lit, il ne se joue pas.** Il dit, pour chaque exigence de
`docs/SPEC_CONNEXION_APPRENANT.md`, ce qui la garde et ce que vaut cette garde.

Le seul document à dérouler soi-même est `docs/RECETTE_FONCTIONNELLE.md`.

Trois niveaux de preuve, nommés sans ambiguïté :

- **T** : un test automatisé nommé, qui échouerait si l'exigence tombait.
- **L** : vérification par lecture du code, avec la référence. Aucun test ne la garde.
- **M** : vérification manuelle ou opératoire, hors portée d'un test automatisé.

Exécution du 2026-09-18 (avant démolition) : 2019 tests unitaires dont 70 SQL, 24 parcours
Playwright, 9 assertions pgTAP sur instance Supabase, tous verts. CI et
workflow `rls-tests` verts sur la PR.

**Démolition du lien magique, 2026-09-18 (après l'exécution ci-dessus).** L'arbitrage Q1 est révisé (`docs/SPEC_CONNEXION_APPRENANT.md`, chapitre 12) : le lien magique est intégralement supprimé. Les preuves des lignes PR3, PR4, W3, W4, W5, W10, W12, RG-04, RG-05, RG-06 et de la section 4 (service de résolution) ci-dessous citent des tests qui ont disparu avec le mécanisme démoli ; elles sont corrigées dans les tableaux qui suivent, avec les noms de tests réellement en vigueur (2030 tests unitaires, 18 parcours Playwright, `rls-tests` vert sauf l'échec pré-existant et sans rapport documenté sur les PR #425 à #428). Le reste de ce document, écrit avant la démolition, garde sa valeur de trace historique.

**Correctif RG-21, même jour.** La démolition avait rouvert la vulnérabilité au pré-clic (chapitre 19 de la spécification) : le lien de réinitialisation Supabase natif consommait son jeton dès une requête GET vers `auth/v1/verify`, avant tout clic de l'apprenant. Corrigé en construisant nos propres liens `token_hash` et en différant la consommation (`verifyOtp`) au clic sur "Enregistrer mon nouveau mot de passe" — sans écran ni clic ajoutés. Voir la ligne RG-21 ci-dessous. 2044 tests unitaires après ce correctif.

---

## 1. Principes directeurs

| # | Exigence | Preuve | Test | Résultat |
|---|----------|--------|------|----------|
| PR1 | Une porte par public, et toute URL historique redirige au lieu d'échouer. | T | `l'ancienne URL /apprenant mène à la page de connexion`, `l'ancienne adresse de lien sans jeton mène à la connexion`, `l'ancienne adresse de réinitialisation mène au nouvel écran` | Vert |
| PR2 | Identifiant d'abord, méthode ensuite. | T | `la connexion demande l'adresse avant toute autre chose` | Vert |
| PR3 | Aucun lien n'ouvre de session automatiquement (révisé 2026-09-18). | T | `un lien d'accès reçu par email préremplit l'adresse et enchaîne, sans ouvrir de session` (`e2e/connexion.spec.ts`) | Vert |
| PR4 | Le mot de passe est de facto obligatoire (révisé 2026-09-18). | T | `aiguille aussi vers le mot de passe quand le compte n'en a pas encore` (`resolution-identite.test.ts`) | Vert |
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
| W3 | Compte sans mot de passe : même écran que W2, recours par "mot de passe oublié" (réécrit 2026-09-18). | T | `aiguille aussi vers le mot de passe quand le compte n'en a pas encore` | Vert |
| W4 | Compte provisionné avant toute tentative de connexion, plus d'état "activation" (réécrit 2026-09-18). | T | `ne connaît pas un participant sans compte (plus de lien d'activation séparé)`, `ne connaît pas un inscrit Academy sans compte (plus de lien d'activation séparé)` | Vert |
| W5 | Email d'accès : lien de réinitialisation si `password_set = false`, préremplissage sinon (réécrit 2026-09-18). | T | `un lien d'accès reçu par email préremplit l'adresse et enchaîne, sans ouvrir de session` (e2e), `learnerAccessLink > compte sans mot de passe : lien recovery vers l'écran de création`, `> compte avec mot de passe : lien qui préremplit /connexion, sans generateLink` (`_shared/learner-account.test.ts`) | Vert |
| W6 | Email inconnu. | T | `une adresse inconnue propose des pistes, jamais un cul-de-sac` | Vert |
| W7 | Création de compte en autonomie. | L | `src/pages/AcademySignup.tsx`, `create-academy-account` | Lu |
| W8 | Mot de passe oublié et définition. | T | `le mot de passe oublié est atteignable sans lien reçu`, `un lien de réinitialisation sans session propose d'en recevoir un nouveau` | Vert |
| W9 | Session déjà ouverte. | L | `src/pages/Connexion.tsx` effet de redirection, `LearnerPortal.handleLogout` | Lu |
| W10 | Lien de réinitialisation expiré ; ancienne URL `/connexion/lien` sans cul-de-sac (réécrit 2026-09-18). | T | `un lien de réinitialisation sans session propose d'en recevoir un nouveau`, `un vieux lien reçu par email avant la démolition mène à la connexion, jamais à une page introuvable` (e2e) | Vert |
| W11 | Routage après connexion et anti-boucle. | T | 9 tests `resolvePostLoginPath`, `un compte sans rattachement voit un écran explicite`, 6 tests `current_user_access_level` | Vert |
| W12 | Provisionnement à l'inscription ou à l'encaissement (réécrit 2026-09-18 : plus de durée fixe côté lien). | T | `ensureLearnerAccount > provisionne un compte sans mot de passe et marque password_set à faux`, `> ne touche jamais à un compte déjà présent (S1)` (`_shared/learner-account.test.ts`) | Vert |
| W13 | Changement d'adresse email. | T | 10 tests `change_learner_email` | Vert |

## 3. Règles de gestion

| # | Exigence | Preuve | Test | Résultat |
|---|----------|--------|------|----------|
| RG-01 | Email normalisé avant toute opération. | T | 3 tests `normalizeLearnerEmail` | Vert |
| RG-02 | Recherche couvrant toutes les origines. | T | `resolve_login_identity > propose l'activation à un participant connu`, `> à un inscrit Academy`, `current_user_access_level > reconnaît un apprenant à son rattachement` | Vert |
| RG-03 | Un email, un seul compte. | L | Unicité tenue par l'authentification, `ensureLearnerAccount` ne recrée jamais | Lu |
| RG-04 | *Retirée le 2026-09-18 : portait sur le lien de connexion à usage unique, mécanisme supprimé.* | — | — | Retirée |
| RG-05 | *Retirée le 2026-09-18 : portait sur le risque qu'un lien magique écrase un mot de passe existant (S1), fermé en supprimant le mécanisme lui-même.* | — | — | Retirée |
| RG-06 | *Retirée le 2026-09-18 : portait sur les trois durées (connexion, activation, réinitialisation) de l'ancien mécanisme. Seule la durée du lien de réinitialisation Supabase (1 heure) subsiste (RG-08 ci-dessous, W5, W8).* | — | — | Retirée |
| RG-07 | Message de confirmation identique quel que soit le cas. | L | `ConnexionMotDePasseOublie`, envoi puis message unique | Lu |
| RG-08 | Quota d'envoi par adresse et par IP (reformulée 2026-09-18 : couvre `send-learner-access-email` et `send-password-reset`). | T | 8 tests `check_link_quota` (`supabase/tests/quota-liens.test.ts`) | Vert |
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
| RG-21 | Un lien pré-cliqué reste utilisable. | T | *Rouverte puis refermée le 2026-09-18 (`docs/SPEC_CONNEXION_APPRENANT.md`, chapitre 19) : l'email ne porte plus l'`action_link` Supabase (qui consommait le jeton dès la requête GET vers `auth/v1/verify`), mais un `token_hash` que `usePasswordRecoverySession` n'échange (`verifyOtp`) qu'au clic sur "Enregistrer mon nouveau mot de passe" — sans écran ni clic ajoutés.* `usePasswordRecoverySession > nouveau format ?token_hash=...&type=recovery : attend la confirmation, ne consomme rien` (`useAuthActions.test.ts`), `ConnexionReinitialisation > stage confirm : enregistrer le mot de passe consomme le jeton avant de l'enregistrer (RG-21)` | Vert |
| RG-22 | L'email d'activation informe de la création du compte. | L | Migration 20260915130000, modèles et texte de repli | Lu |
| RG-23 | Comptes dormants signalés à trois ans. | T | 5 tests `list_dormant_learner_accounts` | Vert |
| RG-24 | Journaux conservés 30 jours au plus. | T | `purge_identity_resolution_log > efface les traces de plus de 30 jours` | Vert |
| RG-25 | Suppression traitée sous 30 jours. | M | Engagement de support, porté par la politique de confidentialité | Hors test |
| RG-26 | La résolution ne rend qu'un état d'aiguillage. | T | 8 tests `parseIdentityState` + `au-delà du quota, le message est uniforme` | Vert |

## 4. Service de résolution, chapitre 6 (réécrit le 2026-09-18 : 3 états, `password_set` n'y intervient plus)

| Exigence | Preuve | Test | Résultat |
|----------|--------|------|----------|
| Trois états d'aiguillage (`password`, `unknown`, `throttled` ; `link` et `activation` retirés) | T | `aiguille vers le mot de passe quand le compte en a un`, `> quand le compte n'en a pas encore`, `ne connaît pas une adresse absente de tous les référentiels`, `freine au-delà de dix résolutions par adresse et par heure` ; `parseIdentityState > ne reconnaît plus l'ancien état %s (lien magique retiré)` pour `link`/`activation` | Vert |
| `password_set` ne pilote plus la résolution, garde son rôle pour l'email envoyé (W5) | T | `considère qu'un compte antérieur au drapeau a un mot de passe`, `learnerAccessLink > compte sans mot de passe : lien recovery vers l'écran de création` | Vert |
| Seuils 10 par adresse, 20 par IP (relevé de 5 à 10 le 18/09, avant la démolition) | T | `freine au-delà de dix résolutions par adresse et par heure`, `ne freine pas une autre adresse depuis la même IP tant que le quota IP tient`, `freine au-delà de vingt résolutions depuis la même adresse IP`, `oublie les tentatives de plus d'une heure` | Vert |
| Mode dégradé si panne | T | `si le service de résolution ne répond pas, l'écran bascule en mode dégradé` (e2e) + `parseIdentityState > traite une réponse vide comme une panne` | Vert |

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

Détaillés en seconde partie de ce document : 20 couverts par un test nommé, 8
par lecture, aucun en échec.

---

## Ce que cette revue dit honnêtement

*Décompte figé au 2026-09-15, avant la démolition du lien magique. RG-04, RG-05
et RG-06 sont retirées depuis (chapitre 3 ci-dessus). RG-21 était passée de
"Vert" à "Rouge" le temps de la démolition, puis corrigée le même jour (voir sa
ligne ci-dessus) : ce sont 55 exigences restantes, toutes tenues à nouveau, pas
58. Un nouveau décompte est à faire à la prochaine revue complète.*

Décompte sur les 58 exigences des tableaux ci-dessus, principes, workflows,
règles de gestion et service de résolution :

- **43 sont gardées par un test nommé.** Elles échoueraient au prochain build si
  le comportement changeait. Elles étaient 28 avant le harnais SQL, 41 avant les
  tests de provisionnement et de session ajoutés le 16/09.
- **14 sont vérifiées par lecture du code.** Ce sont les fonctions serveur en
  TypeScript, les écrans dont le parcours n'est pas joué, et les enchaînements
  d'emails. Plus aucune règle SQL n'est dans ce cas.
- **1 est hors portée d'un test** : le délai de traitement d'une demande de
  suppression.

S'y ajoutent la table de routage, six lignes testées sur huit, et les 28
critères d'acceptation détaillés en seconde partie.

## Le harnais SQL

La lacune signalée à la première revue est comblée. `supabase/tests/` exécute
les fonctions sur un Postgres réel, en mémoire, sans conteneur : chaque fonction
est extraite du fichier de migration qui la livre, jamais recopiée. Modifier la
migration change donc le résultat du test.

| Suite | Ce qu'elle garde |
|-------|------------------|
| `resolution-identite` | Les trois états d'aiguillage (2026-09-18), les seuils, l'oubli à une heure, l'absence d'adresse en clair dans le journal |
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

---

# Les 28 critères d'acceptation

Chapitre 13 de la spécification. Chaque critère porte un scénario métier, joué
du point de vue de l'utilisateur, sans référence technique.

Passe 1 : 2026-09-15, 20 critères tenus, 8 en échec ou partiels. Passe 2 : tous
tenus.

## Scénarios et verdicts


| # | Scénario métier | Passe 1 | Passe 2 |
|---|-----------------|---------|---------|
| 1 | Depuis l'accueil, je clique "Se connecter" : j'arrive sur une page qui me demande mon adresse, avec un accès aux formations gratuites. | OK | OK |
| 2 | J'ai un mot de passe. Je saisis mon adresse, puis mon mot de passe, et j'entre. Aucun email requis. | OK | OK |
| 3 | Je clique sur le lien reçu par email. J'arrive connecté sur mon tableau de bord, sans saisir de mot de passe. | **Échec** : les liens émis avant la refonte ouvrent l'ancienne page, qui redemande un mot de passe. | OK |
| 4 | Inscrit à une formation gratuite Academy, je reviens des semaines plus tard et je me reconnecte. | OK | OK |
| 5 | Je tape `/apprenant/connexion` de mémoire, sans lien. | **Échec** : écran "Lien invalide". | OK |
| 6 | Mon lien a expiré ou a déjà servi : l'écran me propose d'en recevoir un nouveau, sur place. | **Partiel** : vrai sur la nouvelle page, faux sur l'ancienne. | OK |
| 7 | Déjà connecté, je clique sur un lien : je ne repasse pas par une authentification. | OK | OK |
| 8 | Je clique sur la notification d'un commentaire. Après connexion, j'arrive sur ce commentaire, pas sur le tableau de bord. | **Partiel** : tenu par mot de passe, perdu quand on entre par lien. | OK |
| 9 | Quelqu'un transfère mon lien d'accès : il ne peut pas changer mon mot de passe. | OK | OK |
| 10 | Je bricole l'adresse du player en mettant l'email d'un collègue : je vois mes données, pas les siennes. | OK | OK |
| 11 | Sans compte, on ne peut pas lire mes formations en connaissant seulement mon adresse. | **Partiel** : deux fonctions fermées, une troisième encore ouverte. | OK |
| 12 | Membre de l'équipe, je me connecte et j'arrive au tableau de bord, sans clignotement ni retour en arrière. | OK | OK |
| 13 | Mon compte n'est rattaché à rien : je vois un écran qui me le dit et me donne un contact. | **Échec** : un compte sans rattachement était traité comme apprenant. | OK |
| 14 | J'achète une formation : je reçois un email d'activation qui m'amène à la formation achetée. | **Partiel** : amenait au tableau de bord, pas à la formation. | OK |
| 15 | Je refuse de créer un mot de passe : j'accède quand même, et je peux revenir par lien autant de fois que je veux. | OK | OK |
| 16 | J'ouvre deux fois le même lien : la seconde fois est refusée et m'en propose un neuf. | OK | OK |
| 17 | J'ouvre un lien trop vieux : refusé de la même façon, avec renvoi. | OK | OK |
| 18 | Aucun email d'accès ne me renvoie vers la boutique pour me connecter. | OK | OK |
| 19 | Je teste des adresses au hasard sur la page de connexion : je n'apprends rien, et je suis freiné. | OK | OK |
| 20 | Je ne peux pas déclarer moi-même que j'ai un mot de passe. | OK | OK |
| 21 | Le support change mon adresse : je garde toutes mes formations, et les anciens liens ne marchent plus. | OK | OK |
| 22 | Après la bascule, mon vieux lien ne me connecte plus mais me propose un lien neuf. | **Partiel** : renvoyait vers l'ancienne page. | OK |
| 23 | L'email d'activation me dit qu'un compte a été créé et comment demander sa suppression. | **Partiel** : vrai dans le texte de repli, absent des modèles. | OK |
| 24 | Mon gestionnaire de mots de passe enregistre bien le couple adresse et mot de passe. | OK | OK |
| 25 | Le service d'aiguillage est en panne : je peux quand même entrer, par mot de passe ou par lien. | OK | OK |
| 26 | J'avais gardé l'ancienne porte `/auth` en signet : je suis routé vers mon espace, sans message d'erreur. | OK | OK |
| 27 | Formateur inscrit à une formation, j'accède à mon espace apprenant depuis le back-office. | **Échec** : aucun chemin. | OK |
| 28 | L'écran `/auth` de l'équipe n'a pas changé. | OK | OK |

## Corrections de la passe 2

| Critères | Constat | Correction |
|----------|---------|------------|
| 3, 5, 6, 22 | L'ancienne page `/apprenant/connexion` survivait avec son comportement d'origine : mot de passe exigé, erreur nue sans jeton, aucune reprise. Les liens en circulation y menaient. | La page est supprimée. `/apprenant/connexion?token=` redirige vers la nouvelle ouverture de lien, sans jeton vers la page de connexion. |
| 8, 14 | La destination était perdue dès qu'on entrait par un lien. | L'ouverture de lien honore une destination portée par l'URL, et l'email d'activation d'une formation en ligne pointe sur le cours concerné. |
| 11 | `learner_evaluation_course_id` prenait encore une adresse en paramètre pour un appelant anonyme. | Exécution anonyme retirée. |
| 13 | Un compte authentifié sans rattachement était traité comme apprenant. | Nouvel état de session, écran "Votre compte n'a pas encore d'accès", niveau d'accès résolu côté serveur. |
| 23 | Les modèles d'email ne disaient rien de la création du compte ni du droit à suppression. | Mention ajoutée aux quatre modèles. |
| 27 | Rien ne menait du back-office à l'espace apprenant. | Entrée "Mon espace apprenant" dans le menu de l'équipe. |

## Passe 3 : vérification des corrections

Chaque correction est couverte par un test qui échouerait si elle disparaissait.

| Critère | Preuve |
|---------|--------|
| 3, 5, 6, 22 | Parcours Playwright : l'ancienne adresse sans jeton mène à la connexion, avec jeton à l'ouverture de lien, et un jeton déjà servi propose le renvoi sur place. |
| 8, 14 | La destination vient de l'URL, sinon du lien lui-même, sinon du tableau de bord ; une formation en ligne renvoie la page de son cours. |
| 11 | Plus aucune fonction de portail n'accepte une adresse en paramètre pour un appelant anonyme. |
| 13 | Parcours Playwright sur l'écran dédié, plus quatre tests unitaires de routage et quatre sur la résolution du niveau d'accès. |
| 23 | Mention ajoutée aux quatre modèles, non rejouée si déjà présente. |
| 27 | Entrée "Mon espace apprenant" dans le menu de l'équipe. |

### Limites connues, assumées

- **Critère 17, lien de réinitialisation.** La durée d'une heure est celle du
  fournisseur d'authentification, réglée hors du code. À vérifier dans la console
  du projet, section Auth.
- **Critère 22.** Le refus d'un jeton de l'ancien régime suppose que la bascule a
  été jouée (`scripts/bascule-connexion.sql`). Avant la bascule, un ancien lien
  connecte normalement, ce qui est le comportement voulu pendant la transition.
- **Critère 14, cours acheté.** La destination pointe sur le cours quand la
  formation est rattachée à un cours en ligne. Sans rattachement, l'apprenant
  arrive sur son tableau de bord, où la formation figure.
- **Ordre de déploiement.** Le front sait se passer de la fonction de niveau
  d'accès tant que la migration n'est pas appliquée : il retombe sur la règle
  précédente plutôt que de déclarer tout le monde sans accès.

---

## Passe 4 : recette élargie à toute la spécification

La passe 1 ne couvrait que les 28 critères d'acceptation. Le reste de la
spécification porte autant d'exigences : 9 principes directeurs, 13 workflows,
26 règles de gestion, le contrat du service de résolution, la table de routage
et les règles anti-boucle. Passe jouée le 2026-09-15 sur ces exigences.

### Écarts trouvés et corrigés

| Exigence | Scénario métier | Constat | Correction |
|----------|-----------------|---------|------------|
| RG-21 | La sécurité de ma messagerie d'entreprise ouvre les liens avant moi. Quand je clique à mon tour, mon lien doit encore marcher. | **Échec.** L'ouverture du lien consommait le jeton dès le chargement de la page : un robot suffisait à le brûler. C'était précisément le risque que la règle décrivait. | La page d'arrivée ne consomme plus rien toute seule : elle affiche "Ouvrir mon espace", et le jeton n'est dépensé qu'après ce clic. |
| RG-08 | Je demande vingt liens d'affilée pour l'adresse de quelqu'un d'autre. | **Échec.** Seul un délai de 60 secondes existait, dans le navigateur, donc contournable. Aucun quota côté serveur. | Quota serveur : 3 envois par adresse et 10 par adresse IP sur une heure glissante. Au-delà, même message, aucun email. |
| RG-24 | Les traces de connexion ne doivent pas s'accumuler au-delà de 30 jours. | **Échec.** La fonction de purge existait mais n'était jamais appelée. | Purge quotidienne planifiée. |
| RG-15 | Le lien que je reçois annonce la bonne durée. | **Échec.** Un lien de connexion de 30 minutes empruntait le modèle d'activation, qui promet 7 jours. | Un lien de connexion rend son propre texte, avec sa durée. |
| W8.5 | Je change mon mot de passe parce que je me crois compromis : les sessions ouvertes ailleurs doivent tomber. | **Échec.** Aucune session n'était fermée. | Les autres sessions du compte sont révoquées, la courante est épargnée. |
| W9.3 | Je me déconnecte : je retourne à l'accueil, pas sur un écran qui me redemande de me connecter. | **Échec.** Le portail renvoyait sur la page de connexion. | Retour à l'accueil. |
| RG-13 | Ma déconnexion ne laisse rien derrière elle sur le poste. | **Partiel.** Seul le portail purgeait l'état local. | La déconnexion générale le purge aussi. |
| Chapitre 7 | On m'impose un changement de mot de passe alors que je visais une page précise : j'y arrive après. | **Échec.** La destination était perdue. | Elle traverse l'écran de changement obligatoire. |
| Chapitre 8 | La contrainte de mot de passe est levée : l'écran ne doit plus me retenir. | **Échec.** L'écran ne relisait pas la contrainte et renvoyait en dur au back-office. | Il la relit, libère vers la destination, et renvoie un visiteur non connecté vers la connexion. |

### Exigences vérifiées sans écart

Principes PR1 à PR9. Workflows W1 à W4, W6, W7, W10 à W13. Règles RG-01 à RG-07,
RG-09 à RG-12, RG-14, RG-16 à RG-20, RG-22, RG-23, RG-25, RG-26. Contrat du
service de résolution, cinq états et seuils. Table de routage, huit lignes.

### Limite restée ouverte

- **RG-25, suppression sous 30 jours.** C'est un engagement de traitement, tenu
  par le support, pas par le code. La politique de confidentialité le porte.
