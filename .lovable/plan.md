# Import audio LMS : conservation, traçabilité et statut des transcriptions

## Constat (vérifié en base)

- Cours « Gagner en efficacité » : 17 fichiers distincts, 37 lignes `media` (jusqu'à 3 copies du même fichier), aucune transcription conservée.
- 143, 148 et 152 (9 octobre) : une seule copie chacun, jamais transcrits.
- `media` possède déjà `transcript`, `transcription_status`, `transcription_audio_seconds`, `transcription_error`. La fenêtre d'import n'écrit que `transcript`, sans attendre le résultat (et uniquement depuis la dernière modification).
- `lms_lesson_blocks.source_transcript_id` existe, sans contrainte, et est utilisé par l'import de transcripts de la page Transcripts.

## Choix : stocker sur `media`

Option retenue : la transcription vit sur la ligne `media` de l'audio. C'est là que le fichier, sa durée et son statut sont déjà décrits ; créer une ligne `transcripts` mélangerait les audios de cours avec les réunions/Drive/Fireflies (alertes, affectations, récap quotidien).

## Ce qui change

1. **Conservation systématique** : à la fin de chaque transcription, enregistrement attendu (pas « en tâche de fond ») de `transcript`, `transcription_status` (`pending` → `transcribed` / `error`), `transcription_audio_seconds` (durée renvoyée par le service de transcription), `transcription_error`.
2. **Traçabilité** : nouvelle colonne `lms_lesson_blocks.source_media_id` (référence vers `media`) renseignée sur chaque bloc créé depuis un audio. `source_transcript_id` reste réservé aux transcripts de la page Transcripts. Après création des blocs, le statut du média passe à `processed`.
3. **Statut par fichier** : dans le builder, un onglet « Audios du cours » liste chaque audio avec badge (En attente, Transcrit, Traité en blocs, Erreur), durée, date, nombre de blocs produits et leçons concernées, bouton « Télécharger le transcript ».
4. **Anti-doublon** : à l'upload, empreinte du fichier (nom + taille + SHA-256 calculé dans le navigateur, stockée dans une colonne `content_hash`). Si le même fichier existe déjà dans le cours, il est réutilisé (pas de nouvel upload) avec son transcript existant ; l'utilisateur voit « Déjà importé le … » et choisit de réutiliser ou ignorer. Les copies existantes ne sont pas supprimées ; elles sont regroupées à l'affichage.
5. **MCP (lecture seule)** : `list_lms_course_audios(course_id)` (fichiers, statuts, durées, blocs liés) et `read_lms_audio_transcript(media_id)` (texte intégral, pagination si long). Accès réservé au personnel ayant le module LMS.

## Rattrapage des fichiers existants

- Bouton « Transcrire » sur chaque audio sans transcription dans l'onglet « Audios du cours », plus « Transcrire tous les manquants ». Transcription seule : aucun bloc créé ni modifié.
- Pour les doublons, une seule copie par fichier est transcrite et le texte recopié sur les autres.
- Je lancerai ce rattrapage sur le cours « Gagner en efficacité » (17 fichiers dont 143, 148, 152) après mise en ligne, puis je vérifierai les 17 statuts « Transcrit ».
- Liaison rétroactive des blocs déjà générés à leur audio : non faite (rien de fiable ne relie aujourd'hui un bloc à un fichier). Les fichiers 143/148/152 apparaîtront donc « Transcrit » mais pas « Traité en blocs », ce qui correspond à la réalité ; les autres aussi, faute de lien.

## Détails techniques

- Migration : `media.content_hash text`, index `(source_type, content_hash)`; `lms_lesson_blocks.source_media_id uuid` nullable, `ON DELETE SET NULL`.
- `transcribe-audio-long` mode `poll` : renvoyer `audio_duration` d'AssemblyAI.
- `src/services/lmsMediaImport.ts` : `transcribeAudio` retourne `{ text, seconds }` ; helper `saveMediaTranscript(mediaId, …)`.
- `BulkAudioUploadDialog.tsx` : hash + recherche doublon avant upload, statuts persistés, `source_media_id` à la création des blocs, passage `processed`.
- Nouveau composant `CourseAudiosPanel` (builder) avec hook de lecture `media` filtré sur les leçons du cours + nombre de blocs via `source_media_id`.
- Outils MCP dans le serveur existant (`supabase/functions` MCP), client utilisateur, sans clé privilégiée.
- Tests vitest : détection de doublon, normalisation durée/statut.
