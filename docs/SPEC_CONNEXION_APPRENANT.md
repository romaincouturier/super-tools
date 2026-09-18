# Spécifications métier : workflows de connexion apprenant

> **Quel document ouvrir ?**
> `docs/SPEC_CONNEXION_APPRENANT.md` — la référence, ce qui doit être fait et pourquoi.
> `docs/RECETTE_FONCTIONNELLE.md` — **le seul à dérouler soi-même**, dans un navigateur, après publication.
> `docs/COUVERTURE_CONNEXION.md` — ce qui garde chaque exigence, et ce que vaut cette garde. Se lit, ne se joue pas.

Statut : mis en œuvre. Rédigée le 2026-09-14, cette spécification retenait un lien magique qui ouvre une session sans mot de passe (Q1 : mot de passe optionnel). Le 2026-09-18, ce choix a été inversé : le lien magique est intégralement supprimé, il ne fait plus partie des fonctionnalités disponibles. Voir la révision de Q1 au chapitre 12 ; les chapitres 6, 9, 10, 11, 17, 19 et 22 ainsi que les workflows W3, W4, W5, W10 et W12 sont réécrits en conséquence. Le reste du document (populations, principes directeurs hors PR3/PR4, routage, sécurité) reste la référence.
Date de rédaction initiale : 2026-09-14. Révision magique → mot de passe : 2026-09-18.
Tous les arbitrages Q1 à Q8 sont rendus au 2026-09-14 ; Q1 est révisé au 2026-09-18, reporté dans les règles de gestion, les workflows et le plan de bascule.

## 0. Cadrage

### Objectif

Remplacer le mécanisme actuel d'accès apprenant (demande de lien par email comme seule porte d'entrée) par un parcours de connexion conforme à l'état de l'art : une page de connexion unique, une détection automatique du cas de l'utilisateur, aucun cul-de-sac, et un retour systématique à la destination demandée.

### Dans le périmètre

- Connexion et création de compte apprenant.
- Activation de compte depuis un email (achat en ligne, inscription intra, relance, erratum).
- Mot de passe oublié et définition de mot de passe.
- Comportement des URL bricolées, des liens expirés et des liens déjà utilisés.
- Routage après connexion (apprenant, staff, compte sans rôle).
- Correction des boucles de redirection à la connexion staff.

### Hors périmètre

- Refonte du mécanisme d'authentification staff `/auth` : arbitrage Q5 rendu, l'écran ne bouge pas. Formulaire, anti-brute force et changement de mot de passe conservés à l'identique. Seules les corrections de boucles du chapitre 8, qui portent sur les gardes de route et non sur l'écran, s'y appliquent, plus la ligne de routage de l'apprenant arrivant sur `/auth` au chapitre 7.
- Maquettes des écrans : travaillées séparément, hors de ce document. Les textes du chapitre 10 en sont la matière.
- SSO entreprise, MFA, connexion via réseaux sociaux : non retenus à ce stade, mentionnés en annexe des arbitrages.
- Modèle d'autorisation des contenus : qui a le droit de lire et d'écrire quoi une fois connecté. Frontière et méthode de traitement au chapitre 15.

---

## 1. État des lieux

### 1.1 Points d'entrée existants

| # | Origine | URL atteinte | Mécanisme réel | Compte créé ? |
|---|---------|--------------|----------------|---------------|
| E1 | Bouton "Se connecter" de la landing | `/apprenant` | Formulaire d'envoi de lien uniquement | Non |
| E2 | Achat SuperTilt, mode `woocommerce` (défaut) | lien `supertilt_link` externe | Email renvoyant vers supertilt.fr, hors SuperTools | Non |
| E3 | Achat SuperTilt, mode `magic_link` | `/apprenant/connexion?token=` | Token 1 an, puis saisie ou création de mot de passe | À l'étape mot de passe |
| E4 | Inscription intra ou inter par le staff | `/apprenant/connexion?token=` | Idem E3, déclenché par `add-training-participant` | À l'étape mot de passe |
| E5 | Relance avant démarrage e-learning | `/apprenant/connexion?token=` | Token 1 an régénéré par le cron | À l'étape mot de passe |
| E6 | Erratum e-learning | `/apprenant/connexion?token=` | Token 1 an régénéré | À l'étape mot de passe |
| E7 | Formation gratuite Academy | `/academy/inscription?course=` | Formulaire nom + email + mot de passe | Oui, immédiatement |
| E8 | Notification communauté | `/espace-apprenant/pratique?post=` | Aucun mécanisme de connexion, suppose une session | Non |
| E9 | Lien direct vers un cours | `/lms/:courseId/player?email=` | Identité portée par l'URL | Non |

Références : `src/pages/Landing.tsx:88`, `supabase/functions/add-training-participant/index.ts:600-620`, `supabase/functions/send-elearning-access/index.ts:77-79`, `supabase/functions/send-learner-magic-link/index.ts:121`, `supabase/functions/process-elearning-start-reminders/index.ts:161`, `supabase/functions/send-elearning-erratum/index.ts:70`, `supabase/functions/create-academy-account/index.ts:55-75`, `supabase/functions/notify-practice-comment/index.ts:75`, `src/pages/LmsCoursePlayer.tsx:46`.

### 1.2 Ruptures constatées

**D1. "Se connecter" ne mène pas à une page de connexion.**
Le bouton de la landing pointe vers `/apprenant`, écran "Espace Apprenant" qui ne propose qu'une seule action : recevoir un lien par email. Aucun champ mot de passe, aucun lien d'inscription. Référence : `src/pages/LearnerAccess.tsx:12-97`.

**D2. Le lien reçu par email n'est pas un lien magique.**
Il ouvre `/apprenant/connexion?token=`, page qui demande systématiquement un mot de passe : création si aucun compte n'existe, saisie si un compte existe. Aucune session n'est ouverte par le lien lui-même. C'est la cause directe du symptôme "je clique sur mon lien et j'arrive sur une page de connexion au lieu de mon tableau de bord". Référence : `src/pages/LearnerOnboarding.tsx:51-79`.

**D3. Le lien expiré ou invalide renvoie vers une impasse.**
La page d'erreur propose "Accéder à mon espace apprenant" vers `/espace-apprenant`. Le portail ne trouve pas de session, attend 2,5 secondes, puis renvoie vers `/apprenant`, c'est-à-dire l'écran "Espace Apprenant" de demande de lien. L'utilisateur boucle sans jamais comprendre quoi faire. Références : `src/pages/LearnerOnboarding.tsx:186-190`, `src/pages/LearnerPortal.tsx:1915-1929`.

**D4. `/apprenant/connexion` sans token affiche une erreur.**
La page exige un token dès le montage et bascule sinon en état d'erreur "Lien invalide". Une URL mémorisée ou saisie à la main devient un mur. Référence : `src/pages/LearnerOnboarding.tsx:51-55`.

**D5. Les apprenants Academy n'ont aucun chemin de connexion.**
Un compte créé via `/academy/inscription` est rattaché à `lms_enrollments`, pas à `training_participants`. Or `send-learner-magic-link` ne répond que si l'email existe dans `training_participants` et échoue silencieusement sinon, avec un message "si votre adresse est associée à une formation". Le lien "J'ai déjà un compte" de la page d'inscription pointe donc vers une impasse. Références : `supabase/functions/send-learner-magic-link/index.ts:41-51`, `supabase/functions/create-academy-account/index.ts:72-75`.

**D6. "Mot de passe oublié" n'est atteignable que muni d'un token valide.**
La bascule vers le mode `forgot` n'existe que dans l'écran token, en mode connexion. Sans lien valide en main, un apprenant ayant oublié son mot de passe n'a aucun point d'entrée. Référence : `src/pages/LearnerOnboarding.tsx:149-158` et l'aiguillage des modes en `:57-79`.

**D7. Deux modes d'accès e-learning coexistent, pilotés par un réglage global.**
`elearning_access_mode` vaut `woocommerce` par défaut : l'email d'accès pointe vers `supertilt_link` (site marchand) et non vers l'espace apprenant. En mode `magic_link`, il pointe vers le token. Le même événement métier, un achat, produit donc deux parcours incompatibles selon un réglage invisible pour l'apprenant. Références : `supabase/functions/add-training-participant/index.ts:600-620`, `src/components/settings/SettingsGeneral.tsx:204-221`.

**D8. Aucune conservation de la destination.**
Aucun paramètre de redirection n'existe dans le parcours. Après connexion, la destination est toujours `/espace-apprenant`. Un lien profond, par exemple une notification de commentaire vers `/espace-apprenant/pratique?post=`, perd sa cible dès que la session manque. Références : `src/pages/LearnerOnboarding.tsx:87-89`, `supabase/functions/notify-practice-comment/index.ts:75`.

**D9. La session n'est pas la source d'identité dans le player LMS.**
L'email de l'apprenant est lu dans l'URL, pas dans la session, et il est propagé aux écritures de progression. Référence : `src/pages/LmsCoursePlayer.tsx:46, 339, 906`.

**D10. Le cas "déjà connecté" n'est pas traité.**
Un apprenant disposant d'une session valide qui clique sur son lien d'accès se voit redemander un mot de passe. Aucune détection de session en amont dans l'écran token.

**D11. Le portail attend 2,5 secondes avant de conclure à l'absence de session.**
Temporisation fixe destinée à absorber une course de synchronisation du stockage. Elle pénalise tous les utilisateurs non connectés. Référence : `src/pages/LearnerPortal.tsx:1915-1929`.

### 1.3 Points de sécurité structurants à traiter dans la refonte

Ces points ne sont pas des remarques de style : ils conditionnent la conception des workflows cibles.

**S1. Un lien d'accès permet d'écraser le mot de passe d'un compte existant.**
`create-learner-account` appelé avec un token valide et un email déjà rattaché à un compte met à jour le mot de passe du compte existant. Combiné à une validité d'un an et à un email transférable, cela vaut prise de contrôle de compte. Référence : `supabase/functions/create-learner-account/index.ts:73-88`.

**S2. Les tokens vivent un an, sont réutilisables et ne sont pas consommés après une connexion.**
`consume_learner_token` n'est appelé que dans le parcours de création de compte, pas après une connexion par mot de passe. Références : `supabase/functions/send-learner-magic-link/index.ts:105-107`, `src/pages/LearnerOnboarding.tsx:122`.

