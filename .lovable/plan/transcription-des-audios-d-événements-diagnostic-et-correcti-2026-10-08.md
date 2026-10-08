# Transcription des audios d'événements : diagnostic et correctifs

## Diagnostic (vérifié en base et dans le code)

Fichiers de « Agile Game Alpes » importés le 07/10 vers 16h14 UTC :

| Fichier | Taille | Audio facturé | Résultat |
|---|---|---|---|
| Nouvel enregistrement 155 | 56,8 Mo | aucun résultat enregistré | transcript vide |
| Mairie - Brégnier Cordon 2 | 0,76 Mo | 234 s (~4 min), 16h15 | 21 caractères |
| Nouvel enregistrement 156 | 16,4 Mo | 1 957 s (~33 min), 20h14 | correct |

Cause principale : pour les événements, la transcription tourne **entièrement dans le navigateur**. Après l'import, l'écran envoie l'audio au service de transcription, puis vérifie toutes les 5 s pendant 60 min au maximum s'il est terminé. Le texte n'est enregistré que si l'onglet reste ouvert jusqu'au bout. Aucune tâche côté serveur, aucun identifiant de tâche conservé, aucun statut ni erreur stockés sur le média (la table n'a qu'un champ `transcript`).

- **155** : pas de résultat enregistré. Le plus probable : l'onglet a été fermé ou a changé de page, ou le navigateur a mis la page en veille, avant la fin d'un fichier d'environ 1 h (56 Mo). Le résultat est peut-être prêt chez le fournisseur, mais l'identifiant de la tâche n'a été gardé nulle part. Le format m4a et la taille ne posent pas problème (156 en m4a est passé). Cause probable, pas prouvée : la fonction n'a pas gardé de journaux de cette période.
- **Mairie 2** : le fichier est petit (0,76 Mo, environ 4 min) et a été transcrit entièrement en 1 min. Ce n'est pas une coupure : il n'y avait presque pas de voix audible (micro éloigné ou fichier coupé à l'enregistrement). Il faut l'écouter pour confirmer. Relancer la transcription donnera probablement le même texte.
- **156** : l'essai automatique n'a pas abouti non plus (pas de résultat à 16h). Le texte enregistré à 20h14 vient sans doute d'un clic manuel sur « Transcrire », d'où le délai.
- **Ce que l'interface montre** : une erreur ne s'affiche qu'en notification temporaire, et seulement si l'onglet est encore ouvert. Rien n'est conservé. Le bouton « Transcrire » existe déjà quand le transcript est vide, mais pas quand le texte est presque vide.

## Plan de correction

1. **Transcription côté serveur, comme pour les missions.** Ajouter à chaque média audio un statut (en attente / en cours / terminé / échec), l'identifiant de tâche, le message d'erreur et la date de lancement. L'import lance la tâche et le serveur la suit avec une tâche planifiée toutes les minutes : fermer l'onglet ne perd plus rien. Le circuit déjà utilisé pour les documents de mission sera réutilisé, sans en créer un second.
2. **Erreurs visibles** sur la vignette du média : « Transcription en cours », « Échec : message », et « Audio quasi muet » pour un texte de moins de 200 caractères sur plus d'une minute d'audio.
3. **Relancer depuis l'interface** : un bouton « Relancer la transcription » en cas d'échec ou de texte très court, avec confirmation s'il y a déjà un texte.
4. **Fichiers longs** : le fournisseur accepte des fichiers de plusieurs heures. Le découpage est donc inutile une fois le suivi passé côté serveur. La limite de 60 min dans le navigateur disparaît.
5. **Rattrapage** : relancer 155 et Mairie 2 avec le nouveau circuit, puis vérifier la longueur du texte et la note de synthèse de l'événement. Ne pas toucher à 156.

## Détails techniques

- Migration `media` : `transcription_status`, `assemblyai_transcript_id`, `transcription_error`, `transcription_started_at`. Les audios déjà transcrits passent à `completed`.
- Étendre `process-mission-audio-transcriptions`, ou ajouter un mode `media`, pour suivre les lignes `media` en `processing` et écrire `transcript` ainsi que `events.summary_notes`, comme le fait aujourd'hui `EntityMediaManager.handleTranscribe`.
- `EntityMediaManager.tsx` : remplacer `transcribeAudio()` (suivi dans le navigateur) par un appel qui lance la tâche, puis afficher le statut lu en base.
- Chaque essai continue d'être enregistré dans le suivi des coûts de transcription.
