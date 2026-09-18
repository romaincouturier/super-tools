/**
 * Client Supabase mémoïsé pour l'espace apprenant.
 *
 * Chaque instanciation de client démarre son propre timer d'auto-refresh sur
 * /token : créer un client par requête faisait exploser le quota (429
 * over_request_rate_limit). On garde donc un seul client par email, sans
 * session persistée ni refresh automatique — l'identité apprenante passe
 * uniquement par l'en-tête x-learner-email lu par les policies RLS.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type LearnerClient = ReturnType<typeof createClient<Database>>;

const cache = new Map<string, LearnerClient>();

export function createLearnerClient(learnerEmail: string): LearnerClient {
  const key = (learnerEmail || "").toLowerCase();
  const existing = cache.get(key);
  if (existing) return existing;

  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: { "x-learner-email": learnerEmail },
    },
  });
  cache.set(key, client);
  return client;
}
