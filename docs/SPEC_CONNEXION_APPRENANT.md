# Spécifications métier : workflows de connexion apprenant

Statut : spécification. Aucune implémentation à ce stade.
Date : 2026-09-14.
Tous les arbitrages Q1 à Q8 sont rendus au 2026-09-14, reportés dans les règles de gestion, les workflows et le plan de bascule.

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

**PR3. Un lien reçu par email ouvre une session.**
Cliquer sur un lien d'accès connecte, point. Le mot de passe n'est jamais un préalable à l'entrée.

**PR4. Le mot de passe est optionnel (arbitrage Q1 rendu).**
Il est proposé après la première connexion par lien, jamais imposé. Un apprenant peut vivre tout son parcours avec des liens de connexion, sans jamais définir de mot de passe.

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

Déclencheur : réception d'un email contenant un lien d'accès. Pour un achat, l'email est émis par W12.

1. L'apprenant clique. Le lien ouvre `/connexion/lien?token=`.
2. Le système valide le token. Si valide : ouverture de session immédiate, consommation du token, redirection vers la destination portée par le lien, à défaut le tableau de bord.
3. Premier accès seulement : écran d'accueil proposant de définir un mot de passe, avec une action "Plus tard" qui mène directement au contenu.
4. Si une session est déjà ouverte pour la même personne : pas de nouvelle authentification, redirection directe vers la destination.
5. Si une session est ouverte pour une autre personne : écran explicite "Vous êtes connecté en tant que X, ce lien concerne Y", avec deux actions : continuer en tant que X, ou changer de compte.

Le lien d'activation est valable 7 jours et à usage unique. Le lien de connexion émis depuis la page de connexion est valable 30 minutes.

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
3. L'email contient un lien de réinitialisation valable 1 heure, à usage unique.
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

### W12. Provisionnement automatique à l'encaissement (arbitrage Q4 rendu)

Déclencheur : paiement encaissé sur une formation en ligne, quelle que soit la source (boutique SuperTilt, inscription par le staff, inscription par un commanditaire intra).

1. Le compte apprenant est créé immédiatement, sans mot de passe, à partir de l'email de facturation normalisé.
2. Si un compte existe déjà pour cet email, il est réutilisé. Aucun doublon, aucune modification de son mot de passe.
3. L'inscription à la formation achetée est rattachée au compte dans le même mouvement.
4. Un email d'activation est envoyé immédiatement, porteur d'un lien valable 7 jours et de la destination du cours acheté.
5. L'apprenant clique et entre dans son cours, connecté, sans mot de passe : parcours W5.
6. Le réglage `elearning_access_mode` disparaît. Le mode `woocommerce`, qui renvoyait vers le site marchand sans créer de compte, cesse d'être une voie d'accès.
7. Si l'email d'activation n'est pas ouvert, la relance avant démarrage régénère un lien d'activation neuf, sans recréer le compte.

Règles associées : RG-01, RG-03, RG-05, RG-06.

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
| RG-04 | Un lien de connexion est à usage unique et consommé dès l'ouverture de session, quel que soit le mode de connexion emprunté ensuite. |
| RG-05 | Un lien de connexion ne permet jamais de modifier le mot de passe d'un compte existant. La modification passe exclusivement par le parcours W8, sur une session déjà ouverte ou un lien de réinitialisation dédié. |
| RG-06 | Durées de validité, arbitrage Q3 rendu : lien de connexion 30 minutes, lien d'activation 7 jours, lien de réinitialisation 1 heure. Tous à usage unique, tous consommés à la première ouverture. |
| RG-07 | Les messages de confirmation d'envoi sont identiques que l'adresse existe ou non, pour les parcours déclenchés par saisie libre (mot de passe oublié). |
| RG-08 | Le nombre de demandes de lien est limité par adresse et par adresse IP sur une fenêtre glissante. Au-delà, le système répond le même message sans envoyer d'email. |
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

### 6.1 Le service de résolution

