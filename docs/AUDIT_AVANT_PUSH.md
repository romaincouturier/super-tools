# Audit avant push, refonte de connexion apprenant

Branche `claude/relaxed-bardeen-01pssi`, comparée à `origin/main`. Date : 2026-09-15.
Contrainte : pousser applique les migrations en base sans publier le front.
Pendant ce délai, l'application de `origin/main` interroge une base migrée.

**Verdict : partir sous conditions.** Un écart bloquant, un écart majeur, deux
écarts mineurs assumables. Les conditions sont au chapitre 5.

---

## 1. Compatibilité ascendante, objet par objet

Méthode : pour chaque objet SQL modifié, recherche des appelants dans la version
`origin/main` du front, pas dans la branche.

### A1. Retrait de la policy d'écriture sur `user_security_metadata` — **bloquant**

`supabase/migrations/20260914170000_lot3_resolution_identite.sql:19` supprime
`"Users can update their own security metadata"`.

Deux écrans de `origin/main` écrivent directement dans cette table :
`ForcePasswordChange.tsx:58-60` et `ResetPassword.tsx:94-96`, tous deux pour
remettre `must_change_password` à faux après un changement de mot de passe.

Après migration, cette écriture est refusée par la sécurité de niveau ligne.
PostgREST ne renvoie pas d'erreur : l'ordre porte sur zéro ligne et l'écran
poursuit normalement. Le drapeau reste donc à vrai.

Conséquence : à la connexion suivante, `Auth.tsx` relit le drapeau et renvoie
l'utilisateur sur l'écran de changement de mot de passe. Il change son mot de
passe, le drapeau ne tombe pas, il y revient. La boucle dure jusqu'à la
publication du front.

Population : les comptes portant `must_change_password = true`, non mesurable
depuis mes outils, la table n'étant pas exposée. À compter avant décision :

```sql
SELECT count(*) FROM user_security_metadata WHERE must_change_password;
```

Si le compte est nul, l'écart devient théorique. Sinon il est bloquant, et il
touche l'équipe, pas les apprenants.

### A2. Modèles d'email réécrits — **majeur**

`20260915110000` et `20260915130000` réécrivent quatre modèles : le lien
« connecte automatiquement, sans mot de passe à créer », il est « valable
7 jours et utilisable une seule fois ».

Ces modèles sont lus par les fonctions serveur **déjà déployées**, qui émettent
des liens vers `/apprenant/connexion`. Or dans `origin/main`, cette page demande
un mot de passe, et le jeton vaut un an, réutilisable. L'email annonce donc un
comportement que l'application ne rend pas.

Quatre modèles concernés, mesuré en base. L'apprenant ne perd pas l'accès, mais
on lui promet une chose et on lui en sert une autre.

### A3. Prévisualisation apprenant par l'équipe — **mineur**

`20260915120000` fait que `get_learner_email()` ignore l'en-tête
`x-learner-email`. Dans `origin/main`, `useLearnerPortalData.ts:11` et `:70`
créent un client porteur de cet en-tête pour lire les données d'un apprenant
donné.

Vérification faite : un client Supabase créé à la volée porte bien la session,
car chaque requête attend `auth.getSession()`
(`node_modules/@supabase/supabase-js/src/SupabaseClient.ts:570-578`). Les
apprenants ne perdent donc rien. En revanche, quand l'équipe prévisualise
l'espace d'un apprenant, l'identité retenue devient celle du membre de l'équipe,
qui n'est pas un apprenant : la prévisualisation renvoie un espace vide.

Exception : dans l'aperçu encadré de l'éditeur, le client principal passe par un
stockage relayé (`previewAuthStorage.ts:5-18`) que le client à la volée ne
partage pas. Là, la session manque des deux côtés et la lecture échoue aussi.
Cela ne concerne pas les apprenants, qui visitent l'application directement.

### A4. Player de cours ouvert sans compte — **mineur**

Dans `origin/main`, `LmsCoursePlayer.tsx:46` prend l'adresse dans l'URL et, à
défaut, la demande. Sans session, l'identité vaut désormais nul : la progression
n'est plus lue ni écrite, et le bloc questionnaire disparaît. Le contenu publié
reste lisible.

