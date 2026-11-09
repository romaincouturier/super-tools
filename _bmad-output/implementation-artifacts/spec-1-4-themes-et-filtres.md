---
title: 'Story 1.4 : classer les contenus par thèmes et filtrer'
type: 'feature'
created: '2026-11-06'
status: 'done'
baseline_commit: '18d872d212e93d4cf6327778f217eec5501c0ec8'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-1-3-visuel-et-alertes.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les contenus ne portent aucun thème éditorial : impossible de voir l'équilibre de la ligne éditoriale ni de filtrer le calendrier autrement que par canal.

**Approach:**
- Des thèmes colorés se gèrent dans les réglages du module : liste vide au départ, création, renommage, recoloration, suppression.
- Le composeur attribue un thème (ou aucun) à un contenu ; la carte prend un liseré gauche à sa couleur.
- Une barre de filtres en pastilles, conforme à la maquette, filtre la grille et « Non planifiés » par thème, réseau et statut.

## Boundaries & Constraints

**Always:**
- Le thème est porté par le contenu (`social_content_groups.theme_id`), pas par la déclinaison, puisqu'une carte représente un groupe. Clé étrangère vers `social_themes` en `ON DELETE SET NULL` : supprimer un thème laisse les contenus intacts, sans thème.
- `social_themes` : nom non vide et unique (insensible à la casse), couleur hexadécimale `#rrggbb`. Aucune ligne créée par la migration. RLS active, policies sur `is_admin` ou `has_module_access(auth.uid(), 'supertilt_fr')`, `WITH CHECK` compris ; tout utilisateur du module gère les thèmes. Table ajoutée aux sauvegardes (règle [038]).
- Filtres : trois familles (thème, réseau, statut) en pastilles, toutes désélectionnées au départ. ET entre familles, OU dans une famille ; une famille sans pastille sélectionnée ne filtre pas. Ils s'appliquent à la grille et à « Non planifiés ».
- La barre des canaux de la story 1.2 devient la famille « Réseau » de cette barre : un seul filtre. Sélectionner des réseaux restreint aussi les déclinaisons visibles sur les cartes (badges, heure, statut, alertes).
- Le filtre de statut porte sur le statut affiché de la carte (`groupDisplayStatus` des déclinaisons visibles) : Brouillon, Programmé, Publié.
- Le filtrage est une fonction pure du service, testée (1.4-UNIT-001 et 002).
- Liseré gauche de la carte à la couleur du thème, neutre sans thème, dans la grille comme dans « Non planifiés ».

