# Spécifications métier : workflows de connexion apprenant

Statut : spécification. Aucune implémentation à ce stade.
Date : 2026-09-14.

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

- Refonte du mécanisme d'authentification staff `/auth` (formulaire, anti-brute force, force-password-change) : conservé tel quel, hors correction des boucles.
- SSO entreprise, MFA, connexion via réseaux sociaux : non retenus à ce stade, mentionnés en annexe des arbitrages.
- Droits fins et RLS sur les contenus LMS : sujet connexe, traité dans l'audit sécurité, pas dans cette spécification.

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

**PR3. Un lien reçu par email ouvre une session.**
Cliquer sur un lien d'accès connecte, point. Le mot de passe n'est jamais un préalable à l'entrée.

**PR4. Le mot de passe est optionnel.**
Il est proposé, jamais imposé. Un apprenant peut vivre tout son parcours avec des liens de connexion.

**PR5. Aucun cul-de-sac.**
Tout état d'échec, lien expiré, lien consommé, email inconnu, propose une action qui relance le parcours depuis l'écran en cours, sans renvoyer l'utilisateur sur une page d'erreur nue.

**PR6. La destination est conservée.**
Toute redirection vers la connexion mémorise la cible et y ramène après authentification.

**PR7. L'identité vient de la session, jamais de l'URL.**
Aucun email en paramètre d'URL, sauf prévisualisation staff explicitement authentifiée.

**PR8. Le routage après connexion est déterministe et calculé en un seul endroit.**
Une seule garde de route décide, à partir d'un état de session résolu. Aucun hook de données ne déclenche de redirection.

---

## 4. Workflows cibles

### W1. Connexion depuis le site : saisie de l'identifiant

Déclencheur : clic sur "Se connecter" depuis `/`, ou accès direct à `/connexion`, ou redirection depuis une page protégée.

1. L'écran `/connexion` affiche un champ email unique, un bouton "Continuer", et un lien "Créer un compte".
2. À la soumission, le système normalise l'email (minuscules, espaces retirés) et évalue le cas selon la matrice du chapitre 6.
3. L'écran suivant s'affiche sans changement d'URL perçu comme une rupture, avec l'email rappelé et une action "Ce n'est pas moi" qui revient à l'étape 1.

Règles associées : RG-01, RG-02, RG-03, RG-12.

### W2. Compte existant avec mot de passe

1. Affichage du champ mot de passe, avec l'email rappelé en clair.
2. Actions secondaires visibles : "Recevoir un lien de connexion par email" et "Mot de passe oublié".
3. Succès : ouverture de session, redirection selon le chapitre 7.
4. Échec : message générique "Email ou mot de passe incorrect", compteur d'essais existant conservé, proposition immédiate du lien de connexion.

### W3. Compte existant sans mot de passe défini

Cas d'un apprenant provisionné par une inscription ou un achat, qui n'a jamais choisi de mot de passe.

1. Message : "Nous vous envoyons un lien de connexion à cette adresse."
2. Envoi immédiat, écran de confirmation avec rappel de l'adresse, action "Renvoyer" soumise à un délai, et rappel de vérifier les indésirables.
3. À l'ouverture du lien : session ouverte, puis proposition non bloquante "Définir un mot de passe pour vous connecter plus vite la prochaine fois", refusable.

### W4. Email connu du système mais sans compte

Cas d'un participant présent dans les formations ou les inscriptions LMS, sans compte d'authentification.

1. Message : "Vous êtes bien inscrit. Nous vous envoyons un lien pour activer votre accès."
2. Envoi du lien d'activation, puis parcours W5 à partir de l'étape 2.

### W5. Activation depuis un email (achat, intra, inter, relance, erratum)

Déclencheur : réception d'un email contenant un lien d'accès.

1. L'apprenant clique. Le lien ouvre `/connexion/lien?token=`.
2. Le système valide le token. Si valide : ouverture de session immédiate, consommation du token, redirection vers la destination portée par le lien, à défaut le tableau de bord.
3. Premier accès seulement : écran d'accueil proposant de définir un mot de passe, avec une action "Plus tard" qui mène directement au contenu.
4. Si une session est déjà ouverte pour la même personne : pas de nouvelle authentification, redirection directe vers la destination.
5. Si une session est ouverte pour une autre personne : écran explicite "Vous êtes connecté en tant que X, ce lien concerne Y", avec deux actions : continuer en tant que X, ou changer de compte.

Règles associées : RG-04, RG-05, RG-06, RG-11.

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
3. L'email contient un lien de réinitialisation à usage unique et de durée courte.
4. Le lien ouvre un écran de définition de mot de passe, avec les mêmes exigences que la création.
5. Après validation : session ouverte, toutes les autres sessions de ce compte invalidées, redirection vers la destination mémorisée.
6. Un apprenant sans mot de passe qui passe par ce parcours en définit un : il n'y a pas deux mécanismes distincts.

### W9. Session déjà ouverte

1. Accès à `/connexion` avec une session valide : redirection immédiate vers l'espace correspondant au rôle, sans affichage du formulaire.
2. Accès à une page protégée avec session valide : accès direct.
3. Déconnexion explicite depuis le portail : fermeture de session et retour sur `/`, pas sur un écran de connexion.