**S3. `preview_learner_token` révèle l'email et l'existence d'un compte à un appelant anonyme.**
Référence : `supabase/migrations/20260518210000_preview_learner_token_has_account.sql`.

**S4. `get_learner_portal_data(text)` est exécutable par le rôle `anon` avec n'importe quel email.**
Les formations, questionnaires et évaluations d'un apprenant sont donc lisibles sans authentification, à partir de la seule connaissance de son adresse. Référence : `supabase/migrations/20260518220000_grant_learner_portal_functions.sql:3`.

**S5. Le player LMS accepte l'identité fournie dans l'URL.**
Conséquence : consultation et écriture de progression au nom d'un tiers. Référence : `src/pages/LmsCoursePlayer.tsx:46`.

La cible doit rendre ces trajectoires impossibles : identité issue de la session, fonctions de portail réservées à `authenticated` et bornées à l'utilisateur courant, tokens à usage unique et à durée courte.

---

## 2. Populations concernées

| Code | Population | Origine du compte | Situation actuelle | Besoin |
|------|-----------|-------------------|--------------------|--------|
| P1 | Acheteur d'une formation en ligne | Achat SuperTilt | Selon réglage : email marchand ou lien token | Accès immédiat après paiement, sans friction |
| P2 | Participant à une formation intra | Inscrit par le staff ou par le commanditaire | Lien token par email | Accès sans avoir rien demandé, souvent sur mobile |
| P3 | Participant à une formation inter ou présentielle | Inscrit par le staff | Lien token, usage documents et questionnaires | Retrouver ses documents plusieurs mois après |
| P4 | Inscrit Academy gratuit | Auto-inscription en ligne | Compte avec mot de passe, mais aucune page de connexion | Se reconnecter simplement |
| P5 | Apprenant revenant spontanément | Toutes origines | Doit redemander un lien à chaque fois | Connexion classique email plus mot de passe |
| P6 | Membre du staff | Back-office | `/auth`, boucles de redirection | Connexion stable et routage déterministe |
| P7 | Compte sans rôle identifié | Résidu de migrations | Traité comme staff par défaut | Message explicite, pas de redirection silencieuse |

---

## 3. Principes directeurs de la cible

**PR1. Une porte unique par public.**
`/connexion` pour les apprenants, `/auth` pour le staff. Toute autre URL historique redirige vers l'une des deux, jamais vers un écran d'erreur.

**PR2. Identifiant d'abord, méthode ensuite.**
L'utilisateur saisit son email. Le système détermine son cas et propose l'étape adaptée. L'utilisateur n'a jamais à déclarer lui-même s'il a un compte.

**PR3. Aucun lien n'ouvre de session automatiquement (arbitrage Q1 révisé le 2026-09-18).**
Un lien reçu par email préremplit l'adresse ou mène à un écran de définition de mot de passe ; il ne connecte jamais par lui-même. Le mot de passe est le seul mécanisme d'ouverture de session.

**PR4. Le mot de passe est de facto obligatoire (arbitrage Q1 révisé le 2026-09-18).**
Un compte sans mot de passe défini est aiguillé, comme tout autre compte connu, vers l'étape mot de passe. Son unique recours est « mot de passe oublié », qui envoie un lien de réinitialisation forçant la définition d'un mot de passe avant d'entrer. Il n'existe plus de parcours où un apprenant entre sans jamais définir de mot de passe.

**PR5. Aucun cul-de-sac.**
Tout état d'échec, lien expiré, lien consommé, email inconnu, propose une action qui relance le parcours depuis l'écran en cours, sans renvoyer l'utilisateur sur une page d'erreur nue.

**PR6. La destination est conservée.**
Toute redirection vers la connexion mémorise la cible et y ramène après authentification.

**PR7. L'identité vient de la session, jamais de l'URL.**
Aucun email en paramètre d'URL, sauf prévisualisation staff explicitement authentifiée.

**PR8. Le routage après connexion est déterministe et calculé en un seul endroit.**
Une seule garde de route décide, à partir d'un état de session résolu. Aucun hook de données ne déclenche de redirection.

**PR9. L'état d'un compte est une donnée portée, pas une donnée devinée.**
Savoir si un compte existe et s'il a un mot de passe est produit par un service serveur unique, à partir d'une information explicitement enregistrée. Aucun écran ne déduit l'état d'un compte d'un échec de connexion.

---

## 4. Workflows cibles

### W1. Connexion depuis le site : saisie de l'identifiant

Déclencheur : clic sur "Se connecter" depuis `/`, ou accès direct à `/connexion`, ou redirection depuis une page protégée.

1. L'écran `/connexion` affiche un champ email unique, un bouton "Continuer", et un lien "Créer un compte".
2. À la soumission, le système normalise l'email (minuscules, espaces retirés) et évalue le cas selon la matrice du chapitre 6.
3. L'écran suivant s'affiche sans changement d'URL perçu comme une rupture, avec l'email rappelé et une action "Revenir à la page de connexion" qui revient à l'étape 1. Renommée le 18/09/2026 : "Ce n'est pas moi" ne se comprenait pas en usage réel.

Règles associées : RG-01, RG-02, RG-03, RG-12.

### W2. Compte existant avec mot de passe

1. Affichage du champ mot de passe, avec l'email rappelé en clair.
2. Action secondaire visible : "Mot de passe oublié". Le lien "Recevoir un lien de connexion par email" a été retiré le 18/09/2026 : il doublait "Mot de passe oublié" sans que la différence (l'un contourne le mot de passe une fois, l'autre le change) se comprenne en usage réel. Il reste affiché en mode dégradé (chapitre 6.4), où c'est la seule porte d'entrée pour un apprenant sans mot de passe tant que l'aiguillage est en panne.
3. Succès : ouverture de session, redirection selon le chapitre 7.
4. Échec : message générique "Email ou mot de passe incorrect", compteur d'essais existant conservé, proposition de réinitialiser le mot de passe.

### W3. Compte existant sans mot de passe défini (réécrit le 2026-09-18)

Cas d'un apprenant provisionné par une inscription ou un achat, qui n'a jamais choisi de mot de passe. Ce n'est plus un cas distinct côté résolution d'identité : `resolve_login_identity` renvoie `password` pour tout compte existant, qu'il ait ou non un mot de passe défini (le drapeau `password_set` n'entre plus dans le calcul de l'état). L'apprenant atterrit donc sur W2.

1. Écran mot de passe (W2), comme pour tout compte connu. Il n'a naturellement pas encore de mot de passe à saisir.
2. Son seul recours est "Mot de passe oublié" (W8), qui envoie un lien de réinitialisation Supabase (`recovery`, 1 heure, usage unique) menant à l'écran de définition de mot de passe.
3. Après validation, `password_set` passe à vrai et la session est ouverte : la prochaine connexion utilise directement ce mot de passe.

Il n'existe plus de mécanisme séparé "recevoir un lien de connexion" : un compte sans mot de passe suit exactement le même parcours qu'un compte qui en a un.

### W4. Compte provisionné avant toute tentative de connexion (réécrit le 2026-09-18)

Le cas "participant connu mais sans compte" ne se produit plus au moment de la connexion : le compte est désormais créé au moment de l'événement métier qui le justifie (achat, inscription à une formation e-learning), jamais différé jusqu'à ce que l'apprenant tape son adresse. `ensureLearnerAccount` (`supabase/functions/_shared/learner-account.ts`) est appelée dès l'inscription ou l'encaissement (W12), sans mot de passe.

Une adresse qui n'a jamais fait l'objet d'un tel événement métier reste donc `unknown` à la résolution d'identité et suit W6 : il n'y a plus d'état intermédiaire "activation".

### W5. Réception de l'email d'accès (achat, intra, inter, relance, erratum) — réécrit le 2026-09-18

Déclencheur : réception de l'email d'accès émis par W12 ou renvoyé manuellement par le staff (`send-learner-access-email`). Le contenu du lien dépend de `password_set`, lu via la RPC `learner_password_set` :

1. **`password_set = false`** : le lien est un lien `recovery` Supabase natif (généré par `admin.auth.admin.generateLink`), valable 1 heure, à usage unique. Il ouvre `/connexion/reinitialisation`, l'écran de définition de mot de passe (le même que "mot de passe oublié", W8). Aucune session n'est ouverte avant que le mot de passe soit enregistré.
2. **`password_set = true`** : le lien pointe vers `/connexion?email=<adresse>`, sans jeton. Il préremplit seulement l'adresse et lance la résolution d'identité habituelle (W1 étape 2) ; l'apprenant saisit son mot de passe comme à l'accoutumée. Ce lien n'expire jamais et est réutilisable, puisqu'il ne porte aucune preuve d'identité.
3. Dans les deux cas, aucun clic n'ouvre de session par lui-même : `/connexion?email=` s'arrête à l'étape mot de passe (PR3).
4. Un ancien email envoyé avant la démolition du lien magique pointe vers `/connexion/lien?token=...` : cette route redirige vers `/connexion`, jamais vers une page introuvable.

Règles associées : RG-08, RG-11.

### W6. Email totalement inconnu

1. Message neutre et non culpabilisant : "Nous n'avons pas trouvé de compte pour cette adresse."
2. Trois pistes proposées : essayer l'adresse utilisée lors de l'inscription à la formation, découvrir les formations gratuites et créer un compte, contacter le support avec un lien mailto pré-rempli.
3. Aucune création de compte silencieuse.

### W7. Création de compte en autonomie

Déclencheur : formation gratuite depuis la landing, ou lien "Créer un compte" depuis `/connexion`.

1. Formulaire nom, email, mot de passe, avec exigences de robustesse affichées en continu.
2. Si l'email correspond déjà à un compte : bascule vers W2 avec le message "Vous avez déjà un compte, connectez-vous", sans divulguer d'autre information.
3. Si l'email correspond à un participant existant sans compte : le compte est créé et rattaché à ses formations existantes, sans doublon.
4. Succès : session ouverte, redirection vers le contenu choisi, à défaut le tableau de bord.

### W8. Mot de passe oublié et définition de mot de passe

1. Accessible depuis `/connexion` à l'étape mot de passe et depuis une URL directe `/connexion/mot-de-passe-oublie`.
2. Saisie de l'email, message de confirmation neutre et identique quel que soit le cas.
3. L'email contient un lien de réinitialisation valable 1 heure, à usage unique.
4. Le lien ouvre un écran de définition de mot de passe, avec les mêmes exigences que la création.
5. Après validation : session ouverte, toutes les autres sessions de ce compte invalidées, redirection vers la destination mémorisée.
6. Un apprenant sans mot de passe qui passe par ce parcours en définit un : il n'y a pas deux mécanismes distincts.

