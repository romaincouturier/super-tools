# Suite ST-2026-0264 : communautés thématiques et accès apprenant par email

Analyse et plan uniquement. Rien ne sera modifié avant votre validation.

## 1. Communautés thématiques (option B élargie)

### Constat
- Les publications sont aujourd'hui rattachées à un cours (`practice_posts.course_id`). Les dépôts partagés sont le même fil (`deposit_id`).
- Volumes : Facilitation graphique 166, Sketchnoter 19, AI4Product 5. Tous les autres cours publiés : 0.
- Cours intra repérés : Acoss/URSSAF, Agirc-Arrco, FDJ Vitrolles, FDJ Boulogne, CAUE Drôme, Lyon 06/2026 (à confirmer).

### Modèle proposé
- 4 thématiques : Facilitation graphique, Intelligence collective, IA, Transformation.
- Un cours non intra peut être rattaché à plusieurs thématiques. Un cours intra ne peut être rattaché à aucune (bloqué par la base).
- Un apprenant voit les thématiques de ses cours inscrits, plus la communauté de ses cours intra.
- Les admins et formateurs voient tout.

### Migration : recommandation « fusion douce, sans déplacer les données »
- Les publications restent attachées à leur cours d'origine. La thématique affiche, sans les recopier, les publications de tous ses cours non intra.
- Chaque publication porte un petit badge d'origine (« Sketchnoter sur tablette »). Un filtre permet de revenir à un seul cours.
- Pas de communauté par cours visible pour les cours non intra : la thématique la remplace. Elle reste disponible en filtre.
- Nouvelles publications : on enregistre le cours depuis lequel l'apprenant publie (leçon, dépôt) et sa thématique principale.
- Liens existants (`/communaute?course=…`, mails) : redirigés vers la thématique, filtre du cours pré-appliqué.
- Notifications : on notifie toujours le staff du cours d'origine. Les apprenants abonnés reçoivent aussi les nouveautés de leurs thématiques, via le récapitulatif existant (pas de nouvel email).
- Dépôts de travaux : inchangés, ils restent rattachés à la leçon et au cours. Leur publication partagée apparaît dans la thématique.
- Projection des dessins en live : la sélection reste par cours ou session par défaut, avec une option « toute la thématique ».
- Point de confidentialité : un apprenant Sketchnoter verra les 166 publications Facilitation graphique. Les auteurs n'y ont pas consenti. Proposition : un message d'information la première fois, et la possibilité pour chaque auteur de garder une publication « visible du cours uniquement ».
- Retour arrière : simple désactivation d'un réglage (mode thématique activé ou non). Comme rien n'est déplacé, les communautés par cours réapparaissent telles quelles.

### Rattachement par défaut proposé
| Cours | Thématique(s) |
|---|---|
| Facilitation graphique, communiquer avec le visuel | Facilitation graphique |
| Sketchnoter sur tablette (Procreate, Concepts) | Facilitation graphique |
| Formation Sketchnoting (SOLO) | Facilitation graphique |
| La facilitation graphique 100% Pratique | Facilitation graphique |
| Produire ses vidéos dessinées | Facilitation graphique |
| Icebreakers à la carte / mode d'emploi | Intelligence collective |
| MasterClass Animer des réunions à distance | Intelligence collective |
| La météo intérieure | Intelligence collective |
| AI4Product | IA |
| Les fondamentaux de l'Agilité | Transformation |
| Développer sa posture de manager | Transformation |
| Clean code, sortir de la dette technique | Transformation (ou aucune) |
| Cours intra (Acoss, Agirc-Arrco, FDJ ×2, CAUE, Lyon ?) | Aucune, communauté isolée |

### Questions
1. Le cours Lyon 06/2026 est-il intra ?
2. Clean code : thématique Transformation, ou aucune ?
3. Les publications existantes deviennent-elles visibles de toute la thématique (avec un message d'information) ? Ou seulement les nouvelles ?

## 2. Accès à l'espace apprenant par simple adresse email

### Risque constaté (élevé)
- La fonction de la base qui identifie l'apprenant accepte, sans connexion, l'adresse envoyée par le navigateur dans un en-tête. Elle vérifie seulement que l'adresse est celle d'un apprenant connu.
- Conséquence : connaître l'email d'un apprenant permet de lire et modifier sa progression et ses quiz, de lire, modifier ou supprimer ses dépôts et ses publications, et de publier en son nom.
- Écrans concernés : `/lms/:id/home?email=` et `/lms/:id/player?email=` (y compris `/formation-support/:id/lms/:id`), `/formation-support/:id?email=`, `/formulaire/*?email=`, ainsi que les liens générés par le portail.
- Le portail lui-même (son tableau de bord) exige déjà une connexion.
- Les questionnaires, évaluations, conventions et émargements utilisent des liens à jeton unique : ils ne sont pas concernés et restent inchangés.

### Option A : connexion obligatoire, avec lien magique (recommandée)
- Les pages du cours et de la communauté exigent une session. Un `?email=` sans session redirige vers la connexion, avec l'email prérempli et un retour automatique au cours.
- Les emails envoient un lien de connexion personnel (lien magique), dont l'adresse finale est le cours.
- On retire l'en-tête d'identité et les accès anonymes des politiques de la base.
- Déploiement en deux temps : d'abord le parcours de connexion, puis, après une semaine d'observation, la fermeture des accès anonymes.
- Avantages : correction complète. Inconvénients : une étape de connexion de plus, et les anciens liens obligent à se connecter.

### Option B : jeton d'accès signé dans les liens
- Chaque email contient un jeton personnel, limité dans le temps et à un cours, à la place de `?email=`. La base vérifie ce jeton.
- Avantages : pas de connexion pour l'apprenant. Inconvénients : un lien transféré donne accès au compte, il y a plus de code à maintenir, et les anciens liens doivent être régénérés.

Recommandation : option A, puisque tous les apprenants ont désormais un compte et un mot de passe ou un lien magique.

## Détails techniques
- Thématiques : tables `community_themes` et `course_community_themes`, avec un trigger qui refuse un cours intra. Nouvelle fonction `learner_can_read_theme()` en security definer. `practice_posts` : ajout d'une colonne nullable `visibility_scope` ('theme'/'course'). Les politiques de lecture élargissent `learner_can_read_community` à la thématique. Réglage dans `app_settings` (`community_theme_mode`) pour revenir en arrière. Sauvegarde : ajout des nouvelles tables.
- Accès : supprimer le repli `x-learner-email` de `get_learner_email()`, et retirer ou restreindre les politiques `anon_*` sur practice_posts, lms_work_deposits, lms_progress, lms_quiz_attempts et les tables liées. Garde de route avec redirection vers `/connexion?email=&redirect=`. `useLearnerIdentity` : session seule. Les edge functions d'emails génèrent les liens magiques vers le cours. Tests pgTAP : anonyme refusé, apprenant A sans accès à B.