C'est le comportement voulu par la spécification (PR7). Il arrive simplement
avant l'écran qui l'explique. Mesure : 5 progressions enregistrées sur les
30 derniers jours, tous apprenants confondus.

### A5. Réglage `elearning_access_mode` supprimé — **sans effet notable**

`20260915090000` supprime la ligne. `origin/main` la lit dans
`add-training-participant/index.ts:313` avec `|| "magic_link"` en repli : la
fonction déployée bascule donc en mode lien, qui pointe sur
`/apprenant/connexion`, page toujours servie. L'écran de réglages affichera
« WooCommerce » sélectionné par défaut alors que le comportement est le lien.
Incohérence d'affichage, sans conséquence fonctionnelle.

### A6. Objets purement ajoutés — **sans risque**

`identity_resolution_log`, `password_set`, `resolve_login_identity`,
`current_user_access_level`, `check_link_quota`, `change_learner_email`,
`revoke_other_sessions`, `mark_password_changed`, `request_password_change`,
`list_dormant_learner_accounts`, `connexion_indicators`, la purge et son cron :
aucun appelant dans `origin/main`, aucun effet tant que le front n'est pas
publié.

### A7. Fonctions de portail fermées au rôle anonyme — **sans effet**

`get_learner_portal_data` exige désormais une session et l'adresse de
l'appelant. Dans `origin/main`, elle n'est appelée qu'après l'ouverture de
session (`LearnerPortal.tsx:1937`), avec l'adresse de la session ou, pour
l'équipe, celle de la prévisualisation. Les deux cas restent autorisés.

---

## 2. Les tests valent-ils quelque chose

Douze règles structurantes ont été cassées volontairement, une par une, pour
vérifier que le test censé les garder tombe. Le code a été restauré après chaque
essai, l'arbre vérifié propre.

| Règle cassée | Résultat |
|--------------|----------|
| La destination mémorisée accepte une URL externe | Détecté |
| Le routage ignore un compte sans rattachement | Détecté |
| Le niveau d'accès rend toujours « apprenant » | Détecté |
| L'URL reprend le pas sur la session pour l'identité | Détecté |
| L'état d'aiguillage accepte n'importe quelle valeur | Détecté |
| Tous les liens durent 7 jours | Détecté |
| L'adresse n'est plus débarrassée de ses espaces | Détecté |
| Le quota de résolution par adresse saute | Détecté |
| Le changement d'adresse accepte une collision | Détecté |
| Le portail laisse lire l'espace d'un tiers | Détecté |
| Le quota d'envoi de liens saute | Détecté |
| **`get_learner_email` relit l'en-tête du navigateur** | **Survit** |

Le dernier essai est le plus important de l'audit. Le test
`ne rend rien sans session` passait quelle que soit la fonction, parce que le
harnais ne posait jamais l'en-tête : `current_setting('request.headers')` y
valait toujours nul. Le test le plus visible du correctif de sécurité central ne
gardait rien.

Corrigé pendant l'audit, car un test complaisant est pire qu'une absence de
test : le harnais pose maintenant l'en-tête, et deux cas sont couverts, sans
session et avec une session qui tente de se faire passer pour quelqu'un d'autre.
La même mutation est désormais détectée.

Les tests SQL chargent bien la fonction depuis son fichier de migration : les
mutations appliquées aux fichiers de migration ont fait tomber les tests, ce qui
ne serait pas arrivé sur une copie.

---

## 3. Ordre de mise en production

| Ordre | Quoi | Pourquoi |
|-------|------|----------|
| 1 | Migrations `20260914150000`, `20260914170000` **moins son retrait de policy**, `20260915090000`, `20260915100000`, `20260915140000` | Ajouts et fermetures sans appelant dans le front déployé |
| 2 | Publication du front | L'application se met au niveau de la base |
| 3 | Fonctions serveur : `resolve-login-identity`, `redeem-learner-token`, `backfill-learner-accounts`, `send-learner-magic-link`, `create-learner-account`, `add-training-participant`, `manage-learner-account`, `process-elearning-start-reminders`, `send-elearning-erratum` | Les nouvelles fonctions ne servent qu'au nouveau front |
| 4 | Retrait de la policy d'écriture, migrations d'emails `20260915110000` et `20260915130000`, migration `20260915120000` | Tout ce qui suppose le nouveau front |
| 5 | `backfill-learner-accounts`, une fois | Confort, pas un préalable |
| 6 | `scripts/bascule-connexion.sql`, quand vous le décidez | Invalidation des anciens liens |

