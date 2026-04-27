/**
 * Claude Model Constants — Edge Functions
 *
 * Centralise les identifiants de modèles Claude utilisés côté serveur.
 * Pour migrer toute la flotte vers une nouvelle version, modifier ces constantes
 * et tous les appels en hériteront.
 *
 * Stratégie :
 * - CLAUDE_DEFAULT (Haiku) : usage massif, faible coût, latence faible.
 *   Convient pour génération JSON structurée, assistants métier simples,
 *   templates Arena, titres, classifications.
 * - CLAUDE_ADVANCED (Sonnet) : tool use complexe, conversation longue,
 *   raisonnement multi-étapes. Réservé aux cas où la qualité prime.
 */

export const CLAUDE_DEFAULT = "claude-haiku-4-5-20251001";
export const CLAUDE_ADVANCED = "claude-sonnet-4-5-20250929";
