## Objectif

Étendre le module **Transcripts** : depuis n'importe quel transcript `ready`, générer (1) une proposition d'article de blog et (2) une proposition de post LinkedIn via **Claude Sonnet 4.6**, avec tagging automatique sur les domaines Supertilt, puis pouvoir envoyer le résultat vers une **newsletter** existante.

Tous les prompts (system + user) et la liste des tags Supertilt sont **paramétrables** depuis Paramètres → Prompts IA, sans redéploiement.

---

## 1. Stockage des prompts & tags (paramétrable)

Nouvelle table `transcript_ai_prompts` :


| Colonne                | Type        | Notes                                                   |
| ---------------------- | ----------- | ------------------------------------------------------- |
| `id`                   | uuid PK     | &nbsp;                                                  |
| `kind`                 | text        | `blog_article` | `linkedin_post`                        |
| `system_prompt`        | text        | éditable                                                |
| `user_prompt_template` | text        | supporte `{{transcript}}`, `{{title}}`, `{{tags_list}}` |
| `model`                | text        | défaut `claude-sonnet-4-6`                              |
| `updated_at`           | timestamptz | &nbsp;                                                  |


RLS : lecture/écriture admin uniquement (via `is_admin()`).

Tags Supertilt : stockés dans `app_settings` sous la clé `supertilt_content_tags` (JSON array). Valeurs initiales : `["organisation du travail", "intelligence collective", "intelligence artificielle", "facilitation graphique"]`.

Nouvelle table `transcript_generations` (pour persister les sorties) :


| Colonne         | Type                                    |
| --------------- | --------------------------------------- |
| `id`            | uuid PK                                 |
| `transcript_id` | uuid FK → transcripts                   |
| `kind`          | text (`blog_article` / `linkedin_post`) |
| `content`       | text                                    |
| `tags`          | text[]                                  |
| `model`         | text                                    |
| `created_at`    | timestamptz                             |
| `created_by`    | uuid                                    |


Permet de garder l'historique et d'éviter de régénérer à chaque ouverture.

---

## 2. UI Paramètres → "Prompts IA Transcripts"

Nouvelle section dans `Parametres.tsx` (admin only) avec :

- 2 cartes éditables (Article / LinkedIn) : `system_prompt` + `user_prompt_template` + sélecteur de modèle (Sonnet 4.6 par défaut, Haiku 4.5 secondaire)
- Liste éditable des **tags Supertilt** (chips ajoutables/supprimables)
- Auto-save debounced (pattern `useAutoSaveForm` du projet)
- Aperçu des variables disponibles (`{{transcript}}`, `{{title}}`, `{{tags_list}}`)

---

## 3. Edge function `generate-transcript-content`

Nouvelle edge function (JWT vérifié, admin requis) :

**Input** : `{ transcript_id, kind: "blog_article" | "linkedin_post" }`

**Logique** :

1. Charge le transcript (`raw_text`, `title`)
2. Charge le prompt correspondant depuis `transcript_ai_prompts`
3. Charge la liste des tags depuis `app_settings.supertilt_content_tags`
4. Substitue les variables dans le user_prompt
5. Appelle l'API Anthropic Claude Sonnet 4.6 (utilise `ANTHROPIC_API_KEY` déjà présent — utilisé par AI Arena) en demandant via **tool calling** une sortie structurée :
  ```json
   { "content": "…markdown…", "tags": ["organisation du travail", …], "title_suggestion": "…" }
  ```
   Tags contraints à la liste Supertilt (enum dans le schema du tool).
6. Insert dans `transcript_generations` et retourne le résultat.

Streaming non requis (réponse one-shot, suffisamment rapide).

---

## 4. UI fenêtre Transcript (Sheet enrichi)

`TranscriptDetail` passe en **tabs** :

```
[ Transcript ]  [ Article blog ]  [ Post LinkedIn ]
```

Onglet **Article blog** :

- Si pas encore généré → bouton "Générer une proposition d'article" (loading state)
- Si généré → éditeur (Tiptap, déjà utilisé) avec contenu, chips de tags, bouton "Régénérer"
- Bouton **"Envoyer vers une newsletter"** → popover avec `Select` des newsletters en `draft` (réutilise pattern de `useContentCardData`). Confirme → crée une `content_card` puis l'attache via `newsletter_cards`.

Onglet **Post LinkedIn** :

- Identique mais pas de bouton newsletter (juste copier dans le presse-papier + tags)

Les générations existantes sont rechargées depuis `transcript_generations` à l'ouverture.

---

## 5. Tags & domaines Supertilt

- Claude reçoit la liste depuis `app_settings` et doit choisir **1 à 3 tags** parmi celle-ci (enum strict dans le tool schema → pas de hallucination)
- Les tags choisis sont stockés sur `transcript_generations.tags` et affichés en chips
- Quand on bascule vers une newsletter, les tags sont propagés sur la `content_card`

---

## 6. Étapes de livraison

1. Migration DB : `transcript_ai_prompts`, `transcript_generations`, seed `app_settings.supertilt_content_tags`
2. UI Paramètres : section "Prompts IA Transcripts" + tags éditables
3. Edge function `generate-transcript-content` (config.toml `verify_jwt = true`)
4. UI Transcripts : tabs + génération + envoi newsletter
5. Hook `useTranscriptGenerations(transcriptId)`
6. Vérifications : lint, build, test manuel d'une génération

---

## Détails techniques

- **Modèle** : `claude-sonnet-4-6` (constante existante `CLAUDE_ADVANCED` dans `_shared/claude-models.ts`)
- **Secret** : `ANTHROPIC_API_KEY` (déjà configuré, utilisé par AI Arena)
- **Réutilisation** : helper d'appel Anthropic existant (cf. fonctions Arena), pattern `useAutoSaveForm`, `useEdgeFunction`
- **Sécurité** : RLS admin sur `transcript_ai_prompts` ; `transcript_generations` accessible aux users ayant le module `transcripts`
- **Note** : tu n'as pas (encore) collé les prompts Zapier dans la réponse — pas bloquant, on **seed** la table avec des prompts initiaux que tu pourras remplacer en 30 secondes via la nouvelle UI Paramètres dès que tu les retrouves.

---

## Questions ouvertes (non bloquantes)

- Veux-tu un **3e onglet "Résumé enrichi"** (au-delà du résumé brut déjà stocké), ou le résumé existant suffit ? Résumé brut suffit
- Pour le post LinkedIn : on ajoute aussi un bouton "Envoyer vers le board Contenus" (kanban) pour planification ? Sinon copier-coller manuel. ==> oui ajouter envoyer vers le board "contenus"

À lancer ?