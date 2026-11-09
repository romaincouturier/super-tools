# Commandes internes issues d'un devis de jeux

## Constats (vérifiés)
- Un devis de jeux n'est pas enregistré dans une table dédiée : `generate-game-devis` écrit une ligne `activity_logs` (`game_devis_sent`) avec opportunité, client, lignes, port, frais de dossier, PDF.
- Les commandes boutique sont créées par `supertilt-webhook` dans `woocommerce_orders` (`wc_order_id` INTEGER NOT NULL UNIQUE) et `order_items` (clé `woocommerce_order_id,wc_product_id`). Le kanban, l'historique `game_sales`, les emails auteur/partenaire, la location et Sendcloud partent de là.
- Le mail « Nouvelle commande sur SuperTilt » envoyé à la compta n'existe pas dans SuperTools : c'est le mail natif de WooCommerce. Une commande créée seulement dans SuperTools ne l'envoie donc jamais, et ne crée aucune facture WooCommerce.
- Accès boutique : URL, Consumer Key et Consumer Secret sont renseignés dans les paramètres. Je ne sais pas si la clé a les droits lecture/écriture ou lecture seule : il faut le vérifier par un appel de test sans risque.
- Opportunité test `ac1bdbac…` (statut gagné, mission liée « Commande de 5 jeux de cartes Echo », en cours) : **aucun devis de jeux enregistré** pour elle. Il faudra régénérer le devis depuis l'onglet Devis, ou utiliser la saisie manuelle prévue à l'étape 2.

## Parcours livré
1. Opportunité gagnée avec un devis de jeux : la fenêtre propose « Créer une commande » en premier. « Créer une mission » reste accessible, mais en option secondaire, et n'est jamais créée automatiquement.
2. L'écran de revalidation est pré-rempli depuis le dernier devis : jeux, quantités, prix unitaires, remises, port, frais de dossier, client, adresse de facturation et adresse de livraison. Tout reste modifiable. Sans devis, les lignes sont à saisir.
3. La validation crée une commande « origine devis » avec un numéro `DV-2026-0001`. Le même workflow que pour une commande boutique se déclenche, sans mail compta et sans facture WooCommerce.
4. Le kanban et la fiche commande affichent un badge « Commande issue d'un devis » avec des liens vers le PDF du devis et l'opportunité.

## Étapes livrables
**Étape 1 : base de données (une migration, sans casser l'existant)**
- `woocommerce_orders` : ajouter `source` (`woocommerce` par défaut, ou `devis`), `devis_activity_log_id`, `crm_card_id`, `cancelled_at`, `cancel_reason`.
- Identifiant sans collision : `wc_order_id` négatif tiré d'une séquence dédiée, car les vrais numéros WooCommerce sont positifs. `order_number` = `DV-AAAA-NNNN`, tiré d'un compteur verrouillé par année (même principe que le correctif des tickets).
- Idempotence : un index unique partiel interdit deux commandes actives pour un même `crm_card_id` (`source='devis'`, `cancelled_at IS NULL`).
- Une fonction serveur crée la commande et ses lignes en une seule transaction, avec trace dans `crm_activity_log` (« commande créée »). Droits réservés aux utilisateurs ayant le module CRM ou dropshipping.
- Ajout des nouveaux champs aux sauvegardes (`backup-export`, `scheduled-backup`).

**Étape 2 : extraire le workflow commun**
- Sortir de `supertilt-webhook` le traitement par ligne (kanban, `game_sales`, emails auteur/partenaire, location, Slack) dans `_shared/process-order-items.ts`. Le webhook et la nouvelle fonction `create-devis-order` l'appellent tous les deux.
- `create-devis-order` vérifie l'utilisateur, valide les lignes (jeu, quantité, prix ≥ 0), appelle la fonction de création, puis lance le traitement commun. Sendcloud et le suivi restent inchangés, puisqu'ils partent des lignes de commande.
- Aucun appel aux commandes WooCommerce, aucun mail compta.
- Tests : pas de collision de numéro, appel idempotent (le deuxième appel renvoie la commande existante), lignes de location qui créent bien le contrat.

**Étape 3 : écrans**
- Fenêtre post-gain (`CardDetailDialogs.tsx`) : si l'opportunité a un devis de jeux, afficher « Créer une commande » et rétrograder « Créer une mission ». Si une commande existe déjà, afficher « Voir la commande ».
- Nouvel écran de revalidation, avec chargement par hook puis service : lignes éditables, total HT et TTC, adresses.
- Badge et liens dans le kanban dropshipping et la fiche commande.

**Étape 4 : annulation et correction**
- Avant expédition (aucune ligne envoyée ni remise en main propre) : « Annuler la commande » renseigne `cancelled_at`, archive les lignes, marque les ventes `game_sales` comme annulées et remet le stock interne. Un mail de contre-ordre est proposé en brouillon à l'auteur ou partenaire déjà prévenu, jamais envoyé automatiquement. Une nouvelle commande devient ensuite possible.
- Correction : annuler puis recréer depuis l'écran pré-rempli. Pas de modification directe des lignes déjà notifiées, pour garder une trace propre.
- Après expédition : annulation bloquée, avec un message qui demande de passer par un avoir.

**Étape 5 (option) : stock**
- Stock interne : décrémenter `games.current_stock` à la validation (la fonction `decrement_game_stock` existe) et le remettre à l'annulation.
- Stock boutique : si l'appel de test confirme le droit d'écriture, faire un `PUT /products/{woocommerce_product_id}` sur `stock_quantity` (ou la variation correspondante), puis le remettre à l'annulation. En cas d'échec, une action quotidienne est créée, sans bloquer la commande.
- Si la clé est en lecture seule : il faut une nouvelle clé lecture/écriture créée dans WooCommerce (environ 5 min de votre côté), puis environ une demi-journée de développement et de tests. Le connecteur WooCommerce de Lovable est une alternative.

**Étape 6 : reprise de l'opportunité Echo**
- Rouvrir puis repasser en gagné ne recrée pas de mission (rien d'automatique). La fenêtre proposera « Créer une commande ».
- La mission existante n'est jamais supprimée automatiquement. Je propose de la passer en « terminée » après votre accord pour faire disparaître les alertes du récap. Plus tard, les opportunités issues d'un devis de jeux seront aussi exclues des alertes mission (train, hôtel, date de début, prochaine action).
- Prérequis : régénérer le devis de jeux lié à cette opportunité, car aucun n'est enregistré aujourd'hui.

## Points à confirmer
1. Clé boutique : j'ai votre accord pour un appel de test en lecture seule, qui vérifiera les droits sans rien modifier ?
2. Format du numéro `DV-AAAA-NNNN` : il vous convient ?
3. Faut-il quand même prévenir l'auteur ou le partenaire immédiatement à la validation, comme pour une commande boutique ? Je pars sur oui.
4. Pour la mission Echo existante : la passer en terminée, ou la laisser telle quelle ?
