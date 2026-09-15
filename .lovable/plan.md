# Restructuration pédagogique des leçons LMS

Deux fonctions distinctes dans l'éditeur de cours : une relecture rapide bloc par bloc, et une refonte complète d'une leçon proposée puis validée avant écriture.

## 1. Relecture d'un bloc (correction ponctuelle)

- Sur chaque bloc de contenu textuel (texte, encadré, points clés, exercice, code, légende d'image), une action « Relire » dans la barre du bloc.
- L'IA corrige fautes, formulation et liens morts sans changer la nature du bloc.
- Affichage de la version proposée à côté de l'actuelle, avec « Appliquer » ou « Annuler ». Rien n'est enregistré sans clic.
- Les champs autres que le texte (URL de média, options d'affichage) ne sont jamais modifiés.

## 2. Refonte d'une leçon

- Bouton « Restructurer la leçon » dans la barre du haut de l'éditeur, agissant sur la leçon ouverte.
- L'IA analyse tous les blocs de contenu et propose un plan complet : liste ordonnée des blocs finaux, avec pour chacun son type, son contenu et une justification pédagogique.
- Heuristique de conversion : synthèse → points clés, avertissement/prérequis → encadré, consigne + mise en pratique → exercice, prompt/commande → bloc de code, approfondissement optionnel → accordéon replié, fil narratif → reste en texte.
- Écran de validation : chaque bloc proposé est modifiable (titre, texte), décochable, et affiche sa justification. Bouton « Appliquer la restructuration ».
- Application en une seule opération : les anciens blocs de contenu sont remplacés d'un coup, jamais dans un état intermédiaire.
- Si la leçon a changé entre la proposition et la validation, l'application est refusée avec un message invitant à relancer l'analyse.

## 3. Historique des versions

- Un instantané daté de la leçon est enregistré avant chaque restructuration.
- Panneau « Versions » listant les instantanés (date, auteur, nombre de blocs), avec aperçu et « Restaurer cette version ».
- La restauration crée elle-même un instantané, donc rien n'est jamais perdu.

## 4. Hors périmètre (v1)

Quiz, devoirs, blocs de mise en page (section, ligne, conteneur, séparateur), blocs HTML libre, remplacement de médias. Aucun accès en écriture pour un compte apprenant.

## Détails techniques

- Migration : table `lms_lesson_snapshots` (`lesson_id` FK, `blocks jsonb`, `created_by`, `created_at`, `label`), GRANT `authenticated`/`service_role`, RLS alignée sur les politiques d'édition existantes de `lms_lessons` (staff/module `lms`).
- Edge function `lms-restructure-lesson` : prend les blocs de la leçon, appelle Anthropic (`CLAUDE_ADVANCED`) avec un prompt stocké dans `app_settings` (clé `lms_lesson_restructure_prompt`, fallback local, carte de réglage ajoutée à `TranscriptPromptsSettings.tsx`), retourne `{ blocks: [{ type, content, rationale }] }` ; types restreints à une whitelist (`text`, `callout`, `key_points`, `exercise`, `code`, `accordion`, `bullet_list`, `checklist`), parsing JSON via `_shared/ai-json.ts`.
- Edge function `lms-proofread-block` : entrée `{ type, content }`, sortie même forme, seuls les champs HTML/texte réécrits.
- Frontend : `src/services/lmsLessonRestructure.ts` (appels + normalisation + validation de forme par type via `defaultBlockContent`), `LessonRestructureDialog.tsx` (analyse → validation → application), `LessonVersionsDialog.tsx`, action de relecture dans `BuilderBlockWrapper.tsx`, boutons dans `BuilderTopbar.tsx`.
- Application transactionnelle : RPC `apply_lesson_restructure(lesson_id, expected_fingerprint, blocks jsonb)` — vérifie l'empreinte (ids + `updated_at` des blocs existants), écrit le snapshot, supprime les blocs de contenu de premier niveau, insère les nouveaux avec positions denses ; refus par `RAISE EXCEPTION` en cas de désynchronisation.
- Sécurité : tout HTML passe par `sanitizeLmsHtml` avant enregistrement, côté service et dans la RPC via la whitelist de types.
- Entrées `[functions.lms-restructure-lesson]` et `[functions.lms-proofread-block]` (`verify_jwt = true`) dans `supabase/config.toml`.
- Tests unitaires sur la normalisation/validation des blocs proposés.
