# Prompt d'audit avant push, refonte de connexion

À coller tel quel dans une session neuve, sur la branche `claude/relaxed-bardeen-01pssi`.
Il est écrit pour une situation précise : pousser sur GitHub applique les migrations
de base de données sans publier le front. Pendant ce décalage, l'ancien front
parle à la nouvelle base.

---

## Le prompt

Tu es chargé d'un audit de mise en production. Tu n'as rien écrit de ce code et
tu n'as aucune raison de lui faire confiance. Ton travail n'est pas de valider,
c'est de trouver ce qui va casser.

### Le contexte, à tenir pour acquis

La branche `claude/relaxed-bardeen-01pssi` refond la connexion apprenant :
`docs/SPEC_CONNEXION_APPRENANT.md` porte la spécification,
`docs/RECETTE_CONNEXION.md` la recette, `docs/REVUE_SPEC_CONNEXION.md` la revue
exigence par exigence, `docs/AUDIT_SURFACES_EXPOSEES.md` l'état des accès.

La contrainte qui commande tout : **pousser sur GitHub applique les migrations
en base, mais ne publie pas le front**. Pendant un délai que nous ne maîtrisons
pas, l'application déployée est celle de `origin/main`, et elle interroge une
base déjà migrée. Toute incompatibilité entre les deux se paie en connexions
perdues, pas en tests rouges.

La population concernée est petite et identifiée : 165 apprenants distincts, dont
2 inscrits Academy et 5 adresses partagées entre plusieurs personnes, plus
l'équipe SuperTilt. Un apprenant bloqué, c'est une formation interrompue.

### Ce que tu dois produire

Un rapport dans `docs/AUDIT_AVANT_PUSH.md`, et rien d'autre tant que tu n'as pas
fini. Tu ne corriges rien sans avoir d'abord énoncé le problème.

### Passe A, compatibilité ascendante. La plus importante.

Pour **chaque** objet SQL touché entre `origin/main` et `HEAD` — fonction, colonne,
policy, droit, réglage supprimé — réponds à une seule question : *l'application
de `origin/main` continue-t-elle de fonctionner une fois cette migration
appliquée ?*

Méthode imposée, parce que la lecture de la branche ne répond pas à cette
question : pour chaque objet, cherche ses appelants **dans la version
`origin/main` du front** (`git show origin/main:chemin/fichier`), pas dans la
branche. Un appelant qui a disparu de la branche existe encore en production.

Points de départ, sans t'y limiter :
- les fonctions dont la signature ou le comportement change, en particulier
  celles qui se mettent à exiger une session ou à refuser une adresse tierce ;
- les droits d'exécution retirés au rôle `anon` ;
- les policies supprimées, et ce que le front de `origin/main` écrivait grâce à
  elles ;
- les colonnes et réglages supprimés, lus ailleurs ;
- les clients Supabase créés à la volée par l'ancien front, et la question de
  savoir s'ils portent bien la session au moment de la requête.

Pour chaque incompatibilité trouvée : qui est touché, ce qu'il voit à l'écran,
et si la panne est silencieuse. Une donnée vide affichée sans erreur est pire
qu'une erreur.

### Passe B, les tests valent-ils quelque chose

Ne crois aucun test sur son nom. Prends les vingt tests les plus structurants,
et pour chacun : casse volontairement le code qu'il prétend garder, relance,
vérifie qu'il tombe, remets en état. Un test qui reste vert quand la règle
disparaît est un test qui ment, et il vaut moins que pas de test.

Vérifie en particulier que les tests SQL de `supabase/tests/` chargent bien la
fonction depuis son fichier de migration et non une copie, et que le schéma de
test ne diverge pas du schéma réel au point de rendre le test complaisant.

Cherche ce qui n'est pas testé et qui devrait l'être, en partant des exigences
marquées « L » dans `docs/REVUE_SPEC_CONNEXION.md`.

### Passe C, ordre et retour arrière

Établis l'ordre exact de mise en production : quelle migration, quelle fonction
serveur, à quel moment, et ce qui se passe si l'ordre n'est pas respecté.
Pour chaque migration, dis si elle est réversible et comment. Une migration
irréversible qui n'est pas signalée comme telle est un défaut du rapport.

Distingue ce qui peut partir maintenant sans risque de ce qui doit attendre la
publication du front.

### Passe D, rayon d'impact

Mesure, ne suppose pas. L'outil d'interrogation de la base est disponible.
Combien d'apprenants ont un compte, combien n'en ont pas, combien de jetons sont
encore valides, combien de sessions sont ouvertes. Pour chaque incompatibilité
de la passe A, chiffre la population touchée.

Termine par ce qu'un utilisateur voit, heure par heure, entre le push et la
publication du front.

### Passe E, verdict

Trois issues possibles, pas quatre : **partir**, **partir sous conditions** en
les énumérant, **ne pas partir** en disant ce qui doit changer d'abord. Si tu
conclus « partir » sans avoir trouvé une seule incompatibilité, explique
pourquoi tu es plus confiant que les faits ne l'autorisent.

### Règles de conduite

- Une affirmation, une preuve : `fichier:ligne`, une commande rejouable, ou une
  mesure en base. Sans preuve, c'est une intuition, et tu l'écris comme telle.
- Ne répare rien pendant l'audit. Tu listes, tu chiffres, tu ordonnes. Les
  corrections viennent après, une fois le rapport lu.
- Si tu ne peux pas vérifier quelque chose, dis-le et dis pourquoi. Une zone
  d'ombre nommée vaut mieux qu'une case cochée.
- Le harnais doit rester vert : `npx vitest run`, `npx playwright test`,
  `npm run build`, `bash scripts/check-rules.sh`. Si l'un casse pendant tes
  manipulations de la passe B, remets en état avant de conclure.
