# Mail « Nouvelle publication communauté » enrichi

## Constat (vérifié en base)
- Le 03/10 : 4 mails envoyés à 14h00, 14h03, 14h09, 14h09 (Paris). Il ne reste que 2 publications d'Anna (« Scribing Practice » et « Scribing Practice 2 », 14h09). Les 2 premières ont été supprimées entre-temps (probablement republiées après l'erreur de dépôt corrigée samedi). Ce ne sont donc pas des doublons techniques : chaque mail correspond à une publication distincte, l'envoi par publication est déjà unique.
- Les travaux publiés n'ont qu'une seule réaction : « J'aime » (les emojis multiples existent seulement sur les publications du fil « Pratique »). Le mail proposera donc ce même « J'aime ».
- « Voir la publication » ouvre la fenêtre de la page Dépôts (côté équipe), qui n'affiche ni les « J'aime » ni les commentaires de la communauté.

## Ce qui change
1. **Aperçu dans le mail** : miniature de l'image (si le fichier est une image), titre, début du texte (300 caractères), formation et leçon.
2. **« J'aime » depuis le mail** : bouton « J'aime » dans le mail. Le clic passe par un lien sécurisé personnel au formateur (valable 30 jours, utilisable seulement pour cette publication), enregistre la réaction sans reconnexion, puis ouvre la publication. Un second clic ne crée pas de doublon.
3. **Vue publication complète** : la fenêtre ouverte par « Voir la publication » affiche l'image, le texte, le nombre de « J'aime » avec les auteurs, les commentaires de la communauté, et permet de réagir et commenter directement.
4. **Regroupement** : quand une publication arrive, le mail attend 5 minutes ; toutes les publications de la même personne dans la même formation pendant cette fenêtre partent en un seul mail (« 2 nouvelles publications… »), chacune avec son aperçu et son bouton « J'aime ».

Les autres notifications (retours formateur, commentaires, fil Pratique) ne changent pas.

## Détails techniques
- Table `deposit_reaction_tokens` (token aléatoire, deposit_id, trainer_email, expires_at) ; RLS activée sans policy, accès service role uniquement.
- Nouvelle edge function publique `deposit-email-reaction` (GET ?t=token) : valide le token, upsert dans `lms_deposit_reactions` avec l'email du formateur, redirige vers `/lms/deposits?deposit=<id>`.
- `send-deposit-trainer-notification` : ne s'exécute plus immédiatement ; l'appel côté client marque la publication « à notifier ». Un cron toutes les 5 minutes appelle la fonction en mode lot : regroupe les publications non notifiées de plus de 5 minutes par (apprenant, formation), un seul mail, puis `trainer_notified_at` posé sur toutes. Aperçu image via URL signée 7 jours (bucket privé).
- Fenêtre `DepositDetail` côté équipe : ajout des sections réactions et commentaires (tables `lms_deposit_reactions`, `lms_deposit_comments`), avec l'email du staff connecté comme auteur ; vérification que les policies RLS permettent au staff d'écrire, ajustement sinon.
- Test : regroupement (2 publications à 3 minutes = 1 mail) et token invalide/expiré refusé.
- Aucun mail renvoyé pour les publications passées.