Arbitrage Q2 rendu le 2026-09-14 : le système détecte le cas de l'utilisateur, avec limitation de débit et réponse uniforme en cas d'abus. La détection est donc un service, pas une déduction d'écran.

Un unique point d'entrée serveur reçoit une adresse et renvoie un état d'aiguillage. Il ne renvoie rien d'autre : ni nom, ni formation, ni identifiant de compte, ni rôle (RG-26).

| État renvoyé | Signification | Écran suivant |
|--------------|---------------|---------------|
| `password` | Un compte existe et un mot de passe est défini. Vaut aussi pour un compte staff : le rôle n'est pas divulgué avant authentification. | W2 |
| `link` | Un compte existe, sans mot de passe défini. | W3 |
| `activation` | Aucun compte, mais l'adresse est connue comme apprenant. | W4 |
| `unknown` | Adresse inconnue de toutes les origines. | W6 |
| `throttled` | Quota dépassé. Aucun email n'est envoyé. | Écran d'attente, message uniforme |

La colonne "connu comme apprenant" agrège participants aux formations, inscriptions LMS et achats rattachés (RG-02).

### 6.2 D'où vient "mot de passe défini"

L'information n'existe nulle part aujourd'hui : `user_security_metadata` ne porte que `must_change_password`, et l'API d'authentification n'expose pas de drapeau lisible. Elle doit donc être produite explicitement.

1. Un drapeau `password_set` est ajouté à `user_security_metadata`, à côté de `must_change_password`.
2. Il vaut faux au provisionnement (W12, W4) et vrai dès qu'un mot de passe est défini (W7, W8, proposition de W5).
3. Il est écrit exclusivement par le rôle de service. La policy de mise à jour actuelle de cette table laisse un utilisateur écrire sa propre ligne sans clause de contrôle : elle doit être restreinte, sans quoi un apprenant pourrait positionner son propre drapeau.
4. Reprise de l'existant : à la bascule, tous les comptes existants sont marqués `password_set = true`. C'est exact, les trois chemins de création actuels imposent tous un mot de passe (`create-learner-account`, `create-academy-account`, onboarding staff).

### 6.3 Limitation de débit et journalisation

Les seuils s'appuient sur les fonctions existantes `check-login-attempt` et `log-login-attempt`, étendues à la résolution d'identité et à l'envoi de liens.

| Action | Par adresse | Par adresse IP | Au-delà |
|--------|-------------|----------------|---------|
| Résolution d'identité | 5 par heure | 20 par heure | `throttled`, message uniforme |
| Envoi d'un lien de connexion ou d'activation | 3 par heure | 10 par heure | Message d'envoi habituel, aucun email émis |
| Saisie de mot de passe | Compteur existant conservé (RG-09) | 20 par heure | Blocage temporaire existant |

Fenêtre glissante, compteurs tenus côté serveur, jamais dans le navigateur. Chaque résolution est journalisée avec l'adresse hachée, l'adresse IP et l'état renvoyé, conservés 30 jours (RG-24), pour détecter un balayage d'adresses.

### 6.4 Mode dégradé si la résolution ne répond pas

La détection devient un point de passage obligé du parcours : sa panne ne doit pas fermer la porte. Si le service ne répond pas dans les 3 secondes, renvoie une erreur, ou si le navigateur n'exécute pas le script, l'écran bascule sur le formulaire de connexion classique, email et mot de passe affichés ensemble, avec le lien "Recevoir un lien de connexion".

Ce repli fonctionne parce que les deux voies de sortie ne dépendent pas de la résolution : la vérification du mot de passe passe par l'authentification, l'envoi de lien par le service d'envoi. Un apprenant sans mot de passe demande un lien, un apprenant qui en a un se connecte directement. Personne n'est bloqué.

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

## 9. Emails impactés