### W9. Session déjà ouverte

1. Accès à `/connexion` avec une session valide : redirection immédiate vers l'espace correspondant au rôle, sans affichage du formulaire.
2. Accès à une page protégée avec session valide : accès direct.
3. Déconnexion explicite depuis le portail : fermeture de session et retour sur `/`, pas sur un écran de connexion.

### W10. Liens invalides ou expirés (réécrit le 2026-09-18)

Il n'existe plus qu'un seul type de lien porteur d'un jeton consommable : le lien de réinitialisation Supabase (`recovery`), utilisé aussi bien pour "mot de passe oublié" (W8) que pour le premier accès d'un compte sans mot de passe (W5). Le lien préremplissant `/connexion?email=` ne porte aucun jeton et ne peut donc jamais être "expiré" ou "déjà utilisé" (W5, point 2).

| État | Message | Action proposée |
|------|---------|-----------------|
| Lien de réinitialisation expiré ou déjà utilisé | "Ce lien a expiré." | Adresse pré-remplie, bouton "Recevoir un nouveau lien" vers `/connexion/mot-de-passe-oublie`, dans le même écran (`ConnexionReinitialisation.tsx`) |
| Ancienne URL `/connexion/lien?token=` (émise avant la démolition du lien magique) | Aucun message d'erreur | Redirection vers `/connexion`, étape 1 — jamais la page "introuvable" |
| Ancienne URL `/apprenant/connexion` ou `/apprenant` | Aucun message d'erreur | Redirection vers `/connexion` |

Principe conservé : l'écran d'erreur porte l'action de reprise. Il ne renvoie jamais vers une page qui redemandera la même chose, et un ancien lien ne mène jamais à un cul-de-sac.

### W11. Routage après connexion et anti-boucle

1. La session est résolue une seule fois, dans un fournisseur d'état unique, avant toute décision de navigation.
2. Tant que l'état n'est pas résolu, aucune redirection n'est émise : un indicateur de chargement est affiché.
3. Une fois l'état résolu, la garde de route applique la table du chapitre 7.
4. Un compte sans rôle identifiable affiche un écran explicite "Votre compte n'a pas encore d'accès", avec un contact support. Il n'est ni renvoyé vers le back-office, ni renvoyé en boucle vers la connexion.
5. Un apprenant qui atteint une route staff est redirigé une fois vers son espace, avec un marqueur empêchant un second aller-retour.
6. Un membre du staff qui atteint `/connexion` est redirigé vers `/dashboard`, sans déconnexion.

### W12. Provisionnement automatique à l'inscription ou à l'encaissement (arbitrage Q4 rendu, réécrit le 2026-09-18)

Déclencheur : inscription à une formation e-learning, quelle que soit la source (achat sur la boutique SuperTilt, inscription par le staff, inscription par un commanditaire intra).

1. Le compte apprenant est créé immédiatement par `ensureLearnerAccount`, sans mot de passe, à partir de l'email normalisé (RG-01). `password_set` est enregistré à faux.
2. Si un compte existe déjà pour cet email, il est réutilisé tel quel : aucun doublon, aucune modification de son mot de passe ni de son drapeau `password_set` (S1).
3. L'inscription à la formation est rattachée au compte dans le même mouvement.
4. Le même email d'accès est envoyé, quelle que soit la source (`sendLearnerAccessEmail`) : le lien envoyé dépend de `password_set` (W5) — jamais d'ouverture de session automatique.
5. Le réglage `elearning_access_mode` a disparu (lot 5, chapitre 21). Le mode `woocommerce`, qui renvoyait vers le site marchand sans créer de compte, n'est plus une voie d'accès.
6. Si l'email n'est pas ouvert, la relance avant démarrage régénère un email d'accès neuf via la même fonction, sans recréer le compte.

Règles associées : RG-01, RG-08, RG-11.

### W13. Changement d'adresse email d'un apprenant

Déclencheur : le staff modifie l'adresse d'un apprenant depuis l'administration, ou l'apprenant demande le changement au support.

1. Le changement est une opération unique qui met à jour, dans la même transaction, le compte d'authentification et toutes les occurrences métier de l'ancienne adresse : participants aux formations, inscriptions LMS, questionnaires, évaluations, dépôts de travaux.
2. Tous les liens en circulation vers l'ancienne adresse sont invalidés.
3. Un email d'information part vers l'ancienne adresse et un email de confirmation vers la nouvelle, porteur d'un lien de connexion.
4. Les sessions ouvertes du compte sont fermées.
5. Si la nouvelle adresse correspond déjà à un autre compte, l'opération est refusée avec un message explicite. La fusion de deux comptes n'est pas couverte par cette spécification.

Constat à l'origine de ce workflow : aujourd'hui `manage-learner-account` action `update_email` ne modifie que le compte d'authentification (`supabase/functions/manage-learner-account/index.ts:94-103`). Le portail résolvant les contenus par email, un changement d'adresse détache silencieusement l'apprenant de toutes ses formations.

---

## 5. Règles de gestion

| Code | Règle |
|------|-------|
| RG-01 | L'email est normalisé en minuscules et sans espaces de bord avant toute recherche, tout envoi et tout enregistrement. |
| RG-02 | La recherche d'un apprenant couvre toutes les origines : participants aux formations, inscriptions LMS, comptes Academy. Une seule adresse, une seule identité. |
| RG-03 | Un email ne peut correspondre qu'à un seul compte. La détection de doublon est faite avant toute création. |
| RG-04 | *Retirée le 2026-09-18 (démolition du lien magique) : portait sur le lien de connexion à usage unique, mécanisme supprimé.* |
| RG-05 | *Retirée le 2026-09-18 : portait sur le risque qu'un lien magique écrase le mot de passe d'un compte existant (S1). Le mécanisme visé n'existe plus ; la modification du mot de passe reste exclusivement le fait de W8, sur une session déjà ouverte ou un lien de réinitialisation Supabase natif.* |
| RG-06 | *Retirée le 2026-09-18 : portait sur les trois durées de validité (connexion, activation, réinitialisation) de l'ancien mécanisme. Une seule durée subsiste, celle du lien de réinitialisation Supabase natif : 1 heure, à usage unique (W5, W8).* |
| RG-07 | Les messages de confirmation d'envoi sont identiques que l'adresse existe ou non, pour les parcours déclenchés par saisie libre (mot de passe oublié). |
| RG-08 | Reformulée le 2026-09-18 : le nombre d'envois de l'email d'accès ou de réinitialisation (`send-learner-access-email`, `send-password-reset`) est limité par adresse (3 par heure) et par adresse IP (10 par heure) sur une fenêtre glissante, via `check_link_quota`. Au-delà, le système répond le même message sans envoyer d'email. |
| RG-09 | Le compteur d'échecs de mot de passe existant est conservé et s'applique aux apprenants comme au staff. |
| RG-10 | Toute redirection vers la connexion mémorise la destination. Seules les destinations internes à l'application sont acceptées, toute valeur externe est ignorée. |
| RG-11 | L'identité utilisée par le portail et par le player LMS provient de la session. Le paramètre email d'URL n'est accepté que pour la prévisualisation staff, après vérification du rôle. |
| RG-12 | Aucun écran de connexion n'expose d'information de compte avant validation, hors le cas assumé de la détection à l'étape 1, encadré par RG-08. |
| RG-13 | La déconnexion purge l'intégralité de l'état local associé à l'apprenant, y compris les valeurs de session de navigation. |
| RG-14 | Un compte apprenant et un compte staff ne se distinguent pas par la porte d'entrée utilisée mais par le rôle porté par le compte. |
| RG-15 | Tout email transactionnel contenant un lien d'accès mentionne la durée de validité et la conduite à tenir si le lien ne fonctionne plus. |
| RG-16 | L'existence d'un mot de passe est portée par un drapeau `password_set` enregistré côté serveur, jamais déduite d'un échec de connexion. Il est écrit exclusivement par le rôle de service. |
| RG-17 | L'adresse email est la clé d'identité métier, mais elle n'est pas unique dans les tables de participants. Le compte porte l'identité, le rattachement aux formations se fait par l'email normalisé, et plusieurs lignes de participants peuvent pointer vers le même compte. |
| RG-18 | Un participant sans adresse email valide ne peut pas être provisionné. Il reste accessible par les parcours publics à jeton (questionnaires, évaluations, émargement), qui ne sont pas des connexions. |
| RG-19 | Le changement d'adresse d'un apprenant est une opération atomique qui propage la nouvelle adresse à toutes les tables métier et invalide les liens en circulation (W13). |
| RG-20 | Tout écran de connexion conserve l'email dans le document à l'étape mot de passe, avec les attributs d'auto-complétion attendus, pour que les gestionnaires de mots de passe enregistrent le couple. Un formulaire en deux étapes ne doit pas retirer le champ email du formulaire. |
| RG-21 | Les liens des emails transactionnels sont conçus pour survivre à un pré-clic : l'ouverture d'un lien ne consomme le jeton qu'après une action de l'utilisateur sur la page d'arrivée, jamais sur une requête automatique. |
| RG-22 | Toute création de compte automatique (W12) est notifiée à la personne dans l'email d'activation, qui indique qui est responsable de traitement, quelles données sont enregistrées et comment demander la suppression. |
| RG-23 | Un compte apprenant sans aucune connexion ni inscription active depuis trois ans est signalé pour suppression. La suppression efface le compte d'authentification et anonymise les traces de connexion, sans toucher aux données de traçabilité réglementaire des formations. |
| RG-24 | Les journaux de connexion et de résolution d'identité conservent l'adresse sous forme hachée et l'adresse IP pendant 30 jours au plus. |
| RG-25 | Toute demande de suppression de compte est traitée sous 30 jours et confirmée par email. Les obligations de conservation Qualiopi portent sur les données de formation, pas sur le compte d'accès. |
| RG-26 | Aucune réponse du service de résolution d'identité ne contient de nom, de formation, d'identifiant de compte ni de rôle. Elle se limite à l'état d'aiguillage. |

---

## 6. Résolution d'identité à la saisie de l'email

### 6.1 Le service de résolution (réécrit le 2026-09-18 : 3 états au lieu de 5)

