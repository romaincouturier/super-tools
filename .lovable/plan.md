# Contenus sociaux : statut indépendant de la date

## Où la règle « date ⇒ programmé » est appliquée aujourd'hui

Base (la source de la règle) :
- Contrainte `social_posts_status_matches_date` (`20261105120000_social_contents.sql`, l. 52-54) : interdit un « Brouillon » (`unscheduled`) daté. C'est le verrou principal.
- `save_social_content_group` (dernière version `20261106110000_social_themes.sql`, l. 116-139) : le statut est calculé à l'enregistrement, `CASE WHEN scheduled_at IS NULL THEN 'unscheduled' ELSE 'scheduled'`, et écrasé à chaque mise à jour.
- `set_social_group_date` (`20261105130000_social_group_date.sql`, l. 23-24) : glisser-déposer dans le calendrier, même calcul.
- `set_social_post_published` (`20261107100000_social_post_publication.sql`, l. 41-45) : « Annuler le marquage » remet Programmé si daté, Brouillon sinon (comportement conservé).

Application :
- `SocialComposerDialog.tsx` l. 497-500 : badge en lecture seule, statut affiché = `date ? "scheduled" : "unscheduled"`.
- `socialContents.ts` l. 527-535 `withGroupDate` : mise à jour optimiste avec le même calcul.
- `socialContents.ts` l. 484-486 `listUndatedGroups` : « Non planifiés » charge les contenus au statut Brouillon (et non sans date), donc un brouillon daté y resterait.
- `placeGroups` place déjà par date : un brouillon daté ira sur son jour, en gris, une fois la contrainte levée.

MCP / API : aucun outil MCP ni fonction serveur ne crée de contenus sociaux aujourd'hui (seules les sauvegardes lisent ces tables). La logique sera donc garantie en base, ce qui couvrira tout futur outil MCP ; aucun outil MCP n'est créé dans ce lot (à demander séparément si souhaité).

## Comportement cible

- Date et statut indépendants : saisir, modifier ou effacer une date ne touche jamais le statut.
- Sélecteur par déclinaison Brouillon / Programmé à la place du badge ; « Publié » reste piloté par le bouton « Marquer publié » (sélecteur désactivé sur une déclinaison publiée).
- Nouvelle déclinaison : Brouillon par défaut, datée ou non.
- Programmé sans date et heure : message « Indiquez une date et une heure pour programmer », le statut ne change pas.
- Effacer la date d'une déclinaison Programmé : refusé avec un message « Repassez en Brouillon avant de retirer la date » (hypothèse, puisque le statut ne doit pas changer et que Programmé exige une date ; à corriger si tu préfères un autre comportement). Même règle au glisser vers « Non planifiés ».
- Glisser-déposer d'un brouillon sur un jour : il devient daté, reste Brouillon.
- Calendrier : brouillon daté sur son jour, couleur grise Brouillon ; « Non planifiés » = contenus ayant une déclinaison sans date. Filtres de statut inchangés (ils lisent le statut enregistré).
- Données existantes intactes : aucune mise à jour de lignes, les Programmé restent Programmé.

## Étapes

1. Migration (additive, aucune donnée modifiée) :
   - remplacer la contrainte par `publication_status <> 'scheduled' OR scheduled_at IS NOT NULL` (seul Brouillon daté devient permis ; toutes les lignes existantes la respectent déjà) ;
   - `save_social_content_group` : lit `publication_status` optionnel par déclinaison (`unscheduled` / `scheduled`, défaut `unscheduled` à la création, statut existant conservé si absent en mise à jour), n'en déduit plus jamais depuis la date ; refuse `scheduled` sans date avec un message clair ; `published` ne passe que par `set_social_post_published` ;
   - `set_social_group_date` : ne modifie plus le statut ; refuse de retirer la date si une déclinaison non publiée est Programmé ;
   - nouvelle RPC `set_social_post_status(post_id, status)` (SECURITY INVOKER, RLS de l'appelant, Brouillon/Programmé uniquement, refus sans date).
2. Service `socialContents.ts` : brouillon de formulaire porte le statut par canal ; `setPostStatus` ; `withGroupDate` garde le statut ; `listUndatedGroups` filtre `scheduled_at IS NULL` ; helper pur `validateStatusChange` partagé formulaire/messages.
3. Formulaire `SocialComposerDialog.tsx` : sélecteur shadcn par onglet, état statut par canal, message toast quand Programmé est refusé ; badge Publié + bouton conservés.
4. Tests (lancés avant livraison avec `npm test`, `npm run typecheck`, `bash scripts/check-rules.sh`).

## Tests ajoutés

- `supabase/tests/social-contents.test.ts` (base) :
  - brouillon daté enregistré : statut reste `unscheduled`, date conservée ;
  - passage à Programmé sans date refusé (RPC et enregistrement), statut inchangé ;
  - effacement de la date sur un contenu Programmé refusé, statut et date inchangés ;
  - changer la date d'un Programmé ne change pas son statut.
- `src/services/socialContents.test.ts` : `withGroupDate` ne change pas le statut ; `placeGroups` met un brouillon daté sur son jour avec le statut Brouillon et pas dans « Non planifiés » ; `validateStatusChange`.
- `SocialComposerDialog.test.tsx` : saisir une date laisse « Brouillon » ; choisir Programmé sans date affiche le message et garde Brouillon ; nouvelle déclinaison créée en Brouillon avec date.
- Tests existants qui supposent « datée ⇒ Programmé » mis à jour.

## Impact sécurité (PR)

Nouvelle RPC en SECURITY INVOKER, exécution `authenticated` seulement, révoquée pour `anon` : la RLS existante (admin ou module supertilt_fr) s'applique. Aucune donnée existante modifiée, aucun email ni automatisation.
