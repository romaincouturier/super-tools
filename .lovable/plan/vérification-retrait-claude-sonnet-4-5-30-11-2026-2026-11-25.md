# Vérification retrait Claude Sonnet 4.5 (30/11/2026)

Verdict : non concerné. Aucune modification nécessaire.

## Contrôlé
1. Code (src/, supabase/functions/, supabase/migrations/, scripts/, .github/) : aucune occurrence de sonnet-4-5 / sonnet-4.5 / claude-sonnet-4-5-20250929. Seul « 4-5 » trouvé : claude-haiku-4-5-20251001 (modèle par défaut, non concerné).
2. Colonnes « model » en base : api_usage_events.model, transcript_ai_prompts.model, transcript_generations.model, editorial_recommendations.model, tender_documents.ai_analysis_model, tender_opportunities.ai_summary_model, plus app_settings (valeurs). Aucune ligne Sonnet 4.5.
3. Secrets : seul ANTHROPIC_API_KEY (clé), aucun secret fixant un modèle.
4. Modèles utilisés (api_usage_events) : claude-haiku-4-5-20251001 (dernier appel 24/11), claude-sonnet-5-5 (23/11), historiques claude-sonnet-4-6 (07/10) et claude-sonnet-5 (30/09). Aucun n'est visé par ce retrait ; leur support après le 30/11 n'a pas été vérifié auprès d'Anthropic.