Arbitrage Q2 rendu le 2026-09-14 : le système détecte le cas de l'utilisateur, avec limitation de débit et réponse uniforme en cas d'abus. La détection est donc un service, pas une déduction d'écran.

Un unique point d'entrée serveur (`resolve_login_identity`, exposé par la fonction `resolve-login-identity`) reçoit une adresse et renvoie un état d'aiguillage. Il ne renvoie rien d'autre : ni nom, ni formation, ni identifiant de compte, ni rôle (RG-26).

Depuis la démolition du lien magique, `password_set` n'entre plus dans ce calcul : la seule question posée est "un compte d'authentification existe-t-il pour cette adresse ?".

| État renvoyé | Signification | Écran suivant |
|--------------|---------------|---------------|
| `password` | Un compte existe, avec ou sans mot de passe déjà défini. Vaut aussi pour un compte staff : le rôle n'est pas divulgué avant authentification. | W2 (et W3 si `password_set` est encore faux : même écran, recours par "mot de passe oublié") |
| `unknown` | Aucun compte d'authentification pour cette adresse — qu'elle soit ou non connue comme participant ou inscrite (W4). | W6 |
| `throttled` | Quota dépassé. Aucun email n'est envoyé. | Écran d'attente, message uniforme |

Les états `link` et `activation` de la version initiale de cette spécification n'existent plus : ils supposaient un mécanisme de lien qui ouvre une session, aujourd'hui supprimé.

### 6.2 D'où vient "mot de passe défini"

1. Le drapeau `password_set` de `user_security_metadata` (ajouté au lot 3) ne sert plus à la résolution d'identité (6.1), mais reste la source de vérité pour deux usages : choisir le contenu du lien envoyé par `sendLearnerAccessEmail` (W5) et alimenter `connexion_indicators` (chapitre 20).
2. Il vaut faux au provisionnement (`ensureLearnerAccount`, W12) et vrai dès qu'un mot de passe est défini, par n'importe quel parcours qui aboutit à `ConnexionReinitialisation.tsx` (W5, W8) ou à la création de compte (W7).
3. Il est écrit exclusivement par le rôle de service (`markPasswordChanged`, appelé côté serveur). La policy de mise à jour de `user_security_metadata` ne laisse pas un apprenant positionner son propre drapeau.

### 6.3 Limitation de débit et journalisation

Les seuils s'appuient sur les fonctions existantes `check-login-attempt` et `log-login-attempt`, étendues à la résolution d'identité et à l'envoi de liens.

| Action | Par adresse | Par adresse IP | Au-delà |
|--------|-------------|----------------|---------|
| Résolution d'identité | 10 par heure | 20 par heure | `throttled`, message uniforme |
| Envoi de l'email d'accès ou de réinitialisation (RG-08) | 3 par heure | 10 par heure | Message d'envoi habituel, aucun email émis |
| Saisie de mot de passe | Compteur existant conservé (RG-09) | 20 par heure | Blocage temporaire existant |

Fenêtre glissante, compteurs tenus côté serveur, jamais dans le navigateur. Chaque résolution est journalisée avec l'adresse hachée, l'adresse IP et l'état renvoyé, conservés 30 jours (RG-24), pour détecter un balayage d'adresses.

### 6.4 Mode dégradé si la résolution ne répond pas (réécrit le 2026-09-18)

La détection devient un point de passage obligé du parcours : sa panne ne doit pas fermer la porte. Si le service ne répond pas dans les 3 secondes, renvoie une erreur, ou si le navigateur n'exécute pas le script, l'écran bascule sur le formulaire de connexion classique, avec les champs email et mot de passe affichés ensemble, et le lien "Mot de passe oublié" toujours visible.

Ce repli fonctionne parce qu'il n'existe plus qu'une seule voie de sortie, indépendante de la résolution : la vérification du mot de passe passe par l'authentification. Un apprenant sans mot de passe encore défini utilise "Mot de passe oublié" comme n'importe quel autre apprenant en difficulté. Personne n'est bloqué.

Le message accompagnant le repli reste discret, ce n'est pas un écran d'erreur : voir le mode dégradé au chapitre 10.1. Les bascules en mode dégradé sont comptées et suivies comme incident, le repli n'étant jamais le comportement nominal.

---

## 7. Table de routage après authentification

| Situation | Destination |
|-----------|-------------|
| Destination mémorisée valide et autorisée pour le rôle | La destination mémorisée |
| Apprenant, sans destination mémorisée | `/espace-apprenant/tableau-de-bord` |
| Apprenant arrivant sur une route staff | `/espace-apprenant/tableau-de-bord`, une seule fois |
| Staff, sans destination mémorisée | `/dashboard` |
| Staff arrivant sur la porte apprenant | `/dashboard`, sans déconnexion |
| Apprenant arrivant sur `/auth` | `/espace-apprenant/tableau-de-bord`, sans déconnexion ni message d'erreur |
| Membre du staff également inscrit à une formation | `/dashboard`. Son espace apprenant reste accessible depuis un lien explicite du back-office, sur sa propre adresse, sans passer par la prévisualisation |
| Compte marqué changement de mot de passe obligatoire | `/force-password-change`, puis la destination initiale |
| Compte sans rôle identifiable | Écran "Compte sans accès", avec contact support |

---

## 8. Boucles de redirection à la connexion staff

### Causes identifiées

**L1.** `useAuth` redirige vers `/auth` dès que la session est absente, y compris pendant un rafraîchissement de jeton, alors que `/auth` redirige vers `/dashboard` dès qu'une session apparaît. Les deux mécanismes se répondent. Références : `src/hooks/useAuth.ts:57-66`, `src/pages/Auth.tsx:50-68`.

**L2.** `Auth.tsx` déclenche deux évaluations concurrentes, par abonnement aux changements d'état et par lecture directe de la session, chacune capable d'émettre une navigation.

**L3.** `RequireStaff` conclut "accès autorisé" par défaut lorsqu'aucun profil n'est trouvé et que le compte n'est pas marqué apprenant. Un compte sans rôle entre donc dans le back-office, y échoue, et repart vers la connexion. Référence : `src/components/RequireStaff.tsx:18-21`.

**L4.** La redirection vers `/force-password-change` est émise par un hook de données, tandis que l'écran cible renvoie vers `/dashboard` sans vérifier la condition qui a motivé la redirection. Références : `src/hooks/useAuth.ts:71-76`, `src/pages/ForcePasswordChange.tsx:68`.

**L5.** `useAuth` est appelé depuis de nombreux composants, dont plusieurs cartes et tiroirs du CRM. Chaque instance peut émettre sa propre navigation, sans coordination.

### Règles cibles

- Un seul fournisseur d'état de session pour toute l'application, monté au-dessus du routeur.
- Aucune redirection émise depuis un hook de données ou un composant de contenu. Seules les gardes de route naviguent.
- Aucune redirection tant que l'état de session n'est pas résolu.
- Les états intermédiaires, rafraîchissement de jeton et perte réseau, ne sont pas assimilés à une déconnexion.
- Un compte sans rôle est un état terminal explicite, pas une valeur par défaut permissive.
- La contrainte de changement de mot de passe est portée par une garde dédiée, qui la relit elle-même et libère l'utilisateur lorsqu'elle est levée.

---

## 9. Emails impactés (réécrit le 2026-09-18)

`send-learner-magic-link` et `create-learner-account` sont supprimées avec la table `learner_magic_links` (démolition du lien magique). Le point d'envoi commun devient `sendLearnerAccessEmail` / `send-learner-access-email` (`supabase/functions/_shared/learner-account.ts`), dont le lien varie selon `password_set` (W5) : lien de réinitialisation Supabase (1 heure) si aucun mot de passe n'est encore défini, lien de préremplissage `/connexion?email=` sinon.

| Email | Fonction actuelle | État |
|-------|-------------------|------|
| Accès après inscription à une formation e-learning (achat, intra, inter) | `sendLearnerAccessEmail`, appelée par `add-training-participant` | Livré. Un seul email, quelle que soit la source, dont le contenu dépend de `password_set` |
| Renvoi manuel de l'email d'accès | `send-learner-access-email` | Livré. Réservé au staff, depuis la fiche participant ; jamais appelé par un visiteur anonyme |
| Relance avant démarrage | `process-elearning-start-reminders` | Livré. Régénère le même email d'accès via `learnerAccessLink`, sans recréer le compte |
| Erratum e-learning | `send-elearning-erratum` | Livré. Rebranché sur `learnerAccessLink` |
| Réinitialisation de mot de passe et premier accès (W5, W8) | `send-password-reset`, lien `recovery` généré par `learnerAccessLink` | Livré. Même écran de destination (`ConnexionReinitialisation.tsx`) pour les deux cas, texte identique |
| Notification communauté | `notify-practice-comment` | Inchangé, hors périmètre de la démolition |
| Reprise à la démolition du lien magique | `scripts/bascule-demolition-lien-magique.sql` | Mesure seulement (chapitre 17) ; l'envoi d'un email de prévenance reste à la discrétion du produit |
| Changement d'adresse | `change_learner_email` | Livré (W13) |

Les textes des emails encore en circulation sont au chapitre 11.

---

## 10. Textes d'interface

Libellés de référence. Ton : vous, phrases courtes, aucune formulation culpabilisante, aucun terme technique (jeton, session, authentification) visible par l'apprenant. Un contact support est présent en pied de chaque écran : `contact@supertilt.fr`.

### 10.1 Page de connexion

| Écran ou état | Titre | Texte | Actions |
|---------------|-------|-------|---------|
| Étape 1, saisie | Se connecter | Indiquez l'adresse email utilisée lors de votre inscription. | Champ "Adresse email", bouton "Continuer", lien "Créer un compte" |
| Étape 2, état `password` | Content de vous revoir | Saisissez votre mot de passe pour accéder à vos formations. | Adresse rappelée et modifiable par "Revenir à la page de connexion", champ "Mot de passe", bouton "Me connecter", lien "Mot de passe oublié" |
| Étape 2, mot de passe refusé | Content de vous revoir | Email ou mot de passe incorrect. Vous pouvez réessayer, ou réinitialiser votre mot de passe. | Idem, avec le compteur d'essais existant |
| État `unknown` | Nous n'avons pas trouvé de compte | Aucun compte n'est associé à {email}. Si vous avez suivi une formation avec nous, essayez l'adresse utilisée lors de votre inscription, souvent votre adresse professionnelle. Sinon, créez un compte gratuit pour commencer. | Bouton principal "Créer un compte gratuitement", lien "Essayer une autre adresse", lien "Écrire au support" |
| État `throttled` | Trop de tentatives | Vous avez fait plusieurs demandes coup sur coup. Réessayez dans quelques minutes. | Lien "Écrire au support" |
| Mode dégradé | Se connecter | Nous n'avons pas pu identifier votre compte pour l'instant. Saisissez votre adresse et votre mot de passe. | Champs email et mot de passe ensemble, bouton "Me connecter", lien "Mot de passe oublié" |

