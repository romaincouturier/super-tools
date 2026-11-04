# Analyse : mail « Créez votre mot de passe » envoyé à des apprenants déjà équipés d'un compte

## 1. Chemins qui envoient ce mail

Tous finissent dans une seule fonction partagée, `sendLearnerAccessEmail` (`supabase/functions/_shared/learner-account.ts`), avec un seul modèle : **`learner_access`** (« Accès à l'espace apprenant », personnalisé en base en `learner_access_vous`).

| Chemin | Déclencheur | Fonction serveur |
|---|---|---|
| Ajout unitaire (formation e-learning) | `add-training-participant`, étape 10 | `ensureLearnerAccount` puis `sendLearnerAccessEmail` (sans nom de formation) |
| Import en lot | `BulkAddParticipantsDialog` -> `sendElearningAccessToBatch` -> `send-learner-access-email` (1 appel par personne, 500 ms) | `sendRegisteredLearnerAccessEmail` |
| Bouton « Renvoyer l'accès » (fiche participant) et repositionnement | `send-learner-access-email` | idem |
| MCP inscription LMS | `_shared/lms-enrollment-tools.ts` | `sendLearnerAccessEmail` (avec titre du cours) |
| Relances e-learning (démarrage, inactivité, erratum) | réutilisent seulement le lien (`learnerAccessLink`), contenu propre | — |

`send-elearning-access` (ancien mail) existe encore mais n'est plus appelé par l'interface.

## 2. Comment le compte existant est détecté aujourd'hui

- Le code **ne regarde pas** « a un compte » mais « a un mot de passe » : RPC `learner_password_set(email)` qui lit `user_security_metadata.password_set` (absence de ligne = considéré avec mot de passe).
- `false` -> lien de création de mot de passe + objet « Créez votre mot de passe ». `true` -> lien `/connexion?email=…` + objet « Accéder à votre espace ». Le modèle enregistré contient bien les deux variantes.
- Donc un apprenant avec mot de passe reçoit déjà, en théorie, la variante « accès ». Le mail « créer un mot de passe » part quand `password_set = false`.

Constat en base (lecture seule) :
- **427 comptes** sont à `password_set = false`, dont **424 créés en novembre** (migration Academy / provisionnement à l'inscription) et **2 seulement** se sont déjà connectés.
- Ce sont donc pour l'essentiel des personnes connues côté formation ou WordPress, mais qui **n'ont jamais défini de mot de passe dans SuperTools** : pour le code, elles sont « sans mot de passe », et chaque nouvel ajout leur renvoie « Créez votre mot de passe ».
- Causes probables restantes (à confirmer à l'implémentation) : personne qui se connecte autrement (Google, ancien lien) sans que le drapeau passe à vrai ; nouvel ajout pendant qu'un premier lien n'a pas encore été utilisé.
- Autre défaut : même la variante « accès » dit « Votre espace apprenant est prêt » — elle n'annonce pas l'ouverture d'une **nouvelle** formation, et l'ajout unitaire n'envoie pas le nom de la formation.

## 3. Modèles existants

- `learner_access` : seul modèle, à double variante (mot de passe / accès). Pas de modèle dédié « accès à une nouvelle formation ouvert ».
- `password_reset` : réinitialisation demandée par l'apprenant.
- Les mails de bienvenue / convocation des formations présentielles sont à part et non concernés.

## 4. Correction proposée

### Règle de décision (un seul helper pur, testé)
```text
compte absent                         -> créer le compte, mail « Créez votre mot de passe »
compte présent, mot de passe défini
  ou déjà connecté au moins une fois  -> mail « Accès à la formation X ouvert » (lien direct)
compte présent, jamais de mot de passe
  ni de connexion                     -> mail « Créez votre mot de passe », mentionnant la formation
```
- « Mot de passe défini » = `password_set = true` **ou** `last_sign_in_at` non nul (filet pour les comptes dont le drapeau n'a pas suivi). Calculé côté serveur via la RPC existante enrichie, jamais exposé au navigateur.

### Nouveau modèle éditable `learner_course_access`
- Objet : « Votre accès à « {{training_name}} » est ouvert ».
- Contenu : formation ouverte, bouton « Accéder à ma formation » vers l'espace apprenant (lien direct sur le cours si identifié), rappel « connectez-vous avec votre adresse et votre mot de passe », lien « mot de passe oublié ».
- Variantes tu/vous, visible dans Paramètres -> Emails, BCC et signature habituels.
- Le modèle `learner_access` garde son rôle (création de compte / renvoi d'accès).

### Comportement par chemin
- Ajout unitaire et MCP : appliquer la règle, toujours avec le nom de la formation.
- Import en lot : **un seul mail par personne** (déjà dédoublonné par email), choisi par la règle ; le compteur de fin distingue « comptes créés », « accès confirmés », « échecs ».
- Bouton « Renvoyer l'accès » : inchangé (renvoie le lien de connexion ou de création selon l'état), utile pour dépanner.
- Le quota interne (sauf admins) s'applique aux deux types de mail.

### Points de vigilance
- **Compte créé sans mot de passe jamais défini** : doit continuer à recevoir « Créez votre mot de passe » à chaque nouvelle formation, sinon il ne pourra pas entrer. C'est le cas des 424 comptes de novembre.
- **Apprenants migrés de WordPress** : leur mot de passe WordPress n'existe pas dans SuperTools ; ils sont à juste titre « sans mot de passe ». Le mail doit le dire clairement (« Votre espace a changé d'adresse, créez votre mot de passe une fois »).
- **Drapeau non mis à jour** : vérifier que toutes les voies de définition du mot de passe (lien email, page pré-espace, changement forcé, Google) passent `password_set` à vrai ; prévoir une correction de données ponctuelle pour les comptes connectés mais restés à faux (2 aujourd'hui), après accord.
- **Comptes sans ligne de sécurité** (29) : considérés avec mot de passe ; à contrôler.
- Ne jamais révéler à l'appelant si une adresse a un compte ; aucun lien qui ouvre une session automatiquement.
- Aucune relance automatique ajoutée.

## Détails techniques
- `_shared/learner-account.ts` : nouveau `decideLearnerAccessEmail(state)` pur + tests ; `learner_password_set` remplacé ou complété par une RPC service-role renvoyant `{exists, password_set, has_signed_in}`.
- `_shared/editable-email-defaults.ts`, `src/components/settings/settingsConstants.ts`, `src/lib/emailVariableDocs.ts` : nouveau modèle.
- `add-training-participant` : passer `trainingName`. `bulkParticipants.ts` : agréger les résultats par type.
- Redéployer `add-training-participant`, `send-learner-access-email`, `mcp-server`.
- Questions : faut-il un lien direct vers le cours (nécessite l'id du cours LMS lié à la session) ou l'espace apprenant suffit-il ? Le mail « accès ouvert » doit-il aussi partir pour les formations présentielles avec contenus en ligne ?
