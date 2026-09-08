/**
 * Claude Model Constants — Frontend
 *
 * Centralise les identifiants de modèles Claude utilisés côté client (Arena
 * templates, hooks, store). Doit rester aligné avec
 * `supabase/functions/_shared/claude-models.ts` — le check [057] le vérifie,
 * après une dérive silencieuse où ce fichier est resté sur Sonnet 4.6 pendant
 * que le serveur passait à Sonnet 5.
 */

export const CLAUDE_DEFAULT = "claude-haiku-4-5-20251001";
export const CLAUDE_ADVANCED = "claude-sonnet-5";