Les états `link` et `activation` de la version initiale sont retirés le 2026-09-18 avec le mécanisme de lien qu'ils décrivaient (chapitre 6.1).

### 10.2 Ouverture d'un lien (chapitre retiré le 2026-09-18)

Ce chapitre décrivait l'écran ouvert par le lien magique : connexion automatique, proposition de mot de passe non bloquante, gestion d'une session déjà ouverte pour une autre personne. Ce mécanisme est supprimé (chapitre 6.1) ; aucun de ces écrans n'existe plus.

Ce qui reste, un lien menant toujours à une saisie de mot de passe, jamais à une session déjà ouverte, est déjà décrit au 10.3 ("Définition du mot de passe", "Lien de réinitialisation expiré") et au chapitre 10.1 (`/connexion?email=`, préremplissage sans jeton).

### 10.3 Mot de passe

| Écran ou état | Titre | Texte | Actions |
|---------------|-------|-------|---------|
| Mot de passe oublié | Mot de passe oublié | Indiquez l'adresse email de votre compte. Nous vous enverrons un lien pour définir un nouveau mot de passe. | Champ email, bouton "Envoyer le lien", lien "Je me souviens de mon mot de passe" |
| Confirmation d'envoi | Vérifiez votre boîte mail | Si un compte existe pour cette adresse, un email vient de partir. Le lien est valable 1 heure. | Lien "Retour à la connexion" |
| Définition du mot de passe | Choisissez votre mot de passe | Au moins 8 caractères, avec une majuscule, une minuscule, un chiffre et un caractère spécial. | Champs "Mot de passe" et "Confirmation", bouton "Enregistrer et continuer" |
| Lien de réinitialisation expiré | Ce lien a expiré | Les liens de réinitialisation sont valables 1 heure. Demandez-en un nouveau. | Bouton "Recevoir un nouveau lien" |

### 10.4 Cas particuliers

| Écran ou état | Titre | Texte | Actions |
|---------------|-------|-------|---------|
| Compte sans accès | Votre compte n'a pas encore d'accès | Votre compte existe, mais aucune formation ni aucun espace ne lui est encore rattaché. Écrivez-nous, nous réglons cela rapidement. | Lien "Écrire au support", bouton "Se déconnecter" |
| Création de compte, adresse déjà connue | Vous avez déjà un compte | Un compte existe déjà pour cette adresse. Connectez-vous. | Bascule vers l'étape 2 de la connexion, adresse pré-remplie |
| Déconnexion | Aucun écran | Retour à l'accueil, sans message | Aucune |

---

## 11. Emails (réécrit le 2026-09-18)

Variables entre accolades. Le tutoiement existant, piloté par `sponsor_formal_address` et les suffixes `_tu` et `_vous` des modèles, est conservé : les textes ci-dessous sont la version "vous". E-A et E-B, distinctes dans la version initiale, sont fusionnées : `sendLearnerAccessEmail` envoie le même email quelle que soit la source de provisionnement (achat, intra, inter, relance, erratum), avec un contenu qui varie seulement selon `password_set` (chapitre 6.2). E-C n'existe plus : il n'y a plus de "lien de connexion demandé depuis la page de connexion" distinct de "mot de passe oublié" (E-D).

### E-A. Email d'accès à l'espace apprenant (W5, W12), texte réellement livré

Deux variantes, selon `password_set`, envoyées par la même fonction (`sendLearnerAccessEmail`) :

Objet si `password_set = false` : Créez votre mot de passe SuperTools

> Bonjour,
>
> Votre espace apprenant est prêt (pour la formation « {training_name} », quand elle est connue). Créez votre mot de passe pour y accéder.
>
> [Créer mon mot de passe]

Objet si `password_set = true` : Accéder à votre espace SuperTools

> Bonjour,
>
> Votre espace apprenant est prêt (pour la formation « {training_name} », quand elle est connue). Connectez-vous avec votre adresse et votre mot de passe.
>
> [Accéder à mon espace]

Le lien de la première variante est un lien de réinitialisation Supabase, valable 1 heure, à usage unique (10.3) ; celui de la seconde ne porte aucun jeton et n'expire jamais (W5, point 2). Ce texte, plus court que celui envisagé en 2026-09-14, reste à enrichir d'une mention de durée de validité pour la première variante (RG-15) et de la conduite à tenir si le lien ne fonctionne plus — écart connu avec RG-15, à corriger dans une prochaine itération du modèle `learner_access_email`.

### E-D. Réinitialisation de mot de passe (W8), texte réellement livré (`send-password-reset`)

Objet : Réinitialisation de votre mot de passe SuperTools

> Bonjour,
>
> Vous avez demandé à réinitialiser votre mot de passe SuperTools.
>
> Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :
>
> [Choisir un nouveau mot de passe]

Le lien est valable 1 heure et ne fonctionne qu'une fois (`ConnexionReinitialisation.tsx`, chapitre 10.3). Ce même écran de destination sert aussi bien à ce parcours qu'à E-A (`password_set = false`) : le texte affiché à l'apprenant ne distingue pas les deux cas ("Nouveau mot de passe" / "Choisissez un nouveau mot de passe pour sécuriser votre compte", chapitre 10.3), le paramètre `mode=activation` prévu en 2026-09-14 n'ayant finalement pas été branché sur un texte différent.

### E-E. Email de reprise, envoyé une fois à la première bascule (2026-09-15, Q7)

Objet : Votre espace apprenant SuperTilt évolue

> Bonjour {first_name},
>
> Votre espace apprenant change d'adresse de connexion. Rien ne se perd : vos formations, vos documents et votre progression sont inchangés.
>
> Ce qui change : une vraie page de connexion, à mémoriser une fois pour toutes.
>
> [Aller à la page de connexion]
>
> Votre identifiant reste l'adresse {email}. Si vous aviez un mot de passe, il fonctionne toujours. Sinon, indiquez simplement votre adresse et nous vous enverrons un lien.
>
> Les anciens liens d'accès reçus par email ne fonctionnent plus. C'est volontaire, pour la sécurité de votre compte.

Envoyé lors du lot 4 (chapitre 21), avant la démolition du lien magique. La démolition elle-même (chapitre 17.5) n'a pas nécessité de second envoi de masse : `scripts/bascule-demolition-lien-magique.sql` ne mesure que l'exposition, l'email de prévenance restant à la discrétion du produit.

### E-F. Changement d'adresse email (W13)

Deux messages.

Vers la nouvelle adresse, objet : Votre nouvelle adresse de connexion

> Bonjour {first_name},
>
> L'adresse de votre espace apprenant est désormais {new_email}. Vos formations et votre progression sont inchangées.
>
> [Me connecter]
>
> Ce lien est valable 30 minutes.

Vers l'ancienne adresse, objet : L'adresse de votre compte a été modifiée

> Bonjour {first_name},
>
> L'adresse de connexion de votre espace apprenant a été remplacée par {new_email_masque}. Les liens envoyés à cette ancienne adresse ne fonctionnent plus.
>
> Si vous n'êtes pas à l'origine de ce changement, écrivez-nous immédiatement à contact@supertilt.fr.

---

## 12. Arbitrages

### 10.1 Décisions arrêtées le 2026-09-14

| # | Question | Décision | Conséquences dans la spécification |
|---|----------|----------|------------------------------------|
| Q1 | Le mot de passe reste-t-il obligatoire pour un apprenant ? | **Non**, rendu le 2026-09-14. Mot de passe optionnel, proposé après la première connexion par lien, jamais imposé. **Révisé le 2026-09-18 : oui, de facto.** Le lien magique est intégralement supprimé — il ne fait plus partie des fonctionnalités disponibles, sans exception. Un compte sans mot de passe est aiguillé vers l'étape mot de passe comme tout autre compte ; son seul recours est "mot de passe oublié", qui force la définition d'un mot de passe avant d'entrer. | PR3, PR4, chapitre 6.1, W3, W5, W12 (réécrits le 2026-09-18). RG-04, RG-05, RG-06 retirées. Aucun apprenant n'entre plus dans son espace sans, au terme du parcours, avoir défini un mot de passe. |
| Q2 | Détecter le compte à la saisie de l'email, ou message neutre systématique ? | **Détecter**, avec limitation de débit et message uniforme en cas d'abus. | Chapitre 6 : contrat du service de résolution, **trois** états d'aiguillage depuis le 2026-09-18 (cinq à l'origine), seuils chiffrés, journalisation 30 jours. RG-12, RG-24, RG-26. |
| Q3 | Durées de validité des liens ? | **Connexion 30 minutes, activation 7 jours, réinitialisation 1 heure. Tous à usage unique.** Rendu le 2026-09-14, **caduc depuis la révision de Q1** : les liens de connexion et d'activation à durée propre n'existent plus. Seule demeure la durée du lien de réinitialisation Supabase natif, 1 heure, réutilisée par W5 comme par W8. | RG-06 retirée. Les textes annonçant un lien valable un an et réutilisable, notamment l'erratum e-learning, ont bien été réécrits (chapitre 9), sur la fonction d'accès unique plutôt que sur des durées spécifiques par email. |
| Q5 | Une porte unique ou deux portes ? | **Deux portes, et `/auth` ne bouge pas.** Formulaire, anti-brute force et changement de mot de passe conservés à l'identique. Seules les corrections du chapitre 8 s'appliquent, et elles portent sur les gardes de route et le fournisseur de session, pas sur l'écran. | Chapitre 0, chapitre 7. Une seule exception au non-changement, validée le 2026-09-14 : un apprenant qui atteint `/auth` est routé vers son espace au lieu d'être déconnecté avec "Accès réservé" (`src/pages/Auth.tsx:121-131`). Quatre lignes, aucun changement d'écran. |
| Q7 | Que faire des comptes et jetons existants ? | **Invalider les jetons en circulation au basculement, communiquer par un email de reprise, conserver les comptes et les mots de passe.** | Chapitre 17 : plan de bascule, parcours de transition par population, volumétrie mesurée. |
| Q4 | Un achat doit-il créer le compte automatiquement ? | **Oui.** Compte provisionné sans mot de passe dès l'encaissement, email d'activation immédiat. Le mode `woocommerce` disparaît comme voie d'accès. | Nouveau workflow W12, suppression du réglage `elearning_access_mode`, refonte de `send-elearning-access` en email d'activation, D7 résolu. |

