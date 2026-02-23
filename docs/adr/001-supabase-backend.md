# ADR-001 : Supabase comme backend unique

**Date :** 2024
**Statut :** Accepté

## Contexte

L'application super-tools nécessite un backend avec authentification, base de données, stockage de fichiers, edge functions (serverless), et temps réel.

## Décision

Utiliser Supabase comme backend unique (BaaS), comprenant :
- **PostgreSQL** via `supabase-js` (requêtes directes depuis le client)
- **Auth** intégrée (email/password, sessions JWT, RLS)
- **Storage** pour fichiers (conventions PDF, médias, pièces jointes CRM)
- **Edge Functions** (Deno) pour la logique serveur (67 fonctions)
- **Realtime** pour les mises à jour en temps réel

## Conséquences

- **Positif :** Pas d'API REST custom à maintenir, déploiement rapide, RLS pour la sécurité
- **Négatif :** Couplage fort au vendor, requêtes SQL complexes limitées côté client, typage `as any` nécessaire pour les tables non générées
- **Mitigé par :** Couche `domain/repositories/` (P1) qui abstrait Supabase derrière des interfaces
