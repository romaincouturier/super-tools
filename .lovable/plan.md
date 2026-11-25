# Retrait de Claude Sonnet 4.5 : non concerné

Vérification uniquement, aucune modification prévue.

- Code (`src/`, `supabase/functions/`, `scripts/`, `.github/`, migrations) : aucune occurrence de `claude-sonnet-4-5`, de variante datée ou d'alias (recontrôlé le 25/11).
- Base : zéro occurrence (contrôle précédent sur ~1 500 colonnes). Colonnes modèle : `api_usage_events.model`, `transcript_ai_prompts.model`, `transcript_generations.model`, `editorial_recommendations.model`, `tender_documents.ai_analysis_model`, `tender_opportunities.ai_summary_model`.
- Secrets : aucun ne fixe de modèle ; `ANTHROPIC_API_KEY` sert seulement à l'accès.
- Modèles utilisés : `claude-haiku-4-5-20251001`, `claude-sonnet-5-5`, `claude-sonnet-5` (workflow), `claude-sonnet-4-6` (historique). Aucun retrait annoncé au 30/11.

Rien à construire : approuver ou ignorer ce plan ne change rien.
