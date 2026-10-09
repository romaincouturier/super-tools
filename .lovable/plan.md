# Outils MCP LMS : création de quiz/devoirs et métadonnées de leçon

Les outils LMS existants vivent dans `supabase/functions/_shared/lms-tools.ts` (logique, validation, accès staff via `requireStaffOrService()`), déclarés dans `supabase/functions/mcp-server/index.ts` (`MCP_TOOLS`, branches `callTool`, journal `audit()`, consignes serveur). Les nouveaux outils suivent exactement ce découpage.

## 1. `create_lms_quiz`

Entrée :
- `course_id` (UUID, requis : `lms_quizzes.course_id` est obligatoire), `title` (requis), `description?`
- réglages facultatifs : `passing_score`, `max_attempts`, `time_limit_minutes`, `shuffle_questions`, `show_correct_answers`
- `questions` (1 à 50) : `{ question, type: "single_choice" | "multiple_choice", options: [{ text, is_correct, feedback? }], explanation?, points? }`

Validation (avant toute écriture) : 2 à 10 options, texte non vide ; `single_choice` = exactement une bonne réponse, `multiple_choice` = au moins une ; textes nettoyés comme les autres outils ; cours existant.

Écriture : le quiz et ses questions sont créés ensemble, au format déjà lu par le lecteur apprenant (`options: [{label, is_correct, feedback}]`, `multi_select` selon le type, `position` dense). Tout ou rien : si une question échoue, rien n'est créé.

Retour : `quiz_id`, nombre de questions, et le bloc prêt à l'emploi `{ type: "quiz", content: { quiz_id } }` à placer via `apply_lesson_restructure` ou `create_lms_lesson`.

Écriture additive (aucun quiz existant modifié) : pas de barrière de validation, comme `create_lms_lesson`.

## 2. `create_lms_assignment`

Même logique, pertinente car le bloc `assignment` référence aussi un `assignment_id`. Entrée : `course_id`, `title`, `instructions_html?` (nettoyé), `max_score?`, `due_after_days?`, `allow_late_submission?`, `allowed_file_types?`, `max_file_size_mb?`. Retour : `assignment_id` + bloc `{ type: "assignment", content: { assignment_id } }`.

## 3. `read_lms_quiz` (complément utile)

Lit un quiz et ses questions, pour que l'assistant puisse vérifier ce qu'il référence avant une restructuration. Lecture seule.

Hors périmètre v1 : modifier ou supprimer un quiz existant (risque sur les tentatives déjà passées par les apprenants). Possible ensuite via un `update_lms_quiz` avec validation humaine.

## 4. `update_lms_lesson`

Entrée : `lesson_id`, `patch` avec uniquement `title`, `estimated_minutes` (entier 0 à 600 ou null), `position`, et éventuellement `is_mandatory`. Tout autre champ est refusé avec un message listant les champs autorisés (pas d'ignorance silencieuse, pour que l'assistant sache ce qui n'a pas été appliqué).

- Ne touche jamais aux blocs, donc l'empreinte de la leçon reste inchangée.
- `position` : réordonne dans le même module en décalant les voisines (même logique que l'insertion de `create_lms_lesson`), positions denses conservées. Le changement de module reste hors périmètre.
- Retour : la leçon mise à jour (métadonnées) avec valeurs avant/après pour chaque champ modifié.
- Correction ciblée et réversible : pas de barrière humaine obligatoire, mais la consigne serveur demande d'annoncer le changement.

## Technique

- `lms-tools.ts` : `createLmsQuiz`, `createLmsAssignment`, `readLmsQuiz`, `updateLmsLesson`, avec validation explicite et `throw new Error(...)` lisible, convertie en `isError` par `callTool` comme aujourd'hui.
- Atomicité du quiz : une fonction base `create_lms_quiz_with_questions(p_course_id, p_quiz jsonb, p_questions jsonb)` en `SECURITY DEFINER`, `search_path = public`, contrôle staff, exécution révoquée pour `anon`/`PUBLIC`. Réordonnancement de leçon : même approche (`reorder_lms_lesson`) pour éviter les états intermédiaires.
- `mcp-server/index.ts` : 4 entrées `MCP_TOOLS` (schémas JSON détaillés), branches `callTool`, `audit()`, consignes complétées (« créer le quiz puis référencer son quiz_id »), version serverInfo incrémentée.
- Catalogue `lms-block-catalog.ts` : guidance des blocs `quiz`/`assignment` mise à jour pour pointer vers les nouveaux outils ; validation du bloc vérifiant que l'id existe dans le même cours.
- Tests Deno : validation des questions (bonne réponse unique/multiple, options), refus des champs non autorisés du patch, réordonnancement. `bash scripts/check-rules.sh` avant clôture.
- Déploiement de `mcp-server` après implémentation ; aucune donnée existante modifiée.
