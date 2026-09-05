# Import audio e-learning : découpage multi-leçons

## Constat

Aujourd'hui, un fichier audio = une seule leçon cible. Si un enregistrement couvre trois sujets qui appartiennent à trois sections différentes, tout le contenu part dans une seule leçon (ou dans "Ressources"), et il faut redécouper à la main.

Second problème : la liste des leçons envoyée à l'IA est construite depuis le cache local. Si les leçons d'un module n'ont pas encore été ouvertes, elles sont absentes de la liste et l'IA ne peut pas les proposer.

## Ce qui change

1. L'IA découpe chaque audio en segments thématiques (1 à N). Chaque segment reçoit sa propre leçon cible, son texte reformulé et ses points clés.
2. L'écran de validation affiche les segments d'un audio l'un sous l'autre : titre du segment, leçon cible modifiable, texte modifiable, points clés modifiables. Possibilité de supprimer un segment ou de fusionner un audio en un seul bloc si le découpage ne convient pas.
3. À la confirmation, un bloc de texte est créé par segment dans sa leçon respective, dans l'ordre.
4. La liste complète des leçons du cours est chargée depuis la base (et non depuis le cache) avant l'analyse.

## Détails techniques

- `supabase/functions/lms-analyze-audio/index.ts` : prompt et schéma JSON passent de `assignments[{audio_id, lesson_id, reformulated_text, key_points}]` à `assignments[{audio_id, segments:[{title, lesson_id, reformulated_text, key_points}]}]`. Instruction ajoutée : découper uniquement quand le contenu change réellement de sujet ; un seul segment sinon. Le prompt surchargeable via `app_settings.lms_audio_reformulation_prompt` est mis à jour dans le même format ; fallback de lecture si l'IA renvoie l'ancien format (un segment unique).
- `src/services/lmsMediaImport.ts` : types `AudioSegment` / `AudioAssignment` mis à jour + normalisation de l'ancien format.
- `src/components/lms/builder/BulkAudioUploadDialog.tsx` : `AudioItem.segments: AudioSegment[]` remplace `lessonId/reformulatedText/keyPoints`, rendu des segments, création d'un bloc par segment dans `handleConfirm`, liste des leçons via `useCourseLessons(courseId)`.
- Tests vitest sur la normalisation des réponses IA (nouveau format, ancien format, segments vides).
