# Onboarding auteur dropshipping (invitation, formulaire, contrat, signature)

## Constat
- `game_authors` : un seul champ `name`, pas de prénom/nom séparés ni de statut. `games` : a déjà `status`, `commission_rate`, les champs `location_*` (durée, retard/mois, prix de remplacement), mais **pas de tarif de location HT** (la location passe par `location_variation_id` WooCommerce).
- La location dispose déjà de `generate-location-contract` (PDFMonkey), `submit-location-signature`, `send-location-contract-email`, `send-location-signature-reminders` et de la table `location_contract_signatures` (empreintes du PDF et de la preuve, IP, parcours, relances). Aucun code à usage unique (OTP) n'existe aujourd'hui.

## Parcours livré
1. Onglet Auteurs → « Inviter un auteur » (email, prénom, nom, jeu, commission 15 % par défaut). Crée l'auteur, un jeu `brouillon` et une invitation à jeton, puis ouvre un **brouillon d'email** (modèle éditable `author_invitation`). L'envoi n'a lieu qu'après votre clic.
2. Page publique `/proposer-mon-jeu/:token` : trois sections (Vendeur, Jeu, Logistique), plus Location facultative et champs libres. Le brouillon s'enregistre automatiquement et se reprend plus tard. La soumission est verrouillée après confirmation.
3. À la soumission : réponses recopiées dans l'auteur et le jeu, contrat généré par PDFMonkey (référence `DIST-AAAA-n`), statut « contrat envoyé », lien de signature envoyé sur la même page, sans nouvel email à rédiger.
4. Signature : code à 6 chiffres envoyé par email (valable 10 min, 5 essais), signature dessinée, preuve (IP, horodatage, empreinte du code vérifié, empreintes du PDF et de la preuve), PDF signé. Copie automatique à l'auteur et à vous. Relances à J+3 et J+7.
5. Après signature : auteur et jeu en « contrat signé », contrat et preuve sur la fiche auteur, action quotidienne datée pour Emmanuelle avec un lien vers une page interne listant les réponses et les médias téléchargeables.
6. Suivi des statuts : invité → formulaire en cours → soumis → contrat envoyé → signé → fiche en ligne. Le dernier statut est manuel, ou automatique quand `woocommerce_product_id` est renseigné.

## Données
- `game_authors` : ajout de `first_name`, `last_name`, `onboarding_status`, `legal_name`, `siren`, `postal_address`, `legal_rep_name`. `name` reste rempli pour compatibilité.
- `games` : ajout de `location_tarif_ht`, `location_enabled`, `weight_g`, `package_dimensions`, `shipping_fee`, `shipping_delay`, `pitch`, `credits`, `video_url`, `logo_url`.
- **`author_onboarding_invitations`** : token haché, author_id, game_id, commission, expires_at (30 jours), opened_at, submitted_at, revoked_at, invited_by.
- **`author_onboarding_responses`** : invitation_id, `data jsonb` (réponses brutes, archive de l'ancien Google Form), version, updated_at, submitted_at.
- **`author_onboarding_files`** : invitation_id, kind (logo/photo/pdf), storage_path, mime, taille, empreinte.
- **`distribution_contract_signatures`** : calquée sur `location_contract_signatures`, plus `otp_hash`, `otp_expires_at`, `otp_attempts`, `otp_verified_at` et `author_id`/`game_id`. Table séparée pour ne pas mêler deux types de contrats ni casser la location.
- Séquence `distribution_contract_seq` par année, verrouillée, sans `MAX()+1`.
- Réglage `distributor_signature_path` (image privée) dans `app_settings`.
- Ajout des nouvelles tables aux sauvegardes.

## Réutilisé / nouveau
- Réutilisé : appel PDFMonkey et attente du document, pad de signature, calcul des empreintes et de la preuve, logique de relance (`reminder_count`, `last_reminder_at`), envoi Resend avec copie cachée, modèles d'email éditables, `daily_actions`.
- Nouveau : invitation et formulaire public, code OTP, envoi automatique de la copie signée aux deux parties, statuts auteur, page interne des réponses.
- PDFMonkey : l'API permet de modifier un modèle (`PUT /document_templates/{id}`, champ `body`). Je peux mettre à jour A3FFB90C… si vous me donnez le HTML. Conseil : **dupliquer d'abord** le modèle (ou me laisser le faire), pour ne pas casser un usage existant non identifié.

## Sécurité
- Jeton aléatoire de 32 octets, stocké uniquement haché, expiration à 30 jours, révocable, non devinable. Aucun accès anonyme direct aux tables : tout passe par des fonctions qui vérifient le jeton côté serveur (RLS fermée à `anon`, accès staff réservé au module `dropshipping`).
- Uploads : envoyés par la fonction vers un bucket privé `author-onboarding`. Liste blanche (PNG/JPG/WebP/PDF), 10 Mo par fichier, 20 photos maximum, nom de fichier réécrit, empreinte enregistrée. Téléchargement staff par URL signée d'une heure.
- Champs texte : longueurs limitées, URL `http(s)` seulement, aucun HTML interprété dans le PDF (échappement avant Liquid).
- Signature impossible sans OTP valide. Le PDF est figé à l'envoi : toute modification après soumission impose un nouveau contrat.
- Limitation de débit sur l'envoi d'OTP et la sauvegarde du brouillon (même mécanisme que `formulaire_rate_limits`).

## Points à anticiper
- Modification des réponses après soumission : je propose un bouton staff « Rouvrir le formulaire », qui annule le contrat non signé.
- Changement de commission après l'envoi du contrat : régénérer le contrat.
- Un auteur qui a plusieurs jeux : une invitation par jeu, auteur réutilisé si l'email existe déjà.
- Prix de vente HT proposé par l'auteur ou prix boutique : je n'écrase pas les prix existants, je stocke la proposition.
- Valeur juridique : signature électronique simple renforcée par l'OTP, pas une signature qualifiée.
- Édouard Vuillemin : vérifier s'il existe déjà dans `game_authors` avant l'invitation.
- Emmanuelle doit exister comme utilisatrice avec accès au module.

## Étapes livrables
1. Schéma, bucket, séquence, réglage de signature, modèle d'email d'invitation, bouton « Inviter » et brouillon d'email (sans envoi automatique).
2. Formulaire public avec brouillon, uploads et soumission ; page interne des réponses.
3. Contrat PDFMonkey et mise à jour ou duplication du modèle.
4. Signature avec OTP, preuve, PDF signé, copie automatique aux deux parties, relances J+3/J+7.
5. Statuts dans l'onglet Auteurs, action pour Emmanuelle, outils MCP de lecture (optionnel), sauvegardes, tests.
6. Premier cas réel : Édouard, invitation préparée et envoyée par vous.

## Questions
1. Durée de validité de l'invitation : 30 jours, cela vous convient ?
2. PDFMonkey : je duplique le modèle, ou je modifie A3FFB90C directement ?
3. Le tarif de location HT doit-il aussi mettre à jour la variation WooCommerce ? Je propose que non (manuel).
4. Le statut « fiche en ligne » : manuel, ou automatique dès qu'un produit WooCommerce est lié ?