| Email | Fonction actuelle | Évolution attendue |
|-------|-------------------|--------------------|
| Accès e-learning après achat | `send-elearning-access` | Devient l'email d'activation émis par W12 : lien 7 jours à usage unique vers le cours acheté, sur l'espace apprenant. Le renvoi vers le site marchand disparaît |
| Lien d'accès apprenant | `send-learner-magic-link` | Devient l'email de connexion ou d'activation, avec durée de validité annoncée et périmètre élargi aux inscrits Academy |
| Relance avant démarrage | `process-elearning-start-reminders` | Régénère un lien d'activation de 7 jours sans recréer le compte (W12 étape 7) |
| Erratum e-learning | `send-elearning-erratum` | Lien d'activation aligné sur 7 jours ; le texte annonçant une validité d'un an réutilisable est à réécrire (arbitrage Q3) |
| Réinitialisation de mot de passe | `send-password-reset` | Distinction du parcours apprenant et du parcours staff, destination de retour adaptée |
| Notification communauté | `notify-practice-comment` | Lien profond porteur de la destination, exploitable après connexion |
| Reprise à la bascule | À créer | Envoi unique aux 165 adresses recensées, voir chapitre 17 |
| Changement d'adresse | À créer | Deux messages, vers la nouvelle et vers l'ancienne adresse (W13) |

Les textes rédigés de ces six emails sont au chapitre 11.

---

## 10. Textes d'interface

Libellés de référence. Ton : vous, phrases courtes, aucune formulation culpabilisante, aucun terme technique (jeton, session, authentification) visible par l'apprenant. Un contact support est présent en pied de chaque écran : `contact@supertilt.fr`.

### 10.1 Page de connexion

| Écran ou état | Titre | Texte | Actions |
|---------------|-------|-------|---------|
| Étape 1, saisie | Se connecter | Indiquez l'adresse email utilisée lors de votre inscription. | Champ "Adresse email", bouton "Continuer", lien "Créer un compte" |
| Étape 2, état `password` | Content de vous revoir | Saisissez votre mot de passe pour accéder à vos formations. | Adresse rappelée et modifiable par "Ce n'est pas moi", champ "Mot de passe", bouton "Me connecter", liens "Recevoir un lien de connexion" et "Mot de passe oublié" |
| Étape 2, mot de passe refusé | Content de vous revoir | Email ou mot de passe incorrect. Vous pouvez réessayer, ou recevoir un lien de connexion par email. | Idem, avec le compteur d'essais existant |
| État `link` | Vérifiez votre boîte mail | Nous venons d'envoyer un lien de connexion à {email}. Il est valable 30 minutes. Pensez à regarder vos courriers indésirables. | Bouton "Renvoyer le lien", actif après 60 secondes, lien "Utiliser une autre adresse" |
| État `activation` | Votre accès est prêt | Vous êtes bien inscrit. Nous venons d'envoyer à {email} un lien pour activer votre accès. Il est valable 7 jours. | Bouton "Renvoyer le lien", actif après 60 secondes, lien "Utiliser une autre adresse" |
| État `unknown` | Nous n'avons pas trouvé de compte | Aucun compte n'est associé à {email}. Si vous avez suivi une formation avec nous, essayez l'adresse utilisée lors de votre inscription, souvent votre adresse professionnelle. | Lien "Essayer une autre adresse", lien "Découvrir les formations gratuites", lien "Écrire au support" |
| État `throttled` | Trop de tentatives | Vous avez fait plusieurs demandes coup sur coup. Réessayez dans quelques minutes. | Lien "Écrire au support" |
| Mode dégradé | Se connecter | Nous n'avons pas pu identifier votre compte pour l'instant. Saisissez votre mot de passe, ou demandez un lien de connexion. | Champs email et mot de passe ensemble, bouton "Me connecter", lien "Recevoir un lien de connexion" |

### 10.2 Ouverture d'un lien

