-- Accorder l'exécution de toutes les fonctions du portail apprenant
-- aux rôles anon et authenticated (requis pour Supabase RPC depuis le client)
GRANT EXECUTE ON FUNCTION public.get_learner_portal_data(text)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_learner_token(text)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_learner_token(text)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_learner_token(text)    TO anon, authenticated;
