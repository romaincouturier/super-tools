# Kanban éditorial et newsletters depuis Claude

## Ce qui existe déjà
- Claude peut lire le kanban et les newsletters passées, mais un seul outil (le dossier de préparation) renvoie tout à la fois : c'est lourd pour une simple question.
- Il ne peut rien écrire : ni carte de contenu, ni sommaire de newsletter.
- En base : 9 colonnes (Idées, À relire, relectures, Attente/Bloqué, Diffusion en cours, Diffusion terminée, Archive), 87 cartes, 6 newsletters envoyées et 1 brouillon (08/09/2026).

## Besoin 1 — Déposer une carte
Nouvel outil **create_content_card** :
- titre (obligatoire), contenu (texte ou HTML simple, un article complet si besoin), thèmes (étiquettes), emoji facultatif, échéance facultative ;
- stade d'avancement choisi par nom de colonne (par défaut : « Idées »). Un nom inconnu est refusé, avec la liste des colonnes valides ;
- la carte arrive en haut de la colonne. L'auteur indiqué est « connecteur Claude » ;
- l'outil ne fait qu'ajouter : il ne modifie ni ne supprime aucune carte existante.

Nouvel outil **list_content_board** (léger) : les colonnes et, pour chaque carte, son titre, ses thèmes, sa colonne et la date de sa dernière newsletter, sans le contenu. On peut filtrer par colonne ou par thème. Il sert aussi à retrouver une carte à mettre dans une newsletter.

## Besoin 2 — Historique des newsletters
Nouvel outil **list_newsletters** : pour chaque newsletter, sa date, son statut et la liste des articles dans l'ordre (titre et thèmes seulement). Les plus récentes d'abord, 12 au maximum par défaut.
Le contenu complet d'un article reste accessible à la demande, carte par carte (**get_content_card**).

## Besoin 3 — Préparer la prochaine newsletter
Nouvel outil **prepare_newsletter** :
- sert à créer un brouillon (titre et date prévue) ou à reprendre le brouillon existant ;
- reçoit le sommaire dans l'ordre souhaité : des cartes existantes et/ou de nouveaux contenus, créés au passage dans le kanban (colonne « Idées » par défaut) ;
- remplace le sommaire du brouillon par celui qui est fourni. Il ne touche jamais une newsletter déjà envoyée (refus explicite) ;
- signale les cartes déjà utilisées dans une newsletter envoyée, sans les bloquer.
L'envoi reste manuel, depuis l'interface.

## Consignes données à Claude
Ajouter aux consignes de Claude : pour une question simple, utiliser list_newsletters et list_content_board plutôt que le dossier complet, et ne jamais envoyer de newsletter.

## Détails techniques
- Outils ajoutés dans `supabase/functions/_shared/editorial-tools.ts`, branchés dans `mcp-server/index.ts`. Descriptions en anglais, comme les autres outils.
- Tables `content_cards` (`tags` en jsonb : on écrit un tableau et on lit aussi les anciennes valeurs en chaîne), `content_columns`, `newsletters`, `newsletter_cards` (`display_order`). Accès via le client administrateur déjà utilisé par le serveur, `org_id` repris de l'organisation par défaut.
- Remplacement du sommaire : suppression puis réinsertion des lignes `newsletter_cards` de ce brouillon uniquement, après avoir vérifié `status <> 'sent'`.
- Aucune migration nécessaire.
- Tests Vitest sur la validation (colonne inconnue, newsletter envoyée refusée, ordre conservé, lecture des deux formats de tags), `scripts/check-rules.sh`, puis déploiement de `mcp-server` seul. Vérification réelle : créer une carte de test « [TEST] » dans « Idées », lire l'historique, puis supprimer la carte.
