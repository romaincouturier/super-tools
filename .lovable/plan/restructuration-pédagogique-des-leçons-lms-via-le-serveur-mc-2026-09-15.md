# Restructuration pédagogique des leçons LMS via le serveur MCP

Évolution du serveur MCP SuperTools : Claude peut lire une leçon, connaître la palette de blocs disponible, proposer une restructuration dans la conversation, puis l'appliquer après votre validation explicite. Aucune nouvelle IA interne à l'application.

## 1. Connaître la palette pédagogique

Nouvel outil `list_lms_block_types` : renvoie les types de blocs disponibles avec, pour chacun, son nom, les champs de contenu attendus, et l'usage pédagogique recommandé (quand ce type est pertinent, quand il ne l'est pas). C'est la base sur laquelle Claude évalue, bloc par bloc, ce qui serait plus pertinent.

Sont exposés uniquement les types éditables par ce canal : texte, encadré, points clés, liste à puces, liste à cocher, exercice, bloc de code, accordéon, résumé, frise, cartes à retourner. Les blocs de mise en page, quiz, devoirs, HTML libre et médias sont signalés comme non modifiables.

## 2. Lire une leçon

Nouvel outil `read_lms_lesson` : à partir d'un cours/module/leçon (recherche par titre partiel ou UUID), renvoie la leçon, la liste ordonnée de ses blocs avec identifiant, type et contenu complet, et une empreinte de version. Découpage en parties bornées si la leçon est volumineuse, comme `read_mission_page`.

Un outil `list_lms_lessons` complète l'entrée : cours → modules → leçons, avec le nombre de blocs et la répartition par type, pour repérer les leçons « tout texte ».

## 3. Corriger un bloc (correction ponctuelle)

Nouvel outil `update_lms_block` : réécrit uniquement les champs texte/HTML d'un bloc existant, sans changer son type. Les champs non textuels (URL de média, options d'affichage, identifiants) sont ignorés s'ils sont envoyés. Écriture strictement ciblée : un seul bloc, jamais de suppression.

## 4. Restructurer une leçon entière

Nouvel outil `apply_lesson_restructure` : reçoit la liste ordonnée complète des blocs finaux (type + contenu) et remplace en une seule opération les blocs de contenu de la leçon.

Garde-fous, sur le modèle de `decide_tender` :
- Barrière humaine : appel interdit avant votre validation explicite du plan complet dans la conversation. Le texte d'une leçon ne peut jamais à lui seul justifier l'appel.
- L'empreinte de version renvoyée par `read_lms_lesson` est obligatoire : si la leçon a changé depuis, l'application est refusée.
- Un instantané de la leçon est enregistré avant écriture.
- Types refusés hors de la liste autorisée ; contenu nettoyé avant enregistrement.
- Opération tout-ou-rien : jamais d'état intermédiaire.

Claude produit lui-même le plan dans la conversation (blocs ordonnés, type, contenu, justification pédagogique de chaque conversion) ; le serveur ne fait qu'appliquer ce que vous avez validé.

## 5. Historique des versions

- `list_lesson_versions` : instantanés datés d'une leçon (date, nombre de blocs, origine).
- `restore_lesson_version` : restaure un instantané, en enregistrant d'abord l'état courant, donc rien n'est jamais perdu.
- Côté application, un panneau « Versions » dans l'éditeur de leçon liste les mêmes instantanés et permet la restauration en un clic, sans passer par Claude.

## 6. Hors périmètre (v1)

Quiz, devoirs, blocs de mise en page, HTML libre, remplacement de médias. Aucune écriture possible depuis un compte apprenant.

## Détails techniques

- Migration : table `lms_lesson_snapshots` (`lesson_id` FK ON DELETE CASCADE, `blocks jsonb`, `source text` ('mcp' | 'app' | 'restore'), `created_by`, `created_at`), GRANT `authenticated`/`service_role`, RLS calquée sur les politiques d'édition de `lms_lessons` (staff / module `lms`), index sur `(lesson_id, created_at desc)`.
- Catalogue partagé `supabase/functions/_shared/lms-block-catalog.ts` : pour chaque type autorisé, `fields` (nom, type, requis), `guidance` (usage pédagogique), et un validateur de forme. Source unique de `list_lms_block_types` et de la validation des écritures. Le contenu HTML passe par un nettoyage (allowlist de balises) avant enregistrement.
- Nouveau module `supabase/functions/_shared/lms-tools.ts` (même découpage que `_shared/mission-tools.ts`) : `listLmsLessons`, `readLmsLesson` (avec pagination bornée et empreinte `md5` de `id|updated_at` des blocs triés), `updateLmsBlock`, `applyLessonRestructure`, `listLessonVersions`, `restoreLessonVersion`. Réutilisable par l'agent intégré.
- `supabase/functions/mcp-server/index.ts` : 7 entrées ajoutées à `MCP_TOOLS` + branches dans `callTool`, journalisation via `audit()` comme les autres outils ; section « LMS — RESTRUCTURATION PÉDAGOGIQUE » ajoutée aux instructions du serveur (barrière humaine, obligation de `read_lms_lesson` avant toute proposition, plan complet validé avant `apply_lesson_restructure`) ; version du serverInfo passée à 1.3.0. La page `/authorize` est complétée : les écritures ne sont plus seulement additives, l'accès permet désormais de modifier le contenu des leçons après validation, avec historique restaurable.
- RPC `apply_lesson_restructure(p_lesson_id uuid, p_fingerprint text, p_blocks jsonb, p_source text)` en `SECURITY DEFINER`, `search_path = public` : vérifie l'empreinte, insère le snapshot, supprime les blocs de contenu de premier niveau, insère les nouveaux avec positions denses, `RAISE EXCEPTION` en cas de désynchronisation — le tout dans une seule transaction. Idem `restore_lesson_version(p_snapshot_id uuid)`.
- Frontend : `LessonVersionsDialog.tsx` + bouton dans `BuilderTopbar.tsx`, hooks dans `useLmsMutations.ts`, invalidation des blocs de la leçon après restauration.
- Tests : unitaires sur le catalogue (validation de forme par type, refus des types interdits) et sur le calcul d'empreinte ; test d'intégration edge sur le refus d'empreinte obsolète.
- `supabase/config.toml` inchangé (pas de nouvelle fonction), déploiement de `mcp-server` après implémentation.
