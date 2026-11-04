# Existant dans SuperTools

Relevé sur `main` le 3 novembre 2026.

## Module d'accueil

- Groupe de menu supertilt.fr, sous-modules : Newsletter (`/supertilt-fr/newsletter`), Transcripts, Témoignages, Projets. Il est déclaré dans `src/components/AppSidebar.tsx` et `src/components/moduleIcons.ts`.
- Droit d'accès `supertilt_fr`, enum `app_module`. Les sous-items déclarent `module: "supertilt_fr"`.

## Kanban newsletter

- Les cartes sont dans `content_cards` et les colonnes dans `content_columns`. Le champ `card_type` vaut `article`, `post` ou `post_linkedin`.
- Le 3 novembre : 95 cartes, dont 6 posts (`post` : 4 en « Diffusion Terminée » ; `post_linkedin` : 1 en « Diffusion Terminée », 1 en « Idées »).
- Les colonnes de relecture portent les noms de Romain et Manue, qui est Emmanuelle. Il n'existe aucun circuit de validation formel.
- Écrans : `src/pages/ContentBoard.tsx` et `src/components/content/` (`KanbanBoard`, `ContentCardDialog`, `NewsletterSection`, `ReviewRequestDialog`).

## Connecteur MCP

- Serveur : `supabase/functions/mcp-server/index.ts`. Outils de contenu existants : `get_content_card`, `create_content_card`, `add_content_card`, `list_content_board`, `list_newsletters`, `prepare_newsletter`, `get_editorial_brief`, `get_content_performance`.
- CAP-13 étend ce serveur. Il n'en crée pas un second.
- Le serveur est mono-utilisateur : chaque requête est liée à `ALLOWED_EMAIL` (`romain@supertilt.fr`), avec la clé service role. L'identité des actions MCP est donc toujours Romain.

## Briques réutilisables

- Médiathèque : module Médias.
- Intégration Google Agenda : OAuth, `GoogleCalendarCallback`.
- Modules Événements et Formations : sessions datées.
- Actions quotidiennes : `generate-daily-actions`, la voie existante pour notifier un approbateur.
- Moteur éditorial : `docs/moteur-editorial.md`, recommandations issues des transcripts.

## Règles du dépôt qui s'appliquent

- Flux de données : page, puis hook (`src/hooks/`), puis service (`src/services/`), puis Supabase. Aucun `supabase.from()` dans un composant UI.
- RLS sur chaque nouvelle table, conditionnée au droit `supertilt_fr`.
- Pour lister les collaborateurs (approbateurs, mentions) : RPC `get_staff_directory`, jamais `profiles` en direct (règle [076]).
- Auto-save : `useAutoSaveForm`. Mode démo : masques de `src/lib/demoMask.ts`.
- Une migration de `supabase/migrations/` n'est pas appliquée par le push : elle se joue explicitement en production.
