# Accès à la gestion des comptes apprenants pour le module E-learning

## Constat

La page LMS > Apprenants récupère la liste via la fonction serveur `manage-learner-account`, qui refuse (403) tout appelant dont le profil n'est pas administrateur. Vérifié en base : Emmanuelle a bien l'accès au module `lms` mais `is_admin = false`, alors que Romain est admin. D'où une liste vide chez elle.

## Changement

Autoriser les utilisateurs ayant l'accès au module E-learning à utiliser la page comme un admin :

- lister les comptes apprenants
- désactiver / réactiver un compte
- modifier l'email
- supprimer un compte

Les utilisateurs sans le module E-learning et sans rôle admin restent refusés.

## Détails techniques

- `supabase/functions/manage-learner-account/index.ts` : remplacer le contrôle unique `is_admin(caller.id)` par `is_admin(caller.id) OR has_module_access(caller.id, 'lms')` (appels RPC via le client service role), en conservant la réponse 403 sinon.
- Aucune migration de base de données, aucune modification de RLS.
- Vérification : typecheck, puis test réel — Emmanuelle ouvre `/lms/apprenants` et voit la liste ; un compte sans le module E-learning obtient toujours 403.