### W10. Liens invalides, expirés ou déjà utilisés

| État du lien | Message | Action proposée |
|--------------|---------|-----------------|
| Expiré | "Ce lien a expiré." | Champ email pré-rempli, bouton "Recevoir un nouveau lien" dans le même écran |
| Déjà utilisé | "Ce lien a déjà servi." | Même traitement, plus rappel qu'un lien ne sert qu'une fois |
| Inconnu ou malformé | "Ce lien n'est pas valide." | Renvoi vers `/connexion`, formulaire vierge |
| Token absent de l'URL | Aucun message d'erreur | Affichage direct de `/connexion`, étape 1 |

Principe : l'écran d'erreur porte l'action de reprise. Il ne renvoie jamais vers une page qui redemandera la même chose.

### W11. Routage après connexion et anti-boucle

1. La session est résolue une seule fois, dans un fournisseur d'état unique, avant toute décision de navigation.
2. Tant que l'état n'est pas résolu, aucune redirection n'est émise : un indicateur de chargement est affiché.
3. Une fois l'état résolu, la garde de route applique la table du chapitre 7.
4. Un compte sans rôle identifiable affiche un écran explicite "Votre compte n'a pas encore d'accès", avec un contact support. Il n'est ni renvoyé vers le back-office, ni renvoyé en boucle vers la connexion.
5. Un apprenant qui atteint une route staff est redirigé une fois vers son espace, avec un marqueur empêchant un second aller-retour.
6. Un membre du staff qui atteint `/connexion` est redirigé vers `/dashboard`, sans déconnexion.

---

## 5. Règles de gestion

| Code | Règle |
|------|-------|
| RG-01 | L'email est normalisé en minuscules et sans espaces de bord avant toute recherche, tout envoi et tout enregistrement. |
| RG-02 | La recherche d'un apprenant couvre toutes les origines : participants aux formations, inscriptions LMS, comptes Academy. Une seule adresse, une seule identité. |
| RG-03 | Un email ne peut correspondre qu'à un seul compte. La détection de doublon est faite avant toute création. |
| RG-04 | Un lien de connexion est à usage unique et consommé dès l'ouverture de session, quel que soit le mode de connexion emprunté ensuite. |
| RG-05 | Un lien de connexion ne permet jamais de modifier le mot de passe d'un compte existant. La modification passe exclusivement par le parcours W8, sur une session déjà ouverte ou un lien de réinitialisation dédié. |
| RG-06 | Les durées de validité sont distinctes : lien de connexion court, lien d'activation moyen, lien de réinitialisation court. Les valeurs précises sont arbitrées en Q3. |
| RG-07 | Les messages de confirmation d'envoi sont identiques que l'adresse existe ou non, pour les parcours déclenchés par saisie libre (mot de passe oublié). |
| RG-08 | Le nombre de demandes de lien est limité par adresse et par adresse IP sur une fenêtre glissante. Au-delà, le système répond le même message sans envoyer d'email. |
| RG-09 | Le compteur d'échecs de mot de passe existant est conservé et s'applique aux apprenants comme au staff. |
| RG-10 | Toute redirection vers la connexion mémorise la destination. Seules les destinations internes à l'application sont acceptées, toute valeur externe est ignorée. |
| RG-11 | L'identité utilisée par le portail et par le player LMS provient de la session. Le paramètre email d'URL n'est accepté que pour la prévisualisation staff, après vérification du rôle. |
| RG-12 | Aucun écran de connexion n'expose d'information de compte avant validation, hors le cas assumé de la détection à l'étape 1, encadré par RG-08. |
| RG-13 | La déconnexion purge l'intégralité de l'état local associé à l'apprenant, y compris les valeurs de session de navigation. |
| RG-14 | Un compte apprenant et un compte staff ne se distinguent pas par la porte d'entrée utilisée mais par le rôle porté par le compte. |
| RG-15 | Tout email transactionnel contenant un lien d'accès mentionne la durée de validité et la conduite à tenir si le lien ne fonctionne plus. |

---

## 6. Matrice de décision à la saisie de l'email

| Compte d'authentification | Mot de passe défini | Connu comme apprenant | Rôle staff | Écran suivant |
|---------------------------|---------------------|-----------------------|-----------|---------------|
| Oui | Oui | Indifférent | Non | W2, saisie du mot de passe |
| Oui | Non | Indifférent | Non | W3, envoi d'un lien de connexion |
| Oui | Indifférent | Indifférent | Oui | W2, puis routage staff après connexion |
| Non | - | Oui | Non | W4, envoi d'un lien d'activation |
| Non | - | Non | Non | W6, email inconnu |

Note : la colonne "connu comme apprenant" agrège participants aux formations, inscriptions LMS et achats rattachés.

---

## 7. Table de routage après authentification