Réversibilité, franchement : les créations de fonctions sont réversibles en
rejouant la version précédente depuis l'historique. Les suppressions ne le sont
pas d'elles-mêmes : la ligne `elearning_access_mode` et la policy d'écriture
devront être recréées à la main, et les textes des modèles d'email écrasés ne
sont récupérables que depuis une sauvegarde. Aucune donnée d'apprenant n'est
détruite par ces migrations.

---

## 4. Rayon d'impact, mesuré

| Mesure | Valeur |
|--------|--------|
| Apprenants distincts, participants aux formations | 164 |
| Inscrits LMS distincts | 90 |
| Progressions enregistrées sur 30 jours | 5 |
| Modèles d'email réécrits | 4 |
| Comptes portant le changement de mot de passe obligatoire | Non mesurable, table non exposée |
| Jetons encore valides | Non mesurable, table non exposée |

Ce que voit un utilisateur entre le push et la publication du front :

- **Un apprenant qui se connecte** : rien ne change. Son parcours passe par
  l'ancienne page, son compte existe, ses données se lisent.
- **Un apprenant qui reçoit un email** : le texte annonce un lien qui connecte
  sans mot de passe, la page lui en demande un. C'est l'écart A2.
- **Un visiteur sans compte sur un cours public** : lit le contenu, sa
  progression n'est plus retenue. Cinq personnes concernées au plus, sur la base
  de l'activité du mois.
- **Un membre de l'équipe qui prévisualise un espace apprenant** : espace vide.
- **Un membre de l'équipe marqué « doit changer son mot de passe »** : boucle.
  C'est l'écart A1.

---

## 5. Verdict et conditions

**Partir sous conditions.** Trois, par ordre d'importance.

1. **Sortir le retrait de la policy de la migration du lot 3** et le porter dans
   une migration jouée avec le front. C'est une ligne à déplacer. Sans cela, un
   membre de l'équipe peut se retrouver bloqué, et la panne est silencieuse.
   Si le décompte des comptes concernés est nul, la condition tombe.
2. **Retenir les deux migrations d'emails** jusqu'à la publication du front.
   Rien n'oblige à les jouer maintenant, et les jouer trop tôt fait mentir les
   messages envoyés aux apprenants.
3. **Retenir `20260915120000`** jusqu'à la publication du front, pour éviter de
   casser la prévisualisation de l'équipe pendant la fenêtre. C'est du confort,
   pas de la sécurité : l'en-tête reste sans effet pour tout ce qui compte dès
   le lot 1, qui fait primer le jeton.

Les écarts A4 et A5 sont assumables en l'état.

Je ne conclus pas « partir » sans réserve parce que l'écart A1 produit une panne
silencieuse sur un parcours que personne ne surveille, et que son ampleur
dépend d'un chiffre que je n'ai pas pu lire.

---

## 6. Ce que je n'ai pas pu vérifier

- Le nombre de comptes avec changement de mot de passe obligatoire, et le nombre
  de jetons en circulation : `user_security_metadata` et `learner_magic_links`
  ne sont pas exposées à mon outil d'interrogation.
- La durée réelle du lien de réinitialisation, réglée dans la console du
  fournisseur d'authentification et non dans ce dépôt.
- Le comportement des policies de niveau ligne, que le harnais SQL ne reproduit
  pas : il teste les fonctions, pas les rôles.
- Le délai réel entre le push et la publication du front, qui commande la durée
  de tous les écarts ci-dessus.

Harnais au moment de l'audit : 1981 tests unitaires, 23 parcours, 76/76 règles,
build vert.
