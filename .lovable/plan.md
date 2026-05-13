## Ajout : titre IA automatique pour les transcripts

Quand AssemblyAI renvoie le transcript (status `ready`), on génère automatiquement un titre court et explicite via Lovable AI, indépendant du nom du fichier Google Drive.

### Changements

**1. Base de données**
- Ajouter colonne `ai_title text` à la table `transcripts` (nullable).
- Le `title` existant (nom du fichier Drive) reste inchangé pour traçabilité.

**2. Edge function `assemblyai-webhook`**
- Après réception du transcript final et insertion en DB, déclencher la génération de titre :
  - Modèle : `google/gemini-2.5-flash` (rapide + peu coûteux, suffisant pour un titre).
  - Prompt system : "Tu génères un titre court (6-10 mots max) en français qui résume le sujet principal de la transcription. Pas de guillemets, pas de ponctuation finale, ton neutre et descriptif."
  - Input : les 3000 premiers caractères du transcript (suffisant pour cerner le sujet).
  - Update `transcripts.ai_title` avec le résultat.
- Si la génération échoue (rate limit, etc.) : log l'erreur, ne bloque pas le flow — `ai_title` reste null et pourra être régénéré.

**3. UI Transcripts**
- Dans la liste et le sheet de détail : afficher `ai_title` en titre principal s'il existe, sinon fallback sur `title` (nom fichier).
- Afficher le nom de fichier Drive en sous-titre discret (`text-muted-foreground text-xs`).
- Bouton "Régénérer le titre" dans le sheet (à côté du titre, icône refresh) → réutilise la même logique via un petit endpoint ou en appelant directement Lovable AI depuis le client via une nouvelle edge function `regenerate-transcript-title`.

**4. Paramètres (cohérent avec le reste du plan)**
- Ajouter le prompt de titre dans la section "Prompts IA Transcripts" (system prompt éditable), au même endroit que les prompts article et LinkedIn.

### Intégration avec le plan en cours

Cette addition s'intègre proprement à la migration `transcript_ai_prompts` déjà prévue : on ajoute une 3e ligne `kind = 'title'` (en plus de `article` et `linkedin`).

Prêt à lancer l'ensemble (prompts paramétrables + 3 onglets + génération de titre auto) ?