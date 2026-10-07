# Contrôle d'exactitude de la sauvegarde (portabilité hors Lovable)

## Constat (vérifié sur le run réussi du 07/10)

La sauvegarde de cette nuit est « OK » : 241 tables, aucune erreur. Mais « OK » veut seulement dire « nombre de lignes à peu près cohérent ». Ce n'est pas une preuve d'exactitude :

1. **Contrôle trop tolérant** : une table passe si l'écart est inférieur à 5 % (ou 100 lignes), et le run passe tant que moins de 10 % des tables sont en écart. Aucune vérification du contenu.
2. **Risque réel de lignes en double ou oubliées** : la plupart des tables sont lues par pages sans ordre fixe. Si des lignes changent pendant la lecture, une page peut en sauter ou en répéter, sans que le compteur le voie.
3. **Données absentes de la sauvegarde**, problématiques pour une migration :
   - **Comptes de connexion** (emails, mots de passe chiffrés, sessions) : non sauvegardés. Sans eux, sur une autre plateforme, toute l'équipe et tous les apprenants devraient recréer un compte.
   - **Index de recherche IA** (5 679 lignes) : sauté volontairement, il peut être recalculé.
   - **15 tables exclues volontairement** (données temporaires, signalements sensibles VHD...) : choix documentés, mais à faire figurer dans le rapport.
   - **Structure de la base** (tables, règles d'accès, fonctions, tâches planifiées) et **fonctions serveur** : présentes uniquement dans le code, pas dans le dossier de sauvegarde.
   - **Clés secrètes** (Resend, Google, PDFMonkey...) : jamais sauvegardées (normal), mais leur liste n'est écrite nulle part.
4. Les fichiers (3 462) sont copiés en miroir avec un manifeste, mais personne ne relit les copies Drive pour vérifier leur taille.

## Ce que je propose

### A. Lecture exacte
- Toutes les tables sont lues dans un ordre fixe (par identifiant ou par clé primaire), sans risque de doublon ni d'oubli.
- Chaque fichier exporté enregistre son nombre de lignes et une empreinte de son contenu.

### B. Contrôle d'exactitude, table par table
Juste après l'export de chaque table, la base calcule le même nombre et la même empreinte pour les lignes exportées (mêmes identifiants). Le rapport classe chaque table :
- **Exacte** : même nombre, même empreinte.
- **Écart expliqué** : lignes créées ou modifiées après l'export (prouvé par leur date de modification).
- **Écart non expliqué** : la sauvegarde est KO et la table est nommée dans l'email.

Plus de tolérance de 5 %.

### C. Relecture des fichiers Drive (contrôle de restauration)
Une fois par semaine, la sauvegarde relit les fichiers depuis Drive : JSON lisible, nombre de lignes, empreinte identique, aucun identifiant en double. Pour les fichiers, comparaison de la taille Drive avec le manifeste sur un échantillon tournant, avec une couverture totale sur un mois.

### D. Kit de migration dans chaque sauvegarde
Un fichier « inventaire » ajouté au dossier Drive contient :
- la liste des tables avec nombre de lignes, empreinte et statut (exacte / exclue avec la raison / sautée) ;
- **l'export des comptes utilisateurs** (identifiant, email, mot de passe chiffré, rôles, date de création), pour que les comptes puissent être recréés à l'identique ailleurs ;
- la structure complète de la base (tables, colonnes, règles d'accès, fonctions, tâches planifiées) ;
- la liste des fonctions serveur et **les noms** des clés secrètes à reconfigurer (jamais leurs valeurs).

### E. Email de rapport
Nouvelle ligne « Exactitude » : X tables exactes, Y écarts expliqués, Z écarts non expliqués (tableau détaillé), comptes utilisateurs inclus, dernier contrôle de relecture Drive.

## Points à valider

- **Comptes utilisateurs** : leur export contient les mots de passe chiffrés (non lisibles, mais sensibles). Ils seraient stockés dans le dossier Drive privé de sauvegarde, comme le reste. D'accord ?
- **Signalements VHD** : je propose de les laisser exclus (choix actuel). Une migration les perdrait. À confirmer.

## Détails techniques

- RPC `backup_table_fingerprint(table, ids[])` en SECURITY DEFINER, réservée au service : `count(*)` et `md5(string_agg(md5(row_to_json(t)::text), '' order by pk))`. Le même calcul est fait côté fonction sur les lignes exportées (sérialisation identique via `row_to_json` côté SQL pour l'export, afin d'éviter les écarts de format JSON entre PostgREST et JS). Variante plus simple si le format diverge : l'export lui-même passe par une RPC qui renvoie les pages en `jsonb`.
- Pagination par clé primaire (lue dans `information_schema.table_constraints`), repli `ctid` si une table n'a pas de clé.
- RPC `backup_auth_users_export()` (service uniquement) sur `auth.users` et `auth.identities` (lecture seule, aucune écriture dans le schéma auth).
- RPC `backup_schema_inventory()` : colonnes, contraintes, policies (`pg_policies`), fonctions (`pg_get_functiondef`), jobs `cron.job`.
- Contrôle Drive hebdomadaire : nouveau mode `verify` de `scheduled-backup`, avec des ticks et un checkpoint comme la synchro storage.
- `verifyBackupIntegrityByCounts` est remplacée par le résultat des empreintes ; la règle [038] et `check-backup-tables.sh` sont inchangées.