| Écran ou état | Titre | Texte | Actions |
|---------------|-------|-------|---------|
| Lien valide | Connexion en cours | Un instant, nous ouvrons votre espace. | Aucune, redirection automatique |
| Proposition de mot de passe, premier accès | Vous y êtes | Souhaitez-vous définir un mot de passe ? Vous pourrez vous connecter directement, sans passer par votre boîte mail. | Champ "Mot de passe" avec exigences affichées, bouton "Enregistrer", lien "Plus tard" |
| Lien expiré | Ce lien a expiré | Les liens de connexion sont valables 30 minutes, les liens d'activation 7 jours. Nous pouvons vous en envoyer un nouveau tout de suite. | Adresse pré-remplie, bouton "Recevoir un nouveau lien" |
| Lien déjà utilisé | Ce lien a déjà servi | Un lien ne fonctionne qu'une fois, pour votre sécurité. Nous pouvons vous en envoyer un nouveau. | Adresse pré-remplie, bouton "Recevoir un nouveau lien" |
| Lien invalide | Ce lien n'est pas valide | Il a peut-être été coupé par votre logiciel de messagerie. Indiquez votre adresse, nous vous en envoyons un nouveau. | Champ email vierge, bouton "Recevoir un lien" |
| Session ouverte pour une autre personne | Vous êtes déjà connecté | Vous êtes connecté en tant que {email_session}. Ce lien concerne {email_lien}. | Bouton "Continuer en tant que {email_session}", bouton "Me connecter en tant que {email_lien}" |

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

## 11. Emails

Six emails à rédiger ou refondre. Variables entre accolades. Chaque email annonce sa durée de validité (RG-15) et la conduite à tenir si le lien ne fonctionne plus. Le tutoiement existant, piloté par `sponsor_formal_address` et les suffixes `_tu` et `_vous` des modèles, est conservé : les textes ci-dessous sont la version "vous".

### E-A. Activation après achat (W12)

Objet : Votre formation {training_name} vous attend

> Bonjour {first_name},
>
> Merci pour votre achat. Votre formation {training_name} est prête.
>
> Nous avons créé votre espace apprenant avec l'adresse {email}. Vous y retrouverez votre formation, vos documents et vos attestations.
>
> [Accéder à ma formation]
>
> Ce lien est valable 7 jours et ne fonctionne qu'une fois. Passé ce délai, rendez-vous sur la page de connexion, nous vous en enverrons un nouveau en quelques secondes.
>
> Vous n'aurez pas de mot de passe à créer, sauf si vous le souhaitez.
>
> Vos données sont traitées par SuperTilt pour vous donner accès à votre formation. Pour demander la suppression de votre compte, écrivez à contact@supertilt.fr.

### E-B. Activation après inscription par un tiers (intra, inter, relance)

Objet : Votre accès à la formation {training_name}

> Bonjour {first_name},
>
> Vous êtes inscrit à la formation {training_name}{date_label}. Votre espace apprenant est prêt, à l'adresse {email}.
>
> [Activer mon accès]
>
> Ce lien est valable 7 jours et ne fonctionne qu'une fois. Passé ce délai, rendez-vous sur la page de connexion, nous vous en enverrons un nouveau.
>
> Vous n'avez pas de mot de passe à créer, sauf si vous le souhaitez.
>
> Vos données sont traitées par SuperTilt pour vous donner accès à votre formation. Pour demander la suppression de votre compte, écrivez à contact@supertilt.fr.

### E-C. Lien de connexion (W3, demandé depuis la page de connexion)

Objet : Votre lien de connexion

> Bonjour,
>
> Voici votre lien pour accéder à votre espace apprenant.
>
> [Me connecter]
>
> Ce lien est valable 30 minutes et ne fonctionne qu'une fois. S'il a expiré, redemandez-en un depuis la page de connexion.
>
> Vous n'avez pas demandé ce lien ? Ignorez ce message, votre compte reste protégé.

### E-D. Réinitialisation de mot de passe

Objet : Définir un nouveau mot de passe

> Bonjour,
>
> Vous avez demandé à définir un nouveau mot de passe.
>
> [Choisir un nouveau mot de passe]
>
> Ce lien est valable 1 heure et ne fonctionne qu'une fois.
>
> Vous n'avez pas fait cette demande ? Ignorez ce message, votre mot de passe actuel reste valable.