**Never:**
- Pas de vues enregistrées, pas de filtre campagne, auteur, période ni recherche (epic 3).
- Pas d'édition manuelle de `types.ts` (règle [079]).

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Résultat attendu | Erreur |
|---|---|---|---|
| Liste vide | module fraîchement migré | aucun thème, réglages vides avec invitation à créer | N/A |
| Nom en double | « IA » existe, on crée « ia » | refus, message clair | violation d'unicité traduite |
| Thème supprimé | thème attribué à 3 contenus | contenus intacts, sans thème, liseré neutre | N/A |
| Aucun filtre | aucune pastille | tous les contenus | N/A |
| Deux thèmes | pastilles A et B | contenus de A ou de B | N/A |
| Familles croisées | thème A + statut Programmé | contenus de A et programmés | N/A |
| Réseau | pastille LinkedIn | cartes réduites aux déclinaisons LinkedIn ; contenus sans LinkedIn masqués | N/A |
| Statut mixte | LI publié, IN programmé, filtre Publié + réseau LI | la carte s'affiche (statut affiché des visibles : Publié) | N/A |
| Sans thème | contenu sans thème, pastille de thème active | masqué | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261105120000_social_contents.sql` -- modèle de table, RLS, trigger `update_updated_at_column`, RPC `save_social_content_group(p_group_id, p_format, p_sync, p_posts)` (redéfinie en 1.3 dans `20261106100000_social_post_media.sql`).
- `supabase/tests/social-contents.test.ts` -- harnais PGlite (`actAs`, comptes avec et sans droit, Romain exclu des preuves d'accès), migrations jouées deux fois.
- `supabase/functions/scheduled-backup/index.ts:89` et `supabase/functions/backup-export/` -- listes `TABLES_TO_BACKUP` ; `scripts/check-backup-tables.sh`.
- `scripts/sql-tested-functions.txt` -- fonctions SQL testées (règle [058]).
- `src/services/socialContents.ts` -- types, `groupDisplayStatus`, `placeGroups(groups, visibleChannelIds, range, channelsById)`, `CalendarCard`, `buildGroupPosts`.
- `src/hooks/useSocialContents.ts` -- `SOCIAL_CONTENTS_KEY`, hooks de lecture et mutations.
- `src/components/social/ChannelFilterBar.tsx` -- barre réseau actuelle (sémantique « masquer »), à remplacer.
- `src/components/social/ContentCard.tsx`, `UndatedColumn.tsx`, `SocialCalendar.tsx`, `SocialComposerDialog.tsx`, `src/pages/SocialContentsPage.tsx` -- à étendre.
- `src/components/missions/MissionSettingsTab.tsx:31` -- palette de couleurs existante (`colorOptions`), modèle de pastilles de couleur.
- `src/hooks/useConfirm.tsx` -- confirmation (règle [021]) ; `src/components/ui/spinner` (règle [017]) ; `src/lib/toastError`.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20261106110000_social_themes.sql` -- table `social_themes`, `social_content_groups.theme_id`, RLS, RPC `save_social_content_group` avec `p_theme_id`. -- Socle.
- [x] `supabase/tests/social-contents.test.ts` -- liste vide après migration (1.4-SQL-002), thème supprimé (1.4-SQL-001), RLS des thèmes par opération (sans droit, avec droit hors Romain, admin, anon), unicité insensible à la casse, RPC avec thème. -- Règles [058], R-01.
- [x] Sauvegardes -- `social_themes` dans `scheduled-backup` et `backup-export`. -- Règle [038].
- [x] `src/services/socialContents.ts` -- type `SocialTheme`, CRUD des thèmes, `theme_id` dans les lectures et la sauvegarde ; `SocialFilters` et `filterCards` (fonction pure) ; erreur d'unicité traduite. -- Service.
- [x] `src/hooks/useSocialContents.ts` -- `useSocialThemes`, `useCreateSocialTheme`, `useUpdateSocialTheme`, `useDeleteSocialTheme`, invalidation des contenus à la suppression. -- Hooks.
- [x] `src/components/social/SocialSettingsDialog.tsx` -- réglages du module, section « Thèmes » : liste, création, renommage, couleur, suppression confirmée. -- 1.4-COMP-001.
- [x] `src/components/social/SocialFilterBar.tsx` -- remplace `ChannelFilterBar` : familles Thème (point à la couleur), Réseau, Statut. -- 1.4-COMP-002.
- [x] `SocialComposerDialog.tsx` -- champ « Thème » (« Sans thème » par défaut), sauvegardé avec le contenu. -- Composeur.
- [x] `ContentCard.tsx` -- liseré gauche à la couleur du thème. -- UX-DR5.
- [x] `SocialContentsPage.tsx` -- bouton « Réglages », état des filtres, filtrage appliqué à la grille et à « Non planifiés ». -- Page.
- [x] Tests : `socialContents.test.ts` (filtres, matrice), `SocialCalendar.test.tsx` ou test de page (liseré, pastilles), test du dialogue de réglages, test du composeur (thème envoyé). -- Couverture.

**Acceptance Criteria:**
- Given le module migré, when l'utilisateur ouvre les réglages, then la liste des thèmes est vide et il peut créer, renommer, recolorer et supprimer un thème.
- Given un thème attribué dans le composeur, when la carte s'affiche, then son liseré gauche prend la couleur du thème.
- Given des pastilles de thème, réseau et statut sélectionnées, when le calendrier s'affiche, then la grille et « Non planifiés » ne montrent que les contenus correspondants, et désélectionner toutes les pastilles d'une famille annule ce filtre.

## Implementation Notes

