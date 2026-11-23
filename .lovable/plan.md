# Locations : le statut du contrat pilote la préparation du colis

## Ce qui existe déjà (vérifié)
- À la signature (`submit-location-signature`), la ligne passe en « Location en cours » (`location_active`), la date de fin est fixée à J+30 et seul le client reçoit une confirmation. Rien n'est envoyé à l'équipe.
- Sur la carte de commande, le bouton d'expédition affiche déjà « Contrat non signé » tant que le contrat n'est pas signé, mais sans explication ni date.
- Le récap quotidien contient une alerte « signature en attente » seulement après 10 jours ou à moins de 5 jours de l'expiration. Les contrats récents et les colis à préparer n'y figurent pas.
- Des relances de signature automatiques sont déjà en place (`send-location-signature-reminders`). Elles ne changent pas.

## Recommandation : un statut sur la carte et une tâche dans le récap, sans nouvel email automatique

### 1. Bandeau de statut sur la carte de location (écran Commandes)
Le bandeau est calculé à partir du dernier contrat principal, sans compter les avenants :
- `pending` : bandeau orange « Contrat envoyé le JJ/MM, en attente de signature : ne pas expédier ». Il indique aussi le nombre de relances et la date d'expiration du lien.
- `signed` sans expédition : bandeau vert « Contrat signé le JJ/MM : colis à préparer ». Il affiche la date limite d'expédition si une date de début de location est renseignée sur la commande. Sinon, rien n'est inventé.
- `expired` ou `cancelled` : bandeau rouge « Contrat expiré/annulé : ne pas expédier, renvoyer un contrat ».
- Une fois le colis expédié ou remis en main propre, le bandeau disparaît.

### 2. Expédition signalée, pas bloquée
Si le contrat n'est pas signé, cliquer sur « Jeu expédié » ouvre une confirmation : « Le contrat n'est pas signé. Expédier quand même ? ». L'expédition reste possible pour les cas exceptionnels, et chaque forçage est enregistré dans l'historique de la commande.

### 3. Bloc « Locations » dans le récap quotidien d'Emmanuelle
- « Colis à préparer » : contrats signés sans expédition, avec le client, le jeu, l'adresse de livraison et la date de signature. Ce sont des tâches à cocher, une par ligne, sans doublon. Elles se ferment toutes seules à l'expédition, en suivant la règle existante qui clôt les tâches de commande quand le statut change.
- « En attente de signature : ne pas expédier » : contrats en attente, avec leur ancienneté en jours et le nombre de relances envoyées. Ce bloc est informatif.
- Destinataire : Emmanuelle, désignée par un réglage modifiable dans les paramètres et non écrit en dur. Romain garde ses alertes actuelles.

### 4. Mail court à la signature : en option
Vos règles interdisent tout email automatique non demandé. Je ne l'ajoute que si vous le confirmez. Si oui : un mail interne à Emmanuelle, « Contrat LOC-xxxx signé : préparer le colis pour [client], jeu [nom], adresse [adresse] », envoyé une seule fois par contrat et tracé dans l'historique des emails de la commande.

## Question
Faut-il ajouter le mail de l'étape 4, ou le récap quotidien suffit-il ? Avec le récap seul, Emmanuelle découvre la signature le lendemain à 7 h.

## Détails techniques
- Un helper pur `rentalShippingState(signature, item)` renvoie l'état (`wait`, `prepare`, `invalid`, `done`) avec ses dates. Il est partagé entre l'écran et `daily-data-fetchers.ts`, pour que les deux affichent toujours la même chose.
- Le hook `useSupertiltOrders` charge déjà les signatures. On y ajoute le nombre de relances et la date d'expiration.
- `generate-daily-actions` crée une nouvelle catégorie `location_a_preparer` (clé category|order_item|id) attribuée au réglage `rental_shipping_assignee`. Elle se ferme automatiquement quand la ligne est expédiée, remise en main propre ou archivée.
- Pas de nouvelle table et pas de changement des droits d'accès. Seul un réglage est ajouté dans `app_settings`.
- Tests : états du helper (pending, signed, expired, cancelled, expédié), absence de doublon de tâche, fermeture à l'expédition, et confirmation obligatoire pour expédier sans signature.
- Rien ne change pour LOC-2026-003 : il apparaîtra dans « Colis à préparer » s'il n'est pas encore expédié.
