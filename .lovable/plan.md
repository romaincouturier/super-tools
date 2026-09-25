# Corriger le bandeau de réassort ECHO

## Constat vérifié
- Le mail client « Suite à votre commande d'ECHO 💛 » ne vient pas de SuperTools : l'envoi SuperTools associé à la commande est une notification partenaire distincte.
- Le texte du bandeau n'existe ni dans le code ni dans les modèles d'e-mail de SuperTools.
- La commande contient des traces AutomateWoo : le mail client est donc piloté par une automatisation de la boutique WordPress.
- La boutique publique indique déjà ECHO « en stock », mais la fiche SuperTools conserve un ancien stock à `0`; le réassort SuperTools est pourtant terminé.

## Mise en œuvre
1. Lire l'automatisation AutomateWoo responsable du mail ECHO avec l'accès WooCommerce déjà configuré côté serveur, sans exposer les identifiants.
2. Remplacer le bandeau en dur par une condition liée à un statut de réassort explicite et facilement modifiable pour le produit.
3. Désactiver ce statut pour ECHO immédiatement.
4. Déclencher uniquement un aperçu ou une vérification de configuration, jamais un envoi client ni un rejeu des commandes existantes.
5. Vérifier que les prochaines commandes ECHO n'incluent plus le bandeau et documenter l'action exacte pour le réactiver.

## Limite
Si AutomateWoo refuse l'accès fourni par la boutique, j'arrête sans modifier l'envoi et j'indique précisément l'autorisation manquante.