### E-E. Email de reprise, envoyé une fois à la bascule

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
| Q1 | Le mot de passe reste-t-il obligatoire pour un apprenant ? | **Non.** Mot de passe optionnel, proposé après la première connexion par lien, jamais imposé. | PR4, W3 étape 3, W5 étape 3. Un apprenant peut rester sans mot de passe indéfiniment et se connecter par lien à chaque fois. |
| Q2 | Détecter le compte à la saisie de l'email, ou message neutre systématique ? | **Détecter**, avec limitation de débit et message uniforme en cas d'abus. | Chapitre 6 : contrat du service de résolution, cinq états d'aiguillage, seuils chiffrés, journalisation 30 jours. RG-12, RG-24, RG-26. |
| Q3 | Durées de validité des liens ? | **Connexion 30 minutes, activation 7 jours, réinitialisation 1 heure. Tous à usage unique.** | RG-04, RG-06, W5, W8. Les textes annonçant un lien valable un an et réutilisable, notamment l'erratum e-learning, sont à réécrire. La reprise de formation passe par la connexion, plus par un lien longue durée. |
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
14. Un achat en ligne déclenche la création du compte et un email d'activation pointant vers l'espace apprenant et le cours acheté.
15. Un apprenant qui refuse de définir un mot de passe accède à son espace et peut se reconnecter par lien autant de fois qu'il le souhaite.
16. Un lien de connexion ouvert une seconde fois est refusé et propose l'envoi d'un nouveau lien.
17. Un lien de connexion ouvert plus de 30 minutes après son émission est refusé de la même manière, un lien d'activation au-delà de 7 jours, un lien de réinitialisation au-delà d'une heure.
18. Le réglage `elearning_access_mode` n'existe plus et aucun email d'accès e-learning ne renvoie vers le site marchand comme voie de connexion.
19. Le service de résolution d'identité ne renvoie jamais autre chose qu'un état d'aiguillage, et répond `throttled` au-delà des seuils du chapitre 6.
20. Un apprenant ne peut pas modifier son propre drapeau `password_set`.
21. Le changement d'adresse d'un apprenant conserve l'accès à toutes ses formations et invalide les liens émis vers l'ancienne adresse.
22. Un jeton émis avant la bascule ne permet plus d'entrer, et l'écran affiché propose l'envoi d'un lien neuf.
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

Les deux sujets se touchent sur trois points, traités ici et seulement ici :

1. L'identité applicative provient de la session et jamais de l'URL (PR7, RG-11).
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

- Personne n'est contraint de créer un mot de passe.
- Personne ne perd l'accès à ses formations, ses documents ou sa progression.
- Aucun apprenant ne rencontre d'écran d'erreur nue : toute impasse porte l'action de reprise.
- Une seule action supplémentaire est demandée, au plus une fois, à ceux qui cliquent sur un ancien lien.
- Le support dispose de la liste des 165 adresses et peut renvoyer un lien à la demande.

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

**Pré-clic des liens par les filtres de messagerie.** Les passerelles de sécurité d'entreprise ouvrent les liens avant l'utilisateur. Avec des jetons à usage unique, l'apprenant reçoit alors un lien déjà consommé. Deux parades : le jeton n'est consommé qu'après une action sur la page d'arrivée, jamais sur le simple chargement (RG-21), et W10 propose toujours le renvoi d'un lien neuf. Q6, le code à six chiffres, reste la réponse de fond.

**Gestionnaires de mots de passe.** Un formulaire en deux étapes casse l'enregistrement du couple identifiant et mot de passe si le champ email disparaît à l'étape 2. L'email reste donc présent dans le formulaire, en lecture seule, avec les attributs d'auto-complétion attendus (RG-20).