- Migration : `social_themes (id uuid pk, name text not null, color text not null check (color ~ '^#[0-9a-f]{6}$'), created_by uuid default auth.uid(), created_at, updated_at)`, index unique sur `lower(btrim(name))`, check `btrim(name) <> ''`. `ALTER TABLE social_content_groups ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES social_themes(id) ON DELETE SET NULL` + index. Policies select/insert/update/delete sur le modèle des groupes. Migration rejouable (règle [042]).
- RPC : les trois migrations de l'epic ne sont pas encore en production, aucun ancien front ne l'appelle. `DROP FUNCTION IF EXISTS public.save_social_content_group(uuid, text, boolean, jsonb)` puis recréation avec `p_theme_id uuid DEFAULT NULL` en dernier paramètre, corps de 1.3 conservé, `theme_id` écrit sur le groupe à l'insertion et à la mise à jour. Toujours SECURITY INVOKER. Si `p_theme_id` n'existe pas (thème supprimé entre-temps) : null, comme pour `media_id`.
- Palette : neuf couleurs reprises de `MissionSettingsTab` (`colorOptions`), copiées dans le dialogue de réglages ; couleur par défaut à la création : la première non utilisée.
- Filtres : `SocialFilters = { themeIds: Set<string>, channelIds: Set<string>, statuses: Set<SocialPublicationStatus> }`. La famille Réseau alimente `visibleChannelIds` de `placeGroups` (vide = tous les canaux) ; `filterCards(cards, filters)` applique ensuite thème (`group.theme_id`) et statut (`card.status`). Tri et placement inchangés.
- Barre : pastilles `aria-pressed`, aucune sélectionnée au départ, comme la maquette ; thème avec point de couleur. Pas de vue enregistrée.
- Réglages : bouton « Réglages » dans les actions de l'en-tête de page, dialogue avec une section « Thèmes » (la story 4.1 y ajoutera « Contexte de marque »). Renommage en ligne, enregistrement à la validation (Entrée ou perte du focus), erreur d'unicité en toast.
- Blancs : la contrainte `social_themes_name_not_blank` refuse un nom fait uniquement de blancs (`[[:space:]]` plus les blancs Unicode, espace insécable compris), et l'index unique compare `lower()` du nom débarrassé de ces mêmes blancs de bord, comme le `trim()` du service. Ce choix remplace le `btrim(name) <> ''` et le `lower(btrim(name))` d'origine, qui ignoraient tabulations et espaces insécables.
- RPC : le thème est relu `FOR KEY SHARE`, ce qui le verrouille jusqu'à la fin de la transaction. Une suppression concurrente attend, puis remet le contenu à null par `ON DELETE SET NULL`, au lieu d'une violation de clé étrangère.
- Filtrage : `applySocialFilters(groups, filters, channels, existingThemeIds, range, channelsById)` dans le service fait `placeGroups`, puis `filterCards` sur la grille et sur « Non planifiés », et retire les jours vidés. Une pastille encore sélectionnée dont le thème a été supprimé, ou dont le canal a disparu des canaux actifs, ne filtre plus, faute de pouvoir être désélectionnée. La page n'appelle que cette fonction.
- Réglages : Échap dans un champ de renommage annule la saisie sans fermer le dialogue (`onEscapeKeyDown` avec `preventDefault` sur ces champs). Fermer le dialogue avec un renommage en cours le valide, par la perte du focus. Renommer et recolorer passent par deux mutations distinctes, portées par le dialogue et non par les lignes, pour qu'une erreur de renommage ne soit jamais perdue.
- Composeur : tant que les thèmes chargent ou sont en erreur, le champ « Thème » est désactivé avec un libellé neutre (« Chargement des thèmes... », « Thèmes indisponibles »), jamais « Sans thème ». Un thème inconnu une fois les thèmes chargés s'affiche « Sans thème », mais son id est envoyé tel quel : la RPC le ramène à null.
- Production : jouer `20261106110000_social_themes.sql` après les trois migrations précédentes de l'epic.

## Spec Change Log

## Review Triage Log

- [medium] Test 1.4-SQL-002 vidé par le beforeEach, ne prouvait rien -- patché : comptage juste après la double migration.
- [medium] Câblage du filtre de statut dans la page non vérifié (grille et Non planifiés) -- patché : test.
- [medium] Pastille d'un thème supprimé restée active -- patché : `applySocialFilters` pure, test unitaire et de page.
- [low] Pastille d'un canal disparu restée active -- patché : intersection avec les canaux actifs.
- [low] Course suppression de thème / sauvegarde (23503) -- patché : `FOR KEY SHARE`.
- [low] Nom fait de blancs Unicode accepté en base -- patché : contrainte et index cohérents avec `trim()`.
- [low] Échap ferme tout le dialogue, renommage perdu à la fermeture, erreur de renommage écrasée par la recoloration -- patché.
- [low] Composeur affichant « Sans thème » pendant le chargement des thèmes -- patché : champ désactivé avec libellé d'attente.
- [low] Invalidations des hooks de thèmes non testées -- patché : tests.
- [low] Toasts d'erreur recoloration et suppression non testés -- patché : tests.
- [low] Appel RPC à 4 paramètres efface le thème -- non retenu : seul appelant le service, qui envoie toujours le thème ; à revoir si le MCP (epic 4) appelle la RPC.
- [false] Tables `social_*` absentes de la restauration (`backup-import`) -- antérieur à 1.4, hors règle [038] (export uniquement).

## Verification

**Commands:**
- `npm run typecheck` -- expected: aucune erreur
- `npm test` -- expected: tous les tests passent
- `bash scripts/check-rules.sh` -- expected: toutes les vérifications OK
