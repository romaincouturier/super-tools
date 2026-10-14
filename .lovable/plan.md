# Location de jeux : relance de signature du contrat

## Constat (lecture seule)

1. **Circuit actuel**
   - La commande WooCommerce (variation location) arrive par `supertilt-webhook` et la carte passe en « Location — contrat en attente » (`location_pending`).
   - Dans Commandes Supertilt, l'équipe génère le contrat (`generate-location-contract`, PDF), puis clique sur « Envoyer + signer » (`send-location-contract-email`). Le client reçoit un email avec le PDF en pièce jointe et un lien vers la signature interne SuperTools `/signature-location/<token>`. Ce n'est pas un outil externe : c'est une signature électronique simple maison, avec fichier de preuve.
   - En base : table `location_contract_signatures` (`status` pending/signed/expired, `expires_at` = envoi + 30 j, `signed_at`, PDF signé). À la signature, `submit-location-signature` passe la carte en « Location en cours », fixe la fin à signature + 30 j et envoie un email de confirmation.
2. **Relance automatique : il n'y en a pas.** Aucun cron, aucune edge function ni alerte quotidienne ne s'occupe des contrats `pending`. Le seul moyen est de renvoyer le contrat à la main. Le lien expire au bout de 30 jours sans que personne soit prévenu.
3. **Blocage de l'envoi du jeu : seulement implicite.** Tant que le contrat n'est pas signé, la carte reste dans « contrat en attente », et le garde-fou en base empêche de la passer en « Traité » s'il y a une référence de contrat. Mais il n'existe ni étape ni case « jeu expédié » pour les locations (le bouton « Confirmé envoyé » est réservé au dropshipping). Rien n'empêche donc vraiment d'expédier avant la signature, et rien n'indique « tu peux envoyer » après.

## Proposition

1. **Relance client automatique par email**, à J+3 et J+7 après l'envoi, si le contrat n'est toujours pas signé. Elle reprend le même lien de signature, avec un modèle modifiable « Relance signature contrat de location » (tu/vous). Au maximum 2 relances, chacune envoyée une seule fois (anti-doublon), copie cachée habituelle et trace dans l'historique des emails.
2. **Alerte interne dans le mail quotidien** : liste des contrats non signés depuis plus de 10 jours ou qui expirent dans moins de 5 jours, pour décider d'appeler le client.
3. **Étape « jeu expédié » pour les locations** : un bouton « Jeu expédié », actif seulement quand le contrat est signé et grisé avec l'explication « Contrat non signé » sinon. Une fois le contrat signé, un badge « À expédier » s'affiche sur la carte.

## Détails techniques

- Ajouter `reminder_count` et `last_reminder_at` à `location_contract_signatures`. La réservation se fait par un UPDATE conditionnel pour que chaque relance parte une seule fois.
- Créer une edge function `send-location-signature-reminders`, appelée par le cron quotidien déjà en place à 07h00 Paris (aucun nouveau cron), sur les avenants exclus (`location_extension_id IS NULL`) ou inclus selon ton choix.
- Ajouter un modèle dans `EDITABLE_EMAIL_DEFAULTS` et `renderEditableEmail`, conforme à la règle [075].
- Ajouter un fetcher `fetchLocationSignatureAlerts` dans `daily-data-fetchers.ts`.
- Réutiliser `shipped_confirmed_at` pour les locations, avec un trigger en base qui refuse l'expédition sans signature `signed`.

## Points à valider

- Délais J+3 / J+7, et seuil d'alerte interne à 10 jours.
- Relances aussi pour les avenants de prolongation ?