### 10.2 Arbitrages restants

| # | Question | Recommandation | Impact si l'autre option est retenue |
|---|----------|----------------|--------------------------------------|
| Q6 | Code à six chiffres en complément du lien cliquable ? | Oui, à terme. Les filtres de sécurité des messageries d'entreprise pré-cliquent les liens et consomment les tokens à usage unique. Avec un lien de connexion à 30 minutes et à usage unique (Q3), le risque de lien déjà consommé à l'ouverture devient concret pour les apprenants intra. | Sans code de secours, ces apprenants dépendront du renvoi de lien proposé par W10. |
| Q8 | Faut-il fusionner `training_participants`, `lms_enrollments` et les comptes en une notion unique d'apprenant ? | Oui, au moins au niveau d'une vue de résolution d'identité. Q4 rend la question plus pressante : le provisionnement à l'achat écrit dans les trois référentiels à la fois. | Sans cela, la règle RG-02 reste coûteuse à appliquer dans chaque parcours. |

---

## 13. Critères d'acceptation

1. Depuis `/`, le bouton "Se connecter" ouvre une page de connexion avec un champ email et un accès à la création de compte.
2. Un apprenant disposant d'un mot de passe se connecte depuis cette page sans lien reçu par email.
3. Un apprenant cliquant sur un lien d'accès valide arrive sur son tableau de bord, connecté, sans saisir de mot de passe.
4. Un apprenant Academy peut se reconnecter depuis la page de connexion.
5. `/apprenant/connexion` sans token affiche la page de connexion, jamais une erreur.
6. Un lien expiré ou déjà utilisé propose, dans le même écran, de recevoir un nouveau lien.
7. Un apprenant déjà connecté qui ouvre un lien d'accès ne repasse pas par une authentification.
8. Après connexion depuis un lien profond, l'apprenant arrive sur la page initialement demandée.
9. Un lien d'accès ne permet plus de modifier le mot de passe d'un compte existant.
10. Le portail et le player LMS n'acceptent plus d'identité fournie par l'URL, hors prévisualisation staff authentifiée.
11. Les fonctions de portail ne sont plus exécutables par un appelant anonyme.
12. Un membre du staff se connecte et atteint `/dashboard` sans aller-retour de redirection.
13. Un compte sans rôle voit un écran explicite et n'entre jamais dans une boucle.
14. Une inscription à une formation e-learning (achat ou ajout par le staff) déclenche la création du compte et l'envoi immédiat de l'email d'accès. *(critère 14, reformulé le 2026-09-18 : n'est plus un email d'activation à durée fixe, voir chapitre 9 et E-A.)*
15. *Retiré le 2026-09-18 : décrivait un apprenant se reconnectant indéfiniment par lien sans jamais définir de mot de passe. Ce parcours n'existe plus (PR4) — un tel apprenant est aiguillé vers l'étape mot de passe (W3) à chaque connexion, avec "mot de passe oublié" comme recours.*
16. Un lien de réinitialisation ouvert une seconde fois est refusé et propose l'envoi d'un nouveau lien (`ConnexionReinitialisation.tsx`, chapitre 10.2).
17. Un lien de réinitialisation ouvert plus d'une heure après son émission est refusé de la même manière. *(critère 17, reformulé le 2026-09-18 : les durées "connexion 30 minutes" et "activation 7 jours" de RG-06 n'existent plus, RG-06 étant retirée.)*
18. Le réglage `elearning_access_mode` n'existe plus et aucun email d'accès e-learning ne renvoie vers le site marchand comme voie de connexion.
19. Le service de résolution d'identité ne renvoie jamais autre chose qu'un état d'aiguillage, et répond `throttled` au-delà des seuils du chapitre 6.
20. Un apprenant ne peut pas modifier son propre drapeau `password_set`.
21. Le changement d'adresse d'un apprenant conserve l'accès à toutes ses formations et invalide les liens émis vers l'ancienne adresse.
22. Un jeton de lien magique émis avant la démolition du 2026-09-18 ne permet plus d'entrer ; l'ancienne URL `/connexion/lien?token=` redirige vers `/connexion`, jamais vers une erreur (chapitre 17.5).
23. L'email d'activation d'un compte créé automatiquement informe la personne de la création du compte et de la marche à suivre pour en demander la suppression.
24. À l'étape mot de passe, un gestionnaire de mots de passe enregistre bien le couple adresse et mot de passe.
25. Si le service de résolution ne répond pas, l'écran de connexion bascule en mode dégradé et laisse entrer aussi bien un apprenant avec mot de passe qu'un apprenant sans mot de passe.
26. Un apprenant qui atteint `/auth` est routé vers son espace, sans déconnexion ni message d'erreur.
27. Un membre du staff également inscrit à une formation atteint son espace apprenant sans passer par la prévisualisation.
28. Aucun écran de `/auth` n'est modifié : formulaire, anti-brute force et changement de mot de passe sont identiques avant et après.

---

## 14. Stratégie de test

Chaque critère du chapitre 13 est rattaché à un dispositif. Un critère sans test est une intention.

### 14.1 Jeu de comptes de test

Six comptes à créer dans l'environnement de test, couvrant la matrice du chapitre 6 et les populations du chapitre 2.

| Compte | État | Sert à vérifier |
|--------|------|-----------------|
| T1 | Compte avec mot de passe, inscrit à deux formations | W2, routage, agrégation multi-formations |
| T2 | Compte sans mot de passe, provisionné | W3, W5, proposition de mot de passe et refus |
| T3 | Participant connu, aucun compte | W4, activation |
| T4 | Adresse inconnue | W6 |
| T5 | Compte staff | Routage staff, non-divulgation du rôle par la résolution |
| T6 | Compte staff également inscrit à une formation | Accès aux deux espaces sans prévisualisation |

### 14.2 Tests unitaires (`vitest`)

- Normalisation de l'email : casse, espaces de bord, caractères invisibles.
- Résolution d'identité : les cinq états, à partir de données simulées.
- Validation de la destination mémorisée : une URL externe est ignorée, une URL interne est conservée (RG-10).
- Calcul des expirations : 30 minutes, 7 jours, 1 heure, et la frontière exacte.
- Décision de routage : la table du chapitre 7, cas par cas, sans rendu React.

### 14.3 Tests d'intégration des fonctions serveur

- Résolution d'identité : réponse limitée à l'état, aucune fuite de nom, de rôle ni de formation (RG-26, critère 19).
- Seuils de limitation : le sixième appel sur une adresse dans l'heure renvoie `throttled` et n'envoie aucun email.
- Consommation de jeton : une seconde présentation échoue (critère 16).
- Non-régression S1 : présenter un jeton valide pour une adresse ayant déjà un compte ne modifie jamais son mot de passe (critère 9).
- Non-régression S4 : les fonctions du portail refusent un appelant anonyme (critère 11).
- `password_set` : un apprenant authentifié ne peut pas modifier sa propre ligne (critère 20).
- Changement d'adresse : les formations suivent, les liens de l'ancienne adresse sont invalidés (critère 21).

### 14.4 Tests de parcours (`playwright`, fichier `e2e/connexion.spec.ts`)

Le fichier `e2e/smoke.spec.ts` existant couvre déjà le chargement de la landing, la présence du lien "Se connecter" et le formulaire `/auth`. Les parcours de connexion viennent dans un fichier dédié.

| Scénario | Critères couverts |
|----------|-------------------|
| Depuis `/`, "Se connecter" ouvre la page de connexion avec un champ email | 1 |
| T1 se connecte avec son mot de passe et atteint son tableau de bord | 2 |
| T2 demande un lien, l'ouvre, arrive connecté, refuse le mot de passe, se reconnecte par lien | 3, 15 |
| T3 saisit son adresse, reçoit un lien d'activation, l'ouvre, atteint son cours | 14 |
| T4 voit l'écran "aucun compte" et ses trois pistes, sans création silencieuse | 5 (état `unknown`) |
| `/apprenant/connexion` sans jeton affiche la page de connexion | 5 |
| Un lien expiré puis un lien déjà utilisé proposent le renvoi dans le même écran | 6, 16, 17 |
| T1 déjà connecté ouvre un lien : pas de nouvelle authentification | 7 |
| Redirection depuis `/espace-apprenant/pratique?post=` puis connexion : retour sur la page demandée | 8 |
| T5 se connecte et atteint `/dashboard` sans aller-retour de redirection | 12 |
| Un compte sans rôle voit l'écran dédié et n'entre pas en boucle | 13 |
| Un ancien jeton présenté après bascule affiche l'écran de renvoi | 22 |
| Le service de résolution indisponible fait basculer l'écran en mode dégradé | Chapitre 6.4 |

Les redirections et les boucles se vérifient en comptant les entrées d'historique de navigation, pas seulement l'URL finale : une boucle corrigée doit laisser un historique propre.

### 14.5 Ce qui reste manuel

- Rendu des six emails dans les principales messageries et comportement des filtres qui pré-cliquent les liens.
- Enregistrement du couple adresse et mot de passe par un gestionnaire de mots de passe (critère 24).
- Lecture d'écran et navigation au clavier sur les six écrans.
- Envoi réel de l'email de reprise sur une liste restreinte avant l'envoi général.

---

## 15. Frontière avec le modèle d'autorisation

Cette spécification traite de l'authentification : qui entre, par quelle porte, avec quelle preuve. Elle ne traite pas de l'autorisation : une fois entré, qui a le droit de lire et d'écrire quoi.

Les deux sujets se touchent sur trois points, traités ici et seulement ici. Les trois sont livrés au 2026-09-15 :

1. L'identité applicative provient de la session et jamais de l'URL ni d'un en-tête (PR7, RG-11).
2. Les fonctions du portail cessent d'être exécutables par un appelant anonyme (S4).
3. Le player LMS cesse d'accepter une adresse en paramètre (S5).

