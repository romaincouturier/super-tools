# Construire des leçons e-learning à partir d'un transcript

Dans l'éditeur d'un cours en ligne, à côté des boutons « images » et « audios », un nouveau bouton « transcript » permet de partir d'un texte de réunion/atelier et d'en tirer plusieurs leçons prêtes à relire.

## Parcours utilisateur

1. **Ouvrir** : bouton « Importer un transcript » dans la barre du haut de l'éditeur de cours.
2. **Choisir la source** (deux onglets) :
   - *Bibliothèque* : recherche dans les transcripts existants (titre, tags, source), aperçu de la durée et du résumé, sélection d'un ou plusieurs transcripts.
   - *Coller un texte* : zone de saisie libre (titre optionnel + texte), pour un transcript qui n'est pas dans la bibliothèque.
3. **Choisir la destination** : le module du cours dans lequel les nouvelles leçons seront créées (par défaut le dernier module).
4. **Analyse IA** avec barre de progression : découpage du texte en leçons cohérentes, chaque leçon avec un titre, une introduction, des sections de texte, des points clés, et un encadré « À retenir ».
5. **Écran de validation** :
   - liste des leçons proposées, dépliables ;
   - titre modifiable, texte de chaque bloc modifiable ;
   - possibilité de décocher une leçon ou un bloc ;
   - possibilité d'affecter une leçon proposée à une leçon existante (ajout des blocs à la fin) plutôt que d'en créer une nouvelle ;
   - bouton « Relancer l'analyse » si le découpage ne convient pas.
6. **Confirmer** : les leçons sont créées (ou complétées), avec un message indiquant le nombre de leçons et de blocs créés. Un lien direct vers la première leçon créée.

## Traçabilité

Chaque leçon créée garde le transcript d'origine. Dans l'éditeur, un badge « Issu du transcript : *titre* » s'affiche en tête de leçon, cliquable vers le transcript. Depuis ce badge, une action « Régénérer depuis le transcript » relance l'analyse pour cette seule leçon (les blocs proposés sont ajoutés, jamais écrasés sans validation).

## Règles retenues

- Les transcripts vides ou en erreur ne sont pas proposés dans la bibliothèque.
- Un texte trop long est traité par tronçons, sans jamais dépasser les limites du modèle.
- Le contenu généré est du texte structuré (titres, paragraphes, listes) ; aucun quiz n'est généré à ce stade.
- Rien n'est écrit dans le cours avant la confirmation explicite.
- Les échecs d'analyse affichent un message clair, copiable, avec bouton de relance (mêmes conventions que l'import audio).

## Détails techniques

**Base de données (migration)**
- `lms_lessons` : ajout de `source_transcript_id uuid NULL REFERENCES public.transcripts(id) ON DELETE SET NULL` + index.
- `lms_lesson_blocks` : ajout de `source_transcript_id uuid NULL` (même référence) pour les blocs ajoutés à une leçon existante.
- Aucune nouvelle table ; politiques RLS existantes de `lms_lessons` / `lms_lesson_blocks` inchangées (colonnes non sensibles).

**Edge function `lms-analyze-transcript`**
- Entrée : `{ transcripts: [{ id?, title, text }], lessons: [{ id, title, module_title }] }`.
- Réutilise le pattern de `lms-analyze-audio` : `callAnthropic` via `CLAUDE_ADVANCED`, parsing par `_shared/ai-json.ts`, `logAnthropicUsage`, découpage en tronçons pour les textes longs.
- Sortie : `{ proposals: [{ transcript_id, lessons: [{ title, summary_html, sections: [{ heading, html }], key_points: string[], target_lesson_id: string|null }] }] }`.
- Ajout dans `supabase/config.toml`.
- Prompt éditable côté réglages : nouvelle entrée `kind = 'lms_lesson_from_transcript'` dans `transcript_ai_prompts`, exposée par `TranscriptPromptsSettings.tsx`.

**Frontend**
- `src/services/lmsTranscriptImport.ts` : appel de la fonction + normalisation défensive des propositions (même approche que `normalizeAudioAssignments`), tests unitaires.
- `src/components/lms/builder/TranscriptImportDialog.tsx` : dialogue à étapes (source → destination → analyse → validation → création), création des blocs via `createLessonBlock` et des leçons via `useCreateLesson`.
- `BuilderTopbar.tsx` : nouveau bouton (icône `FileText`) ouvrant le dialogue.
- `src/hooks/useTranscripts.ts` : réutilisation de la liste paginée existante pour le sélecteur (colonnes légères, `raw_text` chargé seulement pour les transcripts retenus).
- Badge de provenance dans `BuilderCanvas.tsx` (leçon) à partir de `source_transcript_id`.

**Vérifications**
- `tsgo` (typecheck), `bash scripts/check-rules.sh`, tests unitaires du normaliseur, test manuel : import d'un transcript réel de la bibliothèque dans un cours de test, contrôle du rendu côté apprenant.