| Situation | Destination |
|-----------|-------------|
| Destination mémorisée valide et autorisée pour le rôle | La destination mémorisée |
| Apprenant, sans destination mémorisée | `/espace-apprenant/tableau-de-bord` |
| Apprenant arrivant sur une route staff | `/espace-apprenant/tableau-de-bord`, une seule fois |
| Staff, sans destination mémorisée | `/dashboard` |
| Staff arrivant sur la porte apprenant | `/dashboard`, sans déconnexion |
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

## 9. Emails impactés

| Email | Fonction actuelle | Évolution attendue |
|-------|-------------------|--------------------|
| Accès e-learning après achat | `send-elearning-access` | Devient un email d'activation pointant vers l'espace apprenant, avec la destination du cours acheté |
| Lien d'accès apprenant | `send-learner-magic-link` | Devient l'email de connexion ou d'activation, avec durée de validité annoncée et périmètre élargi aux inscrits Academy |
| Relance avant démarrage | `process-elearning-start-reminders` | Lien d'activation aligné sur les nouvelles durées |
| Erratum e-learning | `send-elearning-erratum` | Lien d'activation aligné, le texte annonçant une validité d'un an est à revoir |
| Réinitialisation de mot de passe | `send-password-reset` | Distinction du parcours apprenant et du parcours staff, destination de retour adaptée |
| Notification communauté | `notify-practice-comment` | Lien profond porteur de la destination, exploitable après connexion |

---

## 10. Décisions à arbitrer

| # | Question | Recommandation | Impact si l'autre option est retenue |
|---|----------|----------------|--------------------------------------|
| Q1 | Le mot de passe reste-t-il obligatoire pour un apprenant ? | Non. Mot de passe optionnel, proposé après la première connexion par lien. | Si obligatoire, toute activation impose une étape supplémentaire et le taux d'abandon reste celui d'aujourd'hui. |
| Q2 | Détecter le compte à la saisie de l'email, ou message neutre systématique ? | Détecter, avec limitation de débit et message d'erreur uniforme en cas d'abus. | Le message neutre protège de l'énumération mais ramène l'ambiguïté que cette refonte cherche à supprimer. |
| Q3 | Durées de validité des liens ? | Connexion 30 minutes, activation 7 jours, réinitialisation 1 heure, tous à usage unique. | Les textes actuels promettent un an réutilisable. Si ce confort doit être conservé, il faut dissocier le lien authentifiant du lien de reprise de formation. |
| Q4 | Un achat doit-il créer le compte automatiquement ? | Oui. Compte provisionné sans mot de passe dès l'encaissement, email d'activation immédiat. Le mode `woocommerce` disparaît comme voie d'accès. | Le maintien des deux modes perpétue deux parcours contradictoires pour un même événement métier. |
| Q5 | Une porte unique ou deux portes ? | Deux portes, un seul moteur. `/auth` cesse de déconnecter un apprenant avec un message d'erreur et le route vers son espace. | Une porte unique simplifie le code mais mélange deux publics dans une même interface. |
| Q6 | Code à six chiffres en complément du lien cliquable ? | Oui, à terme. Les filtres de sécurité des messageries d'entreprise pré-cliquent les liens et consomment les tokens à usage unique. | Sans code de secours, certains apprenants intra recevront des liens déjà consommés à l'ouverture. |
| Q7 | Que faire des comptes et tokens existants ? | Invalider les tokens en circulation au basculement, communiquer par un email de reprise, conserver les comptes et les mots de passe. | Laisser vivre les anciens tokens prolonge la faille S1 pendant un an. |
| Q8 | Faut-il fusionner `training_participants`, `lms_enrollments` et les comptes en une notion unique d'apprenant ? | Oui, au moins au niveau d'une vue de résolution d'identité. | Sans cela, la règle RG-02 reste coûteuse à appliquer dans chaque parcours. |

---

## 11. Critères d'acceptation

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
14. Un achat en ligne déclenche un email d'activation pointant vers l'espace apprenant et le cours acheté.

---

## 12. Inventaire des impacts pour le chiffrage

**Écrans à créer ou refondre**
`/connexion` (étape email, étape mot de passe, étape lien envoyé, état email inconnu), `/connexion/lien` (consommation du token), `/connexion/mot-de-passe-oublie`, écran "Définir un mot de passe", écran "Compte sans accès", refonte de `LearnerAccess.tsx`, refonte de `LearnerOnboarding.tsx`, garde de route unique.

**Routes à conserver en redirection**
`/apprenant`, `/apprenant/connexion`, `/apprenant/reset-password` : les liens en circulation doivent continuer de fonctionner.

**Fonctions serveur**
`send-learner-magic-link`, `create-learner-account`, `create-academy-account`, `send-password-reset`, `send-elearning-access`, `process-elearning-start-reminders`, `send-elearning-erratum`, `add-training-participant`, plus une fonction de résolution d'identité à la saisie de l'email.

**Base de données**
`learner_magic_links` (durées, usage unique, typage du lien), `preview_learner_token` et `consume_learner_token` (exposition réduite), `get_learner_portal_data` (droits et périmètre), résolution d'identité entre `training_participants`, `lms_enrollments` et les comptes.

**Réglages**
`elearning_access_mode` : suppression ou requalification selon Q4.