Tout le reste relève d'une spécification d'autorisation distincte : périmètre de lecture d'un apprenant sur les cours, les dépôts, la communauté et les évaluations, règles de partage entre apprenants d'une même session, accès du commanditaire intra, accès du formateur, prévisualisation staff. Le traiter dans ce document reviendrait à mélanger deux chantiers de calendriers différents : la connexion est une refonte de parcours, l'autorisation est une reprise du modèle de données et des policies.

Ordre recommandé : livrer d'abord les trois points ci-dessus, qui sont des préalables techniques, puis ouvrir la spécification d'autorisation. L'inventaire des surfaces exposées est fait : `docs/AUDIT_SURFACES_EXPOSEES.md`.

---

## 16. Identité, doublons et adresses partagées

L'adresse email est la clé de rattachement, mais elle n'est unique nulle part dans les tables métier : `training_participants` n'a aucune contrainte d'unicité sur `email`, et `send-learner-magic-link` prend d'ailleurs la première ligne d'un tableau de résultats (`supabase/functions/send-learner-magic-link/index.ts:41-51`). Quatre situations réelles en découlent.

**Un apprenant, plusieurs lignes de participants.** C'est le cas normal : une ligne par formation suivie. Le compte est unique, le rattachement se fait par adresse normalisée, et le portail agrège. Aucun traitement particulier.

**Une adresse pour plusieurs personnes.** Cinq adresses sont dans ce cas aujourd'hui (mesure du chapitre 17.1). Un commanditaire intra qui inscrit trois collaborateurs avec sa propre adresse crée une identité unique qui voit les trois parcours. C'est la conséquence assumée du modèle. Deux conséquences à tenir : l'écran d'ajout de participants doit avertir le staff qu'une adresse déjà utilisée par un autre participant donnera un accès partagé, et les documents nominatifs, attestations et émargements, restent attachés à la ligne de participant, jamais au compte.

**Une personne, plusieurs adresses.** Adresse professionnelle pour une formation intra, adresse personnelle pour un achat Academy : deux comptes distincts, chacun ne voyant que son périmètre. La fusion de comptes n'est pas couverte. Le support traite ces cas par W13, en alignant les adresses.

**Un participant sans adresse valide.** Il ne peut pas être provisionné (RG-18). Il conserve l'accès aux parcours publics à jeton, questionnaires, évaluations, émargement, qui ne sont pas des connexions et ne créent pas de compte.

---

## 17. Plan de bascule et transition des utilisateurs existants

Arbitrage Q7 rendu le 2026-09-14 : invalidation des jetons en circulation au basculement, email de reprise, conservation des comptes et des mots de passe.

### 17.1 Volumétrie mesurée

Mesures faites en base le 2026-09-14.

| Population | Volume |
|-----------|--------|
| Apprenants distincts, toutes origines | 165 adresses |
| Lignes de participants aux formations | 197, pour 163 adresses distinctes |
| Participants sans adresse email | 0 |
| Inscrits LMS distincts | 90 |
| Présents dans les deux référentiels | 88 |
| Participants sans inscription LMS | 75 |
| Inscrits LMS sans ligne de participant, population aujourd'hui sans chemin de connexion (D5) | 2 |
| Adresses partagées entre plusieurs personnes distinctes | 5 |

Deux enseignements. D'abord la bascule est légère : un email de reprise vers 165 adresses, et un support capable de traiter les cas restants à la main. Ensuite les adresses partagées ne sont pas une hypothèse d'école, il y en a cinq, à traiter selon le chapitre 16 avant l'envoi.

Le volume de jetons encore valides n'a pas pu être mesuré, la table `learner_magic_links` n'étant pas exposée à l'outil d'interrogation. Ce comptage est à faire avant la bascule ; il ne change pas le plan, seulement le message de l'email de reprise.

### 17.2 Parcours de transition, population par population

Aucune de ces populations ne doit rencontrer de rupture. Le tableau se lit comme un engagement.

| Population | Situation après bascule | Ce qu'elle fait | Rupture possible |
|-----------|------------------------|-----------------|------------------|
| Compte avec mot de passe (tous les comptes existants) | `password_set = true`, mot de passe inchangé | Se connecte comme avant, depuis la nouvelle page | Aucune. Le mot de passe fonctionne, aucune réinitialisation |
| Apprenant utilisant un lien reçu avant la bascule | Jeton invalidé | Ouvre son ancien lien, voit l'écran de renvoi, reçoit un lien neuf en une action | Un clic de plus, une seule fois |
| Inscrit Academy (2 adresses sans ligne de participant) | Compte avec mot de passe | Peut enfin se connecter, ce qui était impossible avant | Aucune, c'est un gain |
| Participant connu sans compte | Aucun compte | Saisit son adresse, reçoit un lien d'activation | Aucune |
| Adresse partagée entre plusieurs personnes (5 cas) | Un compte pour l'adresse, plusieurs parcours visibles | Voit les formations de toutes les personnes rattachées à l'adresse | À traiter avant la bascule : contacter, séparer les adresses lorsque c'est possible |
| Membre du staff | Compte inchangé, `/auth` inchangé | Se connecte comme avant | Aucune |
| Apprenant ayant gardé `/auth` en signet | Compte apprenant | Est routé vers son espace au lieu du message "Accès réservé" | Aucune, c'est un gain |
| Apprenant ayant gardé `/apprenant` en signet | Ancienne URL redirigée 90 jours | Arrive sur la nouvelle page de connexion | Aucune |

### 17.3 Déroulé

1. **Avant.** Compter les jetons non expirés. Traiter les 5 adresses partagées. Mesurer les indicateurs du chapitre 20 pour disposer d'un point de comparaison. Envoyer l'email de reprise à une liste restreinte pour vérifier son rendu.
2. **Au basculement.** Tous les jetons en circulation sont invalidés en une opération. La faille S1 se referme le jour même, sans attendre l'expiration naturelle.
3. **Immédiatement après.** Envoi de l'email de reprise E-E aux 165 adresses.
4. **Pendant 90 jours.** Les anciennes URL, `/apprenant`, `/apprenant/connexion`, `/apprenant/reset-password`, restent servies et redirigent vers les nouveaux écrans. Un ancien jeton présenté n'affiche jamais d'erreur technique mais l'écran de renvoi du chapitre 10.2.
5. **Ce qui est conservé.** Les comptes, les mots de passe, les inscriptions, la progression. Aucune réinitialisation de masse, aucune action obligatoire demandée à qui que ce soit.
6. **Surveillance des sept premiers jours.** Volume d'envois de liens, taux de connexion réussie du premier coup, tickets support. Une hausse des demandes de lien au-delà du double de la normale déclenche une revue avant de poursuivre.
7. **Retour arrière.** Possible tant que les anciens écrans sont servis. Passé les 90 jours, il n'est plus prévu.

### 17.4 Engagements de fluidité

- Personne n'est contraint de créer un mot de passe. *(Engagement tenu au 2026-09-15 ; caduc depuis la révision de Q1 le 2026-09-18, voir 17.5 : un mot de passe est désormais nécessaire pour entrer, au plus tard au fil de la première connexion suivant la démolition.)*
- Personne ne perd l'accès à ses formations, ses documents ou sa progression.
- Aucun apprenant ne rencontre d'écran d'erreur nue : toute impasse porte l'action de reprise.
- Une seule action supplémentaire est demandée, au plus une fois, à ceux qui cliquent sur un ancien lien.
- Le support dispose de la liste des 165 adresses et peut renvoyer un lien à la demande.

### 17.5 Deuxième bascule : démolition du lien magique (2026-09-18)

Le 17.1-17.4 documentent la première bascule (2026-09-15), qui conservait le lien magique et le mot de passe optionnel. Le 2026-09-18, l'arbitrage Q1 est révisé : le lien magique est intégralement supprimé, sans fenêtre de compatibilité de 90 jours — bascule nette, cohérente avec « corriger vite un échec » plutôt qu'avec une dépréciation progressive.

**Mesure avant fusion**, jouée en base via `scripts/bascule-demolition-lien-magique.sql` :