**Mobile.** Le lien reçu par email ouvre le navigateur par défaut, qui n'est pas forcément celui où une session existe déjà. C'est sans conséquence : le lien authentifie par lui-même. En revanche, un lien de 30 minutes suppose que l'apprenant consulte ses emails dans la foulée, ce que le message d'attente doit rappeler.

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
| 3 | Service de résolution d'identité, drapeau `password_set`, limitation de débit | Prérequis de la page de connexion. Livré : fonction `resolve-login-identity`, journal `identity_resolution_log`, seuils 5 par adresse et 20 par IP par heure |
| 4 | Écrans de connexion : W1 à W10, redirections des anciennes URL | Livré. W5 ouvre une vraie session depuis le lien, W10 porte l'action de reprise dans chaque état d'échec, les durées de 30 minutes et 7 jours s'appliquent aux liens émis |
| 5 | Provisionnement à l'encaissement W12, refonte des emails, suppression de `elearning_access_mode` | Livré côté code : le compte est provisionné à l'inscription, l'email d'activation est unique quelle que soit la source, le réglage a disparu. La bascule elle-même reste une opération manuelle, `scripts/bascule-connexion.sql` |
| 6 | W13, purge des comptes inactifs, indicateurs, politique de confidentialité | Livré. Changement d'adresse atomique sur 26 tables, comptes dormants signalés, indicateurs dans Monitoring, politique de confidentialité à jour |

Transverse à tous les lots : les tests du chapitre 14 sont écrits avec le lot qu'ils couvrent, jamais après. Les textes du chapitre 10 et les emails du chapitre 11 sont validés avant le développement du lot 4, les maquettes servant de support à cette validation.

Les lots 1 et 2 sont livrables sans rien changer à ce que voit l'apprenant. La bascule du chapitre 17 intervient à la fin du lot 4.

---

## 22. Inventaire des impacts pour le chiffrage

**Écrans à créer ou refondre**
`/connexion` (étape email, étape mot de passe, étape lien envoyé, état email inconnu), `/connexion/lien` (consommation du token), `/connexion/mot-de-passe-oublie`, écran "Définir un mot de passe", écran "Compte sans accès", refonte de `LearnerAccess.tsx`, refonte de `LearnerOnboarding.tsx`, garde de route unique.

**Routes à conserver en redirection**
`/apprenant`, `/apprenant/connexion`, `/apprenant/reset-password` : les liens en circulation doivent continuer de fonctionner.

**Fonctions serveur**
`send-learner-magic-link`, `create-learner-account`, `create-academy-account`, `send-password-reset`, `send-elearning-access`, `process-elearning-start-reminders`, `send-elearning-erratum`, `add-training-participant`, plus une fonction de résolution d'identité à la saisie de l'email.

**Base de données**
`learner_magic_links` (durées, usage unique, typage du lien), `preview_learner_token` et `consume_learner_token` (exposition réduite), `get_learner_portal_data` (droits et périmètre), résolution d'identité entre `training_participants`, `lms_enrollments` et les comptes.

**Base de données, ajouts liés aux compléments**
`user_security_metadata` : colonne `password_set` et restriction de la policy de mise à jour. Journal de résolution d'identité avec adresse hachée et purge à 30 jours. Purge quotidienne des jetons consommés ou expirés.

**Tests**
`e2e/connexion.spec.ts` à créer, tests unitaires de résolution, de normalisation, d'expiration et de routage, tests d'intégration des fonctions serveur dont les non-régressions S1 à S5.

**Opérations de bascule**
Invalidation en masse des jetons en circulation, redirections des anciennes URL pendant 90 jours, email de reprise, mesure des indicateurs du chapitre 20 avant bascule.

**Documents à mettre à jour**
Politique de confidentialité (création automatique de compte, journalisation, comptes inactifs), textes des emails transactionnels du chapitre 9.

**Réglages**
`elearning_access_mode` : supprimé (arbitrage Q4). Le basculement doit prévoir le retrait du bloc de réglage dans `SettingsGeneral.tsx` et la branche correspondante de `add-training-participant`.
