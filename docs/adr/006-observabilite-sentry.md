# ADR-006 : Sentry pour l'observabilité frontend

**Date :** 2026-02 (P1)
**Statut :** Accepté

## Contexte

Aucun système de monitoring des erreurs en production. Les erreurs JavaScript étaient silencieuses et non détectées.

## Décision

Intégrer `@sentry/react` avec :
- Initialisation conditionnelle dans `main.tsx` (uniquement si `VITE_SENTRY_DSN` est défini)
- Capture automatique des erreurs non catchées
- Rapport d'erreur explicite dans `PageErrorBoundary` (error boundary global)

## Conséquences

- **Positif :** Visibilité sur les erreurs production, stack traces, contexte utilisateur
- **Négatif :** SDK ajouté au bundle (~15 Ko gzipped), données sensibles potentielles dans les rapports
- **Configuration :** DSN via variable d'environnement, pas de tracking en développement