| Mesure | Résultat |
|--------|----------|
| Comptes `password_set = false` (dépendent encore d'un lien pour entrer) | 1 |
| Jetons `learner_magic_links` encore valides | 142, pour 70 apprenants distincts |

**Pourquoi aucun blocage, contrairement à la première bascule.** La première bascule (17.3) prévoyait un email de reprise obligatoire avant l'envoi en masse, parce qu'un ancien lien invalidé menait alors à une impasse réelle. Ce n'est plus le cas : `/connexion/lien` redirige désormais vers `/connexion` (jamais de cul-de-sac, chapitre 10.2) et "mot de passe oublié" reste utilisable par n'importe quel compte, avec ou sans mot de passe déjà défini (W3). Rien n'empêche donc de fusionner la démolition sans attendre.

**Ce qui n'est pas fait, à la discrétion du produit.** Contrairement à E-E (17.3, point 3), aucun email n'est envoyé en masse aux 70 apprenants concernés : le script ne fait que mesurer l'exposition. Un envoi ciblé, sur le modèle d'E-E, reste possible si le produit juge que prévenir ces apprenants avant qu'ils ne remarquent d'eux-mêmes que l'ancien lien ne fait plus rien est préférable à les laisser découvrir "mot de passe oublié" par eux-mêmes.

**Après fusion.** Le compte à `password_set = false` et les apprenants ayant un jeton encore valide suivent tous désormais W3 : à leur prochaine tentative de connexion, ils sont aiguillés vers l'étape mot de passe et utilisent "mot de passe oublié" pour en définir un.

---

## 18. Données personnelles et conservation

**Création de compte sans demande explicite.** W12 crée un compte pour une personne qui n'a rien demandé, à partir de son email de facturation. C'est licite au titre de l'exécution du contrat de formation, à condition de l'annoncer : l'email d'activation indique qu'un compte a été créé, qui est responsable de traitement, quelles données y figurent et comment en demander la suppression (RG-22).

**Politique de confidentialité.** La page existante doit être complétée sur trois points : création automatique de compte à l'achat, journalisation des tentatives de connexion et des résolutions d'identité avec leurs durées, durée de vie des comptes inactifs.

**Durées de conservation.**

| Donnée | Durée | Fondement |
|--------|-------|-----------|
| Jetons de connexion et d'activation | Effacés à consommation ou à expiration, purge quotidienne | Minimisation |
| Journaux de résolution d'identité et de tentatives de connexion | 30 jours (RG-24) | Sécurité |
| Compte apprenant sans connexion ni inscription active | 3 ans, puis signalement pour suppression (RG-23) | Minimisation |
| Données de formation, émargements, évaluations, attestations | Inchangées, selon les obligations Qualiopi | Obligation légale |

La suppression d'un compte d'accès n'emporte pas la suppression des données de formation, qui relèvent d'une obligation de conservation distincte. Le message adressé à la personne doit le dire clairement.

**Droits.** Demande de suppression traitée sous 30 jours et confirmée par email (RG-25). L'export des données d'un apprenant n'est pas couvert par cette spécification.

---

## 19. Cas de vie particuliers et ergonomie

**Changement d'adresse.** Traité par W13.

**Pré-clic des liens par les filtres de messagerie (réécrit le 2026-09-18, régression rouverte puis refermée le même jour).** Les passerelles de sécurité d'entreprise ouvrent les liens avant l'utilisateur. Avec un jeton à usage unique, l'apprenant reçoit alors un lien déjà consommé. La démolition avait rouvert cette vulnérabilité : le lien de réinitialisation Supabase natif (W5, W8) envoyait l'`action_link` fourni par `admin.auth.admin.generateLink`, qui pointe vers `auth/v1/verify` — une simple requête GET sur cette URL, même sans exécuter de JavaScript, consomme le jeton avant que l'apprenant ne clique lui-même.

Correctif : l'email ne porte plus jamais cet `action_link`. `learnerAccessLink` et `send-password-reset` construisent leur propre URL, `/connexion/reinitialisation?token_hash=<hashed_token>&type=recovery`, qui pointe vers notre application et ne consomme rien à elle seule. `usePasswordRecoverySession` (`src/hooks/useAuthActions.ts`) distingue ce format d'un nouvel état `confirm`, mais sans écran ni clic ajoutés : `ConnexionReinitialisation.tsx` affiche directement l'écran habituel de définition de mot de passe (10.3), et c'est le clic sur "Enregistrer mon nouveau mot de passe" qui appelle `supabase.auth.verifyOtp({ token_hash, type: "recovery" })` — le seul point de consommation réelle du jeton — avant d'enregistrer le mot de passe. Un pré-clic automatique par un filtre de messagerie ne charge que cette page, sans rien consommer. L'ancien format `#access_token=...&type=recovery` (déjà consommé côté Supabase avant l'arrivée sur la page) reste reconnu pour les emails envoyés avant ce correctif, sans passer par `verifyOtp`.

**Gestionnaires de mots de passe.** Un formulaire en deux étapes casse l'enregistrement du couple identifiant et mot de passe si le champ email disparaît à l'étape 2. L'email reste donc présent dans le formulaire, en lecture seule, avec les attributs d'auto-complétion attendus (RG-20).

**Mobile.** Le lien reçu par email ouvre le navigateur par défaut, qui n'est pas forcément celui où une session existe déjà. Sans conséquence pour le lien de préremplissage `/connexion?email=`, qui n'authentifie jamais par lui-même (W5) ; pour le lien de réinitialisation, valable 1 heure (10.3), l'apprenant doit consulter ses emails dans l'heure.

**Accessibilité.** Les écrans de connexion respectent les exigences déjà appliquées au reste de l'application : navigation au clavier complète, messages d'erreur annoncés aux lecteurs d'écran et associés au champ concerné, contraste suffisant, aucun état signalé par la seule couleur.

**Apprenant qui n'a jamais reçu l'email.** Toutes les impasses convergent vers la même action, le renvoi d'un lien depuis l'écran en cours, complétée par un contact support visible sur chaque écran de connexion.

---

## 20. Indicateurs de succès

À mesurer avant la bascule pour disposer d'un point de comparaison.

| Indicateur | Définition | Cible |
|------------|-----------|-------|
| Taux d'activation | Comptes activés sur comptes provisionnés, à 7 jours | Supérieur à 70 % |
| Connexion réussie du premier coup | Sessions ouvertes sans deuxième tentative ni demande de lien | Supérieur à 85 % |
| Délai d'accès après achat | Encaissement jusqu'à la première ouverture du cours, médiane | Moins de 24 heures |
| Demandes de lien par apprenant actif et par mois | Volume d'envois rapporté aux apprenants actifs | En baisse continue |
| Tickets support liés à l'accès | Part des tickets dont le motif est la connexion | Divisée par deux |
| Liens expirés présentés | Ouvertures de liens hors délai | Surveillé, arbitre le passage au code à six chiffres (Q6) |

Les trois derniers se lisent ensemble : une baisse des demandes de lien accompagnée d'une hausse des liens expirés signalerait une durée de 30 minutes trop courte.

---

## 21. Lotissement

| Lot | Contenu | Pourquoi dans cet ordre |
|-----|---------|------------------------|
| 1 | Fermeture des trajectoires S1 à S5 : jeton qui n'écrase plus de mot de passe, durées et usage unique, fonctions du portail réservées aux appelants authentifiés, identité issue de la session | Indépendant du parcours, corrige des expositions actives, ne demande aucun écran neuf |
| 2 | Fournisseur d'état de session unique, garde de route unique, table de routage du chapitre 7 | Prérequis de tous les écrans, et corrige les boucles staff |
| 3 | Service de résolution d'identité, drapeau `password_set`, limitation de débit | Prérequis de la page de connexion. Livré : fonction `resolve-login-identity`, journal `identity_resolution_log`, seuils 10 par adresse et 20 par IP par heure (relevé à 10 le 18/09/2026, constat en production : une reconnexion répétée en peu de temps déclenchait le freinage) |
| 4 | Écrans de connexion : W1 à W10, redirections des anciennes URL | Livré au 2026-09-15. *Description devenue historique : W5 ouvrait alors une session depuis le lien et les durées de 30 minutes et 7 jours s'appliquaient aux liens émis — supprimé par le lot 7.* |
| 5 | Provisionnement à l'encaissement W12, refonte des emails, suppression de `elearning_access_mode` | Livré côté code : le compte est provisionné à l'inscription, l'email d'activation est unique quelle que soit la source, le réglage a disparu. La bascule elle-même reste une opération manuelle, `scripts/bascule-connexion.sql` |
| 6 | W13, purge des comptes inactifs, indicateurs, politique de confidentialité | Livré. Changement d'adresse atomique sur 26 tables, comptes dormants signalés, indicateurs dans Monitoring, politique de confidentialité à jour |
| 7 | Démolition du lien magique (arbitrage Q1 révisé) : suppression de `learner_magic_links` et des écrans associés, réécriture de `resolve_login_identity` à 3 états | Livré le 2026-09-18. Referme la dette du lot 4 : W5 n'ouvre plus jamais de session sans mot de passe, chapitre 17.5 |

Transverse à tous les lots : les tests du chapitre 14 sont écrits avec le lot qu'ils couvrent, jamais après. Les textes du chapitre 10 et les emails du chapitre 11 sont validés avant le développement du lot 4, les maquettes servant de support à cette validation.

Les lots 1 et 2 sont livrables sans rien changer à ce que voit l'apprenant. La bascule du chapitre 17 intervient à la fin du lot 4.

---

## 22. Inventaire des impacts pour le chiffrage (mis à jour le 2026-09-18)

**Écrans, état livré après démolition**
`/connexion` (étape email, étape mot de passe, état email inconnu, état throttled, mode dégradé — les états `link`/`activation` ont disparu), `/connexion/mot-de-passe-oublie`, `/connexion/reinitialisation` (définition de mot de passe, sert aussi bien W5 que W8), écran "Compte sans accès". `/connexion/lien` n'est plus un écran de consommation de jeton : c'est une redirection vers `/connexion` (chapitre 10.2).

**Routes à conserver en redirection**
`/apprenant`, `/apprenant/connexion`, `/apprenant/reset-password`, `/connexion/lien` : les liens en circulation doivent continuer de fonctionner, jamais vers une page introuvable.

**Fonctions serveur, état livré**
`send-learner-access-email` (remplace `send-learner-magic-link`), `create-academy-account`, `send-password-reset`, `send-elearning-access`, `process-elearning-start-reminders`, `send-elearning-erratum`, `add-training-participant`, `resolve-login-identity`. `send-learner-magic-link`, `create-learner-account` et `redeem-learner-token` sont supprimées.

**Base de données, état livré**
`learner_magic_links`, `validate_learner_token`, `preview_learner_token` et `consume_learner_token` sont supprimées (`supabase/migrations/20260918160000_demolition_lien_magique.sql`). `get_learner_portal_data` corrigée (lot 1). Résolution d'identité entre `training_participants`, `lms_enrollments` et les comptes, réduite à trois états (chapitre 6.1).

**Base de données, ajouts liés aux compléments, état livré**
`user_security_metadata` : colonne `password_set` (ne pilote plus la résolution d'identité depuis le 2026-09-18, garde son rôle pour le choix du lien envoyé et les indicateurs) et policy de mise à jour restreinte au rôle de service. Journal de résolution d'identité avec adresse hachée et purge à 30 jours.

**Tests, état livré**
`e2e/connexion.spec.ts` : les scénarios liés au lien/activation sont retirés, un scénario verrouille la redirection `/connexion/lien` → `/connexion`. Tests unitaires de résolution (trois états), de normalisation et de routage. Tests d'intégration pgTAP des fonctions serveur éditées ou supprimées par la démolition (`supabase/tests/resolution-identite.test.ts`, `identite-session.test.ts`, `changement-adresse.test.ts`, `comptes-et-indicateurs.test.ts`), non-régressions S1 à S5.

**Opérations de bascule, état livré**
Première bascule (17.1-17.4, 2026-09-15) : invalidation en masse des jetons, redirections 90 jours, email de reprise E-E. Deuxième bascule, démolition (17.5, 2026-09-18) : mesure seule (`scripts/bascule-demolition-lien-magique.sql`), pas d'invalidation ni d'email obligatoires, la table étant supprimée directement.

**Documents à mettre à jour**
Politique de confidentialité (création automatique de compte, journalisation, comptes inactifs), textes des emails transactionnels du chapitre 9.

**Réglages**
`elearning_access_mode` : supprimé (arbitrage Q4). Le basculement doit prévoir le retrait du bloc de réglage dans `SettingsGeneral.tsx` et la branche correspondante de `add-training-participant`.
