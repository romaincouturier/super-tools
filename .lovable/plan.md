# Audit Dropshipping vs spec initiale

## ✅ Ce qui fonctionne déjà

- **Webhook WooCommerce** (`supertilt-webhook`) : signature HMAC, filtre par statut (`completed`/`processing`), upsert `woocommerce_orders` + `order_items` (multi‑lignes).
- **Catalogue jeux** (`games`) : titre, type, auteur, URL produit, message perso, instructions, commission (%, fixe, formule), email auteur secondaire, partenaire, stock.
- **Auteurs** (`game_authors`) : nom, email, email secondaire, royalty_rate.
- **Kanban** : à valider / reçue / à expédier / dropshipping / location en attente / traitée / bloquée.
- **Validation manuelle** d'une ligne inconnue : Rattacher / Créer le jeu+auteur / Refuser.
- **Envoi email** (`supertilt-send-email`) : 4 templates (dropshipping / location / partner / internal_notif), variables, BCC fallback, log dans `order_email_log`.
- **Restock** (`supertilt-restock-email`) + table `game_expenses` (date, type, fournisseur, HT, TVA, qté).
- **Portail partenaire** (`supertilt-partner-portal`, `partner_access_tokens`, `partner_payments`) : page partagée par token, partenaire peut déclarer un encaissement.
- **Paramètres** : webhook secret, statuts WC, auto‑send, email interne, expéditeur par défaut.
- **Suivi factures auteur** (ajouté ce matin) : colonne `invoice_received_at`, rappel sympa dans l'email à partir de 5 jeux en attente.

## ⚠️ Écarts vs spec — à corriger

### 1. Double système de ventes incohérent

Le webhook alimente `order_items` mais **pas** `game_sales`. Une fonction parallèle `poll-woocommerce-orders` alimente `game_sales`. Conséquence : la page partenaire (qui lit `game_sales`) ne voit pas en temps réel les ventes arrivées par webhook.
→ **Faire alimenter `game_sales` par le webhook** (en plus de `order_items`), et garder le poller comme filet de sécurité.

### 2. Historique de vente incomplet

`game_sales` ne stocke pas : montant HT, TVA, **frais bancaires Stripe**, alors que la spec les exige.
→ **Ajouter colonnes** `amount_ht`, `vat_amount`, `bank_fees`, `net_amount`, `currency` à `game_sales`. Calcul auto à l'insert (utiliser `stripe_fee_rate`/`stripe_fee_fixed` des settings, et `game.include_stripe_fees`).

### 3. Notification partenaire jamais déclenchée

Un jeu peut avoir `is_partner=true` indépendamment du type. Aujourd'hui le mail "partner" ne part que si `game_type='partner'` — aucun jeu n'a ce type, donc le partenaire n'est jamais notifié.
→ **Logique** : pour tout jeu avec `is_partner=true`, envoyer en plus un email partenaire avec lien vers la page de suivi (token).

### 4. Lien partenaire pas inclus dans le mail partenaire

Le template "partner" n'a pas de `{{lien_suivi_partenaire}}`. Or la spec dit "récap de la page" dans le mail.
→ Générer/réutiliser le `partner_access_tokens` du jeu, exposer la variable et l'inclure dans le template.

### 5. Email location sans contrat joint

La fonction n'attache aucun PDF / lien de contrat. Spec : "envoie un mail avec le contrat de location à renvoyer signé".
→ Ajouter un champ `location_contract_url` sur `games` (PDF dans Storage), exposé en variable `{{contrat_url}}` dans le template "location".

### 6. Notification "jeu Eco / SuperTilt" floue

Aujourd'hui un jeu `game_type='supertilt'` envoie `internal_notif` à `internal_email`. La spec dit "il faudra que ça notifie" sans préciser qui. À confirmer : OK pour notifier l'email interne uniquement ?

### 7. Bouton "Facture reçue" manquant

La colonne existe mais aucune UI pour cocher. Sans ça, le compteur de rappel sympa monte indéfiniment.
→ Ajouter dans l'onglet **Emails envoyés** un bouton/checkbox "Facture reçue".

### 8. Confirmation d'envoi de l'auteur (dropshipping)

Spec : "Une fois que tu auras tout envoyé, peux‑tu me le confirmer ?" — on demande à l'auteur de confirmer mais on n'a pas de moyen de tracer cette confirmation.
→ Ajouter `shipped_confirmed_at` sur `order_items` + bouton dans la card kanban "Confirmé envoyé par l'auteur".

### 9. Suivi des dépenses SuperTilt — UI

Table `game_expenses` OK mais il faut vérifier qu'une page de saisie/listing existe pour les jeux SuperTilt (achat matériel).
→ À confirmer en testant la page Catalogue / fiche jeu.

## 🛠 Plan de mise en conformité (par ordre de priorité)

**Lot 1 — Cohérence ventes & partenaire (critique)**

1. Migration : ajouter `amount_ht`, `vat_amount`, `bank_fees`, `net_amount`, `currency` à `game_sales` ; ajouter `shipped_confirmed_at` à `order_items` ; ajouter `location_contract_url` à `games`.
2. Webhook : alimenter `game_sales` à chaque ligne validée (avec calcul Stripe).
3. Webhook + send-email : si `is_partner=true`, déclencher en plus le mail partenaire avec lien token.

**Lot 2 — Templates & UI**
4. Mettre à jour les templates `partner` (variable `{{lien_suivi_partenaire}}`) et `location` (variable `{{contrat_url}}`).
5. UI : bouton "Facture reçue" dans l'onglet Emails envoyés.
6. UI : bouton "Confirmé envoyé" sur les cards dropshipping.

**Lot 3 — Vérifications**
7. Vérifier la page Catalogue : édition complète d'un jeu (auteur, partenaire, commission, restock, dépenses).
8. Vérifier la page Portail partenaire (pas de régression suite ajout HT/TVA/frais).

## Questions avant de coder

1. Pour le **mail Eco/SuperTilt** : envoi à `internal_email` uniquement, ou aussi à un destinataire spécifique au jeu ?
2. Pour le **contrat de location** : tu veux un PDF unique uploadé par jeu, ou un template avec variables (date, client) à générer dynamiquement ?
3. Tu veux que j'attaque directement le **Lot 1** (le plus critique pour ne plus rater de ventes/partenaires) ou que je commence par autre chose ?  
  
  
1. Je ne vois pas de quoi tu parles  
2. Le contrat de location est un lien à ajouter. Actuellement le mail est Bonjour Stéphane Vuillemenot,
  Merci infiniment pour votre confiance.
  Vous avez choisi de louer le jeu Deadline. Pour bien encadrer notre relation, je vous invite à [signer le contrat de location](https://supertilt.fr/contrat-de-location-du-jeu-deadline/).
  Dès sa signature, je procéderai à son expédition.
  Si vous avez la moindre question, je reste à votre disposition : [romain@supertilt.fr](mailto:romain@supertilt.fr).
  Je vous souhaite de belles parties !
  Bonne journée,
  Romain  
  3. Attaque le lot 1 